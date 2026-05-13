# CoinScope - Open Questions

> Pertanyaan yang perlu dijawab sebelum development dimulai.

## OQ-01: Stablecoin Exclusion

| Attribute | Detail |
|-----------|--------|
| **Pertanyaan** | Apakah stablecoin di-exclude by hardcoded list atau by threshold? |
| **Opsi A** | Hardcoded list (USDT, USDC, DAI, dll.) |
| **Opsi B** | By threshold (misal: 7d change < 1%) |
| **Impact** | Kalau tidak didefinisikan, stablecoin bisa masuk Top 5 saat market flat |
| **Rekomendasi** | Hardcoded list + threshold sebagai fallback |

**Stablecoin List:**
- USDT (Tether)
- USDC (USD Coin)
- DAI (Dai Stablecoin)
- BUSD (Binance USD)
- USTC (TerraClassicUSD)
- TUSD (TrueUSD)
- FDUSD (First Digital USD)
- PYUSD (PayPal USD)

---

## OQ-02: Kurang dari 5 Koin Lolos Filter

| Attribute | Detail |
|-----------|--------|
| **Pertanyaan** | Apa yang terjadi kalau koin yang lolos filter < 5? |
| **Opsi A** | Tetap tampilkan semua yang ada |
| **Opsi B** | Tampilkan error dan stop |
| **Opsi C** | Turunkan threshold filter secara otomatis |
| **Impact** | Edge case yang bisa break display logic |
| **Rekomendasi** | Opsi A - tampilkan semua yang ada dengan warning |

---

## OQ-03: API Key Storage

| Attribute | Detail |
|-----------|--------|
| **Pertanyaan** | CMC API key mau disimpan di mana? |
| **Opsi A** | `.env` file (recommended) |
| **Opsi B** | Config file (JSON/YAML) |
| **Opsi C** | Input manual setiap run |
| **Opsi D** | Environment variable sistem |
| **Impact** | Security concern & portability |
| **Rekomendasi** | Opsi A - `.env` file (gitignored) |

**Contoh `.env`:**
```
CMC_API_KEY=your_api_key_here
CACHE_TTL=3600
UNIVERSE_SIZE=500
```

---

## OQ-04: Tech Stack

| Attribute | Detail |
|-----------|--------|
| **Pertanyaan** | Tech stack: Python atau JavaScript/Node.js? |
| **Opsi A** | Python |
| **Opsi B** | JavaScript/Node.js |
| **Impact** | Menentukan library yang dipakai untuk display |

### Comparison

| Aspect | Python | JavaScript/Node.js |
|--------|--------|-------------------|
| **HTTP Client** | `requests`, `httpx` | `axios`, `node-fetch` |
| **Table Display** | `tabulate`, `rich`, `textual` | `cli-table3`, `table` |
| **Data Processing** | `pandas` | -
| **Config** | `python-dotenv`, `pydantic` | `dotenv`, `config` |
| **Type Safety** | Optional (via typing/mypy) | TypeScript (native) |

**Rekomendasi:** Python untuk data processing yang lebih mudah.

---

## OQ-05: Error Handling CMC API

| Attribute | Detail |
|-----------|--------|
| **Pertanyaan** | Bagaimana handle error dari CMC API? |
| **Scenario** | Rate limit, network error, invalid key |
| **Opsi A** | Retry dengan exponential backoff |
| **Opsi B** | Fail fast dengan error message |
| **Opsi C** | Gunakan cached data jika available |

**Rekomendasi:** Opsi A + C (Retry dulu, kalau tetap gagal pakai cache)

---

## Status Checklist

| ID | Pertanyaan | Status | Keputusan |
|----|------------|--------|-----------|
| OQ-01 | Stablecoin exclusion | ✅ **Resolved** | **Opsi B**: By threshold (7d change < 1%) |
| OQ-02 | < 5 koin lolos filter | ✅ **Resolved** | **Tampilkan semua yang ada** (tanpa error) |
| OQ-03 | API key storage | ✅ **Resolved** | **Opsi A**: `.env` file (gitignored) |
| OQ-04 | Tech stack | ✅ **Resolved** | **Node.js / JavaScript** |
| OQ-05 | Error handling | ✅ **Resolved** | **Retry dengan exponential backoff** |

---

## 🎯 Keputusan Teknis Final

### OQ-01: Stablecoin Exclusion ✅

**Keputusan:** By threshold (7d change < 1%)

**Implementasi:**
```javascript
// Filter logic
if (coin.percent_change_7d < 1.0) {
  return false;  // Exclude stablecoin & coin flat
}
```

**Alasan:** Lebih fleksibel, tidak perlu maintain hardcoded list.

---

### OQ-02: < 5 Koin Lolos Filter ✅

**Keputusan:** Tampilkan semua yang ada

**Implementasi:**
```javascript
const topCoins = scoredCoins.slice(0, 5);
// Bisa 0-5 koin, tidak error
```

---

### OQ-03: API Key Storage ✅

**Keputusan:** `.env` file

**Implementasi:**
```env
# .env (gitignored)
CMC_API_KEY=your_api_key_here
CACHE_TTL=3600
UNIVERSE_SIZE=500
```

---

### OQ-04: Tech Stack ✅

**Keputusan:** **Node.js / JavaScript**

**Library Stack:**
| Need | Library |
|------|---------|
| HTTP Client | `axios` |
| CLI/Table | `cli-table3`, `chalk` |
| Config | `dotenv` |
| Cache | File system JSON |

---

### OQ-05: Error Handling ✅

**Keputusan:** Retry dengan exponential backoff

**Implementasi:**
```javascript
// Retry logic
// 1st retry: 1s
// 2nd retry: 2s
// 3rd retry: 4s
// Max retry: 3
```

**Catatan:** System runs weekly, aman dari rate limit (333 calls/day).
