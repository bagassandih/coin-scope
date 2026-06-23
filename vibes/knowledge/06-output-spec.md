# CoinScope - Spesifikasi Output

## Format Display Terminal

### Layout

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         CoinScope - Top 5 Potensi Naik                         ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║ 📅 Timestamp: 2026-05-13 14:30:00 UTC                                          ║
║ 📊 Universe: 500 koin | Lolos Filter: 47 koin                                  ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  #  Koin           Harga      7d      24h     Volume      Market Cap    Score ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  1  Bitcoin (BTC)  $98,234    +42.3%  +8.1%   $2.4B       $1.89T [L]    87.4  ║
║  2  Ethereum (ETH) $3,456     +28.7%  +5.2%   $1.2B       $415B  [L]    82.1  ║
║  3  Solana (SOL)  $145.67    +35.2%  +12.4%  $890M       $62B   [M]    79.8  ║
║  4  Cardano (ADA) $0.45      +18.9%  +3.7%   $234M       $16B   [M]    74.2  ║
║  5  Polkadot (DOT) $7.23     +22.1%  +4.5%   $156M       $9.5B  [M]    71.5  ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║ [L] = Large Cap | [M] = Mid Cap | [S] = Small Cap | [X] = Micro Cap          ║
║ ⚠️  Bukan rekomendasi investasi. Ini scoring berbasis momentum historis.       ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## Field Wajib Per Entry

| # | Field | Contoh | Format |
|---|-------|--------|--------|
| 1 | Nama Koin + Simbol | Bitcoin (BTC) | `{Name} ({Symbol})` |
| 2 | Harga Saat Ini (USD) | $98,234.50 | Currency format |
| 3 | 7d Change (%) | +42.3% | Percentage dengan tanda ± |
| 4 | 24h Change (%) | +8.1% | Percentage dengan tanda ± |
| 5 | Volume 24h (USD) | $2.4B | Short number format (K/M/B/T) |
| 6 | Market Cap + Tier | $1.89T [Large Cap] | Currency + [Tier] |
| 7 | Ranking Posisi | #1 dari Top 5 | `#{position} dari Top 5` |

> **Note v2.2.2**: Weighted Score dihitung internally untuk ranking, tapi **tidak ditampilkan di UI**. Score hanya mechanism untuk determine Top 5, bukan nilai yang perlu di-show ke user.

---

## Metadata Output Wajib

Di atas atau bawah tabel Top 5, sistem harus menampilkan:

| Field | Contoh | Description |
|-------|--------|-------------|
| **Timestamp** | 2026-05-13 14:30:00 UTC | Kapan data di-fetch dari CMC API |
| **Total Universe** | 500 koin | Jumlah koin di-fetch awal |
| **Total Lolos Filter** | 47 koin | Jumlah koin sebelum scoring |
| **Disclaimer** | Bukan rekomendasi investasi | Teks singkat peringatan |

---

## Color Coding (Opsional)

Jika terminal mendukung color:

| Element | Color |
|---------|-------|
| Positive change | Green |
| Negative change | Red |
| Large Cap | Blue |
| Mid Cap | Cyan |
| Small Cap | Yellow |
| Micro Cap | Magenta |

---

## Edge Cases

> ⚠️ **Open Question OQ-02**: Apa yang terjadi kalau koin yang lolos filter < 5?

| Scenario | Behavior |
|----------|----------|
| 0 koin lolos filter | Tampilkan pesan: "Tidak ada koin yang memenuhi kriteria" |
| 1-4 koin lolos filter | Tampilkan semua yang ada (bukan paksa 5) |
| 5+ koin lolos filter | Tampilkan top 5 sesuai scoring |
