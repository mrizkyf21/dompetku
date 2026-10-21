# Uji otomatis

Uji berjalan di Chrome headless dan tidak butuh Node.js. Gemini **tidak** benar-benar dipanggil:
jawabannya ditiru, jadi uji tidak memakai kuota dan tidak butuh API key.

```bash
bash tests/run.sh                     # semua uji
bash tests/run.sh bugs.test.html      # satu file uji
```

Kebutuhan: Python 3 dan Google Chrome/Chromium.

| File | Yang diuji |
|---|---|
| `scan.test.html` | Pindai struk: permintaan ke Gemini, pengisian form, foto besar, pembatalan, semua jenis error |
| `report-chat.test.html` | Kategori investasi, laporan & grafik donat, asisten keuangan (privasi, riwayat, kirim ulang) |
| `look.test.html` | Pengaturan tampilan: tema, warna aksen & kontras, ukuran teks, kepadatan, sudut |
| `bugs.test.html` | Bug yang pernah ditemukan, agar tidak muncul lagi |

Lain-lain:
- `run.sh` menyajikan proyek di `http://localhost:8766` dengan profil Chrome sementara, lalu membaca
  hasil lewat DevTools (`cdp.py`). Data aplikasi yang dipakai sehari-hari tidak tersentuh.
- `fixtures/` berisi contoh foto struk, dibuat dengan `python3 tests/make_receipt.py <file> [skala]`
  (butuh Pillow).
- Uji baru: salin pola salah satu `*.test.html`; tulis hasil ke `<pre id="out">` dengan baris
  `PASS ...` / `FAIL ...` dan akhiri dengan `SELESAI`.
