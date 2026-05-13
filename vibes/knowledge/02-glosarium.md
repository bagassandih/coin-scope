# CoinScope - Glosarium & Definisi

> Semua istilah di bawah adalah **definisi resmi** yang dipakai sistem ini. Jika ada perbedaan pemahaman, refer ke sini.

## Istilah Utama

### Koin Berpotensi Naik

| Aspek | Detail |
|-------|--------|
| **Definisi** | Koin dengan Weighted Score ≥ threshold minimum |
| **Berdasarkan** | Kombinasi momentum harga 7 hari, lonjakan volume, tier market cap |
| **Catatan** | Bukan prediksi. Ini ranking berbasis data historis |

### Gainer Mingguan (7d)

| Aspek | Detail |
|-------|--------|
| **Definisi** | Koin dengan persentase kenaikan harga dalam 7 hari terakhir > 0% |
| **Source Field** | `percent_change_7d` dari CMC API |
| **Catatan** | Bisa negatif. Koin dengan 7d negatif otomatis di-filter out |

### Volume Spike

| Aspek | Detail |
|-------|--------|
| **Definisi** | Rasio volume_24h saat ini vs rata-rata volume historis |
| **Threshold** | Spike = rasio > 1.5x (150% di atas rata-rata) |
| **Limitasi** | CMC free tier tidak provide historical average |
| **Solusi** | Hitung sendiri atau gunakan volume_24h relatif terhadap market_cap |

### Market Cap Tier

| Tier | Range Market Cap | Skor Risiko |
|------|-----------------|-------------|
| **Large Cap** | > $10B | Paling stabil |
| **Mid Cap** | $1B – $10B | Sedang |
| **Small Cap** | $100M – $1B | Agak spekulatif |
| **Micro Cap** | < $100M | Paling spekulatif |

> Tier menentukan bobot risiko dalam scoring. Micro Cap = potensi upside lebih besar tapi risiko lebih tinggi.

### Weighted Score

| Aspek | Detail |
|-------|--------|
| **Definisi** | Nilai numerik 0–100 dari kombinasi metrik dengan bobot tertentu |
| **Fungsi** | Satu-satunya basis ranking |
| **Formula** | Lihat [Algoritma Scoring](./04-algoritma.md) |

### Top 5 Rekomendasi

| Aspek | Detail |
|-------|--------|
| **Definisi** | 5 koin dengan Weighted Score tertinggi setelah filter |
| **Catatan** | Bukan rekomendasi investasi. Ini output scoring algoritma |

### Timeframe Prediksi

| Aspek | Detail |
|-------|--------|
| **Horizon** | 30 hari ke depan |
| **Update** | Tidak realtime; dijalankan periodik (misal: mingguan) |
| **Catatan** | Sistem tidak bisa 'memprediksi' 30 hari. Yang dilakukan: ranking momentum saat ini |

### CMC API Free Tier

| Batasan | Detail |
|---------|--------|
| API Calls | 333 calls/hari |
| Data Delay | ~5 menit dari real-time |
| Historical Data | Tidak ada OHLCV historis |

> Batasan ini menentukan arsitektur sistem. Historical avg harus di-cache sendiri.
