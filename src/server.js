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
  getClosedPositions,
  closePosition,
  resumePosition,
} from './tracking.js';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3000;

// WIB Timestamp helper
function log(message) {
  const now = new Date();
  const wibTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  const timestamp = wibTime.toISOString().replace('T', ' ').slice(0, 19) + ' WIB';
  console.log(`[${timestamp}] ${message}`);
}

// Constants
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'change-me-in-production';
const WEBHOOK_RESTART_DELAY = 1000;

// Helper: map coin to response format
function mapCoinResponse(coin, index, trackedIds) {
  return {
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
    tracked: trackedIds.includes(coin.id),
  };
}

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
    const tracked = await getTrackedCoins();
    const trackedIds = tracked.map(t => t.id);

    res.json({
      success: true,
      timestamp: Math.floor(Date.now() / 1000),
      cacheAge: getCacheAge(),
      universe: coins.length,
      filtered: filterResult.passed.length,
      top5: top5.map((coin, index) => mapCoinResponse(coin, index, trackedIds)),
    });
  } catch (err) {
    log(`❌ Error: ${err.message}`);
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
    const tracked = await getTrackedCoins();
    const trackedIds = tracked.map(t => t.id);

    // Save snapshots for ALL tracked coins (including those that didn't pass filter)
    if (tracked.length > 0) {
      const trackedIdsSet = new Set(trackedIds);

      // Coins that passed filter already have tier + weightedScore from scorer
      const trackedInScored = scoredCoins.filter(c => trackedIdsSet.has(c.id));
      const scoredIds = new Set(trackedInScored.map(c => c.id));

      // Tracked coins that didn't pass filter — enrich with tier from raw data
      const trackedNotScored = coins
        .filter(c => trackedIdsSet.has(c.id) && !scoredIds.has(c.id))
        .map(c => {
          const tier = getMarketCapTierScore(c.market_cap);
          return { ...c, tier: tier.name, tierLabel: tier.label, weightedScore: null };
        });

      const allTracked = [...trackedInScored, ...trackedNotScored];
      if (allTracked.length > 0) {
        await saveSnapshot(allTracked);
        log(`  📸 Saved snapshot for ${allTracked.length} tracked coin(s) (${trackedInScored.length} scored, ${trackedNotScored.length} unfiltered)`);
      }
    }

    res.json({
      success: true,
      timestamp: Math.floor(Date.now() / 1000),
      cacheAge,
      universe: coins.length,
      filtered: filterResult.passed.length,
      top5: top5.map((coin, index) => mapCoinResponse(coin, index, trackedIds)),
    });
  } catch (err) {
    log(`❌ Error: ${err.message}`);
    console.error(err.stack);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Get tracked coins list
app.get('/api/tracked', async (req, res) => {
  try {
    const tracked = await getLatestSnapshots();
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
app.post('/api/track', async (req, res) => {
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
      tracked = await addTrackedCoin(req.body.coin, mode || 'cmc', entry_price || null);
    } else if (action === 'remove') {
      await removeTrackedCoin(coinId);
      tracked = await getTrackedCoins();
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

// Close position (move to closed)
app.post('/api/close', async (req, res) => {
  try {
    const { coinId, reason } = req.body;

    if (!coinId) {
      return res.status(400).json({
        success: false,
        error: 'coinId is required',
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'reason is required (take_profit, cutloss, stagnant, other)',
      });
    }

    await closePosition(coinId, reason);
    const tracked = await getTrackedCoins();

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

// Resume position (move back to active)
app.post('/api/resume', async (req, res) => {
  try {
    const { coinId } = req.body;

    if (!coinId) {
      return res.status(400).json({
        success: false,
        error: 'coinId is required',
      });
    }

    await resumePosition(coinId);
    const tracked = await getTrackedCoins();

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

// Get closed positions
app.get('/api/closed', async (req, res) => {
  try {
    const filter = req.query.filter || 'all';
    const closed = await getClosedPositions(filter);

    // Enrich with latest snapshot data for performance calculation
    const enriched = await Promise.all(closed.map(async (coin) => {
      const snapshots = await getCoinSnapshots(coin.id);
      const firstSnapshot = snapshots[0];
      const lastSnapshot = snapshots[snapshots.length - 1];

      let performance = null;
      if (firstSnapshot && lastSnapshot) {
        const priceChange = lastSnapshot.price - firstSnapshot.price;
        const priceChangePercent = (priceChange / firstSnapshot.price) * 100;
        performance = {
          first_price: firstSnapshot.price,
          first_timestamp: firstSnapshot.timestamp,
          last_price: lastSnapshot.price,
          last_timestamp: lastSnapshot.timestamp,
          price_change: priceChange,
          price_change_percent: priceChangePercent,
        };
      }

      // Calculate hold duration
      const closedDate = new Date(coin.closed_at);
      const addedDate = new Date(coin.added_at);
      const holdDays = Math.floor((closedDate - addedDate) / (1000 * 60 * 60 * 24));

      return {
        ...coin,
        logo: `https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png`,
        performance,
        hold_days: holdDays,
      };
    }));

    res.json({
      success: true,
      closed: enriched,
    });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Get closed position history (snapshots)
app.get('/api/closed/:coinId/history', async (req, res) => {
  try {
    const { coinId } = req.params;
    const id = parseInt(coinId);
    const snapshots = await getCoinSnapshots(id);

    // Get coin info from tracked_coins (even though closed)
    const closed = await getClosedPositions();
    const coinInfo = closed.find(c => c.id === id);

    if (!coinInfo) {
      return res.status(404).json({
        success: false,
        error: 'Closed position not found',
      });
    }

    res.json({
      success: true,
      coinId: id,
      name: coinInfo.name,
      symbol: coinInfo.symbol,
      logo: `https://s2.coinmarketcap.com/static/img/coins/64x64/${id}.png`,
      added_at: coinInfo.added_at,
      closed_at: coinInfo.closed_at,
      close_reason: coinInfo.close_reason,
      snapshots,
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
app.get('/api/history/:coinId', async (req, res) => {
  try {
    const { coinId } = req.params;
    const id = parseInt(coinId);
    const snapshots = await getCoinSnapshots(id);
    const performance = await getCoinPerformance(id);

    // Include tracking mode + entry info
    const tracked = await getTrackedCoins();
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

    // Construct logo URL from CMC ID
    const logo = coinTracking?.logo || `https://s2.coinmarketcap.com/static/img/coins/64x64/${id}.png`;

    res.json({
      success: true,
      coinId: id,
      name: coinTracking?.name || null,
      symbol: coinTracking?.symbol || null,
      logo,
      added_at: coinTracking?.added_at || null,
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

// ============================================
// WEBHOOK ENDPOINT (GitHub CI/CD)
// ============================================

// Verify GitHub webhook signature
function verifyGitHubSignature(payload, signature) {
  try {
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    // Safe comparison that handles different lengths
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (err) {
    console.error('Signature verification error:', err.message);
    return false;
  }
}

app.post('/webhook/github', async (req, res) => {
  // Verify webhook signature FIRST (before any async work)
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    log('⚠️  Webhook: No signature provided');
    return res.status(401).json({ error: 'No signature provided' });
  }

  const payload = JSON.stringify(req.body);
  if (!verifyGitHubSignature(payload, signature)) {
    log('⚠️  Webhook: Invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Check if this is a push event
  if (req.headers['x-github-event'] !== 'push') {
    return res.json({ message: 'Event ignored, only push events trigger deploy' });
  }

  // Send response IMMEDIATELY (202 Accepted)
  // GitHub gets quick response, deployment continues in background
  res.status(202).json({
    success: true,
    message: 'Webhook received! Deployment started in background...',
    receivedAt: new Date().toISOString()
  });

  // Spawn detached deployment process (completely independent from HTTP connection)
  // This ensures GitHub gets immediate response without waiting
  const deployScript = `${__dirname}/../scripts/deploy.js`;
  const { spawn: spawnProc } = await import('child_process');

  const deployProc = spawnProc('node', [deployScript], {
    detached: true,
    stdio: 'inherit',  // Show deploy output in main logs
    cwd: process.cwd(),
    env: { ...process.env }
  });
  deployProc.unref();

  log('🔄 Webhook received! Deployment started...');
});

app.listen(PORT, () => {
  log(`🌐 CoinScope UI running at http://localhost:${PORT}`);
});
