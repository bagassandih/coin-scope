# 🪙 CoinScope

> Sistem lacak koin kripto berpotensi naik berbasis **CoinMarketCap API** — dengan Weighted Scoring, Web Dashboard, dan Personal Tracking.

![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-v5-000000?logo=express&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)
![Version](https://img.shields.io/badge/Version-1.0.1-brightgreen)

---

## 📌 Tentang Proyek

CoinScope adalah **personal tool** untuk mengidentifikasi koin kripto yang berpotensi naik menggunakan pendekatan berbasis data. Sistem ini mengambil data dari CMC API, menjalankan hard filter, menormalisasi metrik, lalu menghasilkan **Top 5 koin** dengan Weighted Score tertinggi.

> ⚠️ **Disclaimer:** CoinScope bukan prediksi harga dan bukan rekomendasi investasi. Output adalah hasil scoring berbasis momentum historis.

---

## ✨ Fitur

- **🏆 Top 5 Scoring** — Ranking koin berdasarkan Weighted Score (7d momentum, volume, market cap tier, 24h change)
- **🔍 Hard Filter** — Eliminasi otomatis koin illiquid, stablecoin, dan pump & dump
- **💾 Cache System** — Respons API di-cache 1 jam untuk hemat rate limit (333 calls/day)
- **📊 Dual Tracking Mode:**
  - **📈 Entry Price** — Catat harga saat tracking dimulai, hitung profit/loss dari sana
  - **🌐 CMC Live** — Tampilkan persentase 7d & 24h langsung dari data CMC
- **📸 Snapshot History** — Riwayat harga tiap koin ter-tracked tersimpan setiap Refresh
- **🌐 Web Dashboard** — UI modern di browser (`localhost:3000`)
- **💻 CLI Mode** — Output tabel langsung di terminal

---

## 🧮 Algoritma Scoring

```
Weighted Score = (S_7d × 40%) + (S_vol × 30%) + (S_mcap_tier × 20%) + (S_24h × 10%)
```

Semua metrik dinormalisasi ke skala 0–100 menggunakan **min-max normalization** sebelum dikalikan bobot.

### Market Cap Tier

| Tier | Range | Skor |
|------|-------|------|
| Large Cap `[L]` | > $10B | 25 |
| Mid Cap `[M]` | $1B – $10B | 50 |
| Small Cap `[S]` | $100M – $1B | 75 |
| Micro Cap `[X]` | < $100M | 100 |

### Hard Filter

| Filter | Threshold |
|--------|-----------|
| 7d Price Change | > 1% (otomatis exclude stablecoin) |
| Market Cap | > $50M |
| Volume 24h | > $1M |
| CMC Rank | ≤ 500 |
| Circulating Supply | > 0 |

---

## 🚀 Instalasi & Setup

### 1. Clone & Install

```bash
git clone https://github.com/username/coin-scope.git
cd coin-scope
npm install
```

### 2. Konfigurasi API Key

Buat file `.env` di root project:

```env
CMC_API_KEY=your_coinmarketcap_api_key_here
CACHE_TTL=3600
UNIVERSE_SIZE=500
```

> Dapatkan API key gratis di [coinmarketcap.com/api](https://coinmarketcap.com/api/)

### 3. Jalankan

```bash
# Web Dashboard (recommended)
npm start

# CLI / Terminal output
npm run cli
```

Buka browser ke **http://localhost:3000**

---

## 📂 Struktur Project

```
coin-scope/
├── src/
│   ├── server.js      # Express server + REST API
│   ├── index.js       # CLI version
│   ├── config.js      # Konfigurasi & bobot scoring
│   ├── fetcher.js     # CMC API client + retry logic
│   ├── filter.js      # Hard filter logic
│   ├── scorer.js      # Weighted scoring + normalisasi
│   ├── display.js     # Terminal output formatter
│   ├── cache.js       # Cache management (JSON, TTL 1 jam)
│   ├── tracking.js    # Coin tracking + snapshot system
│   ├── cache/         # Cached CMC API response
│   └── data/
│       ├── tracked.json    # Daftar koin yang di-track
│       └── snapshots.json  # Riwayat snapshot harga
├── public/
│   ├── index.html     # Web UI
│   ├── style.css      # Styling (dark theme)
│   └── app.js         # Frontend logic
├── vibes/
│   └── knowledge/     # Dokumentasi & PRD
├── .env               # API key (gitignored)
└── package.json
```

---

## 🌐 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/top5` | Ambil Top 5 dari cache |
| `POST` | `/api/refresh` | Force refresh dari CMC API + simpan snapshot |
| `GET` | `/api/tracked` | Daftar koin yang di-track |
| `POST` | `/api/track` | Tambah / hapus tracking |
| `GET` | `/api/history/:coinId` | Riwayat snapshot koin |

---

## 📊 Tracking Mode

Saat mencentang koin di dashboard, pilih salah satu mode:

### 📈 Entry Price
Harga saat pertama kali di-track dicatat sebagai **"harga beli"**. Dashboard menampilkan profit/loss relatif terhadap harga entry — seolah kamu membeli di saat itu.

### 🌐 CMC Live
Tampilkan persentase **7d** dan **24h** langsung dari data CMC API tanpa referensi harga beli.

---

## 🛠️ Tech Stack

| Layer | Library |
|-------|---------|
| Runtime | Node.js (ESM) |
| Web Server | Express v5 |
| HTTP Client | Axios |
| Notifications | SweetAlert2 |
| CLI Output | Chalk + CLI-Table3 |
| Config | dotenv |

---

## 🗺️ Roadmap

| Versi | Status | Fitur |
|-------|--------|-------|
| v1.0 | ✅ Released | MVP: scoring, web UI, cache |
| v1.0.1 | ✅ Released | Dual tracking mode, snapshot fix |
| v1.1 | 🔮 Planned | Historical tracking + akurasi evaluasi |
| v1.2 | 🔮 Planned | Scheduler + Telegram notifikasi |
| v2.0 | 🔮 Planned | Custom bobot, analytics lanjutan |

---

## 📝 License

MIT
