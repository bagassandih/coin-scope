import express from 'express';
import { fetchCoins, extractCoinData, fetchCoinPriceById } from './fetcher.js';
import { hardFilter } from './filter.js';
import { calculateScores, rankTop5, getMarketCapTierScore } from './scorer.js';
import { getCachedData, getCacheAge } from './cache.js';
import { analyzeCoins } from './nvidia.js';
import {
  getTrackedCoins,
  addTrackedCoin,
  removeTrackedCoin,
  isCoinTracked,
  saveSnapshot,
  getLatestSnapshots,
  getCoinSnapshots,
  getSnapshotsForTrackingIds,
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
function mapCoinResponse(coin, index, trackedCoinIds) {
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
    percent_change_30d: coin.percent_change_30d,
    percent_change_60d: coin.percent_change_60d,
    percent_change_90d: coin.percent_change_90d,
    volume_24h: coin.volume_24h,
    market_cap: coin.market_cap,
    tier: coin.tier,
    tierLabel: coin.tierLabel,
    score: coin.weightedScore,
    tracked: trackedCoinIds.includes(coin.id),
    tags: coin.tags || [],
    // Supply metrics for dilution risk calculation
    total_supply: coin.total_supply,
    max_supply: coin.max_supply,
    circulating_supply: coin.circulating_supply,
    num_market_pairs: coin.num_market_pairs,
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
    // Use coin_id (CMC ID) for checking if a coin is tracked
    const trackedCoinIds = tracked.map(t => t.coin_id);

    res.json({
      success: true,
      timestamp: Math.floor(Date.now() / 1000),
      cacheAge: getCacheAge(),
      universe: coins.length,
      filtered: filterResult.passed.length,
      top5: top5.map((coin, index) => mapCoinResponse(coin, index, trackedCoinIds)),
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

// AI Analysis endpoint
app.get('/api/analyze', async (req, res) => {
  try {
    const { refresh = 'false' } = req.query;
    const forceRefresh = refresh === 'true';

    log('AI Analysis request received');

    // Get cached data
    const cached = getCachedData();
    if (!cached || !cached.data) {
      return res.status(400).json({
        success: false,
        error: 'No data available. Refresh data first.',
      });
    }

    // Process data to get top5
    const coins = extractCoinData(cached.data);
    const filterResult = hardFilter(coins);

    if (filterResult.passed.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No coins passed the filter. Refresh data first.',
      });
    }

    // Enrich with Binance sentiment if enabled
    const scoredCoins = calculateScores(filterResult.passed);
    const top5 = rankTop5(scoredCoins);

    const analysis = await analyzeCoins(top5, forceRefresh);

    res.json({
      success: true,
      source: forceRefresh ? 'api' : 'cache',
      analysis,
    });
  } catch (err) {
    log(`❌ AI Analysis error: ${err.message}`);
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
    // Force fetch from CMC API (ignore cache) — tombol Refresh harus benar-benar refresh
    const rawData = await fetchCoins(true);
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
    const trackedCoinIds = tracked.map(t => t.coin_id);

    // Save snapshots for ALL tracked coins (including those that didn't pass filter)
    if (tracked.length > 0) {
      const trackedIdsSet = new Set(trackedCoinIds);

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
        // Add tracking_id to each coin for snapshot
        const coinsWithTrackingId = allTracked.map(c => {
          const trackedCoin = tracked.find(t => t.coin_id === c.id);
          return { ...c, tracking_id: trackedCoin.tracking_id };
        });
        await saveSnapshot(coinsWithTrackingId);
        log(`  📸 Saved snapshot for ${allTracked.length} tracked coin(s) (${trackedInScored.length} scored, ${trackedNotScored.length} unfiltered)`);
      }
    }

    res.json({
      success: true,
      timestamp: Math.floor(Date.now() / 1000),
      cacheAge,
      universe: coins.length,
      filtered: filterResult.passed.length,
      top5: top5.map((coin, index) => mapCoinResponse(coin, index, trackedCoinIds)),
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
      const { coin } = req.body;

      if (!coin || !coin.id) {
        return res.status(400).json({
          success: false,
          error: 'coin object with id is required',
        });
      }

      // Prevent duplicate active tracking of the same coin
      const alreadyTracked = await isCoinTracked(coin.id);
      if (alreadyTracked) {
        return res.status(400).json({
          success: false,
          error: 'Koin ini sudah sedang di-track. Batalkan tracking dulu sebelum men-track ulang.',
        });
      }

      const result = await addTrackedCoin(coin, mode || 'cmc', entry_price || null);
      // Return tracking_id (UUID) so frontend can use it for close/resume
      tracked = await getTrackedCoins();
    } else if (action === 'remove') {
      // coinId bisa berupa tracking_id (UUID) dari tab Tracked,
      // atau coin_id (integer CMC) dari tab Top 5. Keduanya di-handle di db.removeTrackedCoin.
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
        error: 'coinId (tracking_id) is required',
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'reason is required (take_profit, cutloss, stagnant, other)',
      });
    }

    // Get the tracked coin details before closing
    const tracked = await getTrackedCoins();
    const coinToClose = tracked.find(c => c.tracking_id === coinId);

    if (coinToClose) {
      // Create a final snapshot at close time with current price
      try {
        // Utamakan harga live dari CMC API; fallback ke cache lokal
        let currentPrice = await fetchCoinPriceById(coinToClose.coin_id);

        if (currentPrice == null) {
          const cached = getCachedData();
          if (cached) {
            const coins = extractCoinData(cached.data);
            const coinData = coins.find(c => c.id === coinToClose.coin_id);
            if (coinData) {
              currentPrice = coinData.price;
            }
          }
        }

        // If we have a price, create the final snapshot
        if (currentPrice) {
          await saveSnapshot({
            tracking_id: coinToClose.tracking_id,
            symbol: coinToClose.symbol,
            name: coinToClose.name,
            price: currentPrice,
            percent_change_7d: 0,  // Not needed for close snapshot
            percent_change_30d: 0,
            percent_change_24h: 0,
            volume_24h: 0,
            market_cap: 0,
            tier: null,
            tier_label: null,
            score: null,
            timestamp: new Date().toISOString(),
          });
          log(`  📸 Created close snapshot for ${coinToClose.symbol} at ${currentPrice}`);
        } else {
          log(`  ⚠️  Could not get current price for ${coinToClose.symbol} - close snapshot not created`);
        }
      } catch (snapErr) {
        // Don't fail the close if snapshot creation fails
        log(`  ⚠️  Failed to create close snapshot: ${snapErr.message}`);
      }
    }

    // coinId is now tracking_id (UUID)
    await closePosition(coinId, reason);
    const updatedTracked = await getTrackedCoins();

    res.json({
      success: true,
      tracked: updatedTracked,
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
        error: 'coinId (tracking_id) is required',
      });
    }

    // coinId is now tracking_id (UUID)
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

    // Ambil SEMUA snapshot untuk semua posisi closed dalam 1 query (hindari N+1)
    const trackingIds = closed.map(c => c.tracking_id);
    const snapshotsByTracking = await getSnapshotsForTrackingIds(trackingIds);

    const enriched = closed.map((coin) => {
      // coin.tracking_id is the UUID
      const snapshots = snapshotsByTracking.get(coin.tracking_id) || [];
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

      // Use coin_id (CMC ID) for logo URL
      const cmcId = coin.coin_id;

      return {
        ...coin,
        logo: `https://s2.coinmarketcap.com/static/img/coins/64x64/${cmcId}.png`,
        performance,
        hold_days: holdDays,
      };
    });

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
    // coinId is now tracking_id (UUID), not an integer
    const snapshots = await getCoinSnapshots(coinId);

    // Get coin info from tracked_coins (even though closed)
    const closed = await getClosedPositions();
    const coinInfo = closed.find(c => c.tracking_id === coinId);

    if (!coinInfo) {
      return res.status(404).json({
        success: false,
        error: 'Closed position not found',
      });
    }

    // Use coin_id (CMC ID) for logo URL
    const cmcId = coinInfo.coin_id || coinInfo.id;

    res.json({
      success: true,
      coinId: coinId,
      name: coinInfo.name,
      symbol: coinInfo.symbol,
      logo: `https://s2.coinmarketcap.com/static/img/coins/64x64/${cmcId}.png`,
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
    // coinId is now tracking_id (UUID), not an integer
    const snapshots = await getCoinSnapshots(coinId);
    const performance = await getCoinPerformance(coinId);

    // Include tracking mode + entry info
    const tracked = await getTrackedCoins();
    const coinTracking = tracked.find(c => c.tracking_id === coinId);
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

    // Construct logo URL from CMC ID (coin_id column)
    const cmcId = coinTracking?.coin_id || coinTracking?.id;
    const logo = coinTracking?.logo || `https://s2.coinmarketcap.com/static/img/coins/64x64/${cmcId}.png`;

    res.json({
      success: true,
      coinId: coinId,
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
