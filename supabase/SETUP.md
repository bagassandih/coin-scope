# Setup Supabase untuk CoinScope

## Langkah 1: Dapatkan Kredensial Supabase

1. Buka [Supabase Dashboard](https://supabase.com/dashboard)
2. Pilih project Anda
3. Navigate ke **Settings → API**

Salin informasi berikut:

```
Project URL: https://qtiobbaxblbfgrxpjlyt.supabase.co
anon/public key: [COPY DARI SINI]
```

## Langkah 2: Jalankan SQL Schema

1. Navigate ke **SQL Editor** di sidebar
2. Klik **New Query**
3. Copy dan paste isi dari `supabase/schema.sql`
4. Klik **Run** ▶️

Tunggu hingga semua tabel dan view berhasil dibuat.

## Langkah 3: Update .env File

Edit file `.env` dan update bagian Supabase:

```env
# Supabase Configuration
SUPABASE_URL=https://qtiobbaxblbfgrxpjlyt.supabase.co
SUPABASE_ANON_KEY=PASTE_ANON_KEY_DISINI
SUPABASE_DB_URL=postgresql://postgres.qtiobbaxblbfgrxpjlyt:kBHD92mUhuPKdHL9@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
```

**PENTING:** Ganti `PASTE_ANON_KEY_DISINI` dengan anon key dari Langkah 1.

## Langkah 4: Disable RLS (Row Level Security)

Untuk development, matikan RLS agar API bisa mengakses data:

Di SQL Editor, jalankan:

```sql
ALTER TABLE tracked_coins DISABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE api_cache DISABLE ROW LEVEL SECURITY;
```

## Langkah 5: Test Connection

Jalankan aplikasi:

```bash
npm start
```

Buka http://localhost:3000 dan coba:
1. Klik tombol ⭐ pada koin untuk track
2. Refresh halaman - tracked coins harus tetap ada
3. Cek di Supabase Dashboard → Table Editor → tracked_coins

## Troubleshooting

### Error: "Invalid API key"
- Pastikan anon key di-copy dengan benar dari Settings → API
- Jangan gunakan service_role key untuk development

### Error: "relation does not exist"
- Pastikan schema.sql sudah dijalankan di SQL Editor
- Cek di Table Editor apakah tabel sudah muncul

### Error: "Permission denied"
- Pastikan RLS sudah dimatikan (Langkah 4)
- Atau set RLS policies:
```sql
-- Alternatif: Buat policy allow all
CREATE POLICY "Enable all access for tracked_coins" ON tracked_coins
FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for snapshots" ON snapshots
FOR ALL USING (true) WITH CHECK (true);
```

## Database Structure

Setelah setup, struktur database akan terlihat seperti ini:

```
┌─────────────────┐     ┌─────────────────┐
│ tracked_coins   │────▶│   snapshots     │
├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (UUID)       │
│ symbol          │     │ coin_id (FK)    │
│ name            │     │ price           │
│ tracking_mode   │     │ percent_change_7d│
│ entry_price     │     │ percent_change_24h│
│ entry_timestamp │     │ score           │
└─────────────────┘     │ timestamp       │
                        └─────────────────┘
```
