let currentData = null;
var refreshCooldown = 30; // seconds
var refreshCountdownInterval = null;

function startRefreshCooldown(btn) {
  var remaining = refreshCooldown;
  btn.disabled = true;
  btn.dataset.originalHtml = btn.innerHTML;

  refreshCountdownInterval = setInterval(function() {
    remaining--;
    btn.innerHTML = '<span class="icon">⏳</span> Tunggu ' + remaining + 's';
    if (remaining <= 0) {
      clearInterval(refreshCountdownInterval);
      refreshCountdownInterval = null;
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalHtml;
    }
  }, 1000);
}

function formatCurrency(value) {
  if (value >= 1e12) return '$' + (value / 1e12).toFixed(2) + 'T';
  if (value >= 1e9) return '$' + (value / 1e9).toFixed(1) + 'B';
  if (value >= 1e6) return '$' + (value / 1e6).toFixed(1) + 'M';
  if (value >= 1e3) return '$' + (value / 1e3).toFixed(2) + 'K';
  return '$' + value.toFixed(2);
}

function formatPrice(price) {
  if (price >= 1) return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 0.01) return '$' + price.toFixed(4);
  return '$' + price.toFixed(8);
}

function formatPercent(value) {
  var sign = value >= 0 ? '+' : '';
  return sign + value.toFixed(1) + '%';
}

function formatTimestamp(ts) {
  var date = new Date(ts * 1000);
  var wibTime = new Date(date.getTime() + (7 * 60 * 60 * 1000));
  return wibTime.toISOString().replace('T', ' ').slice(0, 19) + ' WIB';
}

function formatCacheAge(seconds) {
  if (!seconds) return 'Now';
  var mins = Math.floor(seconds / 60);
  if (mins < 60) return mins + 'm ago';
  var hours = Math.floor(mins / 60);
  return hours + 'h ' + (mins % 60) + 'm ago';
}

function getTierName(label) {
  var names = { 'L': 'Large Cap', 'M': 'Mid Cap', 'S': 'Small Cap', 'X': 'Micro Cap' };
  return names[label] || label;
}

function renderCoins(data) {
  var container = document.getElementById('coinsContainer');

  if (data.message) {
    container.innerHTML = '<div class="empty-state"><div class="icon">🔄</div><h3>Belum ada data</h3><p>Klik tombol <strong>Refresh Data</strong> untuk mengambil data dari CMC API</p></div>';
    return;
  }

  if (!data.top5 || data.top5.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">📊</div><h3>Tidak ada koin yang memenuhi kriteria</h3><p>Coba refresh data atau ubah filter</p></div>';
    return;
  }

  container.innerHTML = data.top5.map(function(coin) {
    var tierClass = 'tier-' + coin.tierLabel;
    var platformBadge = coin.platform
      ? '<span class="network-badge">' + coin.platform + '</span>'
      : '<span class="network-badge native">Native</span>';

    return '<div class="coin-card">' +
      '<label class="track-checkbox-wrapper">' +
        '<input type="checkbox" class="track-checkbox" data-id="' + coin.id + '" data-name="' + coin.name + '" data-symbol="' + coin.symbol + '"' + (coin.tracked ? ' checked' : '') + '>' +
        '<span class="custom-checkbox"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>' +
      '</label>' +
      '<div class="coin-card-inner">' +
        '<div class="coin-card-header">' +
          '<div class="coin-card-rank">#' + coin.rank + '</div>' +
          '<img src="' + coin.logo + '" alt="' + coin.name + '" class="coin-logo" onerror="this.src=\'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E🪙%3C/text%3E%3C/svg%3E\'">' +
          '<div class="coin-header-info">' +
            '<div class="coin-name-row">' +
              '<span class="coin-name">' + coin.name + '</span>' +
              '<span class="tier-badge ' + tierClass + '">' + coin.tierLabel + '</span>' +
              platformBadge +
            '</div>' +
            '<span class="coin-symbol">' + coin.symbol + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="coin-card-price">' +
          '<span class="coin-price">' + formatPrice(coin.price) + '</span>' +
          '<div class="coin-card-score">' +
            '<div class="score-value">' + coin.score.toFixed(1) + '</div>' +
            '<div class="score-label">Score</div>' +
          '</div>' +
        '</div>' +
        '<div class="coin-card-metrics">' +
          '<div class="metric-item"><span class="metric-label">7d Change</span><span class="metric-value ' + (coin.percent_change_7d >= 0 ? 'positive' : 'negative') + '">' + formatPercent(coin.percent_change_7d) + '</span></div>' +
          '<div class="metric-item"><span class="metric-label">24h Change</span><span class="metric-value ' + (coin.percent_change_24h >= 0 ? 'positive' : 'negative') + '">' + formatPercent(coin.percent_change_24h) + '</span></div>' +
          '<div class="metric-item"><span class="metric-label">Volume</span><span class="metric-value">' + formatCurrency(coin.volume_24h) + '</span></div>' +
          '<div class="metric-item"><span class="metric-label">Market Cap</span><span class="metric-value">' + formatCurrency(coin.market_cap) + '</span></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  document.querySelectorAll('.track-checkbox').forEach(function(checkbox) {
    checkbox.addEventListener('change', async function(e) {
      var id = parseInt(e.target.dataset.id);
      var coinName = e.target.dataset.name;
      var coinSymbol = e.target.dataset.symbol;
      var label = coinName + ' (' + coinSymbol + ')';

      if (e.target.checked) {
        // Reset checkbox while user chooses mode
        e.target.checked = false;

        var coinData = currentData && currentData.top5
          ? currentData.top5.find(function(c) { return c.id === id; })
          : null;
        var priceHtml = coinData ? '<p style="color:#f8fafc;font-size:1.4rem;font-weight:700;margin:0.25rem 0">' + formatPrice(coinData.price) + '</p>' : '';

        var result = await Swal.fire({
          title: '📊 Pilih Mode Tracking',
          html: '<p style="color:#94a3b8;margin-bottom:0.25rem">' + label + '</p>' + priceHtml +
                '<div style="display:grid;gap:0.75rem;margin-top:1.25rem;text-align:left">' +
                '<div style="background:#0f172a;border-radius:10px;padding:0.9rem 1rem;border:1px solid #334155">' +
                '<strong style="color:#10b981">📈 Entry Price</strong>' +
                '<p style="color:#94a3b8;font-size:0.85rem;margin-top:0.3rem">Harga saat ini dicatat sebagai "harga beli". Profit/Loss dihitung dari harga entry.</p>' +
                '</div>' +
                '<div style="background:#0f172a;border-radius:10px;padding:0.9rem 1rem;border:1px solid #334155">' +
                '<strong style="color:#3b82f6">🌐 CMC Live</strong>' +
                '<p style="color:#94a3b8;font-size:0.85rem;margin-top:0.3rem">Tampilkan persentase 7d & 24h langsung dari data CMC API.</p>' +
                '</div></div>',
          showConfirmButton: true,
          showDenyButton: true,
          showCancelButton: true,
          confirmButtonText: '📈 Entry Price',
          denyButtonText: '🌐 CMC Live',
          cancelButtonText: 'Batal',
          confirmButtonColor: '#10b981',
          denyButtonColor: '#3b82f6',
          background: '#1e293b',
          color: '#f8fafc',
        });

        if (result.isDismissed) return;

        var mode = result.isConfirmed ? 'entry' : 'cmc';
        var entryPrice = (mode === 'entry' && coinData) ? coinData.price : null;

        try {
          var response = await fetch('/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coinId: id, action: 'add', coin: { id: id, name: coinName, symbol: coinSymbol }, mode: mode, entry_price: entryPrice }),
          });
          var data = await response.json();
          if (!data.success) throw new Error(data.error);

          e.target.checked = true;

          Swal.fire({
            icon: 'success',
            title: 'Tracking Dimulai!',
            text: label + ' — Mode: ' + (mode === 'entry' ? '📈 Entry Price' : '🌐 CMC Live'),
            timer: 2000,
            showConfirmButton: false,
            background: '#1e293b',
            color: '#f8fafc',
          });
        } catch (err) {
          Swal.fire({ icon: 'error', title: 'Gagal tracking', text: err.message, background: '#1e293b', color: '#f8fafc' });
        }

      } else {
        // Untrack flow
        e.target.checked = true; // Hold state while confirming

        var result = await Swal.fire({
          title: 'Stop Tracking?',
          text: 'Hentikan tracking ' + coinSymbol + '?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Ya, Stop',
          cancelButtonText: 'Batal',
          background: '#1e293b',
          color: '#f8fafc',
          confirmButtonColor: '#ef4444',
        });

        if (!result.isConfirmed) return;

        try {
          var response = await fetch('/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coinId: id, action: 'remove' }),
          });
          var data = await response.json();
          if (!data.success) throw new Error(data.error);

          e.target.checked = false;
          Swal.fire({ icon: 'success', title: 'Stopped!', text: coinSymbol + ' dihapus dari tracking', timer: 1500, showConfirmButton: false, background: '#1e293b', color: '#f8fafc' });
        } catch (err) {
          Swal.fire({ icon: 'error', title: 'Gagal', text: err.message, background: '#1e293b', color: '#f8fafc' });
        }
      }
    });
  });
}

function updateStats(data) {
  document.getElementById('timestamp').textContent = formatTimestamp(data.timestamp);
  document.getElementById('universe').textContent = data.universe + ' koin';
  document.getElementById('filtered').textContent = data.filtered + ' koin';
  document.getElementById('cacheAge').textContent = formatCacheAge(data.cacheAge);
}

async function fetchData() {
  try {
    var response = await fetch('/api/top5');
    var data = await response.json();

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
        color: '#f8fafc'
      });
    }
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Failed to fetch',
      text: err.message,
      background: '#1e293b',
      color: '#f8fafc'
    });
  }
}

async function refreshData() {
  var btn = document.getElementById('refreshBtn');
  if (btn.disabled) return;

  btn.classList.add('loading');
  btn.disabled = true;

  try {
    var response = await fetch('/api/refresh', { method: 'POST' });
    var data = await response.json();

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
        color: '#f8fafc'
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Refresh Failed',
        text: data.error,
        background: '#1e293b',
        color: '#f8fafc'
      });
    }
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Refresh Failed',
      text: err.message,
      background: '#1e293b',
      color: '#f8fafc'
    });
  } finally {
    btn.classList.remove('loading');
    startRefreshCooldown(btn);
  }
}

async function showTrackedCoins() {
  try {
    var response = await fetch('/api/tracked');
    var data = await response.json();

    if (!data.success) {
      throw new Error(data.error);
    }

    var modal = document.getElementById('historyModal');
    var body = document.getElementById('historyBody');

    if (data.tracked.length === 0) {
      body.innerHTML = '<div class="empty-state"><div class="icon">📊</div><h3>Belum ada koin di-track</h3><p>Centang koin di Top 5 lalu pilih mode tracking</p></div>';
    } else {
      body.innerHTML = '<div class="tracked-coins-list">' + data.tracked.map(function(item) {
        var isEntry = item.tracking_mode === 'entry';
        var modeBadge = isEntry
          ? '<span class="mode-badge mode-entry">📈 Entry</span>'
          : '<span class="mode-badge mode-cmc">🌐 CMC</span>';

        var performanceHtml = '';
        if (isEntry) {
          if (item.entry_performance) {
            var pct = item.entry_performance.price_change_percent;
            var pctClass = pct >= 0 ? 'positive' : 'negative';
            performanceHtml =
              '<div class="tracked-coin-performance">' +
              '<div class="price">' + formatPrice(item.entry_performance.latest_price) + '</div>' +
              '<div class="entry-label">Entry: ' + formatPrice(item.entry_performance.entry_price) + '</div>' +
              '<div class="' + pctClass + ' entry-pct">' + formatPercent(pct) + ' sejak entry</div>' +
              '</div>';
          } else {
            performanceHtml =
              '<div class="tracked-coin-performance">' +
              '<div class="entry-label">Entry: ' + (item.entry_price ? formatPrice(item.entry_price) : '-') + '</div>' +
              '<div style="color:#94a3b8;font-size:0.8rem">Belum ada snapshot</div>' +
              '</div>';
          }
        } else {
          if (item.latest_snapshot) {
            var c7d = item.latest_snapshot.percent_change_7d;
            var c24h = item.latest_snapshot.percent_change_24h;
            performanceHtml =
              '<div class="tracked-coin-performance">' +
              '<div class="price">' + formatPrice(item.latest_snapshot.price) + '</div>' +
              '<div class="' + (c7d >= 0 ? 'positive' : 'negative') + '">7d: ' + formatPercent(c7d) + '</div>' +
              '<div class="' + (c24h >= 0 ? 'positive' : 'negative') + '">24h: ' + formatPercent(c24h) + '</div>' +
              '</div>';
          } else {
            performanceHtml = '<div class="tracked-coin-performance"><p>Belum ada snapshot</p></div>';
          }
        }

        return '<div class="tracked-coin-item">' +
          '<div onclick="showCoinHistory(' + item.id + ', \'' + item.symbol + '\')" style="flex:1;cursor:pointer;display:flex;align-items:center;gap:0.75rem">' +
          '<img src="' + item.logo + '" alt="' + item.symbol + '" class="tracked-coin-logo" onerror="this.src=\'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E🪙%3C/text%3E%3C/svg%3E\'">' +
          '<div class="tracked-coin-info">' +
          '<h3>' + item.name + ' (' + item.symbol + ') ' + modeBadge + '</h3>' +
          '<p>Added: ' + formatTimestamp(item.added_at) + '</p>' +
          '<p>Snapshots: ' + (item.snapshot_count || 0) + '</p>' +
          '</div>' +
          '</div>' +
          performanceHtml +
          '<button class="untrack-btn" onclick="untrackCoin(' + item.id + ', \'' + item.symbol + '\', event)">Untrack</button>' +
          '</div>';
      }).join('') + '</div>';
    }

    modal.style.display = 'block';
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Failed to load tracked coins',
      text: err.message,
      background: '#1e293b',
      color: '#f8fafc'
    });
  }
}

async function untrackCoin(coinId, symbol, event) {
  event.stopPropagation();

  Swal.fire({
    title: 'Stop Tracking?',
    text: 'Hentikan tracking ' + symbol + '?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ya, Stop',
    cancelButtonText: 'Batal',
    background: '#1e293b',
    color: '#f8fafc',
    confirmButtonColor: '#ef4444'
  }).then(function(result) {
    if (!result.isConfirmed) return;

    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coinId: coinId, action: 'remove' })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.success) {
        throw new Error(data.error);
      }

      Swal.fire({
        icon: 'success',
        title: 'Stopped!',
        text: symbol + ' dihapus dari tracking',
        timer: 1500,
        showConfirmButton: false,
        background: '#1e293b',
        color: '#f8fafc'
      });

      showTrackedCoins();
    })
    .catch(function(err) {
      Swal.fire({
        icon: 'error',
        title: 'Failed',
        text: err.message,
        background: '#1e293b',
        color: '#f8fafc'
      });
    });
  });
}

async function showCoinHistory(coinId, symbol) {
  try {
    var response = await fetch('/api/history/' + coinId);
    var data = await response.json();

    if (!data.success) {
      throw new Error(data.error);
    }

    var modal = document.getElementById('historyModal');
    var header = document.getElementById('historyTitle');
    var body = document.getElementById('historyBody');

    var modeLabel = data.tracking_mode === 'entry' ? '📈 Entry Price' : '🌐 CMC Live';
    header.textContent = symbol + ' — ' + modeLabel;

    if (data.snapshots.length === 0) {
      body.innerHTML = '<div class="empty-state"><p>Belum ada snapshot. Refresh data untuk mulai tracking.</p></div>';
    } else {
      var performanceHtml = '';

      if (data.tracking_mode === 'entry' && data.entry_performance) {
        var ep = data.entry_performance;
        var pctClass = ep.price_change_percent >= 0 ? 'positive' : 'negative';
        performanceHtml =
          '<div style="margin-bottom:1.5rem;padding:1rem;background:var(--bg-secondary);border-radius:12px">' +
          '<h3 style="margin:0 0 0.75rem 0">📈 Performance (Entry Price)</h3>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">' +
          '<div><p style="color:#94a3b8;font-size:0.8rem">Entry Price</p><p style="font-weight:600">' + formatPrice(ep.entry_price) + '</p><p style="color:#94a3b8;font-size:0.8rem">' + formatTimestamp(ep.entry_timestamp) + '</p></div>' +
          '<div><p style="color:#94a3b8;font-size:0.8rem">Harga Sekarang</p><p style="font-weight:600">' + formatPrice(ep.latest_price) + '</p><p style="color:#94a3b8;font-size:0.8rem">' + formatTimestamp(ep.latest_timestamp) + '</p></div>' +
          '</div>' +
          '<p style="margin-top:0.75rem;font-size:1.25rem;font-weight:700" class="' + pctClass + '">' + formatPercent(ep.price_change_percent) + ' sejak entry</p>' +
          '</div>';
      } else if (data.performance) {
        var p = data.performance;
        performanceHtml =
          '<div style="margin-bottom:1.5rem;padding:1rem;background:var(--bg-secondary);border-radius:12px">' +
          '<h3 style="margin:0 0 0.5rem 0">🌐 Performance (CMC)</h3>' +
          '<p>First: ' + formatPrice(p.first_price) + ' (' + formatTimestamp(p.first_timestamp) + ')</p>' +
          '<p>Latest: ' + formatPrice(p.latest_price) + ' (' + formatTimestamp(p.latest_timestamp) + ')</p>' +
          '<p class="' + (p.price_change_percent >= 0 ? 'positive' : 'negative') + '">Change: ' + formatPercent(p.price_change_percent) + '</p>' +
          '<p>Snapshots: ' + p.snapshots_count + '</p>' +
          '</div>';
      }

      var tableRows = data.snapshots.map(function(s) {
        return '<tr><td>' + formatTimestamp(s.timestamp) + '</td><td>' + formatPrice(s.price) + '</td><td class="' + (s.percent_change_7d >= 0 ? 'positive' : 'negative') + '">' + formatPercent(s.percent_change_7d) + '</td><td class="' + (s.percent_change_24h >= 0 ? 'positive' : 'negative') + '">' + formatPercent(s.percent_change_24h) + '</td><td>' + formatCurrency(s.volume_24h) + '</td><td>' + s.score.toFixed(1) + '</td></tr>';
      }).join('');

      body.innerHTML = performanceHtml + '<table class="history-table"><thead><tr><th>Date</th><th>Price</th><th>7d Change</th><th>24h Change</th><th>Volume</th><th>Score</th></tr></thead><tbody>' + tableRows + '</tbody></table>';
    }

    modal.style.display = 'block';
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Failed to load history',
      text: err.message,
      background: '#1e293b',
      color: '#f8fafc'
    });
  }
}

function closeHistoryModal() {
  document.getElementById('historyModal').style.display = 'none';
}

window.onclick = function(event) {
  var modal = document.getElementById('historyModal');
  if (event.target === modal) {
    closeHistoryModal();
  }
}

fetchData();
