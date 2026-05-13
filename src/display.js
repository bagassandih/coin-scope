import chalk from 'chalk';
import Table from 'cli-table3';

export function formatCurrency(value) {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

export function formatPrice(price) {
  if (price >= 1) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(8)}`;
}

export function formatPercent(value) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function getColorForPercent(value) {
  return value >= 0 ? chalk.green : chalk.red;
}

export function getTierColor(tier) {
  const colors = {
    'Large': chalk.blue,
    'Mid': chalk.cyan,
    'Small': chalk.yellow,
    'Micro': chalk.magenta,
  };
  return colors[tier] || chalk.white;
}

export function displayHeader() {
  console.log('');
  console.log(chalk.cyan('╔═══════════════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.white.bold('                         CoinScope - Top 5 Potensi Naik                         ') + chalk.cyan('║'));
  console.log(chalk.cyan('╠═══════════════════════════════════════════════════════════════════════════════╣'));
}

export function displayMetadata(metadata) {
  const timestamp = new Date(metadata.timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  console.log(chalk.gray(` 📅 Timestamp: ${timestamp}`));
  console.log(chalk.gray(` 📊 Universe: ${metadata.universe} koin | Lolos Filter: ${metadata.filtered} koin`));
  console.log(chalk.cyan('╠═══════════════════════════════════════════════════════════════════════════════╣'));
}

export function displayTable(topCoins) {
  if (topCoins.length === 0) {
    console.log(chalk.yellow(' ⚠️  Tidak ada koin yang memenuhi kriteria filtering.'));
    return;
  }

  const table = new Table({
    head: [
      chalk.white.bold('#'),
      chalk.white.bold('Koin'),
      chalk.white.bold('Harga'),
      chalk.white.bold('7d'),
      chalk.white.bold('24h'),
      chalk.white.bold('Volume'),
      chalk.white.bold('Market Cap'),
      chalk.white.bold('Score'),
    ],
    colWidths: [4, 20, 14, 8, 8, 12, 16, 8],
    colAligns: ['middle', 'left', 'right', 'right', 'right', 'right', 'left', 'middle'],
  });

  topCoins.forEach((coin, index) => {
    const name = `${coin.name} (${coin.symbol})`.slice(0, 18);
    const price = formatPrice(coin.price);
    const change7d = getColorForPercent(coin.percent_change_7d)(formatPercent(coin.percent_change_7d));
    const change24h = getColorForPercent(coin.percent_change_24h)(formatPercent(coin.percent_change_24h));
    const volume = formatCurrency(coin.volume_24h);
    const mcap = formatCurrency(coin.market_cap) + ' ' + getTierColor(coin.tier)(`[${coin.tierLabel}]`);
    const score = chalk.bold(coin.weightedScore.toFixed(1));

    table.push([index + 1, name, price, change7d, change24h, volume, mcap, score]);
  });

  console.log(table.toString());
}

export function displayFooter() {
  console.log(chalk.cyan('╠═══════════════════════════════════════════════════════════════════════════════╣'));
  console.log(chalk.gray(' [L] = Large Cap | [M] = Mid Cap | [S] = Small Cap | [X] = Micro Cap'));
  console.log(chalk.yellow(' ⚠️  Bukan rekomendasi investasi. Ini scoring berbasis momentum historis.'));
  console.log(chalk.cyan('╚═══════════════════════════════════════════════════════════════════════════════╝'));
  console.log('');
}

export function displayFilterStats(stats) {
  if (stats.rejected.stablecoin > 0) {
    console.log(chalk.gray(`  📌 Difilter: ${stats.rejected.stablecoin} stablecoin/flat (< 1% 7d change)`));
  }
  const totalRejected = Object.values(stats.rejected).reduce((a, b) => a + b, 0);
  if (totalRejected > 0) {
    console.log(chalk.gray(`  📌 Total rejected: ${totalRejected} koin`));
  }
}
