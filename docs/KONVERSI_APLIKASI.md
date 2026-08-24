# Panduan Konversi ke Aplikasi Seluler

## Mengapa Mudah Dikonversi?

1. **Mobile-first responsive design** — layout sudah optimal di tablet & HP.
2. **Tidak ada ketergantungan database server-side kompleks** untuk frontend.
3. **PWA** sudah disiapkan (manifest.json + service worker).
4. **Pure web technology** (HTML/CSS/JS) → kompatibel dengan wrapper native.

## Metode 1: Progressive Web App (PWA)

Paling cepat, tanpa store.

1. Deploy site ke hosting HTTPS (Vercel, Netlify, VPS, dll).
2. Pastikan `manifest.json` dan `sw.js` ter-load.
3. Di Chrome Android: Menu → "Install app" / "Add to Home screen".
4. Di Safari iOS: Share → "Add to Home Screen".

Aplikasi akan terbuka fullscreen (standalone).

## Metode 2: Capacitor (Recommended oleh Ionic)

Hasilkan APK/AAB (Android) dan IPA (iOS).

```bash
# Di root project (setelah npm install)
npm install @capacitor/core @capacitor/cli
npx cap init "PPOB Mobile" "id.arekaturamanah.ppob" --web-dir public

npm install @capacitor/android @capacitor/ios
npx cap add android
npx cap add ios

# Setiap kali update frontend:
npx cap sync

# Buka di Android Studio / Xcode
npx cap open android
npx cap open ios
```

Kemudian build signed APK/AAB atau archive iOS seperti biasa.

## Metode 3: Apache Cordova

```bash
npm install -g cordova
cordova create ppob-app id.arekaturamanah.ppob "PPOB Mobile"
cd ppob-app
# Copy semua isi public/ ke www/
cordova platform add android
cordova platform add ios
cordova build android
```

## Tips Tambahan untuk Native Feel

- Tambahkan splash screen & icon generik di Capacitor/Cordova config.
- Gunakan `@capacitor/status-bar` dan `@capacitor/splash-screen`.
- Untuk deep link / push notification, tambahkan plugin sesuai kebutuhan.
- Backend tetap bisa di-host terpisah; app hanya memanggil API.

## Catatan Store

- Google Play & App Store memiliki kebijakan khusus untuk aplikasi pembayaran/financial.
- Pastikan Anda memiliki izin/lisensi yang diperlukan (PJP, dll) sebelum publish aplikasi berbayar/transaksional.
- Untuk demo internal, sideload APK sudah cukup.

Dengan struktur saat ini, konversi dapat dilakukan dalam hitungan jam hingga 1-2 hari kerja.
