# Checklist Go-Live

## A. Persiapan Teknis

- [ ] Server Node.js 18+ (VPS / Cloud / PaaS)
- [ ] Domain + HTTPS (Let's Encrypt / Cloudflare)
- [ ] `npm install --production` & proses manager (PM2)
- [ ] Environment:
  ```bash
  export PORT=3000
  export ENCRYPTION_KEY=<hex-64-char-dari-.encryption-key>
  ```
- [ ] Backup otomatis folder `data/` + file `.encryption-key`
- [ ] Firewall: buka 80/443; batasi admin jika perlu

## B. Keamanan

- [ ] Ganti password admin default (`admin` / `admin123`)
- [ ] Pastikan `.encryption-key` tidak ikut ter-commit / ter-upload publik
- [ ] HTTPS wajib (callback provider & Google OAuth membutuhkan HTTPS)
- [ ] Rate limiting (disarankan tambah `express-rate-limit`)
- [ ] Jangan expose file JSON mentah ke public

## C. Provider PPOB

- [ ] Akun Digiflazz / IAK production aktif + deposit
- [ ] API key production diisi di Admin → Settings
- [ ] Callback URL terdaftar di dashboard provider
- [ ] Test 1 transaksi sukses & 1 gagal (cek refund flag)

## D. Payment Gateway

- [ ] Akun bdPay / Midtrans production + KYC selesai
- [ ] Kredensial production diisi
- [ ] Callback / notification URL terdaftar
- [ ] Test VA, QRIS, e-wallet di sandbox lalu production kecil

## E. Google Login

- [ ] OAuth Client ID production
- [ ] Authorized origins = domain production (HTTPS)
- [ ] `settings.google.client_id` terisi
- [ ] Test login & auto-register Google

## F. Konten & Legal

- [ ] Review T&C & Agreement dengan penasihat hukum
- [ ] Copyright, nama company, SEO sudah benar
- [ ] Logo & icon diganti (assets/)
- [ ] FAQ relevan untuk bisnis Anda

## G. Operasional

- [ ] Monitoring log (callback, error)
- [ ] Prosedur refund manual (Admin → Transaksi)
- [ ] Laporan penjualan dicek berkala
- [ ] Backup harian `data/` + encryption key

## H. PM2 Contoh

```bash
npm install -g pm2
pm2 start server.js --name ppob-mobile
pm2 save
pm2 startup
```

## I. Setelah Live

1. Lakukan transaksi uji kecil
2. Verifikasi callback masuk & status update
3. Cetak struk
4. Cek laporan penjualan
5. Monitor 24–48 jam pertama
