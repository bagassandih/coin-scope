# CoinScope - Changelog & Implementation Notes

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
