import { filters } from './config.js';

export function hardFilter(coins) {
  const results = {
    passed: [],
    rejected: {
      stablecoin: 0,
      change7d: 0,
      marketCap: 0,
      volume: 0,
      cmcRank: 0,
      supply: 0,
      nonLatinSymbol: 0, // NEW: reject non-Latin symbols (v2.0)
    },
  };

  for (const coin of coins) {
    // Check non-Latin symbol (v2.0) - filter before other checks
    // Non-Latin symbols won't match Binance trading pairs
    if (!coin.symbol || /[^\x00-\x7F]/.test(coin.symbol)) {
      results.rejected.nonLatinSymbol++;
      continue;
    }

    // Check stablecoin/flat filter (7d < 1%)
    if (coin.percent_change_7d < filters.minChange7d) {
      results.rejected.stablecoin++;
      continue;
    }

    // Check 7d positive
    if (coin.percent_change_7d <= 0) {
      results.rejected.change7d++;
      continue;
    }

    // Check market cap minimum
    if (!coin.market_cap || coin.market_cap <= filters.minMarketCap) {
      results.rejected.marketCap++;
      continue;
    }

    // Check volume minimum
    if (!coin.volume_24h || coin.volume_24h <= filters.minVolume24h) {
      results.rejected.volume++;
      continue;
    }

    // Check CMC rank
    if (!coin.cmc_rank || coin.cmc_rank > filters.maxCmcRank) {
      results.rejected.cmcRank++;
      continue;
    }

    // Check circulating supply
    if (!coin.circulating_supply || coin.circulating_supply <= 0) {
      results.rejected.supply++;
      continue;
    }

    results.passed.push(coin);
  }

  return results;
}
