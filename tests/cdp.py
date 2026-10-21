"""Klien Chrome DevTools minimal (tanpa pustaka luar).

Pemakaian: python3 cdp.py "<ekspresi JavaScript>"
Port dan halaman tujuan diatur lewat env CDP_PORT (bawaan 9333 = emulator)
dan CDP_PAGE (awalan URL halaman, bawaan http://localhost:8000).
"""
import base64
import json
import os
import socket
import struct
import sys
import urllib.request

PORT = int(os.environ.get("CDP_PORT", 9333))
PAGE_PREFIX = os.environ.get("CDP_PAGE", "http://localhost:8000")


def page_ws_path():
    pages = json.load(urllib.request.urlopen(f"http://localhost:{PORT}/json"))
    page = next(p for p in pages if p["type"] == "page" and p["url"].startswith(PAGE_PREFIX))
    return page["webSocketDebuggerUrl"].split(f":{PORT}", 1)[1]


def connect(path):
    s = socket.create_connection(("localhost", PORT))
    key = base64.b64encode(os.urandom(16)).decode()
    s.sendall((f"GET {path} HTTP/1.1\r\nHost: localhost:{PORT}\r\nUpgrade: websocket\r\n"
               f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
    resp = b""
    while b"\r\n\r\n" not in resp:
        resp += s.recv(1)
    if b" 101 " not in resp.split(b"\r\n")[0]:
        raise SystemExit(resp.decode(errors="replace"))
    return s


def send(s, text):
    data = text.encode()
    header = bytearray([0x81])
    n = len(data)
    if n < 126:
        header.append(0x80 | n)
    elif n < 65536:
        header += bytes([0x80 | 126]) + struct.pack(">H", n)
    else:
        header += bytes([0x80 | 127]) + struct.pack(">Q", n)
    mask = os.urandom(4)
    s.sendall(bytes(header) + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))


def recv_exact(s, n):
    buf = b""
    while len(buf) < n:
        chunk = s.recv(n - len(buf))
        if not chunk:
            raise EOFError
        buf += chunk
    return buf


def recv(s):
    _, b2 = recv_exact(s, 2)
    n = b2 & 0x7F
    if n == 126:
        n = struct.unpack(">H", recv_exact(s, 2))[0]
    elif n == 127:
        n = struct.unpack(">Q", recv_exact(s, 8))[0]
    return recv_exact(s, n).decode()


def evaluate(expr):
    s = connect(page_ws_path())
    send(s, json.dumps({"id": 1, "method": "Runtime.evaluate", "params": {
        "expression": expr, "awaitPromise": True, "returnByValue": True, "userGesture": True}}))
    while True:
        msg = json.loads(recv(s))
        if msg.get("id") == 1:
            break
    s.close()
    result = msg.get("result", {})
    if "exceptionDetails" in result:
        return "ERROR: " + json.dumps(result["exceptionDetails"].get("exception", {}).get("description", result["exceptionDetails"]))
    value = result.get("result", {}).get("value")
    return value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    print(evaluate(sys.argv[1]))
