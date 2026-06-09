import axios from 'axios';
import { config } from './config.js';
import { getCachedData, setCachedData, getCacheAge } from './cache.js';

// WIB Timestamp helper
function logFetch(message) {
  const now = new Date();
  const wibTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  const timestamp = wibTime.toISOString().replace('T', ' ').slice(0, 19) + ' WIB';
  console.log(`[${timestamp}] ${message}`);
}

// Retry with exponential backoff
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios(url, options);
      return response.data;
    } catch (err) {
      const isLastAttempt = attempt === maxRetries - 1;

      if (err.response) {
        const status = err.response.status;
        if (status === 401) {
          throw new Error('Invalid CMC API Key. Check your .env file.');
        }
        if (status === 429) {
          throw new Error('Rate limit exceeded. Try again later.');
        }
      }

      if (isLastAttempt) {
        throw new Error(`Failed after ${maxRetries} attempts: ${err.message}`);
      }

      const delay = Math.pow(2, attempt) * 1000;
      logFetch(`  🔄 Retry ${attempt + 1}/${maxRetries} in ${delay}ms...`);
      await sleep(delay);
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchCoins() {
  const cached = getCachedData();
  if (cached) {
    const age = getCacheAge();
    const mins = Math.floor(age / 60);
    logFetch(`  💾 Using cached data (${mins}m old)`);
    return cached.data;
  }

  logFetch('  🌐 Fetching from CMC API...');

  const url = `${config.cmcApiUrl}/cryptocurrency/listings/latest`;
  const options = {
    headers: {
      'X-CMC_PRO_API_KEY': config.cmcApiKey,
      'Accept': 'application/json',
    },
    params: {
      limit: config.universeSize,
      convert: 'USD',
    },
  };

  const data = await fetchWithRetry(url, options);
  setCachedData(data);

  logFetch('  ✅ Data fetched and cached');
  return data;
}

export function extractCoinData(data) {
  if (!data || !data.data) {
    return [];
  }

  return data.data.map(coin => ({
    id: coin.id,
    name: coin.name,
    symbol: coin.symbol,
    logo: `https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png`,
    platform: coin.platform ? coin.platform.symbol : null, // ETH, BSC, SOL, etc. null for native
    platform_name: coin.platform ? coin.platform.name : null, // Ethereum, BNB Chain, etc.
    cmc_rank: coin.cmc_rank,
    price: coin.quote.USD.price,
    volume_24h: coin.quote.USD.volume_24h || 0,
    market_cap: coin.quote.USD.market_cap || 0,
    percent_change_24h: coin.quote.USD.percent_change_24h || 0,
    percent_change_7d: coin.quote.USD.percent_change_7d || 0,
    percent_change_30d: coin.quote.USD.percent_change_30d || 0,
    percent_change_60d: coin.quote.USD.percent_change_60d || 0,
    percent_change_90d: coin.quote.USD.percent_change_90d || 0,
    circulating_supply: coin.circulating_supply || 0,
    total_supply: coin.total_supply || 0,
    max_supply: coin.max_supply || 0,
    num_market_pairs: coin.num_market_pairs || 0,
    tags: coin.tags || [],
  }));
}
