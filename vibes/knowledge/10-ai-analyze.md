# AI Analyze Feature Design

**Project:** CoinScope
**Date:** 2025-01-08
**Status:** Approved
**Author:** Claude (User Assistant)

## Overview

Add AI-powered analysis feature for Top 5 coins using Llama 3.3 70B Instruct model via NVIDIA NIM API. Provides PICK/PASS recommendations with reasoning and detailed breakdown per coin.

## Architecture

```
Frontend (app.js) → Server (server.js) → NVIDIA NIM API → Return Analysis
     ↓                    ↓                     ↓
  Display Modal      Cache Layer          Llama 3.3 70B
```

### Flow

1. User clicks "AI Analyze Top 5" button in Top 5 tab
2. Frontend calls `GET /api/analyze?refresh=false`
3. Server checks cache (TTL: 3600s, same as CMC cache)
4. If cache valid → return cached results
5. If expired/missing → call NVIDIA NIM API
6. Parse & cache results → return to frontend
7. Frontend displays modal with analysis per coin

## Components

### Frontend

**AI Analyze Button**
- Location: Tab Top 5, below "Refresh Data" button
- Styling: Purple gradient, AI icon, loading state
- Disabled when: No coins available, already analyzing

**Results Modal**
- ID: `aiAnalysisModal`
- Content: 5 coin analysis cards stacked vertically
- Footer: Cache status, "Re-analyze" button

**Per Coin Analysis Card**
```javascript
{
  coin_id: integer,
  symbol: string,
  name: string,
  recommendation: "PICK" | "PASS" | "ERROR",
  reasoning: string,  // 2-3 sentences
  breakdown: string[]  // 4-5 bullet points
}
```

### Backend

**`/api/analyze` Endpoint**
```javascript
GET /api/analyze?refresh=false
Response:
{
  success: true,
  source: "cache" | "api",
  cached_at?: string,
  expires_at?: string,
  analysis: [...]
}
```

**`src/nvidia.js` Module**
- `callNvidiaAPI(coins, scoringInfo)` - Main API call
- `formatPrompt(coins, scoringInfo)` - Prompt construction
- `parseResponse(response)` - JSON parsing with error handling

## NVIDIA API Integration

### Environment Variables

```bash
NVIDIA_API_KEY=nvapi-xxx...
NVIDIA_MODEL=meta/llama-3.3-70b-instruct
NVIDIA_API_URL=https://integrate.api.nvidia.com/v1/chat/completions
```

### API Call

```javascript
{
  model: "meta/llama-3.3-70b-instruct",
  messages: [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: USER_PROMPT }
  ],
  temperature: 0.3,
  max_tokens: 2000,
  response_format: { type: "json_object" }
}
```

### Prompt Structure

**System Prompt:** Defines role, output format, PICK/PASS rules

**User Prompt:** Contains:
- Scoring system explanation
- Coin data (price, changes, volume, market cap, tier, score)
- Request for JSON array only

## Data Sent to AI

Per coin:
- Basic: name, symbol, price
- Price changes: 7d, 24h, 30d percentages
- Volume: 24h volume in USD
- Market cap: Total market cap
- System score: Weighted score (0-100)
- Tier: Micro/Small/Mid/Large cap label
- Scoring formula info: Algorithm explanation

## Output Format

Per coin:
1. **Recommendation:** PICK or PASS
2. **Brief Reasoning:** 2-3 sentences explaining the decision
3. **Detailed Breakdown:** 4-5 bullet points covering:
   - Momentum analysis (7d, 24h trends)
   - Volume health assessment
   - Market cap risk evaluation
   - System score interpretation
   - Overall conclusion

## Caching Strategy

- **Key:** `ai_analysis_top5`
- **Storage:** Supabase `api_cache` table (existing)
- **TTL:** 3600s (same as CMC cache)
- **Invalidation:**
  - TTL expiration
  - User clicks "Refresh Data"
  - Manual "Re-analyze" (`?refresh=true`)

## Error Handling

| Scenario | Behavior |
|----------|----------|
| NVIDIA API error (4xx/5xx) | Return error cards, "Try again later" |
| Rate limit (429) | Return cached if available, else error |
| Invalid JSON | Log error, return error cards |
| Partial success (3/5 coins) | "Analyzed 3/5" badge, error coins retryable |
| No top5 coins | Button disabled |

## UI/UX Design

### Button Styling
- Purple gradient background
- White text, AI icon
- Hover: lift effect
- Disabled: 50% opacity

### Modal Styling
- Large modal (max-width: 800px)
- Scrollable for mobile
- Coin cards with recommendation badges

### Recommendation Colors
- PICK: Green gradient (#10b981 → #059669)
- PASS: Red gradient (#ef4444 → #dc2626)
- ERROR: Gray (#64748b)

### Mobile Responsive
- Modal: 95% width, 80vh max height
- Coin cards: stacked, 12px margin
- Scrollable body

## Implementation Files

**New:**
- `src/nvidia.js` - NVIDIA API integration

**Modified:**
- `.env` - Add NVIDIA credentials
- `src/server.js` - Add `/api/analyze` endpoint
- `public/index.html` - Add button + modal HTML
- `public/app.js` - Add frontend logic
- `public/style.css` - Add styling

## Implementation Order

1. **Phase 1: Backend**
   - Add NVIDIA credentials to `.env`
   - Create `src/nvidia.js`
   - Add `/api/analyze` endpoint
   - Implement caching

2. **Phase 2: Frontend**
   - Add button HTML
   - Add modal HTML
   - Add CSS styling
   - Implement `analyzeTop5()` function

3. **Phase 3: Testing**
   - Test with real data
   - Test error scenarios
   - Test cache behavior
   - Mobile responsive test

## Testing Checklist

- [ ] First click: loading → results
- [ ] Cached click: instant results
- [ ] Re-analyze: force refresh works
- [ ] API down: error message shows
- [ ] Invalid JSON: error handling works
- [ ] No coins: button disabled
- [ ] Mobile: scrollable, readable
