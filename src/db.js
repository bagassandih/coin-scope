import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL || 'https://qtiobbaxblbfgrxpjlyt.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  throw new Error(
    'SUPABASE_ANON_KEY is not set in environment variables.\n' +
    'Please check your .env file and add the Supabase anon key.\n' +
    'See supabase/SETUP.md for instructions.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// TRACKED COINS
// ============================================

export async function getTrackedCoins() {
  const { data, error } = await supabase
    .from('tracked_coins')
    .select('*')
    .eq('status', 'active')
    .order('added_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getClosedPositions(filterReason = null) {
  let query = supabase
    .from('tracked_coins')
    .select('*')
    .eq('status', 'closed')
    .order('closed_at', { ascending: false });

  if (filterReason && filterReason !== 'all') {
    query = query.eq('close_reason', filterReason);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function closePosition(trackingId, reason) {
  const { data, error } = await supabase
    .from('tracked_coins')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      close_reason: reason,
    })
    .eq('tracking_id', trackingId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function resumePosition(trackingId) {
  const { data, error } = await supabase
    .from('tracked_coins')
    .update({
      status: 'active',
      closed_at: null,
      close_reason: null,
    })
    .eq('tracking_id', trackingId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function addTrackedCoin(coin, mode = 'cmc', entryPrice = null) {
  // Always insert a new row - allows multiple tracking cycles for the same coin
  const { data, error } = await supabase
    .from('tracked_coins')
    .insert({
      coin_id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      tracking_mode: mode,
      entry_price: mode === 'entry' ? entryPrice : null,
      entry_timestamp: mode === 'entry' ? new Date().toISOString() : null,
      status: 'active',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeTrackedCoin(trackingId) {
  const { error } = await supabase
    .from('tracked_coins')
    .delete()
    .eq('tracking_id', trackingId);

  if (error) throw error;
  return true;
}

export async function isCoinTracked(coinId) {
  // Check if there's an ACTIVE tracking for this coin
  const { data, error } = await supabase
    .from('tracked_coins')
    .select('tracking_id')
    .eq('coin_id', coinId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

// ============================================
// SNAPSHOTS
// ============================================

export async function saveSnapshot(coin) {
  const { data, error } = await supabase
    .from('snapshots')
    .insert({
      tracking_id: coin.tracking_id,
      symbol: coin.symbol,
      name: coin.name,
      price: coin.price,
      percent_change_7d: coin.percent_change_7d,
      percent_change_24h: coin.percent_change_24h,
      volume_24h: coin.volume_24h,
      market_cap: coin.market_cap,
      tier: coin.tier,
      tier_label: coin.tierLabel,
      score: coin.weightedScore,
      timestamp: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function saveSnapshots(coins) {
  const snapshots = coins.map(coin => ({
    tracking_id: coin.tracking_id,
    symbol: coin.symbol,
    name: coin.name,
    price: coin.price,
    percent_change_7d: coin.percent_change_7d,
    percent_change_24h: coin.percent_change_24h,
    volume_24h: coin.volume_24h,
    market_cap: coin.market_cap,
    tier: coin.tier,
    tier_label: coin.tierLabel,
    score: coin.weightedScore,
    timestamp: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from('snapshots')
    .insert(snapshots)
    .select();

  if (error) throw error;
  return data;
}

export async function getSnapshots(trackingId = null) {
  let query = supabase
    .from('snapshots')
    .select('*')
    .order('timestamp', { ascending: false });

  if (trackingId) {
    query = query.eq('tracking_id', trackingId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getCoinSnapshots(trackingId) {
  const { data, error } = await supabase
    .from('snapshots')
    .select('*')
    .eq('tracking_id', trackingId)
    .order('timestamp', { ascending: true });

  if (error) throw error;
  return data;
}

// ============================================
// TRACKED WITH LATEST SNAPSHOT (JOIN)
// ============================================

export async function getTrackedWithLatestSnapshot() {
  const { data, error } = await supabase
    .from('tracked_with_latest_snapshot')
    .select('*')
    .order('added_at', { ascending: false });

  if (error) throw error;

  // Add logo URL - use coin_id (CMC ID) for the logo
  return data.map(coin => ({
    ...coin,
    logo: `https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.coin_id}.png`,
  }));
}

// ============================================
// CACHE
// ============================================

export async function getCachedData(key) {
  // Clean expired cache first
  await supabase.rpc('clean_expired_cache');

  const { data, error } = await supabase
    .from('api_cache')
    .select('*')
    .eq('key', key)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  return data?.data;
}

export async function setCachedData(key, data, ttlSeconds = 3600) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const { error } = await supabase
    .from('api_cache')
    .upsert({
      key,
      data,
      expires_at: expiresAt,
    }, {
      onConflict: 'key'
    });

  if (error) throw error;
  return true;
}

export async function getCacheAge(key) {
  const { data, error } = await supabase
    .from('api_cache')
    .select('created_at')
    .eq('key', key)
    .maybeSingle();

  if (error || !data) return null;
  return Math.floor((Date.now() - new Date(data.created_at).getTime()) / 1000);
}

// ============================================
// PERFORMANCE ANALYTICS
// ============================================

export async function getCoinPerformance(trackingId) {
  const snapshots = await getCoinSnapshots(trackingId);

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

export async function getSnapshotHistory(trackingId, limit = 30) {
  const { data, error } = await supabase
    .from('snapshots')
    .select('*')
    .eq('tracking_id', trackingId)
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data.reverse(); // Return in chronological order
}

// ============================================
// BATCH OPERATIONS
// ============================================

export async function refreshSnapshotsForTracked(coinsData) {
  const tracked = await getTrackedCoins();

  if (tracked.length === 0) return [];

  const snapshots = [];
  const now = new Date().toISOString();

  for (const trackedCoin of tracked) {
    // trackedCoin.id is tracking_id (UUID), trackedCoin.coin_id is CMC coin ID
    const coinData = coinsData.find(c => c.id === trackedCoin.coin_id);

    if (coinData) {
      snapshots.push({
        tracking_id: trackedCoin.id, // Use tracking_id (UUID) for snapshot
        symbol: trackedCoin.symbol,
        name: trackedCoin.name,
        price: coinData.quote.USD.price,
        percent_change_7d: coinData.quote.USD.percent_change_7d,
        percent_change_24h: coinData.quote.USD.percent_change_24h,
        volume_24h: coinData.quote.USD.volume_24h,
        market_cap: coinData.quote.USD.market_cap,
        tier: coinData.tier || null,
        tier_label: coinData.tierLabel || null,
        score: coinData.weightedScore || null,
        timestamp: now,
      });
    }
  }

  if (snapshots.length > 0) {
    const { data } = await supabase
      .from('snapshots')
      .insert(snapshots)
      .select();
    return data;
  }

  return [];
}
