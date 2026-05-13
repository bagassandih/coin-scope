# CoinScope - Overview

## Metadata Dokumen

| Field | Value |
|-------|-------|
| Nama Proyek | CoinTracker / CoinScope |
| Versi | 1.0.0 |
| Status | Draft — Untuk Disepakati |
| Dibuat | 13 Mei 2026 |
| Scope | Personal Tool — Single User |
| Output | Dashboard Terminal / CLI |

## Ringkasan Eksekutif

### Tujuan Sistem

Membangun sistem otomatis berbasis **CoinMarketCap (CMC) API** yang mampu:
- Mengidentifikasi koin kripto berpotensi naik
- Mengevaluasi menggunakan **Weighted Scoring**
- Meranking **Top 5 koin** dengan probabilitas kenaikan dalam 30 hari ke depan

### ⚠️ Disclaimer Krusial

> **Sistem ini BUKAN prediksi harga.**
> - Ini adalah **scoring engine** berbasis momentum historis
> - Output = rekomendasi terstruktur, bukan sinyal beli/jual
> - Akurasi bergantung pada kualitas & ketersediaan data CMC API

### Arsitektur High-Level

```
┌─────────────────────────┐    ┌─────────────────────────┐    ┌─────────────────────────┐
│      INPUT              │    │      PROSES             │    │      OUTPUT             │
│                         │    │                         │    │                         │
│ Data pasar real-time &  │───▶│ Filter → Weighted       │───▶│ Top 5 koin ter-ranking  │
│ historis dari CMC API   │    │ Scoring → Ranking       │    │ tampil di terminal/CLI  │
│ (harga, volume, mcap)   │    │ oleh algoritma          │    │                         │
└─────────────────────────┘    └─────────────────────────┘    └─────────────────────────┘
```

## Referensi Dokumen

- [Glosarium & Definisi](./02-glosarium.md)
- [Sumber Data & API](./03-data-source.md)
- [Algoritma Scoring](./04-algoritma.md)
- [Functional Requirements](./05-requirements.md)
- [Spesifikasi Output](./06-output-spec.md)
- [Open Questions](./07-open-questions.md)
- [Roadmap](./08-roadmap.md)
