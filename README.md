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

## Aplikasi Android (Android Studio)

Folder `android/` berisi proyek Android Studio yang membungkus aplikasi web ini dalam WebView, sehingga
bisa dijalankan di emulator atau dipasang sebagai APK tanpa perlu hosting HTTPS.

1. Android Studio → **Open** → pilih folder `android/`, tunggu Gradle sync selesai.
2. Pilih emulator/HP, lalu tekan **Run ▶**.

Dari terminal: `cd android && ./gradlew assembleDebug` → APK ada di `android/app/build/outputs/apk/debug/`.

Catatan:
- File web (`index.html`, `app.js`, `style.css`, `manifest.json`, `icons/`) disalin otomatis dari folder
  utama setiap kali build. Cukup ubah file di folder utama, lalu build ulang.
- Yang tidak tersedia di WebView ditangani oleh aplikasi Android (`MainActivity.java`): kamera/galeri untuk
  pindai struk, **Simpan ke HP** (folder Download), **Kirim / Bagikan**, tombol Kembali, dan warna status bar.
- **Kunci aplikasi** (Pengaturan → Keamanan, hanya di aplikasi Android): meminta sidik jari atau PIN/pola layar HP
  saat aplikasi dibuka dan setelah ditinggal lebih dari 1 menit. Mengaktifkan/menonaktifkan juga perlu verifikasi.
  Butuh kunci layar HP; jika kunci layar HP dihapus, kunci aplikasi otomatis mati agar data tidak terkunci.
  Di Android 13+ isi aplikasi juga disembunyikan di daftar aplikasi terbaru.
- Data aplikasi Android terpisah dari data versi web/PWA. Pindahkan lewat file cadangan bila perlu.
- Minimal Android 10.

### Versi release (untuk dipakai sehari-hari)

APK release lebih kecil (sekitar 1 MB), kodenya dipadatkan, dan datanya tidak bisa dibaca lewat kabel USB.
APK ini ditandatangani dengan kunci milik sendiri, yang dibuat **sekali saja**:

1. Buat file kunci di luar folder proyek. Isi kata sandi saat diminta, lalu ketik `yes`:
   ```bash
   mkdir -p ~/kunci-android
   /snap/android-studio/current/jbr/bin/keytool -genkeypair -v -keystore ~/kunci-android/dompetku-release.jks \
     -alias dompetku -keyalg RSA -keysize 4096 -validity 10000
   ```
2. Buat file `android/keystore.properties` (sudah dikecualikan dari git):
   ```properties
   storeFile=/home/NAMA_PENGGUNA/kunci-android/dompetku-release.jks
   storePassword=KATA_SANDI
   keyAlias=dompetku
   keyPassword=KATA_SANDI
   ```
3. Build: `cd android && ./gradlew assembleRelease` → `android/app/build/outputs/apk/release/app-release.apk`.

**Penting:** cadangkan file `.jks` beserta kata sandinya (mis. Google Drive + catatan kata sandi). Tanpa file itu,
aplikasi tidak bisa diperbarui lagi dan harus dihapus-pasang (data hilang jika tidak ada cadangan).
Pindah dari APK debug ke release juga perlu hapus-pasang satu kali: buat cadangan data dulu, lalu pulihkan.

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
