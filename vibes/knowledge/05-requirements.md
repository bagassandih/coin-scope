# CoinScope - Functional Requirements

## Fitur Wajib (Must Have — v1.0)

### FR-01: Fetch Data CMC

Sistem harus bisa memanggil CMC API `/listings/latest` dan mengambil minimum 7 field:
- `percent_change_7d`
- `percent_change_24h`
- `percent_change_30d`
- `volume_24h`
- `market_cap`
- `cmc_rank`
- `circulating_supply`

### FR-02: Hard Filter

Sistem harus mengeliminasi koin yang gagal melewati 5 kriteria filter:
1. 7d Price Change > 0%
2. Market Cap > $50M
3. Volume 24h > $1M
4. CMC Rank ≤ 500
5. Circulating Supply > 0

### FR-03: Normalisasi Min-Max

Sistem harus menormalisasi setiap metrik ke skala 0–100 sebelum dikalikan bobot.

```
normalized = (value - min) / (max - min) × 100
```

### FR-04: Weighted Scoring

Sistem harus menghitung Weighted Score sesuai formula:

```
Score = (S_7d × 40%) + (S_vol × 30%) + (S_mcap × 20%) + (S_24h × 10%)
```

### FR-05: Ranking Top 5

Sistem harus menampilkan tepat 5 koin dengan skor tertinggi.

### FR-06: Display Terminal

Output harus tampil di terminal dengan format readable (tabel ASCII atau rich text).

### FR-07: Cache API Response

Sistem harus menyimpan hasil API call ke file lokal dengan TTL 1 jam.

| Attribute | Spec |
|-----------|------|
| Storage | File lokal (JSON) |
| TTL | 1 jam (3600 detik) |
| Behavior | Tidak panggil ulang jika belum expired |

---

## Fitur Opsional (Nice to Have — v1.x)

### FR-08: Notifikasi Telegram

Kirim otomatis Top 5 ke bot Telegram pada jadwal tertentu.

### FR-09: Historical Tracking

Simpan output tiap run ke database lokal (SQLite) untuk evaluasi akurasi setelah 30 hari.

### FR-10: Custom Bobot

User bisa mengubah bobot scoring via config file (JSON/YAML) tanpa edit kode.

### FR-11: Web Dashboard

Visualisasi output di browser lokal (localhost).

---

## Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Performance** | API call < 5 detik (dengan cache) |
| **Reliability** | Handle error CMC API gracefully |
| **Usability** | Output mudah dibaca di terminal |
| **Security** | API key tidak di-hardcode di source code |
| **Maintainability** | Kode modular, mudah modify bobot |

---

## Stablecoin Exclusion

> ✅ **Resolved**: By threshold (7d change < 1%)

**Implementasi:**
```javascript
if (coin.percent_change_7d < 1.0) {
  return false;  // Exclude
}
```

**Alasan**: Lebih fleksibel dari hardcoded list, otomatis exclude stablecoin & coin flat.
