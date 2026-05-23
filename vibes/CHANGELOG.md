# Changelog

All notable changes to CoinScope will be documented in this file.

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
