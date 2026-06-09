---
name: coinscope-v2.2-1-month-trading
description: CoinScope v2.2 - Optimized for 1-month spot trading with 30d primary indicator
metadata:
  type: project
  version: 2.2.0
  date: 2026-06-09
---

# CoinScope v2.2 - 1-Month Spot Trading

## Overview
Optimized for spot trading with hold time: 1 day to 4 weeks (max 1 month).

## Scoring Formula v2.2
```
Score = 30d(40%) + Volume(25%) + 7d(20%) + 24h(10%) + Mcap(5%) + Bonuses
```

## Data Sources
- **100% CMC Data** - No external APIs
- **Binance removed** - SSL certificate issues

## Key Components
- **30d Change (40%)** - PRIMARY indicator for max hold time
- **7d Change (20%)** - Short-term momentum
- **24h Change (10%)** - Entry timing
- **Volume (25%)** - Confirmation
- **Mcap Tier (5%)** - Risk management

## Bonuses
- Healthy Trend: +15 (7d > 0, 30d > 0, not pumped)
- Sector Bonus: +5 (AI, DeFi, RWA, Meme)
- Supply Risk: -10 (circulating < 50% max supply)

## Non-Latin Filter
Filters coins with Chinese/other non-Latin symbols (won't match Binance pairs).

## Files Modified (v2.2)
- `src/config.js` - Updated weights
- `src/scorer.js` - Removed 60d, 30d as primary
- `src/display.js` - Added 30d column to CLI
- `src/nvidia.js` - Updated AI reasoning with 30d
- `src/db.js` - Added 30d to all snapshot functions
- `public/app.js` - Added 30d to all UI components
- `supabase/migrations/20260609_add_30d_to_snapshots.sql` - Database migration

## How to Apply
1. Run migration: `node scripts/run-migration.js supabase/migrations/20260609_add_30d_to_snapshots.sql`
2. Or manually in Supabase SQL Editor
