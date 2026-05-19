# CoinScope - Struktur Project

## Directory Structure

```
coin-scope/
├── src/
│   ├── cache/              # Local cache untuk CMC API data (file besar)
│   │   └── cmc-data.json   # ~900KB JSON response dari CMC
│   ├── db.js               # Supabase client & database operations
│   ├── cache.js            # Cache management (hybrid: file + Supabase)
│   ├── config.js           # Konfigurasi & environment variables
│   ├── fetcher.js          # CMC API client
│   ├── filter.js           # Hard filter logic
│   ├── scorer.js           # Weighted scoring algorithm
│   ├── tracking.js         # Tracking module (delegates to db.js)
│   ├── display.js          # Terminal output (CLI version)
│   ├── server.js           # Express server + API endpoints
│   └── index.js            # CLI entry point
├── public/                 # Web UI static files
│   ├── index.html
│   ├── style.css
│   └── app.js
├── supabase/              # Supabase setup files
│   ├── schema.sql         # SQL schema untuk database
│   ├── README.md          # Database reference
│   └── SETUP.md           # Setup guide
├── .env                   # Environment variables (gitignored)
├── .gitignore
├── package.json
└── README.md
```

## Data Storage Strategy

### Local File (src/cache/)
**Digunakan untuk:** CMC API response cache
**Alasan:** File JSON besar (~900KB), lebih efisien disimpan lokal

### Supabase Database
**Digunakan untuk:** Tracked coins & Snapshots
**Tabel:**
- `tracked_coins` - List koin yang di-track user
- `snapshots` - Historical data harga/scoring
- `api_cache` - Cache untuk API calls kecil (opsional)

## Storage Migration

| Sebelum (v1.0) | Sesudah (v1.1+) |
|----------------|-----------------|
| `src/data/tracked.json` | `tracked_coins` table (Supabase) |
| `src/data/snapshots.json` | `snapshots` table (Supabase) |
| `src/cache/cmc-data.json` | Tetap sama (local file) |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/top5` | GET | Get top 5 coins (from cache) |
| `/api/refresh` | POST | Fetch fresh data from CMC API |
| `/api/tracked` | GET | Get all tracked coins with latest snapshot |
| `/api/track` | POST | Add/remove coin from tracking |
| `/api/history/:coinId` | GET | Get coin snapshot history |

## Environment Variables

```env
# CoinMarketCap API
CMC_API_KEY=your_key_here
CMC_API_URL=https://pro-api.coinmarketcap.com/v1
CACHE_TTL=3600
UNIVERSE_SIZE=500

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_DB_URL=postgresql://...
```

## Development Workflow

1. **First time setup:**
   - Jalankan SQL schema di Supabase SQL Editor
   - Update `.env` dengan kredensial Supabase

2. **Run application:**
   ```bash
   npm start          # Web UI + API server
   npm run cli        # CLI version only
   ```

3. **Data flow:**
   - CMC data → Local file cache (src/cache/cmc-data.json)
   - Tracked coins → Supabase (tracked_coins table)
   - Snapshots → Supabase (snapshots table)
