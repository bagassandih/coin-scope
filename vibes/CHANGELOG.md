# Changelog

All notable changes to CoinScope will be documented in this file.

## [2.2.0] - 2026-06-09

### Changed - Optimized for 1-Month Spot Trading

**Removed 60d Trend:**
- 60d data removed from scoring (not needed for max 4-week hold time)
- Trading style: 1 day to 4 weeks hold time
- Focus on 30d as maximum relevant timeframe

**New Scoring Formula (v2.2):**
```
Score = 30d(40%) + Volume(25%) + 7d(20%) + 24h(10%) + Mcap(5%) + Bonuses
```

**Weight Changes:**
- 30d: **40%** (PRIMARY - max 1 month hold target)
- Volume: **25%** (confirms real movement)
- 7d: **20%** (short-term momentum)
- 24h: **10%** (entry timing)
- Mcap: **5%** (risk management)

**Timeframe Relevance:**
| Data | Relevan? | Reason |
|------|----------|--------|
| 24h | ✅ | Entry timing (scalping/day trade) |
| 7d | ✅ | Short-term swing (1 week hold) |
| 30d | ✅ | Max hold target (4 weeks) |
| 60d | ❌ | Too long (never hold 2 months) |

---

## [2.1.0] - 2026-06-09

### Changed - Remove Binance, CMC Only

**Removed:**
- Binance Public API integration (SSL certificate issues)
- `USE_BINANCE` config option
- `src/binance.js` module
- Funding rate sentiment scoring

**Now 100% CMC Data:**
- All scoring components use CoinMarketCap data only
- Simpler codebase without external dependencies
- Faster execution (no API latency from Binance)

**Non-Latin Symbol Filter (Added):**
- Filters coins with Chinese/other non-Latin symbols
- Prevents matching issues with trading pairs
- Rejects 1 coin in current universe ("币安人生")

**Technical Changes:**
- Updated scoring formula to v2.1 (CMC-only)
- Removed `enrichWithBinanceSentiment` function
- Updated config, index.js, server.js

---

## [2.0.0] - 2026-06-09

### Added - Enhanced Scoring Engine (v2.0)

**New CMC Extended Data Fields:**
- `percent_change_60d` and `percent_change_90d` - Longer trend confirmation
- `total_supply` and `max_supply` - Dilution risk calculation
- `num_market_pairs` - Exchange presence (liquidity proxy)
- `tags` - Sector filtering (AI, DeFi, Layer-1, Layer-2, RWA, Meme)

**New Binance Public API Integration:**
- Funding rate sentiment analysis (free, no API key required)
- Open interest data available
- Long/Short ratio data available
- Batch fetching for efficiency
- Sentiment score: -10 (overly bullish/risky) to +10 (overly bearish/opportunity)

**New Scoring Formula (v2.0):**
```
Score = (60d × 30%) + (30d × 15%) + (7d × 10%) + (Volume × 25%) + (Mcap Tier × 5%) + (24h × 5%) + Sentiment
```

**New Scoring Components:**
- **Supply Dilution Risk** (-10 penalty): High inflation risk when <50% supply circulating
- **Sector Bonus** (+5 points): Bonus for hot sectors (AI, DeFi, RWA, Meme)
- **Healthy Trend Bonus** (+15 points): Reduced from v1.2, now requires positive 60d trend
- **Sentiment Score** (±10 points): From Binance funding rates

**Weight Changes vs v1.2:**
- 60d trend: 30% (NEW - most reliable indicator)
- 30d trend: 15% (reduced from 48%)
- 7d trend: 10% (reduced from 12%)
- Volume: 25% (unchanged)
- Mcap Tier: 5% (reduced from 10%)
- 24h: 5% (unchanged)

**Environment Variables:**
- `USE_BINANCE=false` - Set to `true` to enable Binance sentiment data
  - ⚠️ Note: Binance API currently has SSL certificate issues (2026-06-09)
  - If enabled, system will continue without funding data if API fails

**Technical Changes:**
- New file: `src/binance.js` - Binance Public API integration
- Updated: `src/fetcher.js` - Extended CMC data extraction
- Updated: `src/config.js` - New weights and USE_BINANCE flag
- Updated: `src/scorer.js` - v2.0 scoring formula with new components
- Updated: `src/index.js` - Binance enrichment step
- Updated: `src/server.js` - API endpoints support Binance data
- Updated: `package.json` - Version bump to 2.0.0

---

## [1.5.0] - 2026-06-08

### Added - AI Analyze Feature

**Core Functionality:**
- AI-powered analysis for Top 5 coins using NVIDIA NIM API (Llama 3.3 70B Instruct)
- PICK/PASS recommendations with detailed reasoning
- Server-side AI calls (API key secured on backend)
- Supabase caching with 3600s TTL
- Re-Analyze functionality when cache exists

**UI Elements:**
- AI Analyze button in Top 5 tab with 30s cooldown
- AI badges on coin cards (🟢 PICK / 🔴 PASS) displayed between Score and metrics
- Detailed reasoning modal on card click
- Loading overlay with progress indication
- SweetAlert2 confirmations for analyze/re-analyze actions

**Button States:**
- "🤖 AI Analyze" - Initial state or when no cache exists
- "🔄 Re-Analyze" - When cached analysis exists
- "Analyze in Xs" - During cooldown countdown

**AI Output (Indonesian):**
- Recommendation: PICK atau PASS
- Reasoning: 2-3 kalimat penjelasan
- Breakdown: Momentum, volume, market cap tier, score analysis

**API Endpoint:**
- GET `/api/analyze?refresh=false` - Use cache if available
- GET `/api/analyze?refresh=true` - Force fresh AI call

**Data Flow:**
1. User clicks Analyze → Confirmation → Loading
2. Server checks Supabase cache (TTL 3600s)
3. Cache miss → Call NVIDIA API → Store results
4. Returns analysis with PICK/PASS + reasoning
5. Renders badges on coin cards
6. Click card → Shows detailed breakdown modal

**Environment Variables:**
- NVIDIA_API_KEY - NVIDIA NIM API key
- NVIDIA_MODEL - Model name (default: meta/llama-3.3-70b-instruct)
- NVIDIA_API_URL - API endpoint URL

### Fixed
- Tracked tab card click showing "null(null)" in title - fixed to use tracking_id
- Closed tab card click failing with UUID error - fixed to use tracking_id

### Technical
- New file: `src/nvidia.js` - NVIDIA API integration module
- Cache key: `ai_analysis_top5`
- Position-based coin_id matching (AI returns in same order as input)
- Frontend variables: `aiAnalysisResults`, `hasAiCache`, `aiCooldown`

---

## [1.4.0] - 2026-05-23

### Added - Closed Tab Redesign

**Stats Bar:**
- Total Closed count
- Win Rate percentage
- Avg PNL with profit/loss subtext: "(X profit / Y loss)"

**Filter Improvements:**
- Count badges per category: "Take Profit (1)", "Cutloss (0)", etc.
- Empty filters dimmed (40% opacity) and disabled
- "Stagnan/Boring" shortened to "Stagnan"
- Filter bar always visible with context-aware empty states

**Card Layout (Desktop - 6 columns):**
- Logo | Info | Prices | PNL | Durasi | Closed
- Entry/Exit price display (e.g., "Entry: $0.0209", "Exit: $0.0228")
- PNL badge with caption "P/L" above value (cleaner look)
- Prominent PNL styling: 18px font, colored background + border
- Duration in days, Closed date in compact format (e.g., "23 Mei")

**Card Layout (Mobile - 2x3 grid):**
- [Logo + Info] | [Prices + PNL] | [Duration + Closed]

**UX Decisions:**
- Removed "Track Lagi" & "Delete" buttons (closed positions = read-only historical records)
- Click card to view full history in modal
- All data from `coin.performance`: first_price, last_price, price_change_percent

**Visual Polish:**
- Vertical center alignment for all card elements
- Track Lagi button: purple outline (1.5px border, 0.7 opacity)
- Delete button: red outline (1.5px border, 0.7 opacity)
- Stats bar dividers: 0.12 opacity (more visible)
- Label-value gap: 5px for breathing room

### Changed
- Closed positions now display Entry & Exit prices directly in card
- PNL calculation uses `coin.performance.last_price` as exit price
- Filter empty states show relevant CTAs based on context

### Technical
- Added CSS: `.closed-stats-bar`, `.price-context`, `.pnl-section`
- Grid template: `auto 1fr auto auto auto auto` (desktop), `auto 1fr` (mobile)
- Data source: `coin.performance.last_price` for exit price

---

## [1.3.0] - 2026-05-23

### Added - UX Improvements (Mobile)

**Phase 1 - Quick Wins:**
- Horizontal compact status bar (saves ~120px vertical space)
- Score color coding: green (>70), yellow (40-70), red (<40)
- Rank colors: gold (#1), silver (#2), bronze (#3)
- Prominent PnL badges in tracked cards
- Tab active bottom border indicator
- Improved tab badge spacing and separators

**Phase 2 - Medium Effort:**
- Animated progress bar for refresh countdown
- Conditional filter bar (hidden when no closed positions)
- Typography scale system (22px/17px/14px/12px/11px)
- 8px-based spacing system with CSS variables
- Empty state CTA buttons with navigation

**Phase 3 - Polish:**
- Minimal footer with "Info Scoring" modal
- Pull-to-refresh gesture for mobile
- Smooth animations and transitions
- Accessibility: skip link, focus indicators
- Reduced motion support (@prefers-reduced-motion)

### Changed
- Footer disclaimer is now minimal (11px, 40% opacity)
- Scoring formula moved to modal instead of main screen
- All spacing uses CSS variables for consistency
- All typography uses CSS variables for consistency

### Technical
- Added CSS variables: `--text-display`, `--text-title`, `--text-body`, `--text-caption`, `--text-badge`
- Added CSS variables: `--space-1` through `--space-12` (8px-based)
- Added `:focus-visible` styles for keyboard navigation
- Added touch handlers for pull-to-refresh gesture

---

## [1.2.0] - Previous

### Added
- Close position feature with UI enhancements
- Favicon.svg
- WIB timestamps in deployment and fetcher scripts
