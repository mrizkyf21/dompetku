# Dompetku

Aplikasi pencatat keuangan pribadi berbentuk PWA (Progressive Web App). Bisa dipasang di layar utama HP Android maupun iPhone, dan tetap berjalan tanpa internet.

## Fitur

- Catat pemasukan dan pengeluaran dengan kategori, tanggal, dan catatan
- Ringkasan saldo per bulan dan saldo total
- Laporan: pemasukan, pengeluaran, dan investasi bulan ini; grafik donat "ke mana pemasukan pergi"
  (pengeluaran / investasi / sisa, dengan peringatan defisit); serta rincian per kategori
- Kategori pengeluaran bisa ditandai sebagai **investasi/tabungan** (bawaan: "Investasi & Tabungan")
- **Asisten keuangan (chat Gemini):** diskusi dan minta pendapat tentang kondisi keuangan. Yang dikirim
  hanya ringkasan angka 6 bulan terakhir (tanpa catatan transaksi); percakapan disimpan di perangkat
- Atur kategori sendiri: tambah, ubah nama/ikon, urutkan, dan hapus (transaksinya dipindah ke kategori pengganti)
- Ekspor laporan CSV (bisa dibuka di Excel) dan cadangkan data, masing-masing bisa:
  - **Kirim / Bagikan** lewat menu Share HP (Gmail, Google Drive, WhatsApp, dll.)
  - **Simpan ke HP** di folder Download
- Pulihkan data dari file cadangan (`.json` atau `.txt`, termasuk cadangan versi lama)
- **Pindai struk (AI):** foto struk belanja, lalu Google Gemini membaca toko, tanggal, total, dan daftar
  barang serta memilih kategori yang cocok. Hasilnya ditampilkan untuk diperiksa sebelum disimpan
- **Tampilan bisa diatur sendiri** (Pengaturan → Tampilan), langsung berlaku dan tersimpan otomatis:
  - Tema: ikuti HP / terang / gelap
  - Warna aksen: 7 pilihan siap pakai atau warna bebas; warna teks disesuaikan otomatis agar tetap terbaca
  - Ukuran teks: kecil / normal / besar / sangat besar
  - Kepadatan: lega / ringkas
  - Bentuk sudut: membulat / tegas

## Pindai struk dengan Gemini (gratis)

1. Buat API key gratis di https://aistudio.google.com/apikey (login akun Google).
2. Di aplikasi: **Pengaturan → Pindai struk (AI)**, tempel API key, ketuk **Simpan** lalu **Tes koneksi**.
3. Di Beranda, ketuk tombol **📷**, ambil foto struk atau pilih dari galeri.

Catatan:
- Butuh internet saat memindai. Foto diperkecil (maks. 2000 px) sebelum dikirim.
- Pada paket gratis Gemini, Google dapat memakai konten yang dikirim untuk meningkatkan layanannya.
- API key hanya disimpan di perangkat dan tidak ikut dalam file cadangan.
- Model bisa diganti di Pengaturan jika model bawaan tidak tersedia untuk API key Anda.
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

## Uji otomatis

Jalankan sebelum setiap commit (butuh Python 3 dan Google Chrome):

```bash
bash tests/run.sh
```

Penjelasan lengkap ada di [tests/README.md](tests/README.md).

## Ikon

Ikon dibuat dengan `python3 tools/make_icons.py` (butuh Pillow).
