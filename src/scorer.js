import { weights, marketCapTiers } from './config.js';

// Min-max normalization
function normalize(value, min, max) {
  if (max === min) return 0;
  return ((value - min) / (max - min)) * 100;
}

// Get market cap tier score
function getMarketCapTierScore(marketCap) {
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

export function calculateScores(coins) {
  if (coins.length === 0) return [];

  // Find min/max for normalization
  const change7dValues = coins.map(c => c.percent_change_7d);
  const change24hValues = coins.map(c => c.percent_change_24h);
  const volumeRatios = coins.map(c => getVolumeRatio(c));

  const min7d = Math.min(...change7dValues);
  const max7d = Math.max(...change7dValues);
  const min24h = Math.min(...change24hValues);
  const max24h = Math.max(...change24hValues);
  const minVol = Math.min(...volumeRatios);
  const maxVol = Math.max(...volumeRatios);

  return coins.map(coin => {
    const tier = getMarketCapTierScore(coin.market_cap);
    const volumeRatio = getVolumeRatio(coin);

    const s7d = normalize(coin.percent_change_7d, min7d, max7d);
    const s24h = normalize(coin.percent_change_24h, min24h, max24h);
    const sVol = normalize(volumeRatio, minVol, maxVol);
    const sMcap = tier.score;

    const weightedScore =
      (s7d * weights.change7d) +
      (sVol * weights.volume) +
      (sMcap * weights.marketCapTier) +
      (s24h * weights.change24h);

    return {
      ...coin,
      tier: tier.name,
      tierLabel: tier.label,
      volumeRatio,
      s7d,
      s24h,
      sVol,
      sMcap,
      weightedScore: Math.round(weightedScore * 10) / 10,
    };
  });
}

export function rankTop5(scoredCoins) {
  return scoredCoins
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .slice(0, 5);
}
