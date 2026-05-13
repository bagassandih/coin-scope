import express from 'express';
import { fetchCoins, extractCoinData } from './fetcher.js';
import { hardFilter } from './filter.js';
import { calculateScores, rankTop5 } from './scorer.js';
import { getCachedData, getCacheAge } from './cache.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// API endpoint to get top 5 coins (cache only, never fetch)
app.get('/api/top5', async (req, res) => {
  try {
    const cached = getCachedData();

    if (!cached) {
      return res.json({
        success: true,
        timestamp: Math.floor(Date.now() / 1000),
        cacheAge: null,
        universe: 0,
        filtered: 0,
        top5: [],
        message: 'No cached data. Click Refresh to fetch from CMC.',
      });
    }

    const rawData = cached.data;
    const coins = extractCoinData(rawData);
    const filterResult = hardFilter(coins);

    if (filterResult.passed.length === 0) {
      return res.json({
        success: true,
        timestamp: Math.floor(Date.now() / 1000),
        cacheAge: getCacheAge(),
        universe: coins.length,
        filtered: 0,
        top5: [],
      });
    }

    const scoredCoins = calculateScores(filterResult.passed);
    const top5 = rankTop5(scoredCoins);

    res.json({
      success: true,
      timestamp: Math.floor(Date.now() / 1000),
      cacheAge: getCacheAge(),
      universe: coins.length,
      filtered: filterResult.passed.length,
      top5: top5.map((coin, index) => ({
        rank: index + 1,
        name: coin.name,
        symbol: coin.symbol,
        logo: coin.logo,
        platform: coin.platform,
        platform_name: coin.platform_name,
        price: coin.price,
        percent_change_7d: coin.percent_change_7d,
        percent_change_24h: coin.percent_change_24h,
        volume_24h: coin.volume_24h,
        market_cap: coin.market_cap,
        tier: coin.tier,
        tierLabel: coin.tierLabel,
        score: coin.weightedScore,
      })),
    });
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// API endpoint to refresh data
app.post('/api/refresh', async (req, res) => {
  try {
    const rawData = await fetchCoins();
    const coins = extractCoinData(rawData);
    const filterResult = hardFilter(coins);

    // Fresh data = cache age is 0
    const cacheAge = 0;

    if (filterResult.passed.length === 0) {
      return res.json({
        success: true,
        timestamp: Math.floor(Date.now() / 1000),
        cacheAge,
        universe: coins.length,
        filtered: 0,
        top5: [],
      });
    }

    const scoredCoins = calculateScores(filterResult.passed);
    const top5 = rankTop5(scoredCoins);

    res.json({
      success: true,
      timestamp: Math.floor(Date.now() / 1000),
      cacheAge,
      universe: coins.length,
      filtered: filterResult.passed.length,
      top5: top5.map((coin, index) => ({
        rank: index + 1,
        name: coin.name,
        symbol: coin.symbol,
        logo: coin.logo,
        platform: coin.platform,
        platform_name: coin.platform_name,
        price: coin.price,
        percent_change_7d: coin.percent_change_7d,
        percent_change_24h: coin.percent_change_24h,
        volume_24h: coin.volume_24h,
        market_cap: coin.market_cap,
        tier: coin.tier,
        tierLabel: coin.tierLabel,
        score: coin.weightedScore,
      })),
    });
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n🌐 CoinScope UI running at http://localhost:${PORT}\n`);
});
