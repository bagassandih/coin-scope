# CoinScope Knowledge Base

> Base knowledge untuk proyek CoinScope - Sistem Lacak Koin Berpotensi Naik berbasis CoinMarketCap API.

## 📚 Daftar Dokumen

| Dokumen | Deskripsi |
|---------|-----------|
| [01-overview.md](./01-overview.md) | Ringkasan eksekutif & arsitektur high-level |
| [02-glosarium.md](./02-glosarium.md) | Definisi istilah & konsep kunci |
| [03-data-source.md](./03-data-source.md) | Sumber data CMC API & batasan |
| [04-algoritma.md](./04-algoritma.md) | Pipeline proses & formula scoring |
| [05-requirements.md](./05-requirements.md) | Functional & non-functional requirements |
| [06-output-spec.md](./06-output-spec.md) | Spesifikasi format output terminal |
| [07-open-questions.md](./07-open-questions.md) | Pertanyaan yang perlu dijawab sebelum dev (✅ RESOLVED) |
| [08-roadmap.md](./08-roadmap.md) | Roadmap versi v1.0 s/d v2.0 |
| [09-changelog.md](./09-changelog.md) | **NEW:** Changelog & implementation notes v1.0 |

## 🎯 Quick Reference

### Algoritma Scoring

```
Weighted Score = (S_7d × 40%) + (S_vol × 30%) + (S_mcap × 20%) + (S_24h × 10%)
```

### Hard Filter

| Filter | Threshold |
|--------|-----------|
| 7d Price Change | > **1%** (stablecoin filter) |
| Market Cap | > $50M |
| Volume 24h | > $1M |
| CMC Rank | ≤ 500 |
| Circulating Supply | > 0 |

### Pipeline

```
Fetch Universe → Hard Filter → Normalisasi → Scoring → Ranking → Display
```

## 🚀 Status Development

| Versi | Status | Target |
|-------|--------|--------|
| v1.0 | ✅ **Released** | MVP + Web UI |
| v1.0.1 | ✅ **Released** | Tracking Mode (Entry/CMC) + Snapshot Fix |
| v1.1 | 🔮 Planned | Historical Tracking |
| v1.2 | 🔮 Planned | Otomasi |
| v2.0 | 🔮 Planned | Scale Up |

## ✅ Open Questions - RESOLVED

| ID | Pertanyaan | Keputusan |
|----|------------|-----------|
| OQ-01 | Stablecoin exclusion | **Threshold 7d < 1%** |
| OQ-02 | < 5 koin lolos filter | **Tampilkan semua yang ada** |
| OQ-03 | API key storage | **`.env` file** |
| OQ-04 | Tech stack | **Node.js** |
| OQ-05 | Error handling | **Retry exponential backoff** |

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Web Server:** Express.js
- **HTTP Client:** Axios
- **Notifications:** SweetAlert2
- **CLI:** Chalk + CLI-Table3

## 📝 Metadata

| Field | Value |
|-------|-------|
| Dibuat | 13 Mei 2026 |
| Versi PRD | 1.0.0 |
| Status v1.0 | ✅ Released |
