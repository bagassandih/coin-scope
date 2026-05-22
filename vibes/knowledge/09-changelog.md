# CoinScope - Changelog & Implementation Notes

## v1.2 - Hold Strategy Optimization (22 Mei 2026)

---

### Problem Statement

Algoritma v1.1 memberikan score tinggi pada koin **pump & dump** seperti BOBO:
- 7d Change: +2266.3% (sudah pump)
- 24h Change: -83.3% (dump drastis)
- Score: 61.4 (#1)

**Ini tidak sesuai dengan goal:** "buy → hold 1 bulan → exit"

---

### 1. Scoring Weights Rebalance

| Metrik | v1.1 | v1.2 | Perubahan |
|--------|------|------|-----------|
| 7d Change | 30% | **12%** | ↓ Too short-term |
| **30d Trend** | 15% | **48%** | ↑ Primary signal |
| Volume | 30% | **25%** | ↓ Still important |
| Market Cap Tier | 20% | **10%** | ↓ Less weight |
| 24h Change | 5% | **5%** | = Noise |
| **Healthy Trend Bonus** | - | **+20** | NEW |

**Alasan:**
- 30d lebih merepresentasikan tren sehat untuk holding
- 7d terlalu volatile, easily manipulated
- Bonus untuk tren sehat (steady rise, bukan pump)

---

### 2. Pump & Dump Filter

```javascript
// Filter out koin dengan pattern pump & dump
if (7d_change > 100% && 24h_change < -30%) {
  return false; // Skip
}
```

**Impact:** BOBO (+2266% / -83%) tidak lagi masuk Top 5

---

### 3. Healthy Trend Bonus

```javascript
// Reward koin dengan tren sehat untuk holding
if (7d > 0 && 7d < 50% && 30d > 0) {
  score += 20; // Steady rise, not pumped
}
```

**Kriteria tren sehat:**
- 7d positif (tren naik)
- 7d < 50% (tidak extreme)
- 30d positif (konfirmasi tren bulanan)

---

### 4. Before vs After

| Koin | v1.1 Score | v1.2 Status | Alasan |
|------|------------|-------------|--------|
| **BOBO** | 61.4 (#1) | ❌ **Filtered** | Pump & dump pattern |
| **PROVE** | 53.5 (#2) | ✅ #3 | Tren sehat, lolos |
| **ALT** | 39.6 (#4) | ✅ #5 | Steady rise |

---

### 5. File Changes

- `src/config.js` — Update weights untuk v1.2
- `src/scorer.js` — Add `isPumpAndDump()`, `hasHealthyTrend()`, filter logic

---

## v1.1.1 - Supabase Integration (19 Mei 2026)

---

### 1. Database Migration

**Sebelumnya:** Tracked coins & snapshots disimpan di local JSON files (`src/data/`)

**Sekarang:** Menggunakan Supabase PostgreSQL untuk persistent storage

| Data | Sebelum | Sesudah |
|------|---------|---------|
| Tracked Coins | `src/data/tracked.json` | `tracked_coins` table |
| Snapshots | `src/data/snapshots.json` | `snapshots` table |
| CMC Cache | `src/cache/cmc-data.json` | Tetap sama (local file) |

**Alasan:**
- Persistent storage di cloud
- Lebih scalable untuk historical data
- Backup otomatis dari Supabase
- Query lebih powerful (SQL)

---

### 2. Database Schema

**Tabel yang dibuat:**

```sql
-- tracked_coins
CREATE TABLE tracked_coins (
    id INTEGER PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    tracking_mode VARCHAR(10) CHECK (tracking_mode IN ('cmc', 'entry')),
    entry_price DECIMAL(20, 8),
    entry_timestamp TIMESTAMP WITH TIME ZONE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- snapshots
CREATE TABLE snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coin_id INTEGER NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    percent_change_7d DECIMAL(10, 2),
    percent_change_24h DECIMAL(10, 2),
    volume_24h DECIMAL(30, 2),
    market_cap DECIMAL(30, 2),
    tier VARCHAR(20),
    score DECIMAL(10, 2),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- View untuk join
CREATE VIEW tracked_with_latest_snapshot AS ...
```

---

### 3. Code Changes

**File baru:**
- `src/db.js` — Supabase client & database operations

**File diubah:**
- `src/tracking.js` — Delegate ke db.js (backward compatible)
- `src/cache.js` — Hybrid approach (CMC cache tetap local)
- `src/server.js` — Async/await untuk database operations

**File dihapus:**
- `src/data/` — Folder deprecated

---

### 4. Environment Variables

```env
# Supabase Configuration (NEW)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_DB_URL=postgresql://...
```

---

### 5. Setup Instructions

Lihat `supabase/SETUP.md` untuk guide lengkap:
1. Create project di Supabase
2. Jalankan SQL schema
3. Update `.env` dengan kredensial
4. Disable RLS (untuk development)

---

## v1.1 - 30d Confirmation Scoring (14 Mei 2026)

---

### 1. Hybrid 30d Logic

**Masalah:** Scoring v1.0 hanya bergantung pada momentum 7d (40%) dan 24h (10%), menyebabkan "buy at the top" trap — koin yang sudah naik tinggi terus dapat skor tinggi.

**Solusi:** Tambah konfirmasi tren 30 hari dengan hybrid logic.

| Metrik | v1.0 | v1.1 |
|--------|------|------|
| 7d Change | 40% | **30%** ↓ |
| 30d Confirmation | - | **15%** ↑ (NEW) |
| Volume Spike | 30% | 30% |
| Market Cap Tier | 20% | 20% |
| 24h Change | 10% | **5%** ↓ |

**Hybrid Logic:**
```javascript
// Jika 30d negatif → penalty (dead cat bounce)
if (coin.percent_change_30d <= 0) {
  s30d = 20; // Skor rendah, bukan 0
} else {
  s30d = normalize(coin.percent_change_30d, min30d, max30d);
}
```

**Alasan:**
- Tidak sepenuhnya matikan koin dengan 30d negatif (mungkin reversal)
- Tapi beri penalty signifikan dibanding koin dengan tren sehat
- Koin dengan 7d & 30d searah (tren sehat) dapat reward

**File yang diubah:**
- `src/config.js` — Update `weights` dengan `change30d: 0.15`
- `src/scorer.js` — Tambah hybrid 30d logic di `calculateScores()`

---

### 2. Impact ke Scoring

| Scenario | v1.0 | v1.1 |
|----------|------|------|
| Koin pump 7d +50%, 30d +5% | High score | Lower score (30d hanya +5%) |
| Koin naik stabil 7d +15%, 30d +25% | Medium score | **Higher score** (tren sehat) |
| Dead cat bounce 7d +20%, 30d -30% | Medium-high score | **Low score** (30d penalty) |

---

## v1.0.1 - Tracking Mode Enhancement (13 Mei 2026)

---

### 1. Dual Tracking Mode

Setelah checkbox di-centang, user sekarang memilih mode tracking via dialog:

| Mode | Deskripsi | Display |
|------|-----------|---------|
| **📈 Entry Price** | Harga saat pertama kali track dicatat sebagai "harga beli" | Profit/Loss % dihitung dari entry price |
| **🌐 CMC Live** | Gunakan data persentase 7d & 24h langsung dari CMC | Tampilkan 7d/24h change dari snapshot terbaru |

**Data baru di `tracked.json`:**
```json
{
  "id": 1,
  "symbol": "BTC",
  "name": "Bitcoin",
  "added_at": 1778647630,
  "tracking_mode": "entry",
  "entry_price": 98234.50,
  "entry_timestamp": 1778647630
}
```

**File yang diubah:**
- `src/tracking.js` — `addTrackedCoin(coin, mode, entryPrice)`, `getLatestSnapshots()` include `entry_performance`
- `src/server.js` — `/api/track` pass mode + entry_price, `/api/history/:id` return entry info
- `public/app.js` — Checkbox langsung trigger dialog mode, hapus batch "Track X Coins" button
- `public/style.css` — Badge `.mode-entry` (hijau) & `.mode-cmc` (biru)

---

### 2. Snapshot untuk Semua Tracked Coins

**Sebelumnya:** Snapshot hanya disimpan untuk tracked coins yang **lolos hard filter**.

**Sekarang:** Semua tracked coins selalu tersimpan snapshot-nya saat Refresh, meskipun tidak lolos filter.

**Logika baru di `/api/refresh`:**
```
tracked lolos filter  → snapshot dengan tier + weightedScore
tracked tidak lolos   → snapshot dengan tier, weightedScore = null
```

**File yang diubah:**
- `src/scorer.js` — Export `getMarketCapTierScore` (sebelumnya private)
- `src/server.js` — Ambil tracked coins dari raw `coins` list jika tidak ada di `scoredCoins`

---

## v1.0 - MVP + Web UI (Released)

**Release Date:** 13 Mei 2026

---

## Summary

MVP implementation dengan **Web UI** yang awalnya direncanakan untuk v2.0, plus beberapa enhancement tambahan.

---

## Changes from Original PRD

### 1. Web UI (Originally v2.0 → Now v1.0)

| Feature | PRD Plan | Implementation |
|---------|----------|----------------|
| Web Dashboard | v2.0 | ✅ **v1.0** - Express server + vanilla JS |
| Auto-refresh | Planned | ❌ **Manual only** (untuk hemat rate limit) |
| Custom Config | v2.0 | ⏳ Future - config masih hardcoded |

**Tech Stack:**
- Backend: Express.js
- Frontend: Vanilla JS + SweetAlert2
- Static: HTML/CSS di `public/`

**Endpoint:**
- `GET /api/top5` - Ambil top 5 (pakai cache jika available)
- `POST /api/refresh` - Force refresh dari CMC API

---

### 2. Notification System

| Before | After |
|--------|-------|
| `alert()` | ✅ **SweetAlert2** |
| Error di console | ✅ **Toast + Modal** |

**Install:**
```bash
npm install sweetalert2
```

---

### 3. Coin Logos

**Source:** CMC CDN
```
https://s2.coinmarketcap.com/static/img/coins/64x64/{id}.png
```

**Fallback:** Emoji 🪙 jika gagal load.

---

### 4. Network/Platform Info

**Data:** `coin.platform.symbol` dari CMC API
- `null` = Native coin (BTC, ETH, dll)
- `"ETH"` = Ethereum token (ERC-20)
- `"SOL"` = Solana token
- `"BSC"` = BNB Smart Chain
- dll.

**Display:** Badge di sebelah tier badge.

---

### 5. Timezone

| Before | After |
|--------|-------|
| UTC | ✅ **WIB (UTC+7)** |

**Format:** `YYYY-MM-DD HH:MM:SS WIB`

---

## Bug Fixes

### Issue: `getCacheAge is not defined`

**Root Cause:** Di `fetcher.js`, fungsi `getCacheAge()` dipanggil tapi tidak di-import.

**Fix:**
```javascript
// Before
import { getCachedData, setCachedData } from './cache.js';

// After
import { getCachedData, setCachedData, getCacheAge } from './cache.js';
```

---

## Project Structure

```
coin-scope/
├── src/
│   ├── index.js       # CLI version
│   ├── server.js      # Express server + API
│   ├── config.js      # Konfigurasi
│   ├── cache.js       # Cache management
│   ├── fetcher.js     # CMC API client
│   ├── filter.js      # Hard filter logic
│   ├── scorer.js      # Weighted scoring
│   └── display.js     # Terminal output (CLI)
├── public/
│   ├── index.html     # Web UI
│   ├── style.css      # Styling
│   └── app.js         # Frontend logic
├── .env               # API key
└── package.json
```

---

## Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start Web UI + Server |
| `npm run cli` | Run CLI version (terminal) |

---

## Known Limitations

1. **No custom config** - Bobot scoring masih hardcoded di `config.js`
2. **No historical tracking** - Belum ada database untuk tracking akurasi
3. **Single user** - Tidak ada authentication/multi-user support
4. **CMC Free Tier** - 333 calls/day limit, cache 1 jam

---

## Next Steps (Roadmap)

### v1.1 - Historical Tracking
- SQLite database untuk simpan history
- Evaluasi akurasi setelah 30 hari
- Adjust bobot berdasarkan hasil

### v1.2 - Otomasi
- Scheduler (cron)
- Notifikasi Telegram

### v2.0 - Scale Up
- Custom bobot via config file
- Enhanced analytics
- More data sources (Fear & Greed Index, RSI, dll)

---

## Technical Decisions Log

### Why Web UI di v1.0?
User request dan implementasi cukup simple dengan Express + vanilla JS.

### Why Manual Refresh?
Untuk hemat rate limit CMC API (333 calls/day). System di-run weekly, bukan real-time.

### Why SweetAlert2?
Lebih bagus dari native `alert()`, mudah di-integrasikan, dan mendukung dark theme.

### Why WIB Timezone?
User request (Indonesia user).

---

## Dependencies

```json
{
  "axios": "^1.7.9",          // HTTP client
  "chalk": "^5.4.1",          // Terminal colors
  "cli-table3": "^0.6.5",     // Terminal table
  "dotenv": "^16.4.7",        // Environment variables
  "express": "^5.2.1",        // Web server
  "sweetalert2": "^11.26.24"  // Notifications
}
```

---

## API Key

**Location:** `.env` file (gitignored)

```env
CMC_API_KEY=your_key_here
CACHE_TTL=3600
UNIVERSE_SIZE=500
```

---

## Cache System

**Location:** `src/cache/cmc-data.json`

**Structure:**
```json
{
  "timestamp": 1778644310,
  "data": { /* CMC API response */ }
}
```

**TTL:** 3600 detik (1 jam)

---

## Scoring Formula (Final)

```
Weighted Score = (S_7d × 40%) + (S_vol × 30%) + (S_mcap_tier × 20%) + (S_24h × 10%)
```

| Metrik | Bobot | Min-Max Normalized |
|--------|-------|-------------------|
| 7d Change | 40% | ✅ |
| Volume Ratio | 30% | ✅ |
| Market Cap Tier | 20% | Fixed (25/50/75/100) |
| 24h Change | 10% | ✅ |

---

## Hard Filter (Final)

| Filter | Threshold |
|--------|-----------|
| 7d Change | > 1% (termasuk filter stablecoin) |
| Market Cap | > $50M |
| Volume 24h | > $1M |
| CMC Rank | ≤ 500 |
| Circulating Supply | > 0 |
