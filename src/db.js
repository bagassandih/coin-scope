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
    .order('added_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function addTrackedCoin(coin, mode = 'cmc', entryPrice = null) {
  const { data, error } = await supabase
    .from('tracked_coins')
    .upsert({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      tracking_mode: mode,
      entry_price: mode === 'entry' ? entryPrice : null,
      entry_timestamp: mode === 'entry' ? new Date().toISOString() : null,
    }, {
      onConflict: 'id'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeTrackedCoin(coinId) {
  const { error } = await supabase
    .from('tracked_coins')
    .delete()
    .eq('id', coinId);

  if (error) throw error;
  return true;
}

export async function isCoinTracked(coinId) {
  const { data, error } = await supabase
    .from('tracked_coins')
    .select('id')
    .eq('id', coinId)
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
      coin_id: coin.id,
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
    coin_id: coin.id,
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

export async function getSnapshots(coinId = null) {
  let query = supabase
    .from('snapshots')
    .select('*')
    .order('timestamp', { ascending: false });

  if (coinId) {
    query = query.eq('coin_id', coinId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getCoinSnapshots(coinId) {
  const { data, error } = await supabase
    .from('snapshots')
    .select('*')
    .eq('coin_id', coinId)
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

  // Add logo URL
  return data.map(coin => ({
    ...coin,
    logo: `https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png`,
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

export async function getCoinPerformance(coinId) {
  const snapshots = await getCoinSnapshots(coinId);

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

export async function getSnapshotHistory(coinId, limit = 30) {
  const { data, error } = await supabase
    .from('snapshots')
    .select('*')
    .eq('coin_id', coinId)
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
    const coinData = coinsData.find(c => c.id === trackedCoin.id);

    if (coinData) {
      snapshots.push({
        coin_id: trackedCoin.id,
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
