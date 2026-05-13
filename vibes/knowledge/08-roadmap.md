# CoinScope - Roadmap & Versi

## Overview

```
v1.0 (MVP) ──▶ v1.1 (Evaluasi) ──▶ v1.2 (Otomasi) ──▶ v2.0 (Scale Up)
   │                 │                  │                  │
   ▼                 ▼                  ▼                  ▼
Terminal Output  Historical Data   Scheduler       Custom Config
Basic Scoring    Accuracy Tracking  Telegram        Web Dashboard
                 Weight Adjustment  Notifikasi
```

---

## v1.0 - MVP (Minimum Viable Product)

**Target:** Core functionality untuk personal use

| Scope | Detail |
|-------|--------|
| **Goal** | Sistem scoring dasar dengan output terminal |
| **User** | Single user (manual run) |
| **Timeline** | Sprint 1-2 |

### Fitur (FR-01 s/d FR-07)

- [x] Fetch data dari CMC API
- [x] Hard filter (5 kriteria)
- [x] Normalisasi min-max
- [x] Weighted scoring
- [x] Ranking top 5
- [x] Display terminal
- [x] Cache API response (TTL 1 jam)

### Deliverables

```
coin-scope/
├── src/
│   ├── fetcher.py      # CMC API client
│   ├── filter.py       # Hard filter logic
│   ├── scorer.py       # Weighted scoring
│   ├── display.py      # Terminal output
│   └── cache.py        # Cache management
├── .env                # API key
├── config.json         # Configuration
└── requirements.txt    # Dependencies
```

---

## v1.1 - Evaluasi

**Target:** Tracking & improvement berdasarkan data historis

| Scope | Detail |
|-------|--------|
| **Goal** | Simpan history, evaluasi akurasi, adjust bobot |
| **User** | Single user dengan data tracking |
| **Timeline** | Sprint 3-4 |

### Fitur Baru

- [x] Historical tracking (SQLite)
- [x] Simpan snapshot tiap run
- [x] Evaluasi akurasi setelah 30 hari
- [x] Compare predicted vs actual
- [x] Adjust bobot berdasarkan hasil evaluasi

### Database Schema

```sql
CREATE TABLE runs (
    id INTEGER PRIMARY KEY,
    timestamp DATETIME,
    universe_count INTEGER,
    filtered_count INTEGER,
    top_5 JSON
);

CREATE TABLE coin_history (
    id INTEGER PRIMARY KEY,
    run_id INTEGER,
    symbol TEXT,
    score REAL,
    rank INTEGER,
    actual_7d_change REAL,  -- Diisi setelah 30 hari
    actual_30d_change REAL
);
```

---

## v1.2 - Otomasi

**Target:** Scheduled runs & notifikasi

| Scope | Detail |
|-------|--------|
| **Goal** | Otomatisasi eksekusi & notifikasi |
| **User** | Single user dengan passive monitoring |
| **Timeline** | Sprint 5-6 |

### Fitur Baru

- [x] Scheduler (cron/systemd)
- [x] Telegram bot notifikasi
- [x] Configurable schedule (daily/weekly)
- [x] Notifikasi format: Top 5 summary

### Notifikasi Format

```
🪙 CoinScope Report - 2026-05-13

Top 5 Potensi Naik:
1. Bitcoin (BTC) - Score: 87.4
2. Ethereum (ETH) - Score: 82.1
3. Solana (SOL) - Score: 79.8
4. Cardano (ADA) - Score: 74.2
5. Polkadot (DOT) - Score: 71.5

⚠️ Bukan rekomendasi investasi.
```

---

## v2.0 - Scale Up

**Target:** Enhanced features & better UX

| Scope | Detail |
|-------|--------|
| **Goal** | Customizable, web UI, integrasi data tambahan |
| **User** | Single user dengan rich interface |
| **Timeline** | Sprint 7+ |

### Fitur Baru

- [x] Custom bobot via config file
- [x] Web dashboard (localhost)
- [x] Integrasi data tambahan:
  - Fear & Greed Index
  - RSI (Relative Strength Index)
  - Social sentiment
- [x] Export to CSV/Excel
- [x] Backtesting mode

### Web Dashboard Stack

- **Backend:** Flask/FastAPI (Python) atau Express (Node.js)
- **Frontend:** React/Vue.js atau template-based
- **Charts:** Chart.js, Plotly, atau Recharts

---

## Timeline Summary

| Versi | Duration | Complexity | Priority |
|-------|----------|------------|----------|
| v1.0 | 2 weeks | Low | 🔴 Critical |
| v1.1 | 2 weeks | Medium | 🟡 High |
| v1.2 | 2 weeks | Medium | 🟢 Nice to have |
| v2.0 | 4+ weeks | High | 🟢 Nice to have |

---

## Dependencies Between Versions

```
v1.0 ──▶ v1.1 ──▶ v1.2 ──▶ v2.0
  │        │        │        │
  └────────┴────────┴────────┴──▶ Semua versi butuh v1.0 base
```

- **v1.1** membutuhkan data dari v1.0
- **v1.2** membutuhkan core dari v1.0 + scheduler
- **v2.0** membutuhkan semua fitur sebelumnya sebagai foundation
