#!/bin/bash
# Menjalankan uji otomatis Dompetku di Chrome headless.
#
#   bash tests/run.sh                    # semua uji
#   bash tests/run.sh look.test.html     # uji tertentu
#
# Uji berjalan di http://localhost:8766 dengan profil Chrome sementara, sehingga data aplikasi
# yang dipakai sehari-hari (di alamat lain) tidak tersentuh. Keluar dengan kode 1 jika ada yang gagal.

set -u
TESTS_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$TESTS_DIR")"
PORT=8766
CDP_PORT=9444
TIMEOUT=90

CHROME=$(command -v google-chrome || command -v chromium || command -v chromium-browser)
if [ -z "$CHROME" ]; then
  echo "Chrome/Chromium tidak ditemukan." >&2
  exit 2
fi
if curl -s -o /dev/null "http://localhost:$PORT/"; then
  echo "Port $PORT sedang dipakai program lain. Hentikan dulu program tersebut." >&2
  exit 2
fi

if [ $# -gt 0 ]; then
  FILES=("$@")
else
  FILES=($(cd "$TESTS_DIR" && ls *.test.html))
fi

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1

TOTAL_PASS=0
TOTAL_FAIL=0
for name in "${FILES[@]}"; do
  PROFILE=$(mktemp -d -t dompetku-test.XXXXXX)
  "$CHROME" --headless=new --disable-gpu --no-sandbox --user-data-dir="$PROFILE" \
    --remote-debugging-port="$CDP_PORT" "http://localhost:$PORT/tests/$name" >/dev/null 2>&1 &
  BROWSER=$!

  OUT=""
  for _ in $(seq 1 "$TIMEOUT"); do
    sleep 1
    OUT=$(CDP_PORT=$CDP_PORT CDP_PAGE="http://localhost:$PORT/tests/$name" \
      python3 -I "$TESTS_DIR/cdp.py" 'document.getElementById("out").textContent' 2>/dev/null)
    case "$OUT" in *SELESAI*|*ERROR*) break ;; esac
  done
  # Hentikan semua proses Chrome uji ini (termasuk proses anak) sebelum menghapus profilnya
  pkill -f -- "--user-data-dir=$PROFILE" 2>/dev/null
  wait "$BROWSER" 2>/dev/null
  for _ in 1 2 3 4 5; do
    rm -rf "$PROFILE" 2>/dev/null && break
    sleep 1
  done

  pass=$(grep -c '^PASS' <<<"$OUT")
  fail=$(grep -c '^FAIL' <<<"$OUT")
  if ! grep -q 'SELESAI' <<<"$OUT"; then
    fail=$((fail + 1))
    echo "✗ $name: tidak selesai (macet atau error)"
    grep -E '^ERROR' -A3 <<<"$OUT"
  fi
  TOTAL_PASS=$((TOTAL_PASS + pass))
  TOTAL_FAIL=$((TOTAL_FAIL + fail))
  if [ "$fail" -eq 0 ]; then
    echo "✓ $name: $pass lolos"
  else
    echo "✗ $name: $pass lolos, $fail gagal"
    grep -E '^FAIL' <<<"$OUT" | sed 's/^/    /'
  fi
done

echo "----"
echo "Total: $TOTAL_PASS lolos, $TOTAL_FAIL gagal"
[ "$TOTAL_FAIL" -eq 0 ]
