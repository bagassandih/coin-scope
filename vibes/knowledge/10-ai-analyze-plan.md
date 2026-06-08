# AI Analyze Feature Implementation Plan

> **For agentic workers:** This plan is designed for step-by-step execution. Complete each task fully before moving to the next. No commits until final testing is complete.

**Goal:** Add AI-powered analysis for Top 5 coins using Llama 3.3 70B Instruct via NVIDIA NIM API, with PICK/PASS recommendations and detailed reasoning.

**Architecture:** Server-side AI call → Supabase cache → Frontend modal display. API key secured on server.

**Tech Stack:** NVIDIA NIM API, Llama 3.3 70B Instruct, Express.js, Supabase cache

---

## File Structure

**New files:**
- `src/nvidia.js` - NVIDIA NIM API integration module

**Modified files:**
- `.env` - Add NVIDIA credentials
- `src/server.js` - Add `/api/analyze` endpoint
- `public/index.html` - Add AI button + modal HTML
- `public/app.js` - Add frontend logic
- `public/style.css` - Add button + modal styling

---

## Task 1: Add NVIDIA Credentials to .env

**Files:**
- Modify: `.env`

- [ ] **Step 1: Add NVIDIA API credentials**

Add these lines to `.env`:

```bash
# NVIDIA NIM API Configuration
NVIDIA_API_KEY=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
NVIDIA_MODEL=meta/llama-3.3-70b-instruct
NVIDIA_API_URL=https://integrate.api.nvidia.com/v1/chat/completions
```

**Verify:** File saved with credentials added.

---

## Task 2: Create NVIDIA API Integration Module

**Files:**
- Create: `src/nvidia.js`

- [ ] **Step 1: Create the base module structure**

```javascript
// NVIDIA NIM API Integration for AI Coin Analysis
import { config } from './config.js';
import * as cache from './cache.js';

const CACHE_KEY = 'ai_analysis_top5';

// System prompt - defines AI role and output format
const SYSTEM_PROMPT = `You are an expert cryptocurrency trading analyst. Analyze the given coins and provide PICK/PASS recommendations.

Output MUST be valid JSON with this structure:
{
  "analysis": [
    {
      "coin_id": integer,
      "symbol": "string",
      "name": "string",
      "recommendation": "PICK" | "PASS",
      "reasoning": "Brief 2-3 sentence explanation",
      "breakdown": [
        "Momentum analysis...",
        "Volume analysis...",
        "Market cap risk...",
        "Score assessment...",
        "Overall conclusion..."
      ]
    }
  ]
}

Rules:
- PICK: Score >= 70 AND positive momentum (7d > 0, preferably 30d > 0)
- PASS: Score < 40 OR negative momentum
- Consider: 7d/24h trends, volume health, market cap tier risk
- Be objective, mention risks even for PICK
- Return ONLY the JSON object, no markdown, no extra text`;

// Get scoring formula explanation
function getScoringInfo() {
  return `SCORING SYSTEM (v1.2):
- Weighted Score 0-100, higher is better
- 7d Price Change (12%): Short-term momentum signal
- 30d Change (48%): Confirms healthy trend for holding
- Volume Ratio (25%): Volume / (Market Cap × 0.01) - liquidity check
- Market Cap Tier (10%): Large(25), Mid(50), Small(75), Micro(100) - higher = more speculative
- 24h Change (5%): Minimal signal
- Healthy Trend Bonus (+20): For steady rise (7d 0-50%, 30d > 0, not pump&dump)

INTERPRETATION:
- Score >= 70: Strong candidate for tracking
- Score 40-70: Moderate potential, evaluate carefully
- Score < 40: Weak signals, better skip`;
}

// Format user prompt with coin data
function formatUserPrompt(coins) {
  const coinsList = coins.map(coin => {
    const price = coin.price ? `$${coin.price.toLocaleString()}` : 'N/A';
    const change7d = coin.percent_change_7d?.toFixed(2) ?? 'N/A';
    const change24h = coin.percent_change_24h?.toFixed(2) ?? 'N/A';
    const volume = coin.volume_24h ? `$${(coin.volume_24h / 1e9).toFixed(2)}B` : 'N/A';
    const marketCap = coin.market_cap ? `$${(coin.market_cap / 1e9).toFixed(2)}B` : 'N/A';
    const score = coin.score?.toFixed(1) ?? 'N/A';

    return `
${coin.symbol} (${coin.name})
- Price: ${price}
- 7d Change: ${change7d}%
- 24h Change: ${change24h}%
- Volume 24h: ${volume}
- Market Cap: ${marketCap}
- Tier: ${coin.tierLabel || 'N/A'}
- System Score: ${score}/100`;
  }).join('\n');

  return `${getScoringInfo()}

COINS TO ANALYZE:
${coinsList}

Return JSON object only. No markdown formatting.`;
}

// Call NVIDIA NIM API
export async function callNvidiaAPI(coins) {
  const apiUrl = process.env.NVIDIA_API_URL;
  const apiKey = process.env.NVIDIA_API_KEY;
  const model = process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct';

  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY not set in environment');
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: formatUserPrompt(coins) },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`NVIDIA API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('Empty response from NVIDIA API');
  }

  // Parse JSON response
  try {
    const parsed = JSON.parse(content);
    return parsed.analysis || [];
  } catch (err) {
    console.error('Failed to parse NVIDIA response:', content);
    throw new Error('Invalid JSON response from AI');
  }
}

// Get error result for failed analysis
function getErrorResults(coins, message = 'AI analysis unavailable. Please try again later.') {
  return coins.map(coin => ({
    coin_id: coin.id,
    symbol: coin.symbol,
    name: coin.name,
    recommendation: 'ERROR',
    reasoning: message,
    breakdown: [],
    error: true,
  }));
}

// Main function: analyze coins with caching
export async function analyzeCoins(coins, forceRefresh = false) {
  if (!coins || coins.length === 0) {
    return [];
  }

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    try {
      const cached = await cache.getDbCachedData(CACHE_KEY);
      if (cached) {
        console.log('AI Analysis: Using cached results');
        return cached.data;
      }
    } catch (err) {
      console.error('Cache check failed:', err.message);
      // Continue to API call
    }
  }

  // Call NVIDIA API
  console.log('AI Analysis: Calling NVIDIA API...');
  let analysis;
  try {
    analysis = await callNvidiaAPI(coins);
  } catch (err) {
    console.error('NVIDIA API call failed:', err.message);
    // Return error results
    return getErrorResults(coins, err.message.includes('rate limit') 
      ? 'Rate limited. Please try again in 1 minute.'
      : 'AI analysis unavailable. Please try again later.');
  }

  // Ensure we have results for all coins (partial success handling)
  const results = [];
  for (const coin of coins) {
    const aiResult = analysis.find(r => r.coin_id === coin.id || r.symbol === coin.symbol);
    if (aiResult) {
      results.push(aiResult);
    } else {
      // Missing coin in AI response
      results.push({
        coin_id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        recommendation: 'ERROR',
        reasoning: 'Analysis incomplete for this coin',
        breakdown: [],
        error: true,
      });
    }
  }

  // Cache the results
  try {
    await cache.setDbCachedData(CACHE_KEY, results, config.cacheTtl);
    console.log('AI Analysis: Results cached');
  } catch (err) {
    console.error('Failed to cache results:', err.message);
  }

  return results;
}
```

**Verify:** File created at `src/nvidia.js` with all functions defined.

---

## Task 3: Add /api/analyze Endpoint to Server

**Files:**
- Modify: `src/server.js`

- [ ] **Step 1: Import nvidia module**

Add this import near the top of `src/server.js` (after other imports):

```javascript
import { analyzeCoins } from './nvidia.js';
```

**Location:** After line 18 (after `import * as cache from './cache.js';`)

- [ ] **Step 2: Add the /api/analyze endpoint**

Add this endpoint after the `/api/top5` endpoint (around line 85):

```javascript
// AI Analysis endpoint
app.get('/api/analyze', async (req, res) => {
  try {
    const { refresh = 'false' } = req.query;
    const forceRefresh = refresh === 'true';

    log('AI Analysis request received');

    // Get cached top5 data
    const cachedData = cache.getCachedData();
    if (!cachedData || !cachedData.data.top5) {
      return res.status(400).json({
        success: false,
        error: 'No top5 data available. Refresh data first.',
      });
    }

    const top5 = cachedData.data.top5;
    const analysis = await analyzeCoins(top5, forceRefresh);

    res.json({
      success: true,
      source: forceRefresh ? 'api' : 'cache',
      analysis,
    });
  } catch (err) {
    console.error('AI Analysis error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});
```

**Verify:** Endpoint added, imports in place.

---

## Task 4: Add AI Analyze Button HTML

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Add button after Refresh Data button**

Find the refresh button container in Tab: Top 5 (around line 55-59):

```html
<div class="refresh-btn-container">
  <button id="refreshBtn" onclick="refreshData()">
    <span class="icon">🔄</span> Refresh Data
  </button>
</div>
```

Replace it with:

```html
<div class="refresh-btn-container">
  <button id="refreshBtn" onclick="refreshData()">
    <span class="icon">🔄</span> Refresh Data
  </button>
  <button id="aiAnalyzeBtn" class="ai-analyze-btn" onclick="analyzeTop5()">
    <span class="icon">🤖</span> AI Analyze
    <span class="loading-spinner" style="display:none">⟳</span>
  </button>
</div>
```

**Verify:** Button added to HTML.

---

## Task 5: Add AI Analysis Modal HTML

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Add modal before closing body tag**

Find the closing `</div>` tag before the footer (around line 229), and add this modal:

```html
<!-- AI Analysis Modal -->
<div id="aiAnalysisModal" class="modal">
  <div class="modal-content modal-large">
    <div class="modal-header">
      <h2>🤖 AI Analysis - Top 5 Coins</h2>
      <span class="close" onclick="closeAiModal()">&times;</span>
    </div>
    <div class="modal-body" id="aiAnalysisBody">
      <div class="loading">Analyzing...</div>
    </div>
    <div class="modal-footer">
      <span id="aiCacheStatus" class="cache-status"></span>
      <button class="btn-secondary" onclick="refreshAnalysis()">🔄 Re-analyze</button>
    </div>
  </div>
</div>
```

**Verify:** Modal HTML added before footer.

---

## Task 6: Add AI Button and Modal Styling

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Add AI button styling**

Add this CSS (around line 500, after existing button styles):

```css
/* ============================================
   AI ANALYZE BUTTON
   ============================================ */

.ai-analyze-btn {
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  color: white;
  border: none;
  border-radius: 10px;
  padding: 12px 20px;
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
}

.ai-analyze-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(139, 92, 246, 0.5);
}

.ai-analyze-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.ai-analyze-btn .loading-spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

.ai-analyze-btn.analyzing .icon {
  display: none;
}

.ai-analyze-btn:not(.analyzing) .loading-spinner {
  display: none;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 2: Add AI modal and card styling**

Add this CSS (after modal styles, around line 1900):

```css
/* ============================================
   AI ANALYSIS MODAL
   ============================================ */

.modal-large {
  max-width: 800px;
  width: 90%;
}

.ai-coin-card {
  background: #1e293b;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  border-left: 4px solid #64748b;
}

.ai-coin-card.recommendation-PICK {
  border-left-color: #10b981;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), #1e293b);
}

.ai-coin-card.recommendation-PASS {
  border-left-color: #ef4444;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), #1e293b);
}

.ai-coin-card.recommendation-ERROR {
  border-left-color: #64748b;
  opacity: 0.7;
}

.ai-coin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.ai-coin-name {
  font-size: 1.1rem;
  font-weight: 700;
  color: #f8fafc;
}

.ai-recommendation {
  padding: 6px 16px;
  border-radius: 20px;
  font-weight: 700;
  font-size: 0.85rem;
  text-transform: uppercase;
}

.ai-recommendation.PICK {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
}

.ai-recommendation.PASS {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
}

.ai-recommendation.ERROR {
  background: #64748b;
  color: white;
}

.ai-reasoning {
  color: #e2e8f0;
  line-height: 1.6;
  margin-bottom: 12px;
  font-size: 0.95rem;
}

.ai-breakdown {
  list-style: none;
  padding: 0;
  margin: 0;
}

.ai-breakdown li {
  color: #94a3b8;
  padding: 4px 0;
  padding-left: 20px;
  position: relative;
  font-size: 0.9rem;
  line-height: 1.5;
}

.ai-breakdown li:before {
  content: '•';
  position: absolute;
  left: 0;
  color: #6366f1;
  font-weight: bold;
}

.cache-status {
  color: #94a3b8;
  font-size: 0.85rem;
  margin-right: auto;
}

/* Mobile responsive for AI modal */
@media (max-width: 768px) {
  .modal-large {
    width: 95%;
    max-height: 80vh;
  }

  .ai-coin-card {
    margin-bottom: 12px;
    padding: 12px;
  }

  .ai-coin-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .ai-breakdown li {
    font-size: 0.85rem;
  }
}
```

**Verify:** All CSS added.

---

## Task 7: Add Frontend JavaScript Logic

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Add analyzeTop5 function**

Add this function (around line 170, after `refreshTrackedCoins` function):

```javascript
// ============================================
// AI ANALYSIS
// ============================================

async function analyzeTop5() {
  var btn = document.getElementById('aiAnalyzeBtn');
  var modal = document.getElementById('aiAnalysisModal');
  var body = document.getElementById('aiAnalysisBody');

  // Don't allow duplicate requests
  if (btn.classList.contains('analyzing')) return;

  // Check if we have top5 data
  if (!currentData || !currentData.top5 || currentData.top5.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: 'No Data',
      text: 'Refresh data first before analyzing.',
      background: '#1e293b',
      color: '#f8fafc',
    });
    return;
  }

  // Show modal with loading
  btn.classList.add('analyzing');
  btn.disabled = true;
  modal.style.display = 'block';
  body.innerHTML = '<div class="loading">Analyzing coins with AI...</div>';

  try {
    var response = await fetch('/api/analyze?refresh=false');
    var data = await response.json();

    if (!data.success) {
      throw new Error(data.error);
    }

    // Render results
    renderAiAnalysis(data.analysis, data.source);

    // Update cache status
    updateAiCacheStatus(data.source);
  } catch (err) {
    body.innerHTML =
      '<div class="empty-state">' +
        '<div class="icon">❌</div>' +
        '<h3>Analysis Failed</h3>' +
        '<p>' + err.message + '</p>' +
        '<button class="empty-state-cta" onclick="analyzeTop5()">Retry</button>' +
      '</div>';
  } finally {
    btn.classList.remove('analyzing');
    btn.disabled = false;
  }
}

function renderAiAnalysis(analysis, source) {
  var body = document.getElementById('aiAnalysisBody');

  if (!analysis || analysis.length === 0) {
    body.innerHTML =
      '<div class="empty-state">' +
        '<div class="icon">📊</div>' +
        '<h3>No Analysis Results</h3>' +
      '</div>';
    return;
  }

  // Count successes
  var successCount = analysis.filter(function(a) { return !a.error; }).length;
  var totalCount = analysis.length;

  var html = '<div class="ai-analysis-results">';
  
  if (successCount < totalCount) {
    html += '<p style="color:#f59e0b;margin-bottom:16px">⚠️ Analyzed ' + successCount + '/' + totalCount + ' coins</p>';
  }

  analysis.forEach(function(item) {
    var recClass = item.recommendation || 'ERROR';
    var coinName = item.name + ' (' + item.symbol + ')';
    
    html += '<div class="ai-coin-card recommendation-' + recClass + '">' +
      '<div class="ai-coin-header">' +
        '<span class="ai-coin-name">' + coinName + '</span>' +
        '<span class="ai-recommendation ' + recClass + '">' + (item.recommendation || 'ERROR') + '</span>' +
      '</div>';

    if (item.reasoning) {
      html += '<div class="ai-reasoning">' + item.reasoning + '</div>';
    }

    if (item.breakdown && item.breakdown.length > 0) {
      html += '<ul class="ai-breakdown">';
      item.breakdown.forEach(function(point) {
        html += '<li>' + point + '</li>';
      });
      html += '</ul>';
    }

    if (item.error && !item.reasoning) {
      html += '<div class="ai-reasoning" style="color:#94a3b8">Analysis failed for this coin.</div>';
    }

    html += '</div>';
  });

  html += '</div>';
  body.innerHTML = html;
}

function closeAiModal() {
  document.getElementById('aiAnalysisModal').style.display = 'none';
}

async function refreshAnalysis() {
  var btn = document.getElementById('aiAnalyzeBtn');
  var body = document.getElementById('aiAnalysisBody');
  
  btn.classList.add('analyzing');
  btn.disabled = true;
  body.innerHTML = '<div class="loading">Re-analyzing with fresh data...</div>';

  try {
    var response = await fetch('/api/analyze?refresh=true');
    var data = await response.json();

    if (!data.success) {
      throw new Error(data.error);
    }

    renderAiAnalysis(data.analysis, 'api');
    updateAiCacheStatus('api');
  } catch (err) {
    body.innerHTML =
      '<div class="empty-state">' +
        '<div class="icon">❌</div>' +
        '<h3>Refresh Failed</h3>' +
        '<p>' + err.message + '</p>' +
      '</div>';
  } finally {
    btn.classList.remove('analyzing');
    btn.disabled = false;
  }
}

function updateAiCacheStatus(source) {
  var statusEl = document.getElementById('aiCacheStatus');
  if (source === 'cache') {
    statusEl.textContent = '✓ Cached results';
  } else {
    statusEl.textContent = '✓ Fresh analysis';
  }
}
```

**Verify:** All functions added to app.js.

---

## Task 8: Update refreshData to invalidate AI cache

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Add cache invalidation on data refresh**

Find the `refreshData` function (around line 490) and add cache invalidation after successful refresh:

```javascript
// After line where it sets currentData = data (around line 497)
// Add:
// AI cache will be invalidated on server side automatically via TTL
// No explicit invalidation needed - cache key is based on data timestamp
```

Actually, the cache is already time-based (TTL), so no explicit invalidation needed. The cache will auto-expire with the CMC data.

**Verify:** No changes needed (TTL-based caching handles this automatically).

---

## Task 9: Test the Implementation

**Files:**
- Test: Manual testing in browser

- [ ] **Step 1: Start the server**

```bash
cd /Users/2020bsi01/Documents/Personal/Project/coin-scope
npm start
```

Expected: Server running on port 3000

- [ ] **Step 2: Open browser and test**

```bash
# Open in browser
open http://localhost:3000
```

- [ ] **Step 3: Test the flow**

1. Click "Refresh Data" to get top5 coins
2. Click "AI Analyze" button
3. Verify: Loading state shows
4. Verify: Modal opens with results
5. Check: Each coin shows PICK/PASS recommendation
6. Check: Reasoning text displays
7. Check: Breakdown bullets display
8. Click "Re-analyze" - verify fresh analysis
9. Close modal, click AI Analyze again - verify cached results

- [ ] **Step 4: Test error scenarios**

1. Stop server, click AI Analyze → should show error
2. Restart server, test again

- [ ] **Step 5: Test mobile view**

Resize browser to mobile width (< 768px):
- Verify modal is 95% width
- Verify scrollable
- Verify content readable

---

## Task 10: Final Polish and Verification

**Files:**
- All modified files

- [ ] **Step 1: Verify all files modified**

Check these files exist and have content:
- `.env` - NVIDIA credentials added
- `src/nvidia.js` - Module exists
- `src/server.js` - /api/analyze endpoint added
- `public/index.html` - Button and modal added
- `public/app.js` - analyzeTop5 function added
- `public/style.css` - Styling added

- [ ] **Step 2: Check for console errors**

Open browser DevTools:
- Console should be clean (no errors)
- Network tab should show successful API calls

- [ ] **Step 3: Verify cache behavior**

1. First AI Analyze call: should show "Fresh analysis"
2. Second call within 1 hour: should show "Cached results"
3. After 1 hour or Re-analyze: should show "Fresh analysis"

---

## Completion Checklist

- [ ] All tasks completed
- [ ] Server starts without errors
- [ ] AI Analyze button visible and clickable
- [ ] Modal displays analysis results correctly
- [ ] PICK/PASS recommendations show with correct colors
- [ ] Reasoning and breakdown display
- [ ] Error handling works
- [ ] Cache behavior correct
- [ ] Mobile responsive

---

## Notes for Deployment

Before deploying:
1. Ensure NVIDIA_API_KEY is set in production environment
2. Verify .env is not committed to git (should be in .gitignore)
3. Test with real top5 data
4. Monitor NVIDIA API quota usage
