# Daftar Fitur PPOB Mobile Site

## Frontend (Pengguna)

| Fitur | Keterangan |
|-------|------------|
| Pendaftaran | Email + Username (+ rekening untuk refund) |
| Login | Email/Username, **Google Account**, **Akun Demo** (1-klik) |
| Google Quick Login/Register | Google Identity Services; auto-register jika belum ada |
| Akun Demo | Tombol di modal login → isi & masuk langsung sebagai `demo` |
| Kategori Produk | Prabayar & Pascabayar (filter tab) |
| Pembelian | Pilih produk → nomor tujuan → metode bayar → Agreement → proses |
| Auto Switching | Backend otomatis pilih provider terbaik + fallback |
| Cetak Struk | Tombol setelah transaksi & di Riwayat → HTML siap print |
| Riwayat Transaksi | Daftar transaksi user + tombol cetak struk |
| FAQ | Dinamis dari backend |
| T&C & Agreement | Wajib disetujui saat daftar & beli |
| PWA | Install ke home screen, offline shell |
| Responsive | Optimal tablet & smartphone |

## Backend / Admin

| Fitur | Keterangan |
|-------|------------|
| CRUD Produk | Nama, SKU, kategori, harga, fee, aktif/nonaktif, provider API |
| CRUD FAQ | Pertanyaan, jawaban, urutan, aktif |
| OPEN API Settings | Digiflazz, IAK, Raja-Biller, bdPay, Midtrans, DOKU, Xendit |
| Prioritas Switching | Urutan provider PPOB & Payment |
| Biaya Layanan | Global % + fixed; siap per-produk |
| CMS & SEO | Nama site, copyright, hero, title, description, keywords |
| T&C / Agreement | Edit teks legal (hukum Indonesia) |
| Transaksi | Lihat semua, cetak struk, trigger refund |
| Laporan Penjualan | Filter tanggal, group by hari/bulan/produk/provider |
| Callback Verification | Signature check Digiflazz, Midtrans, bdPay, IAK |
| Enkripsi at-rest | AES-256-GCM untuk users, transactions, settings |
| Pengembalian Dana | Otomatis flag + manual proses ke rekening user |

## Integrasi (Struktur Siap Production)

**PPOB:** Digiflazz (prioritas) → IAK → Raja-Biller  
**Payment:** bdPay (prioritas) → Midtrans → DOKU → Xendit  
Metode: Virtual Account, QRIS, E-Wallet
