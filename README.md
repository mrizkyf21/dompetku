# Dompetku

Aplikasi pencatat keuangan pribadi berbentuk PWA (Progressive Web App). Bisa dipasang di layar utama HP Android maupun iPhone, dan tetap berjalan tanpa internet.

## Fitur

- Catat pemasukan dan pengeluaran dengan kategori, tanggal, dan catatan
- Ringkasan saldo per bulan dan saldo total
- Laporan persentase per kategori
- Ekspor ke CSV (bisa dibuka di Excel) serta cadangkan/pulihkan data (JSON)
- Mode gelap otomatis mengikuti pengaturan HP
- Data tersimpan di perangkat (localStorage), tidak dikirim ke server mana pun

## Menjalankan di komputer

```bash
python3 -m http.server 8000
```

Buka http://localhost:8000 di browser.

## Memasang di HP

Agar bisa dipasang, aplikasi harus dibuka lewat **HTTPS**. Cara termudah dan gratis:

### Opsi A: Netlify Drop (tanpa akun Git)
1. Buka https://app.netlify.com/drop
2. Seret folder proyek ini ke halaman tersebut
3. Buka alamat `https://....netlify.app` yang diberikan di HP

### Opsi B: GitHub Pages
1. Unggah folder ini ke repository GitHub
2. Settings → Pages → Source: branch `main`, folder `/ (root)`
3. Buka `https://<username>.github.io/<nama-repo>/` di HP

### Lalu di HP
- **Android (Chrome):** menu ⋮ → *Instal aplikasi* / *Tambahkan ke layar utama*
- **iPhone (Safari):** tombol Bagikan → *Tambah ke Layar Utama*

## Memperbarui aplikasi

Setelah mengubah file, naikkan versi `CACHE` di [sw.js](sw.js) (misalnya `dompetku-v2`) agar HP mengunduh versi terbaru.

## Ikon

Ikon dibuat dengan `python3 tools/make_icons.py` (butuh Pillow).
