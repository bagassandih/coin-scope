import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'src/data');
const TRACKED_FILE = join(DATA_DIR, 'tracked.json');
const SNAPSHOTS_FILE = join(DATA_DIR, 'snapshots.json');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize files if not exist
if (!existsSync(TRACKED_FILE)) {
  writeFileSync(TRACKED_FILE, JSON.stringify([], null, 2));
}
if (!existsSync(SNAPSHOTS_FILE)) {
  writeFileSync(SNAPSHOTS_FILE, JSON.stringify([], null, 2));
}

// Get tracked coins list
export function getTrackedCoins() {
  try {
    const data = readFileSync(TRACKED_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

// Save tracked coins list
export function saveTrackedCoins(coins) {
  try {
    writeFileSync(TRACKED_FILE, JSON.stringify(coins, null, 2));
    return true;
  } catch (err) {
    console.error('Error saving tracked coins:', err.message);
    return false;
  }
}

// Add coin to tracking
// mode: 'cmc' (use CMC live data) or 'entry' (track profit from entry price)
export function addTrackedCoin(coin, mode = 'cmc', entryPrice = null) {
  const tracked = getTrackedCoins();
  if (!tracked.find(c => c.id === coin.id)) {
    const now = Math.floor(Date.now() / 1000);
    tracked.push({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      added_at: now,
      tracking_mode: mode,
      entry_price: mode === 'entry' ? entryPrice : null,
      entry_timestamp: mode === 'entry' ? now : null,
    });
    saveTrackedCoins(tracked);
  }
  return tracked;
}

// Remove coin from tracking
export function removeTrackedCoin(coinId) {
  const tracked = getTrackedCoins();
  const filtered = tracked.filter(c => c.id !== coinId);
  saveTrackedCoins(filtered);
  return filtered;
}

// Check if coin is tracked
export function isCoinTracked(coinId) {
  const tracked = getTrackedCoins();
  return tracked.some(c => c.id === coinId);
}

// Save snapshot for tracked coins
export function saveSnapshot(coins) {
  try {
    const snapshots = getSnapshots();
    const timestamp = Math.floor(Date.now() / 1000);

    coins.forEach(coin => {
      snapshots.push({
        coin_id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        price: coin.price,
        percent_change_7d: coin.percent_change_7d,
        percent_change_24h: coin.percent_change_24h,
        volume_24h: coin.volume_24h,
        market_cap: coin.market_cap,
        tier: coin.tier,
        tierLabel: coin.tierLabel,
        score: coin.weightedScore,
        timestamp,
      });
    });

    writeFileSync(SNAPSHOTS_FILE, JSON.stringify(snapshots, null, 2));
    return true;
  } catch (err) {
    console.error('Error saving snapshot:', err.message);
    return false;
  }
}

// Get all snapshots
export function getSnapshots() {
  try {
    const data = readFileSync(SNAPSHOTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

// Get snapshots for a specific coin
export function getCoinSnapshots(coinId) {
  const snapshots = getSnapshots();
  return snapshots.filter(s => s.coin_id === coinId).sort((a, b) => a.timestamp - b.timestamp);
}

// Get latest snapshot for each tracked coin
export function getLatestSnapshots() {
  const tracked = getTrackedCoins();
  const snapshots = getSnapshots();

  return tracked.map(coin => {
    const coinSnapshots = snapshots.filter(s => s.coin_id === coin.id);
    const latest = coinSnapshots.sort((a, b) => b.timestamp - a.timestamp)[0];

    let entry_performance = null;
    if (coin.tracking_mode === 'entry' && coin.entry_price && latest) {
      const priceChange = latest.price - coin.entry_price;
      entry_performance = {
        entry_price: coin.entry_price,
        entry_timestamp: coin.entry_timestamp,
        latest_price: latest.price,
        latest_timestamp: latest.timestamp,
        price_change: priceChange,
        price_change_percent: (priceChange / coin.entry_price) * 100,
      };
    }

    return {
      ...coin,
      latest_snapshot: latest || null,
      snapshot_count: coinSnapshots.length,
      entry_performance,
    };
  });
}

// Calculate performance from first snapshot
export function getCoinPerformance(coinId) {
  const snapshots = getCoinSnapshots(coinId);
  if (snapshots.length < 2) return null;

  const first = snapshots[0];
  const latest = snapshots[snapshots.length - 1];

  const priceChange = latest.price - first.price;
  const priceChangePercent = ((latest.price - first.price) / first.price) * 100;

  return {
    first_price: first.price,
    first_timestamp: first.timestamp,
    latest_price: latest.price,
    latest_timestamp: latest.timestamp,
    price_change: priceChange,
    price_change_percent: priceChangePercent,
    snapshots_count: snapshots.length,
  };
}
