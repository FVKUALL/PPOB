# Panduan Lengkap PPOB Mobile Site

## 1. Alur Pengguna (Frontend)

1. Pengunjung membuka site → melihat produk aktif (Prabayar / Pascabayar).
2. Klik **Daftar** → isi Email + Username + (opsional) data rekening untuk refund → centang T&C → Submit.
3. Data tersimpan di `data/users.json`. Session disimpan di LocalStorage browser.
4. Login dengan email atau username.
5. Pilih produk → isi nomor tujuan → pilih metode bayar → centang Agreement → Proses.
6. Backend memilih provider PPOB & Payment sesuai prioritas aktif → simpan transaksi → kembalikan status (simulasi).
7. Jika gagal → status refund pending ke rekening yang terdaftar.

## 2. Alur Admin

1. Buka `/admin/`
2. Login (default admin/admin123)
3. Dashboard menampilkan ringkasan.
4. **Produk**: Tambah/Edit/Hapus, ubah kategori, aktif/nonaktif, harga, admin fee.
5. **FAQ**: CRUD lengkap + urutan tampil.
6. **API & Settings**: Isi kredensial Digiflazz/IAK/bdPay/Midtrans dll + prioritas switching.
7. **Biaya Layanan**: Global % dan/atau fixed.
8. **CMS & SEO**: Nama site, copyright, title, description, keywords, hero text.
9. **T&C / Agreement**: Edit teks legal.
10. **Transaksi**: Lihat semua + trigger refund manual.
11. **Pengguna**: Daftar user terdaftar.

## 3. Automatic Switching

Di `settings.json` (atau Admin):

```json
"api_ppob": {
  "priority": ["digiflazz", "iak", "raja-biller"],
  ...
}
```

Hanya provider yang `"active": true` yang dipertimbangkan. Sistem mengambil yang pertama di list prioritas.

Sama untuk payment gateway.

## 4. Biaya Layanan

- Global percent + global fixed selalu dihitung.
- Bisa ditambah `admin_fee` per produk.
- Field `per_product` di settings tersedia untuk override lebih lanjut (edit JSON manual atau kembangkan form).

## 5. Pengembalian Dana

- Saat order gagal, sistem mencatat `refund_to` dari data rekening user.
- Admin dapat menekan tombol **Refund** di daftar transaksi (simulasi).
- Production: integrasikan dengan API disbursement bdPay / Midtrans / Xendit.

## 6. File JSON yang Penting

| File | Isi |
|------|-----|
| users.json | Daftar pengguna |
| products.json | Katalog produk + kategori + status aktif |
| faqs.json | FAQ |
| settings.json | Semua konfigurasi (API, fee, T&C, SEO, admin password, copyright) |
| transactions.json | Riwayat transaksi |
| cms.json | Konten halaman & menu |

Backup folder `data/` secara berkala.

## 7. Menambah Provider Baru

1. Tambah object di `settings.json` → `api_ppob` atau `api_payment`.
2. Tambah ke array `priority`.
3. Implementasikan pemanggilan API di `server.js` (fungsi order) mengikuti dokumentasi resmi.
4. Update form Admin jika ingin UI setting-nya.

## 8. Production Checklist

- [ ] Ganti password admin
- [ ] Isi API key production
- [ ] Ubah mode ke production + base_url benar
- [ ] Deploy di HTTPS
- [ ] Set callback URL di dashboard provider (Digiflazz, bdPay, dll)
- [ ] Implement signature & verifikasi webhook
- [ ] Rate limiting & logging
- [ ] Backup otomatis folder data/
- [ ] Review T&C dengan legal
- [ ] Ganti icon & logo di assets/
- [ ] Test di berbagai ukuran tablet & HP

## 9. Troubleshooting

**Port sudah dipakai**  
Ubah `PORT` di environment atau di `server.js`.

**JSON corrupt**  
Restore dari backup. Sistem akan mengembalikan array/object kosong jika parse gagal.

**Admin tidak bisa login**  
Cek `data/settings.json` → `admin.username` & `admin.password`.

**Produk tidak muncul**  
Pastikan `"active": true` di products.json.

---

Dokumen ini melengkapi README.md. 
Semua fitur yang diminta sudah diimplementasikan dalam bentuk yang siap dikembangkan lebih lanjut.

## 10. Enkripsi Data JSON (AES-256-GCM)

File sensitif (`users.json`, `transactions.json`, `settings.json`) dienkripsi at-rest:

- Format: `ENC:<iv_hex>:<authTag_hex>:<ciphertext_hex>`
- Key disimpan di `.encryption-key` (otomatis generate saat pertama kali jalan) atau env `ENCRYPTION_KEY` (hex 64 karakter)
- **PENTING**: Backup file `.encryption-key`. Jika hilang, data tidak bisa didekripsi.
- Migrasi otomatis: file plain JSON akan dienkripsi saat server start.

## 11. Automatic Switching Logic

1. Urutan prioritas diambil dari `settings.api_ppob.priority` / `api_payment.priority`.
2. Hanya provider dengan `active: true` yang dicoba.
3. Jika produk punya `provider_api` spesifik, dicoba lebih dulu.
4. Jika satu provider gagal (timeout / error / response gagal), sistem otomatis mencoba berikutnya.
5. Response menyertakan `provider_ppob_tried` untuk audit.

## 12. Callback Verification

Endpoint callback:

| Provider   | URL                          |
|------------|------------------------------|
| Digiflazz  | POST /api/callback/digiflazz |
| IAK        | POST /api/callback/iak       |
| bdPay      | POST /api/callback/bdpay     |
| Midtrans   | POST /api/callback/midtrans  |

Verifikasi:
- Digiflazz: HMAC-SHA256 (jika signature + api_key tersedia)
- Midtrans: SHA512(order_id + status_code + gross_amount + server_key)
- bdPay / IAK: validasi struktur + (production) signature sesuai docs

Set URL callback ini di dashboard masing-masing provider.

## 13. Cetak Struk

- Frontend: tombol "Cetak Struk" setelah transaksi & di Riwayat
- Backend: `GET /api/receipt/:ref_id?format=html` → HTML siap `window.print()`
- Juga tersedia JSON: `GET /api/receipt/:ref_id`

## 14. Laporan Penjualan

Admin → **Laporan Penjualan**

- Filter: tanggal dari–sampai
- Group by: hari / bulan / produk / provider
- Ringkasan: total transaksi, sukses, gagal, success rate, pendapatan, fee
