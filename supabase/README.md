# CoinScope - Supabase Setup Guide

## Prerequisites

1. Akun Supabase aktif
2. Project sudah dibuat di Supabase

## Step 1: Run SQL Schema

1. Buka Supabase Dashboard
2. Navigate ke **SQL Editor**
3. Copy dan paste isi dari `supabase/schema.sql`
4. Klik **Run** untuk execute

Schema akan membuat:
- `tracked_coins` - List koin yang di-track user
- `snapshots` - Historical data harga/scoring untuk tracked coins
- `api_cache` - Cache untuk API calls (opsional)
- View `tracked_with_latest_snapshot` - Join table untuk UI
- Function `clean_expired_cache()` - Cleanup otomatis expired cache

## Step 2: Update Environment Variables

Pastikan `.env` file berisi:

```env
# Supabase Configuration
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_DB_URL=postgresql://postgres.USER:PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
```

## Step 3: Install Dependencies

```bash
npm install @supabase/supabase-js
```

## Step 4: Run Application

```bash
npm start
```

## Database Schema Reference

### tracked_coins

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Coin ID dari CMC (PK) |
| symbol | VARCHAR(20) | Simbol koin (BTC, ETH) |
| name | VARCHAR(100) | Nama lengkap koin |
| added_at | TIMESTAMP | Waktu ditambahkan ke tracking |
| tracking_mode | VARCHAR(10) | 'cmc' atau 'entry' |
| entry_price | DECIMAL | Harga entry (jika mode='entry') |
| entry_timestamp | TIMESTAMP | Waktu entry price dicatat |

### snapshots

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| coin_id | INTEGER | Foreign key ke tracked_coins |
| price | DECIMAL | Harga saat snapshot |
| percent_change_7d | DECIMAL | Perubahan 7 hari dari CMC |
| percent_change_24h | DECIMAL | Perubahan 24 jam dari CMC |
| volume_24h | DECIMAL | Volume 24 jam |
| market_cap | DECIMAL | Market cap |
| tier | VARCHAR(20) | Market cap tier (Large/Mid/Small/Micro) |
| tier_label | VARCHAR(20) | Label tier |
| score | DECIMAL | Weighted score (0-100) |
| timestamp | TIMESTAMP | Waktu snapshot diambil |

## Migration dari File-based ke Supabase

Jika sebelumnya menggunakan `src/data/tracked.json` dan `src/data/snapshots.json`:

```bash
# (Opsional) Backup existing data
cp src/data/tracked.json tracked-backup.json
cp src/data/snapshots.json snapshots-backup.json

# Jalankan application - data akan otomatis menggunakan Supabase
npm start
```

## Troubleshooting

### Connection Error

Pastikan connection string benar:
- Host: `aws-0-ap-northeast-1.pooler.supabase.com` (bukan aws-1)
- Port: `5432`
- Database: `postgres`
- User: `postgres.PROJECT_REF`
- Password: [Database password dari Supabase Dashboard > Settings > Database]

### Permission Denied

Pastikan RLS (Row Level Security) dimatikan untuk development:
```sql
ALTER TABLE tracked_coins DISABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE api_cache DISABLE ROW LEVEL SECURITY;
```

### View Not Found

Jika error `view tracked_with_latest_snapshot does not exist`, jalankan ulang `schema.sql`.
