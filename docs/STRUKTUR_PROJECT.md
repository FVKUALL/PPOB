# Struktur Project PPOB Mobile Site

```
ppob-mobile-site/
├── data/                          # JSON File Storage (satu-satunya "database")
│   ├── users.json                 # Pengguna (terenkripsi AES-256-GCM)
│   ├── products.json              # Katalog produk Prabayar/Pascabayar
│   ├── faqs.json                  # FAQ
│   ├── settings.json              # API keys, fees, T&C, SEO, Google, admin (terenkripsi)
│   ├── transactions.json          # Riwayat transaksi (terenkripsi)
│   └── cms.json                   # Konten CMS (hero, menu, about)
│
├── public/                        # Frontend static (mobile-first)
│   ├── index.html                 # Halaman utama
│   ├── css/style.css              # Styles modern minimalis
│   ├── js/app.js                  # Logika frontend + LocalStorage
│   ├── admin/
│   │   ├── index.html             # Admin panel
│   │   └── admin.js               # Logika admin CRUD + laporan
│   ├── assets/                    # Logo, icon, og-image
│   ├── manifest.json              # PWA manifest
│   └── sw.js                      # Service Worker (PWA)
│
├── docs/                          # Panduan lengkap
│   ├── STRUKTUR_PROJECT.md        # File ini
│   ├── FITUR.md
│   ├── OPEN_API_SETTING.md
│   ├── GO_LIVE.md
│   ├── PANDUAN_ADMIN.md
│   ├── PANDUAN_PENGGUNA.md
│   ├── PANDUAN_LENGKAP.md
│   └── KONVERSI_APLIKASI.md
│
├── server.js                      # Express backend (API + switching + callback + enkripsi)
├── package.json
├── .encryption-key                # Kunci AES (auto-generate, JANGAN commit)
├── .gitignore
└── README.md
```

## Alur Data

1. **Frontend** → `fetch('/api/...')` → **Express (server.js)**
2. **server.js** membaca/menulis file di folder `data/` (dengan enkripsi untuk file sensitif)
3. Session pengguna disimpan di **LocalStorage** browser (bukan cookie server)
4. Callback dari provider PPOB/Payment → endpoint `/api/callback/*` → update `transactions.json`

## Teknologi

| Layer      | Teknologi                                      |
|------------|------------------------------------------------|
| Frontend   | HTML5, CSS3, Vanilla JS, LocalStorage, PWA     |
| Backend    | Node.js, Express                               |
| Storage    | JSON files + AES-256-GCM encryption            |
| Auth       | Email/Username + Google Identity Services      |
| Standar    | W3C HTML5, mobile-first, semantic              |
