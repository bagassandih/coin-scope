#!/usr/bin/env node

import { fetchCoins, extractCoinData } from './fetcher.js';
import { hardFilter } from './filter.js';
import { calculateScores, rankTop5 } from './scorer.js';
import {
  displayHeader,
  displayMetadata,
  displayTable,
  displayFooter,
  displayFilterStats,
} from './display.js';

// WIB Timestamp helper
function getWIBTimestamp() {
  const now = new Date();
  const wibTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  return wibTime.toISOString().replace('T', ' ').slice(0, 19) + ' WIB';
}

async function main() {
  try {
    console.log(chalk.cyan(`\n🪙 CoinScope v1.2 - Sistem Lacak Koin Berpotensi Naik`));
    console.log(chalk.gray(`⏰ ${getWIBTimestamp()}\n`));

    // Step 1: Fetch Universe
    const rawData = await fetchCoins();
    const coins = extractCoinData(rawData);

    if (coins.length === 0) {
      console.error(chalk.red('❌ No data received from CMC API'));
      process.exit(1);
    }

    // Step 2: Hard Filter
    const filterResult = hardFilter(coins);

    console.log(chalk.green(`  ✓ Fetched: ${coins.length} koin`));
    console.log(chalk.green(`  ✓ Lolos filter: ${filterResult.passed.length} koin`));
    displayFilterStats(filterResult);

    if (filterResult.passed.length === 0) {
      displayHeader();
      displayMetadata({
        timestamp: Math.floor(Date.now() / 1000),
        universe: coins.length,
        filtered: 0,
      });
      displayTable([]);
      displayFooter();
      process.exit(0);
    }

    // Step 3: Calculate Scores
    const scoredCoins = calculateScores(filterResult.passed);

    // Step 4: Rank Top 5
    const top5 = rankTop5(scoredCoins);

    // Step 5: Display
    displayHeader();
    displayMetadata({
      timestamp: Math.floor(Date.now() / 1000),
      universe: coins.length,
      filtered: filterResult.passed.length,
    });
    displayTable(top5);
    displayFooter();

  } catch (err) {
    console.error(chalk.red(`\n❌ Error [${getWIBTimestamp()}]: ${err.message}`));
    process.exit(1);
  }
}

import chalk from 'chalk';

main();
