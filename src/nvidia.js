// NVIDIA NIM API Integration for AI Coin Analysis
import { config } from './config.js';
import * as cache from './cache.js';

const CACHE_KEY = 'ai_analysis_top5';

// System prompt - defines AI role and output format
const SYSTEM_PROMPT = `Anda adalah analis cryptocurrency ahli. Analisis koin yang diberikan dan berikan rekomendasi PICK/PASS.

Output HARUS berupa JSON valid dengan struktur:
{
  "analysis": [
    {
      "coin_id": integer (gunakan ID persis dari data koin),
      "symbol": "string",
      "name": "string",
      "recommendation": "PICK" | "PASS",
      "reasoning": "Penjelasan singkat 2-3 kalimat",
      "breakdown": [
        "Analisis momentum...",
        "Analisis volume...",
        "Risiko market cap...",
        "Penilaian score...",
        "Kesimpulan..."
      ]
    }
  ]
}

Aturan:
- PICK: Score >= 70 DAN momentum positif (7d > 0, sebaiknya 30d > 0)
- PASS: Score < 40 ATAU momentum negatif
- Pertimbangkan: tren 7d/24h, kesehatan volume, risiko market cap tier
- Objektif, sebutkan risiko bahkan untuk PICK
- PENTING: Gunakan coin_id persis dari data input
- Gunakan BAHASA INDONESIA untuk semua output
- Return HANYA JSON object, tanpa markdown, tanpa text tambahan`;

// Get scoring formula explanation
function getScoringInfo() {
  return `SCORING SYSTEM (v1.2):
- Weighted Score 0-100, semakin tinggi semakin baik
- 7d Price Change (12%): Sinyal momentum jangka pendek
- 30d Change (48%): Mengkonfirmasi tren sehat untuk holding
- Volume Ratio (25%): Volume / (Market Cap × 0.01) - cek likuiditas
- Market Cap Tier (10%): Large(25), Mid(50), Small(75), Micro(100) - semakin tinggi semakin spekulatif
- 24h Change (5%): Sinyal minimal
- Healthy Trend Bonus (+20): Untuk kenaikan steady (7d 0-50%, 30d > 0, bukan pump&dump)

INTERPRETASI:
- Score >= 70: Kandidat kuat untuk tracking
- Score 40-70: Potensi moderat, evaluasi dengan hati-hati
- Score < 40: Sinyal lemah, lebih baik skip`;
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
- ID: ${coin.id}
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
        return cached;
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
  for (let i = 0; i < coins.length; i++) {
    const coin = coins[i];
    // Match by position first (AI returns in same order), fallback to symbol/id
    const aiResult = analysis[i] || analysis.find(r => r.symbol === coin.symbol);

    if (aiResult && !aiResult.error) {
      // Override coin_id with actual CMC coin ID
      results.push({
        ...aiResult,
        coin_id: coin.id
      });
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
