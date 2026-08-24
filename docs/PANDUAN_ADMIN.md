# Panduan Admin

## Login Admin

1. Buka `/admin/`
2. Default: **username** `admin` · **password** `admin123`
3. Segera ganti password di Settings atau edit `data/settings.json` → `admin`

---

## Menu Admin

### Dashboard
Ringkasan: jumlah produk, pengguna, transaksi, FAQ.

### Produk
- Tambah / Edit / Hapus produk
- Atur kategori: **Prabayar** atau **Pascabayar**
- Harga, admin fee, SKU, provider API
- Aktif / Nonaktifkan produk (produk nonaktif tidak tampil di frontend)

### FAQ
CRUD pertanyaan & jawaban + urutan tampil.

### API & Settings
- Prioritas PPOB & Payment (comma-separated)
- Kredensial Digiflazz, IAK, bdPay, Midtrans, dll
- Centang aktif untuk mengaktifkan provider
- Lihat `docs/OPEN_API_SETTING.md` untuk detail

### Biaya Layanan
- Global persentase (%)
- Global fixed (Rp)
- Diterapkan otomatis saat order

### CMS & SEO
- Nama situs, copyright
- Title, description, keywords (SEO)
- Hero title & subtitle halaman utama

### T&C / Agreement
- Teks Syarat & Ketentuan saat pendaftaran
- Teks Agreement saat pembelian
- Sudah disusun mengacu hukum Indonesia; sesuaikan dengan legal Anda

### Transaksi
- Daftar semua transaksi
- Tombol **Struk** → buka HTML cetak
- Tombol **Refund** untuk transaksi gagal (simulasi ke rekening user)
- Indikator jika terjadi switching provider

### Laporan Penjualan
1. Pilih tanggal Dari – Sampai
2. Group by: Hari / Bulan / Produk / Provider
3. Klik **Tampilkan**
4. Lihat ringkasan (total, sukses, gagal, success rate, pendapatan, fee) + tabel detail

### Pengguna
Daftar user terdaftar (email, username, rekening).

---

## Tips

- Setelah ubah API key, uji 1 transaksi sandbox dulu
- Backup folder `data/` sebelum perubahan besar
- File `.encryption-key` wajib di-backup terpisah
- Untuk Google Login production: isi `client_id` di settings
