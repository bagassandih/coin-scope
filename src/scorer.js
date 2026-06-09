import { weights, marketCapTiers } from './config.js';

// Min-max normalization
function normalize(value, min, max) {
  if (max === min) return 0;
  return ((value - min) / (max - min)) * 100;
}

// Get market cap tier score
export function getMarketCapTierScore(marketCap) {
  if (marketCap >= marketCapTiers.large.min) {
    return { score: marketCapTiers.large.score, label: marketCapTiers.large.label, name: 'Large' };
  }
  if (marketCap >= marketCapTiers.mid.min) {
    return { score: marketCapTiers.mid.score, label: marketCapTiers.mid.label, name: 'Mid' };
  }
  if (marketCap >= marketCapTiers.small.min) {
    return { score: marketCapTiers.small.score, label: marketCapTiers.small.label, name: 'Small' };
  }
  return { score: marketCapTiers.micro.score, label: marketCapTiers.micro.label, name: 'Micro' };
}

// Calculate volume ratio (volume_24h / market_cap * 0.01)
function getVolumeRatio(coin) {
  if (!coin.market_cap || coin.market_cap === 0) return 0;
  return coin.volume_24h / (coin.market_cap * 0.01);
}

// Check if coin matches pump & dump pattern (v1.2)
function isPumpAndDump(coin) {
  const isPumped = coin.percent_change_7d > 100;  // 7d naik > 100%
  const isDumping = coin.percent_change_24h < -30; // 24h turun > 30%
  return isPumped && isDumping;
}

// Check if coin has healthy trend for holding (v2.2 - 1 month trading)
function hasHealthyTrend(coin) {
  const isPositive7d = coin.percent_change_7d > 0;
  const isNotExtreme = coin.percent_change_7d < 50;  // 7d < 50% (not pumped)
  const isPositive30d = coin.percent_change_30d > 0; // 30d confirms trend (max hold time)
  return isPositive7d && isNotExtreme && isPositive30d;
}

// Check supply dilution risk (v2.0) - coins with high inflation are risky
function getSupplyDilutionRisk(coin) {
  if (!coin.circulating_supply || !coin.max_supply || coin.max_supply === 0) {
    return 0; // Unknown, no penalty
  }
  const circulatingRatio = coin.circulating_supply / coin.max_supply;
  // If < 50% of max supply is circulating, high inflation risk
  if (circulatingRatio < 0.5) return 10;
  if (circulatingRatio < 0.7) return 5;
  return 0; // Most supply already circulating = low inflation risk
}

// Get sector bonus (v2.0) - bonus for hot sectors
function getSectorBonus(coin) {
  if (!coin.tags || coin.tags.length === 0) return 0;

  const hotSectors = ['ai', 'artificial-intelligence', 'defi', 'layer-1', 'layer-2', 'rwa', 'meme'];
  const coinTagsLower = coin.tags.map(t => t.toLowerCase());

  const hasHotSector = hotSectors.some(sector =>
    coinTagsLower.some(tag => tag.includes(sector))
  );

  return hasHotSector ? weights.sectorBonus : 0;
}

export function calculateScores(coins) {
  if (coins.length === 0) return [];

  // Filter out pump & dump patterns (v1.2)
  const filteredCoins = coins.filter(coin => !isPumpAndDump(coin));

  // Find min/max for normalization (use filtered coins)
  const change7dValues = filteredCoins.map(c => c.percent_change_7d);
  const change24hValues = filteredCoins.map(c => c.percent_change_24h);
  const change30dValues = filteredCoins.map(c => c.percent_change_30d);
  const volumeRatios = filteredCoins.map(c => getVolumeRatio(c));

  const min7d = Math.min(...change7dValues);
  const max7d = Math.max(...change7dValues);
  const min24h = Math.min(...change24hValues);
  const max24h = Math.max(...change24hValues);
  const min30d = Math.min(...change30dValues);
  const max30d = Math.max(...change30dValues);
  const minVol = Math.min(...volumeRatios);
  const maxVol = Math.max(...volumeRatios);

  return filteredCoins.map(coin => {
    const tier = getMarketCapTierScore(coin.market_cap);
    const volumeRatio = getVolumeRatio(coin);

    const s7d = normalize(coin.percent_change_7d, min7d, max7d);
    const s24h = normalize(coin.percent_change_24h, min24h, max24h);
    const sVol = normalize(volumeRatio, minVol, maxVol);
    const sMcap = tier.score;

    // Hybrid 30d logic (v1.1) - PRIMARY for 1-month trading
    let s30d;
    if (coin.percent_change_30d <= 0) {
      s30d = 20; // Penalty for dead cat bounce / flat trend
    } else {
      s30d = normalize(coin.percent_change_30d, min30d, max30d);
    }

    // Supply dilution risk penalty (v2.0)
    const supplyRisk = getSupplyDilutionRisk(coin);

    // Sector bonus (v2.0)
    const sectorBonus = getSectorBonus(coin);

    // Healthy trend bonus (v2.2 - 1 month trading)
    const healthyBonus = hasHealthyTrend(coin) ? weights.healthyTrendBonus : 0;

    // Weighted score (v2.2 formula - 1 month spot trading)
    const weightedScore =
      (s30d * weights.change30d) +
      (sVol * weights.volume) +
      (s7d * weights.change7d) +
      (s24h * weights.change24h) +
      (sMcap * weights.marketCapTier) +
      healthyBonus +
      sectorBonus -
      supplyRisk;

    return {
      ...coin,
      tier: tier.name,
      tierLabel: tier.label,
      volumeRatio,
      s7d,
      s24h,
      s30d,
      sVol,
      sMcap,
      healthyBonus,
      sectorBonus,
      supplyRisk,
      weightedScore: Math.round(weightedScore * 10) / 10,
    };
  });
}

export function rankTop5(scoredCoins) {
  return scoredCoins
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .slice(0, 5);
}
