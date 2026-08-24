# Panduan OPEN API Setting

Masuk **Admin → API & Settings**.

## 1. PPOB Providers

### Prioritas
Isi urutan dipisah koma, contoh:
```
digiflazz,iak,raja-biller
```
Sistem akan mencoba dari kiri ke kanan. Yang `active = false` dilewati.

### Digiflazz (Prioritas)
1. Daftar di https://digiflazz.com
2. Ambil **Username** & **API Key** (Development / Production)
3. Isi di form Admin, centang **Aktifkan Digiflazz**
4. Set Callback URL di dashboard Digiflazz:
   ```
   https://domain-anda.com/api/callback/digiflazz
   ```
5. Signature: sistem mendukung HMAC-SHA256 jika field `signature` dikirim

### IAK
1. Daftar di https://iak.id / developer.iak.id
2. Ambil API Key Sandbox & Production
3. Base URL:
   - Prepaid sandbox: `https://prepaid.iak.dev`
   - Prepaid production: `https://prepaid.iak.id`
4. Callback: `https://domain-anda.com/api/callback/iak`

### Raja-Biller
Isi username, API key, base URL sesuai dokumentasi provider. Aktifkan jika digunakan.

---

## 2. Payment Gateways

### Prioritas
```
bdpay,midtrans,doku,xendit
```

### bdPay (Prioritas)
1. Daftar di https://bdpay.co.id
2. Ambil Merchant Code & API Key
3. Sandbox: `https://dev-openapi.bdpay.co.id`
4. Production: `https://openapi.bdpay.co.id`
5. Callback: `https://domain-anda.com/api/callback/bdpay`
6. Metode: VA (BCA, BRI, Mandiri, dll), QRIS, Retail

### Midtrans
1. Dashboard Midtrans → Settings → Access Keys
2. Server Key + Client Key (Sandbox / Production)
3. Notification URL: `https://domain-anda.com/api/callback/midtrans`
4. Verifikasi signature: SHA512(order_id + status_code + gross_amount + server_key)

### DOKU / Xendit
Isi kredensial sesuai dokumentasi resmi, aktifkan, dan set callback URL ke endpoint yang sesuai (dapat ditambahkan di `server.js`).

---

## 3. Google Login

Di `settings.json` → `google`:

```json
"google": {
  "client_id": "xxxxx.apps.googleusercontent.com",
  "enabled": true
}
```

Cara mendapatkan Client ID:
1. Buka https://console.cloud.google.com
2. Buat project → APIs & Services → Credentials
3. Create OAuth 2.0 Client ID (Web application)
4. Authorized JavaScript origins: `https://domain-anda.com` dan `http://localhost:3000`
5. Authorized redirect URIs: sama
6. Copy Client ID ke Admin Settings (atau edit JSON)

Jika `client_id` kosong → tombol Google tampil dalam **mode Demo** (simulasi login Google tanpa akun nyata).

---

## 4. Mode Sandbox vs Production

Setiap provider punya field `mode` dan `base_url`.  
Untuk Go-Live:
1. Ganti `mode` → `"production"`
2. Ganti `base_url` ke URL production
3. Isi API key production
4. Pastikan callback URL sudah HTTPS dan terdaftar di dashboard provider

---

## 5. Testing Callback

```bash
# Contoh test Digiflazz callback
curl -X POST http://localhost:3000/api/callback/digiflazz \
  -H "Content-Type: application/json" \
  -d '{"ref_id":"TRX-xxxx","buyer_last_status":"Sukses","sn":"1234567890"}'
```

Cek log server dan status transaksi di Admin → Transaksi.

---

## 6. Implementasi Integrasi (lib/providers.js)

Semua pemanggilan API ada di `lib/providers.js`:

### PPOB
| Provider | Signature | Endpoint utama |
|----------|-----------|----------------|
| Digiflazz | md5(username + apiKey + ref_id) | POST /v1/transaction |
| IAK | md5(username + apiKey + ref_id) | POST /api/top-up |
| Raja-Biller | md5(username + apiKey + ref_id) | POST {base_url}/transaction |

### Payment
| Provider | Auth | Fitur |
|----------|------|-------|
| bdPay | merchantCode + sign | VA, QRIS |
| Midtrans | Basic server_key | Charge VA / QRIS |
| DOKU | Client-Id + HMAC Signature | Checkout payment |
| Xendit | Basic secret_key | Invoice (VA, QRIS, e-wallet) |

**Perilaku:**
- Jika kredensial **kosong** → mode **simulasi** (tetap bisa demo)
- Jika kredensial **terisi** → HTTP call nyata ke API provider
- Auto-switch: gagal di satu provider → coba berikutnya sesuai prioritas

### Contoh isi settings (production)

```json
"api_ppob": {
  "priority": ["digiflazz", "iak"],
  "digiflazz": {
    "active": true,
    "username": "your_user",
    "api_key": "your_key",
    "base_url": "https://api.digiflazz.com/v1",
    "mode": "production"
  }
},
"api_payment": {
  "priority": ["midtrans", "bdpay", "xendit"],
  "midtrans": {
    "active": true,
    "server_key": "Mid-server-xxx",
    "client_key": "Mid-client-xxx",
    "base_url": "https://api.midtrans.com",
    "mode": "production"
  }
}
```
