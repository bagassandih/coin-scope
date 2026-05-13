let currentData = null;

function formatCurrency(value) {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function formatPrice(price) {
  if (price >= 1) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(8)}`;
}

function formatPercent(value) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function formatTimestamp(ts) {
  const date = new Date(ts * 1000);
  // Convert to WIB (UTC+7)
  const wibTime = new Date(date.getTime() + (7 * 60 * 60 * 1000));
  return wibTime.toISOString().replace('T', ' ').slice(0, 19) + ' WIB';
}

function formatCacheAge(seconds) {
  if (!seconds) return 'Now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m ago`;
}

function getTierName(label) {
  const names = { 'L': 'Large Cap', 'M': 'Mid Cap', 'S': 'Small Cap', 'X': 'Micro Cap' };
  return names[label] || label;
}

function renderCoins(data) {
  const container = document.getElementById('coinsContainer');

  // No cached data - show message to refresh
  if (data.message) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">🔄</div>
        <h3>Belum ada data</h3>
        <p>Klik tombol <strong>Refresh Data</strong> untuk mengambil data dari CMC API</p>
      </div>
    `;
    return;
  }

  if (!data.top5 || data.top5.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📊</div>
        <h3>Tidak ada koin yang memenuhi kriteria</h3>
        <p>Coba refresh data atau ubah filter</p>
      </div>
    `;
    return;
  }

  container.innerHTML = data.top5.map(coin => `
    <div class="coin-card">
      <div class="rank">#${coin.rank}</div>
      <div class="coin-info">
        <div class="coin-header">
          <img src="${coin.logo}" alt="${coin.name}" class="coin-logo" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🪙</text></svg>'">
          <div>
            <div class="coin-name">
              ${coin.name}
              <span class="tier-badge tier-${coin.tierLabel}">${coin.tierLabel}</span>
              ${coin.platform ? `<span class="network-badge">${coin.platform}</span>` : '<span class="network-badge native">Native</span>'}
            </div>
            <div class="coin-symbol">${coin.symbol}</div>
          </div>
        </div>
        <div class="coin-price">${formatPrice(coin.price)}</div>
        <div class="coin-metrics">
          <span class="metric ${coin.percent_change_7d >= 0 ? 'positive' : 'negative'}">
            7d: ${formatPercent(coin.percent_change_7d)}
          </span>
          <span class="metric ${coin.percent_change_24h >= 0 ? 'positive' : 'negative'}">
            24h: ${formatPercent(coin.percent_change_24h)}
          </span>
          <span class="metric">
            Vol: ${formatCurrency(coin.volume_24h)}
          </span>
          <span class="metric">
            MCap: ${formatCurrency(coin.market_cap)}
          </span>
        </div>
      </div>
      <div class="coin-score">
        <div class="score-value">${coin.score.toFixed(1)}</div>
        <div class="score-label">Score</div>
      </div>
    </div>
  `).join('');
}

function updateStats(data) {
  document.getElementById('timestamp').textContent = formatTimestamp(data.timestamp);
  document.getElementById('universe').textContent = data.universe + ' koin';
  document.getElementById('filtered').textContent = data.filtered + ' koin';
  document.getElementById('cacheAge').textContent = formatCacheAge(data.cacheAge);
}

async function fetchData() {
  try {
    const response = await fetch('/api/top5');
    const data = await response.json();

    if (data.success) {
      currentData = data;
      renderCoins(data);
      updateStats(data);
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: data.error,
        background: '#1e293b',
        color: '#f8fafc',
      });
    }
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Failed to fetch',
      text: err.message,
      background: '#1e293b',
      color: '#f8fafc',
    });
  }
}

async function refreshData() {
  const btn = document.getElementById('refreshBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const response = await fetch('/api/refresh', { method: 'POST' });
    const data = await response.json();

    if (data.success) {
      currentData = data;
      renderCoins(data);
      updateStats(data);

      Swal.fire({
        icon: 'success',
        title: 'Data Refreshed!',
        text: 'Data berhasil di-update dari CMC API',
        timer: 2000,
        showConfirmButton: false,
        background: '#1e293b',
        color: '#f8fafc',
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Refresh Failed',
        text: data.error,
        background: '#1e293b',
        color: '#f8fafc',
      });
    }
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Refresh Failed',
      text: err.message,
      background: '#1e293b',
      color: '#f8fafc',
    });
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// Initial load
fetchData();
