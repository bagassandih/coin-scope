# 🪙 CoinScope

> Sistem lacak koin kripto berpotensi naik berbasis **CoinMarketCap API** — dengan Weighted Scoring, Web Dashboard, dan Personal Tracking.

![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-v5-000000?logo=express&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)
![Version](https://img.shields.io/badge/Version-1.1-brightgreen)

---

## 📌 Tentang Proyek

CoinScope adalah **personal tool** untuk mengidentifikasi koin kripto yang berpotensi naik menggunakan pendekatan berbasis data. Sistem ini mengambil data dari CMC API, menjalankan hard filter, menormalisasi metrik, lalu menghasilkan **Top 5 koin** dengan Weighted Score tertinggi.

> ⚠️ **Disclaimer:** CoinScope bukan prediksi harga dan bukan rekomendasi investasi. Output adalah hasil scoring berbasis momentum historis.

---

## ✨ Fitur

- **🏆 Top 5 Scoring** — Ranking koin berdasarkan Weighted Score (v1.1: 7d, 30d confirmation, volume, market cap tier, 24h)
- **🔍 Hard Filter** — Eliminasi otomatis koin illiquid, stablecoin, dan pump & dump
- **💾 Hybrid Cache** — CMC data di-cache lokal (1 jam), tracked coins di Supabase
- **📊 Dual Tracking Mode:**
  - **📈 Entry Price** — Catat harga saat tracking dimulai, hitung profit/loss dari sana
  - **🌐 CMC Live** — Tampilkan persentase 7d & 24h langsung dari data CMC
- **📸 Snapshot History** — Riwayat harga tiap koin ter-tracked tersimpan di Supabase
- **🗄️ Supabase Database** — Persistent storage untuk tracked coins & snapshots
- **🌐 Web Dashboard** — UI modern di browser (`localhost:3000`)
- **💻 CLI Mode** — Output tabel langsung di terminal

---

## 🧮 Algoritma Scoring (v1.1)

```
Weighted Score = (S_7d × 30%) + (S_30d × 15%) + (S_vol × 30%) + (S_mcap_tier × 20%) + (S_24h × 5%)
```

### 30d Confirmation (NEW)
- Jika 30d change ≤ 0 → Skor 20 (dead cat bounce penalty)
- Jika 30d change > 0 → Normalized 0-100 (tren sehat)

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

### 2. Setup Supabase

1. Buat project di [supabase.com](https://supabase.com)
2. Buka SQL Editor, jalankan schema dari `supabase/schema.sql`
3. Copy kredensial dari Settings → API

### 3. Konfigurasi Environment

Buat file `.env` di root project:

```env
# CoinMarketCap API
CMC_API_KEY=your_coinmarketcap_api_key_here
CACHE_TTL=3600
UNIVERSE_SIZE=500

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
```

> Dapatkan CMC API key gratis di [coinmarketcap.com/api](https://coinmarketcap.com/api/)

> Lihat `supabase/SETUP.md` untuk guide lengkap Supabase setup.

### 4. Jalankan

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
│   ├── db.js          # Supabase client & database operations (NEW)
│   ├── config.js      # Konfigurasi & bobot scoring
│   ├── fetcher.js     # CMC API client + retry logic
│   ├── filter.js      # Hard filter logic
│   ├── scorer.js      # Weighted scoring + normalisasi
│   ├── display.js     # Terminal output formatter
│   ├── cache.js       # Cache management (hybrid: file + Supabase)
│   ├── tracking.js    # Coin tracking (delegates to db.js)
│   └── cache/         # Cached CMC API response (local file)
├── public/
│   ├── index.html     # Web UI
│   ├── style.css      # Styling (dark theme)
│   └── app.js         # Frontend logic
├── supabase/          # Supabase setup files (NEW)
│   ├── schema.sql     # Database schema
│   ├── SETUP.md       # Setup guide
│   └── README.md      # Database reference
├── vibes/
│   └── knowledge/     # Dokumentasi & PRD
├── .env               # Environment variables (gitignored)
└── package.json
```

### Data Storage

| Data | Storage | Alasan |
|------|---------|--------|
| CMC API Cache | Local file (`src/cache/`) | File besar (~900KB), lebih efisien |
| Tracked Coins | Supabase (`tracked_coins`) | Persistent, cloud backup |
| Snapshots | Supabase (`snapshots`) | Historical tracking |

---

## 🌐 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/top5` | Ambil Top 5 dari cache |
| `POST` | `/api/refresh` | Force refresh dari CMC API + simpan snapshot ke Supabase |
| `GET` | `/api/tracked` | Daftar koin yang di-track (dengan latest snapshot) |
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
| Database | Supabase (PostgreSQL) |
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
| v1.1 | ✅ Released | **Supabase integration, 30d confirmation scoring** |
| v1.2 | 🔮 Planned | Scheduler + Telegram notifikasi |
| v2.0 | 🔮 Planned | Custom bobot, analytics lanjutan |

---

## 📝 Changelog

### v1.1 (2025-05-19)
- ✅ Supabase integration untuk tracked coins & snapshots
- ✅ 30d confirmation scoring (hybrid logic)
- ✅ Rebalanced weights (7d: 40%→30%, 30d: +15%, 24h: 10%→5%)
- ✅ Removed `src/data/` folder (migrated to Supabase)

### v1.0.1 (2025-05-14)
- ✅ Dual tracking mode (Entry Price / CMC Live)
- ✅ Snapshot untuk semua tracked coins (termasuk yang tidak lolos filter)

---

## 📝 License

MIT
