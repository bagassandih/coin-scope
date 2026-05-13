# CoinScope - Sumber Data & Batasan API

## Data yang Dipakai dari CMC API

### Endpoint Utama

```
GET /v1/cryptocurrency/listings/latest
```

### Field Mapping

| Field CMC API | Dipakai Untuk | Priority |
|---------------|---------------|----------|
| `percent_change_7d` | Skor momentum mingguan | ⭐⭐⭐ |
| `percent_change_24h` | Momentum jangka pendek | ⭐⭐ |
| `percent_change_30d` | Konteks tren bulanan | ⭐ |
| `volume_24h` | Deteksi volume spike | ⭐⭐⭐ |
| `market_cap` | Penentuan tier & bobot risiko | ⭐⭐⭐ |
| `cmc_rank` | Filter awal: batasi universe koin | ⭐⭐ |
| `circulating_supply` | Validasi likuiditas | ⭐ |

## Batasan CMC Free Tier

### Limitasi yang Harus Diakui

| Batasan | Detail | Impact pada Sistem |
|---------|--------|-------------------|
| **API Calls** | 333 calls/hari | Sistem harus di-cache; jangan panggil API tiap buka dashboard |
| **Data Delay** | ±5 menit dari real-time | Tidak untuk high-frequency trading |
| **No OHLCV** | Tidak ada data historis | Volume spike harus pakai pendekatan alternatif |

### Strategy untuk Mengatasi Batasan

1. **Caching dengan TTL 1 jam**
   - Simpan response API ke file lokal
   - Tidak panggil ulang jika belum expired

2. **Volume Spike Alternatif**
   - Gunakan rasio: `volume_24h / (market_cap × 0.01)`
   - Angka > 1 = volume tinggi relatif

3. **Universe Terbatas**
   - Ambil top 500 koin berdasarkan cmc_rank
   - Filter sebelum scoring untuk hemat processing

## Contoh Response CMC API

```json
{
  "data": [
    {
      "id": 1,
      "name": "Bitcoin",
      "symbol": "BTC",
      "cmc_rank": 1,
      "quote": {
        "USD": {
          "price": 98234.50,
          "volume_24h": 24000000000,
          "market_cap": 1890000000000,
          "percent_change_1h": 0.12,
          "percent_change_24h": 8.1,
          "percent_change_7d": 42.3,
          "percent_change_30d": 15.7
        }
      },
      "circulating_supply": 19600000,
      "total_supply": 21000000
    }
  ]
}
```

## API Key Management

> ⚠️ **Open Question OQ-03**: CMC API key mau disimpan di mana?
> - `.env` file?
> - Config file terpisah?
> - Input manual setiap run?

Perlu keputusan sebelum development dimulai.
