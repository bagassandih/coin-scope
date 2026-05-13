# CoinScope - Algoritma Scoring

## Pipeline Proses (Urutan Wajib)

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Step 1    │───▶│   Step 2    │───▶│   Step 3    │───▶│   Step 4    │───▶│   Step 5    │───▶│   Step 6    │
│ Fetch       │    │ Hard Filter │    │ Normalisasi │    │ Weighted    │    │ Ranking     │    │ Display     │
│ Universe    │    │             │    │ Metrik      │    │ Scoring     │    │ Top 5       │    │ Output      │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
     │                   │                   │                   │                   │                   │
     ▼                   ▼                   ▼                   ▼                   ▼                   ▼
 List raw         List koin        Nilai 0-100       Weighted         Top 5 final       Output ke
 ~500 koin        lolos filter      per metrik       Score 0-100       list             user
```

### Step 1: Fetch Universe

| Parameter | Value |
|-----------|-------|
| Input | Top N koin dari CMC API |
| Default | Top 500 berdasarkan `cmc_rank` |
| Output | List raw ~500 koin |

### Step 2: Hard Filter

Eliminasi koin yang TIDAK memenuhi kriteria minimum. **Gagal 1 = dibuang.**

Lihat detail di [Hard Filter](#hard-filter--kriteria-wajib) di bawah.

### Step 3: Normalisasi Metrik

Min-max normalization ke skala 0–100:

```
normalized_value = (value - min_value) / (max_value - min_value) × 100
```

### Step 4: Weighted Scoring

Hitung skor akhir dengan formula di [Weighted Scoring Formula](#weighted-scoring--formula-resmi).

### Step 5: Ranking & Top 5

Urutkan descending by Weighted Score. Ambil 5 teratas.

### Step 6: Display Output

Tampilkan ke terminal dengan format di [Spesifikasi Output](./06-output-spec.md).

---

## Hard Filter — Kriteria Wajib

> Koin HARUS lolos SEMUA filter di bawah. Tidak ada pengecualian.

| Filter | Threshold | Alasan |
|--------|-----------|--------|
| **7d Price Change** | > 0% (positif) | Koin yang turun tidak punya momentum |
| **Market Cap Minimum** | > $50 juta USD | Hindari koin illiquid & pump & dump |
| **Volume 24h Minimum** | > $1 juta USD | Pastikan likuiditas cukup |
| **CMC Rank** | ≤ 500 | Batasi ke koin dengan track record |
| **Circulating Supply** | > 0 (tidak null) | Bisa dievaluasi dengan benar |

---

## Weighted Scoring — Formula Resmi

### Formula

```
Weighted Score = (S_7d × 40%) + (S_vol × 30%) + (S_mcap_tier × 20%) + (S_24h × 10%)
```

Dimana `S_*` = nilai metrik yang sudah dinormalisasi ke skala 0–100.

### Detail Per Metrik

| Metrik | Bobot | Cara Hitung | Alasan Bobot |
|--------|-------|-------------|--------------|
| **7d Price Change** (S_7d) | 40% | Min-max normalize `percent_change_7d` | Momentum mingguan = sinyal terkuat |
| **Volume Spike** (S_vol) | 30% | Normalize: `volume_24h / (market_cap × 0.01)` | Volume konfirmasi tren |
| **Market Cap Tier** (S_mcap) | 20% | Large=25, Mid=50, Small=75, Micro=100 | Trade-off risiko-reward |
| **24h Price Change** (S_24h) | 10% | Min-max normalize `percent_change_24h` | Konfirmasi jangka sangat pendek |

### Market Cap Tier Scoring

| Tier | Market Cap Range | Skor |
|------|------------------|------|
| Large Cap | > $10B | 25 |
| Mid Cap | $1B – $10B | 50 |
| Small Cap | $100M – $1B | 75 |
| Micro Cap | < $100M | 100 |

> Skor lebih tinggi = lebih spekulatif (potensi upside lebih besar, risiko lebih tinggi)

---

## Pseudocode

```python
def calculate_weighted_score(coin):
    # Normalisasi min-max (perlu hitung min/max dari universe dulu)
    s_7d = normalize(coin.percent_change_7d, min_7d, max_7d)
    s_24h = normalize(coin.percent_change_24h, min_24h, max_24h)

    # Volume ratio
    volume_ratio = coin.volume_24h / (coin.market_cap * 0.01)
    s_vol = normalize(volume_ratio, min_vol, max_vol)

    # Market cap tier
    s_mcap = get_tier_score(coin.market_cap)

    # Weighted score
    score = (s_7d * 0.40) + (s_vol * 0.30) + (s_mcap * 0.20) + (s_24h * 0.10)

    return score
```
