# Changelog

All notable changes to CoinScope will be documented in this file.

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
