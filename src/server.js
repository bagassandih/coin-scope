import express from 'express';
import { fetchCoins, extractCoinData } from './fetcher.js';
import { hardFilter } from './filter.js';
import { calculateScores, rankTop5, getMarketCapTierScore } from './scorer.js';
import { getCachedData, getCacheAge } from './cache.js';
import {
  getTrackedCoins,
  addTrackedCoin,
  removeTrackedCoin,
  isCoinTracked,
  saveSnapshot,
  getLatestSnapshots,
  getCoinSnapshots,
  getCoinPerformance,
} from './tracking.js';

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
    const tracked = getTrackedCoins().map(t => t.id);

    res.json({
      success: true,
      timestamp: Math.floor(Date.now() / 1000),
      cacheAge: getCacheAge(),
      universe: coins.length,
      filtered: filterResult.passed.length,
      top5: top5.map((coin, index) => ({
        rank: index + 1,
        id: coin.id,
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
        tracked: tracked.includes(coin.id),
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

    // Get tracked coins for UI
    const tracked = getTrackedCoins().map(t => t.id);

    // Save snapshots for ALL tracked coins (including those that didn't pass filter)
    const trackedList = getTrackedCoins();
    if (trackedList.length > 0) {
      const trackedIds = new Set(trackedList.map(t => t.id));

      // Coins that passed filter already have tier + weightedScore from scorer
      const trackedInScored = scoredCoins.filter(c => trackedIds.has(c.id));
      const scoredIds = new Set(trackedInScored.map(c => c.id));

      // Tracked coins that didn't pass filter — enrich with tier from raw data
      const trackedNotScored = coins
        .filter(c => trackedIds.has(c.id) && !scoredIds.has(c.id))
        .map(c => {
          const tier = getMarketCapTierScore(c.market_cap);
          return { ...c, tier: tier.name, tierLabel: tier.label, weightedScore: null };
        });

      const allTracked = [...trackedInScored, ...trackedNotScored];
      if (allTracked.length > 0) {
        saveSnapshot(allTracked);
        console.log(`  Saved snapshot for ${allTracked.length} tracked coin(s) (${trackedInScored.length} scored, ${trackedNotScored.length} unfiltered)`);
      }
    }

    res.json({
      success: true,
      timestamp: Math.floor(Date.now() / 1000),
      cacheAge,
      universe: coins.length,
      filtered: filterResult.passed.length,
      top5: top5.map((coin, index) => ({
        rank: index + 1,
        id: coin.id,
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
        tracked: tracked.includes(coin.id),
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

// Get tracked coins list
app.get('/api/tracked', (req, res) => {
  try {
    const tracked = getLatestSnapshots();
    res.json({
      success: true,
      tracked,
    });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Add/remove coins from tracking
app.post('/api/track', (req, res) => {
  try {
    const { coinId, action } = req.body;

    if (!coinId || !action) {
      return res.status(400).json({
        success: false,
        error: 'coinId and action are required',
      });
    }

    let tracked;
    if (action === 'add') {
      const { mode, entry_price } = req.body;
      tracked = addTrackedCoin(req.body.coin, mode || 'cmc', entry_price || null);
    } else if (action === 'remove') {
      tracked = removeTrackedCoin(coinId);
    } else {
      return res.status(400).json({
        success: false,
        error: 'action must be "add" or "remove"',
      });
    }

    res.json({
      success: true,
      tracked,
    });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Get coin history
app.get('/api/history/:coinId', (req, res) => {
  try {
    const { coinId } = req.params;
    const id = parseInt(coinId);
    const snapshots = getCoinSnapshots(id);
    const performance = getCoinPerformance(id);

    // Include tracking mode + entry info
    const tracked = getTrackedCoins();
    const coinTracking = tracked.find(c => c.id === id);
    const tracking_mode = coinTracking ? (coinTracking.tracking_mode || 'cmc') : 'cmc';
    const entry_price = coinTracking ? coinTracking.entry_price : null;
    const entry_timestamp = coinTracking ? coinTracking.entry_timestamp : null;

    // Entry performance vs snapshots
    let entry_performance = null;
    if (tracking_mode === 'entry' && entry_price && snapshots.length > 0) {
      const latest = snapshots[snapshots.length - 1];
      const priceChange = latest.price - entry_price;
      entry_performance = {
        entry_price,
        entry_timestamp,
        latest_price: latest.price,
        latest_timestamp: latest.timestamp,
        price_change: priceChange,
        price_change_percent: (priceChange / entry_price) * 100,
      };
    }

    res.json({
      success: true,
      coinId,
      snapshots,
      performance,
      tracking_mode,
      entry_price,
      entry_timestamp,
      entry_performance,
    });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n🌐 CoinScope UI running at http://localhost:${PORT}\n`);
});
