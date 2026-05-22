import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

export const config = {
  cmcApiKey: process.env.CMC_API_KEY,
  cmcApiUrl: process.env.CMC_API_URL || 'https://pro-api.coinmarketcap.com/v1',
  cacheTtl: parseInt(process.env.CACHE_TTL) || 3600,
  universeSize: parseInt(process.env.UNIVERSE_SIZE) || 500,
  cacheDir: join(__dirname, 'cache'),
};

// Validate required config
if (!config.cmcApiKey) {
  throw new Error('CMC_API_KEY is required. Set it in .env file');
}

// Scoring weights (v1.2 - optimized for 1-month hold strategy)
export const weights = {
  change7d: 0.12,      // Reduced: 7d too short-term, easily manipulated
  change30d: 0.48,     // Increased: 30d confirms healthy trend for holding
  volume: 0.25,        // Reduced: still important but less than trend
  marketCapTier: 0.10, // Reduced: risk management
  change24h: 0.05,     // Unchanged: minimal signal
  healthyTrendBonus: 20, // NEW: bonus for steady rise (not pump & dump)
};

// Hard filter thresholds
export const filters = {
  minChange7d: 1.0,        // > 1% (also filters stablecoins)
  minMarketCap: 50000000,  // > $50M
  minVolume24h: 1000000,   // > $1M
  maxCmcRank: 500,         // <= 500
};

// Market cap tier scores
export const marketCapTiers = {
  large: { min: 10000000000, score: 25, label: 'L' },    // > $10B
  mid: { min: 1000000000, score: 50, label: 'M' },       // > $1B
  small: { min: 100000000, score: 75, label: 'S' },      // > $100M
  micro: { min: 0, score: 100, label: 'X' },             // < $100M
};
