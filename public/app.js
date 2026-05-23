let currentData = null;
let trackedData = null;
var refreshCooldown = 30; // seconds
var refreshCountdownInterval = null;
var currentTab = 'top5';

// Loading Overlay Functions
function showLoading(message) {
  var overlay = document.getElementById('loadingOverlay');
  var loadingText = overlay.querySelector('.loading-text');
  if (message) {
    loadingText.textContent = message;
  }
  overlay.classList.add('active');

  // Disable all interactions
  document.body.style.pointerEvents = 'none';
  document.body.style.userSelect = 'none';
}

function hideLoading() {
  var overlay = document.getElementById('loadingOverlay');
  overlay.classList.remove('active');

  // Re-enable interactions
  document.body.style.pointerEvents = '';
  document.body.style.userSelect = '';
}

// Tab Navigation
function switchTab(tabName) {
  currentTab = tabName;

  // Save to localStorage
  localStorage.setItem('coinscope_active_tab', tabName);

  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.classList.remove('active');
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
    }
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(function(content) {
    content.classList.remove('active');
  });
  document.getElementById('tab-' + tabName).classList.add('active');

  // Load data for the tab
  if (tabName === 'tracked') {
    loadTrackedCoins();
  } else if (tabName === 'closed') {
    loadClosedPositions();
  }
}

// Load tracked coins for tab
async function loadTrackedCoins() {
  var container = document.getElementById('trackedContainer');
  container.innerHTML = '<div class="loading">Loading...</div>';

  try {
    var response = await fetch('/api/tracked');
    var data = await response.json();

    if (!data.success) {
      throw new Error(data.error);
    }

    trackedData = data;

    // Update stats
    var trackedCount = data.tracked.length;
    var snapshotsTotal = data.tracked.reduce(function(sum, item) {
      return sum + (item.snapshot_count || 0);
    }, 0);

    document.getElementById('trackedCount').textContent = trackedCount;
    document.getElementById('trackedTotal').textContent = trackedCount;
    document.getElementById('snapshotsTotal').textContent = snapshotsTotal;

    if (data.tracked.length === 0) {
      container.innerHTML =
        '<div class="empty-state">' +
          '<div class="icon">📊</div>' +
          '<h3>Belum ada koin di-track</h3>' +
          '<p>Centang koin di tab Top 5 untuk mulai tracking</p>' +
          '<button class="empty-state-cta" onclick="switchTab(\'top5\')">' +
            '<span>🏆</span> Lihat Top 5' +
          '</button>' +
        '</div>';
      return;
    }

    container.innerHTML = '<div class="tracked-coins-list">' +
      data.tracked.map(function(item) {
        var isEntry = item.tracking_mode === 'entry';
        var modeBadge = isEntry
          ? '<span class="mode-badge mode-entry">📈 Entry</span>'
          : '<span class="mode-badge mode-cmc">🌐 CMC</span>';

        var performanceHtml = '';
        if (isEntry) {
          if (item.snapshot_timestamp) {
            var pct = 0;
            if (item.entry_price) {
              pct = ((item.price - item.entry_price) / item.entry_price) * 100;
            }
            var pnlClass = pct >= 0 ? 'pnl-positive' : 'pnl-negative';
            performanceHtml =
              '<div class="tracked-coin-performance">' +
                '<div class="pnl-badge ' + pnlClass + '">' +
                  '<span class="pnl-value">' + formatPercent(pct) + '</span>' +
                  '<span class="pnl-label">PnL</span>' +
                '</div>' +
                '<div style="display:flex;flex-direction:column;align-items:flex-end;margin-left:8px">' +
                  '<span class="current-price-large">' + formatPrice(item.price) + '</span>' +
                  '<span class="entry-price-small">Entry: ' + formatPrice(item.entry_price) + '</span>' +
                '</div>' +
              '</div>';
          } else {
            performanceHtml =
              '<div class="tracked-coin-performance">' +
                '<div class="entry-label">Entry: ' + (item.entry_price ? formatPrice(item.entry_price) : '-') + '</div>' +
                '<div style="color:#94a3b8;font-size:0.8rem">Belum ada snapshot</div>' +
              '</div>';
          }
        } else {
          if (item.snapshot_timestamp) {
            var c7d = item.percent_change_7d;
            var c24h = item.percent_change_24h;
            performanceHtml =
              '<div class="tracked-coin-performance">' +
                '<div class="price">' + formatPrice(item.price) + '</div>' +
                '<div class="' + (c7d >= 0 ? 'positive' : 'negative') + '">7d: ' + (c7d !== null ? formatPercent(c7d) : '-') + '</div>' +
                '<div class="' + (c24h >= 0 ? 'positive' : 'negative') + '">24h: ' + (c24h !== null ? formatPercent(c24h) : '-') + '</div>' +
              '</div>';
          } else {
            performanceHtml = '<div class="tracked-coin-performance"><p>Belum ada snapshot</p></div>';
          }
        }

        return '<div class="tracked-coin-item" onclick="showCoinHistory(' + item.id + ', \'' + item.symbol + '\')">' +
          '<img src="' + item.logo + '" alt="' + item.symbol + '" class="tracked-coin-logo" onerror="this.src=\'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E🪙%3C/text%3E%3C/svg%3E\'">' +
          '<div class="tracked-coin-info">' +
            '<h3>' + item.name + ' (' + item.symbol + ') ' + modeBadge + '</h3>' +
            '<p>Added: ' + formatTimestamp(item.added_at) + ' • Snapshots: ' + (item.snapshot_count || 0) + '</p>' +
          '</div>' +
          performanceHtml +
          '<div class="tracked-coin-actions" onclick="event.stopPropagation()">' +
            '<button class="untrack-btn btn-close" onclick="openCloseModal(' + item.id + ', \'' + item.name + '\', event)">Close</button>' +
            '<button class="untrack-btn btn-untrack" onclick="untrackCoin(' + item.id + ', \'' + item.symbol + '\', event)">Untrack</button>' +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';

  } catch (err) {
    container.innerHTML =
      '<div class="empty-state">' +
        '<div class="icon">❌</div>' +
        '<h3>Gagal memuat data</h3>' +
        '<p>' + err.message + '</p>' +
      '</div>';
  }
}

// Refresh tracked coins (refresh data + reload)
async function refreshTrackedCoins() {
  var btn = document.getElementById('refreshTrackedBtn');
  if (btn.disabled) return;

  showLoading('Refreshing tracked coins & saving snapshots...');

  try {
    // First refresh the data from CMC
    var response = await fetch('/api/refresh', { method: 'POST' });
    var data = await response.json();

    if (data.success) {
      currentData = data;

      // Then reload tracked coins
      await loadTrackedCoins();

      // Update top5 tab stats if needed
      if (data.top5) {
        renderCoins(data);
        updateStats(data);
      }

      Swal.fire({
        icon: 'success',
        title: 'Data Refreshed!',
        text: 'Snapshot tersimpan untuk semua tracked coins',
        timer: 2000,
        showConfirmButton: false,
        background: '#1e293b',
        color: '#f8fafc'
      });
    } else {
      throw new Error(data.error);
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
    hideLoading();
  }
}

function startRefreshCooldown(btn) {
  var remaining = refreshCooldown;
  var countdownContainer = document.getElementById('countdownContainer');
  var progressFill = document.getElementById('progressFill');
  var countdownSeconds = document.getElementById('countdownSeconds');

  btn.disabled = true;
  countdownContainer.style.display = 'block';

  var updateProgress = function() {
    var pct = (remaining / refreshCooldown) * 100;
    progressFill.style.width = pct + '%';
    countdownSeconds.textContent = remaining;
  };

  updateProgress();

  refreshCountdownInterval = setInterval(function() {
    remaining--;
    updateProgress();

    if (remaining <= 0) {
      clearInterval(refreshCountdownInterval);
      refreshCountdownInterval = null;
      btn.disabled = false;
      countdownContainer.style.display = 'none';
      btn.innerHTML = '<span class="icon">🔄</span> Refresh Data';
    }
  }, 1000);
}

function formatCurrency(value) {
  if (value === null || value === undefined) return '-';
  if (value >= 1e12) return '$' + (value / 1e12).toFixed(2) + 'T';
  if (value >= 1e9) return '$' + (value / 1e9).toFixed(1) + 'B';
  if (value >= 1e6) return '$' + (value / 1e6).toFixed(1) + 'M';
  if (value >= 1e3) return '$' + (value / 1e3).toFixed(2) + 'K';
  return '$' + value.toFixed(2);
}

function formatPrice(price) {
  if (price === null || price === undefined) return '-';
  if (price >= 1) return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 0.01) return '$' + price.toFixed(4);
  return '$' + price.toFixed(8);
}

function formatPercent(value) {
  if (value === null || value === undefined) return '-';
  var sign = value >= 0 ? '+' : '';
  return sign + value.toFixed(1) + '%';
}

function formatTimestamp(ts) {
  // Handle both Unix timestamp (number) and ISO string (from Supabase)
  var date;
  if (typeof ts === 'number') {
    date = new Date(ts * 1000);
  } else {
    date = new Date(ts);
  }
  var wibTime = new Date(date.getTime() + (7 * 60 * 60 * 1000));
  return wibTime.toISOString().replace('T', ' ').slice(0, 19) + ' WIB';
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
    container.innerHTML =
      '<div class="empty-state">' +
        '<div class="icon">📊</div>' +
        '<h3>Tidak ada koin yang memenuhi kriteria</h3>' +
        '<p>Coba refresh data atau ubah filter scoring</p>' +
        '<button class="empty-state-cta" onclick="refreshData()">' +
          '<span>🔄</span> Refresh Data' +
        '</button>' +
      '</div>';
    return;
  }

  container.innerHTML = data.top5.map(function(coin) {
    var tierClass = 'tier-' + coin.tierLabel;
    var platformBadge = coin.platform
      ? '<span class="network-badge">' + coin.platform + '</span>'
      : '<span class="network-badge native">Native</span>';

    // Score color class
    var scoreClass = coin.score >= 70 ? 'score-high' : coin.score >= 40 ? 'score-mid' : 'score-low';

    // Rank class
    var rankClass = coin.rank <= 3 ? 'rank-' + coin.rank : 'rank-default';

    return '<div class="coin-card">' +
      '<label class="track-checkbox-wrapper">' +
        '<input type="checkbox" class="track-checkbox" data-id="' + coin.id + '" data-name="' + coin.name + '" data-symbol="' + coin.symbol + '"' + (coin.tracked ? ' checked' : '') + '>' +
        '<span class="custom-checkbox"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>' +
      '</label>' +
      '<div class="coin-card-inner">' +
        '<div class="coin-card-header">' +
          '<div class="coin-card-rank ' + rankClass + '">#' + coin.rank + '</div>' +
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
          '<div class="coin-card-score ' + scoreClass + '">' +
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
  document.getElementById('universe').textContent = data.universe;
  document.getElementById('filtered').textContent = data.filtered;
}

async function fetchData() {
  showLoading('Loading initial data...');

  try {
    var response = await fetch('/api/top5');
    var data = await response.json();

    if (data.success) {
      currentData = data;
      renderCoins(data);
      updateStats(data);

      // Update tracked count
      updateTrackedCount();
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
  } finally {
    hideLoading();
  }
}

// Update tracked count badge
async function updateTrackedCount() {
  try {
    var response = await fetch('/api/tracked');
    var data = await response.json();
    if (data.success) {
      document.getElementById('trackedCount').textContent = data.tracked.length;
    }
  } catch (err) {
    // Silently fail
  }
}

async function refreshData() {
  var btn = document.getElementById('refreshBtn');
  if (btn.disabled) return;

  showLoading('Fetching data from CMC API...');

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
    hideLoading();
    startRefreshCooldown(btn);
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

      // Reload tracked tab
      loadTrackedCoins();
      updateTrackedCount();
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
      // Coin info header with logo
      var coinInfoHtml =
        '<div class="coin-info-header">' +
          '<img src="' + data.logo + '" alt="' + data.symbol + '" class="coin-info-logo" onerror="this.src=\'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E🪙%3C/text%3E%3C/svg%3E\'">' +
          '<div class="coin-info-details">' +
            '<h2 class="coin-info-name">' + data.name + ' <span class="coin-info-symbol">(' + data.symbol + ')</span></h2>' +
            '<p class="coin-info-meta">Added: ' + formatTimestamp(data.added_at) + ' • Snapshots: ' + data.snapshots.length + '</p>' +
          '</div>' +
        '</div>';

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
        var scoreDisplay = s.score !== null ? s.score.toFixed(1) : '-';
        var c7d = s.percent_change_7d;
        var c24h = s.percent_change_24h;
        return '<tr><td>' + formatTimestamp(s.timestamp) + '</td><td>' + formatPrice(s.price) + '</td><td class="' + (c7d >= 0 ? 'positive' : 'negative') + '">' + (c7d !== null ? formatPercent(c7d) : '-') + '</td><td class="' + (c24h >= 0 ? 'positive' : 'negative') + '">' + (c24h !== null ? formatPercent(c24h) : '-') + '</td><td>' + formatCurrency(s.volume_24h) + '</td><td>' + scoreDisplay + '</td></tr>';
      }).join('');

      body.innerHTML = coinInfoHtml + performanceHtml + '<table class="history-table"><thead><tr><th>Date</th><th>Price</th><th>7d Change</th><th>24h Change</th><th>Volume</th><th>Score</th></tr></thead><tbody>' + tableRows + '</tbody></table>';
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

// ============================================
// CLOSED POSITIONS
// ============================================

var currentCloseCoinId = null;
var currentCloseFilter = 'all';

function loadClosedPositions(filter) {
  if (filter) {
    currentCloseFilter = filter;
  }

  var container = document.getElementById('closedContainer');
  container.innerHTML = '<div class="loading">Loading...</div>';

  // Update filter buttons
  document.querySelectorAll('.filter-btn').forEach(function(btn) {
    btn.classList.remove('active');
    if (btn.dataset.filter === currentCloseFilter) {
      btn.classList.add('active');
    }
  });

  fetchClosedPositions(currentCloseFilter);
}

function filterClosed(filter) {
  // Toggle behavior: if clicking the same active filter, reset to 'all'
  if (currentCloseFilter === filter && filter !== 'all') {
    currentCloseFilter = 'all';
  } else {
    currentCloseFilter = filter;
  }
  loadClosedPositions(currentCloseFilter);
}

async function fetchClosedPositions(filter) {
  var container = document.getElementById('closedContainer');
  var filterBar = document.getElementById('filterBar');

  try {
    var response = await fetch('/api/closed?filter=' + filter);
    var data = await response.json();

    if (!data.success) {
      throw new Error(data.error);
    }

    // Update count
    document.getElementById('closedCount').textContent = data.closed.length;

    // Always show filter bar
    filterBar.style.display = 'flex';

    // Update filter active states
    document.querySelectorAll('.filter-btn').forEach(function(btn) {
      btn.classList.remove('active');
      if (btn.dataset.filter === currentCloseFilter) {
        btn.classList.add('active');
      }
    });

    // Handle empty results
    if (data.closed.length === 0) {
      var emptyTitle, emptyMessage, emptyAction;

      if (filter === 'all') {
        emptyTitle = 'Belum ada posisi ditutup';
        emptyMessage = 'Track koin dulu, baru bisa close posisi di sini.';
        emptyAction = '<button class="empty-state-cta" onclick="switchTab(\'tracked\')">Lihat Koin Tracked</button>';
      } else {
        var filterLabels = {
          'take_profit': 'Take Profit',
          'cutloss': 'Cutloss',
          'stagnant': 'Stagnan/Boring',
          'other': 'Other'
        };
        emptyTitle = 'Tidak ada posisi ' + filterLabels[filter];
        emptyMessage = 'Coba filter lain atau clear filter untuk melihat semua posisi.';
        emptyAction = '<button class="empty-state-cta" onclick="filterClosed(\'all\')">Clear Filter</button>';
      }

      container.innerHTML =
        '<div class="empty-state">' +
          '<div class="icon">' + (filter === 'all' ? '✅' : '📭') + '</div>' +
          '<h3>' + emptyTitle + '</h3>' +
          '<p>' + emptyMessage + '</p>' +
          emptyAction +
        '</div>';
      return;
    }

    container.innerHTML = data.closed.map(function(coin) {
      var tagClass = '';
      var tagLabel = coin.close_reason;

      if (coin.close_reason === 'take_profit') {
        tagClass = 'take-profit';
        tagLabel = 'Take Profit';
      } else if (coin.close_reason === 'cutloss') {
        tagClass = 'cutloss';
        tagLabel = 'Cutloss';
      } else if (coin.close_reason === 'stagnant') {
        tagClass = 'stagnant';
        tagLabel = 'Stagnan/Boring';
      } else {
        tagClass = 'other';
        tagLabel = coin.close_reason === 'other' ? 'Other' : coin.close_reason;
      }

      var profitClass = '';
      var profitDisplay = '-';

      if (coin.performance) {
        profitClass = coin.performance.price_change_percent >= 0 ? 'positive' : 'negative';
        profitDisplay = formatPercent(coin.performance.price_change_percent);
      }

      var addedDate = new Date(coin.added_at);
      var closedDate = new Date(coin.closed_at);
      var holdDays = coin.hold_days || Math.floor((closedDate - addedDate) / (1000 * 60 * 60 * 24));

      return '<div class="closed-card" onclick="showClosedHistory(' + coin.id + ')">' +
        '<div class="closed-card-header">' +
        '<div class="closed-card-coin">' +
        '<img src="' + coin.logo + '" alt="' + coin.name + '">' +
        '<div class="closed-card-coin-info">' +
        '<h3>' + coin.name + '</h3>' +
        '<span>' + coin.symbol + '</span>' +
        '</div>' +
        '</div>' +
        '<span class="close-tag ' + tagClass + '">' + tagLabel + '</span>' +
        '</div>' +
        '<div class="closed-card-stats">' +
        '<div class="closed-stat">' +
        '<span class="closed-stat-label">Duration</span>' +
        '<span class="closed-stat-value">' + holdDays + ' days</span>' +
        '</div>' +
        '<div class="closed-stat">' +
        '<span class="closed-stat-label">Profit/Loss</span>' +
        '<span class="closed-stat-value ' + profitClass + '">' + profitDisplay + '</span>' +
        '</div>' +
        '<div class="closed-stat">' +
        '<span class="closed-stat-label">Closed</span>' +
        '<span class="closed-stat-value">' + formatDate(closedDate) + '</span>' +
        '</div>' +
        '</div>' +
        '<div class="closed-card-actions" onclick="event.stopPropagation()">' +
        '<button class="btn-resume" onclick="resumePosition(' + coin.id + ')">Resume</button>' +
        '<button class="btn-delete" onclick="deleteClosedPosition(' + coin.id + ')">Delete</button>' +
        '</div>' +
        '</div>';
    }).join('');
  } catch (err) {
    container.innerHTML = '<div class="error">Failed to load: ' + err.message + '</div>';
  }
}

async function showClosedHistory(coinId) {
  var modal = document.getElementById('historyModal');
  var title = document.getElementById('historyTitle');
  var body = document.getElementById('historyBody');

  body.innerHTML = '<div class="loading">Loading...</div>';
  modal.style.display = 'block';

  try {
    var response = await fetch('/api/closed/' + coinId + '/history');
    var data = await response.json();

    if (!data.success) {
      throw new Error(data.error);
    }

    title.textContent = data.name + ' (' + data.symbol + ') - Closed History';

    // Calculate performance
    var performanceHtml = '';
    if (data.snapshots.length >= 2) {
      var first = data.snapshots[0];
      var last = data.snapshots[data.snapshots.length - 1];
      var priceChange = last.price - first.price;
      var priceChangePercent = (priceChange / first.price) * 100;
      var profitClass = priceChangePercent >= 0 ? 'positive' : 'negative';

      performanceHtml = '<div class="coin-info-header">' +
        '<img src="' + data.logo + '" alt="' + data.name + '">' +
        '<div>' +
        '<h3>' + data.name + ' (' + data.symbol + ')</h3>' +
        '<p>📅 ' + formatDate(new Date(data.added_at)) + ' → ' + formatDate(new Date(data.closed_at)) + '</p>' +
        '<p>🏷️ Reason: ' + (data.close_reason === 'take_profit' ? 'Take Profit' : data.close_reason === 'cutloss' ? 'Cutloss' : data.close_reason === 'stagnant' ? 'Stagnan/Boring' : data.close_reason) + '</p>' +
        '<p class="' + profitClass + '">💰 P/L: ' + formatPercent(priceChangePercent) + '</p>' +
        '</div>' +
        '</div>';
    }

    // Build snapshot table
    var tableRows = data.snapshots.map(function(s) {
      var c7d = s.percent_change_7d;
      var c24h = s.percent_change_24h;
      var scoreDisplay = s.score ? s.score.toFixed(1) : '-';
      return '<tr><td>' + formatTimestamp(s.timestamp) + '</td><td>' + formatPrice(s.price) + '</td><td class="' + (c7d >= 0 ? 'positive' : 'negative') + '">' + (c7d !== null ? formatPercent(c7d) : '-') + '</td><td class="' + (c24h >= 0 ? 'positive' : 'negative') + '">' + (c24h !== null ? formatPercent(c24h) : '-') + '</td><td>' + formatCurrency(s.volume_24h) + '</td><td>' + scoreDisplay + '</td></tr>';
    }).join('');

    body.innerHTML = performanceHtml + '<table class="history-table"><thead><tr><th>Date</th><th>Price</th><th>7d Change</th><th>24h Change</th><th>Volume</th><th>Score</th></tr></thead><tbody>' + tableRows + '</tbody></table>';
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

async function resumePosition(coinId) {
  var result = await Swal.fire({
    title: 'Resume tracking?',
    text: 'This will move the coin back to active tracking',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3b82f6',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Yes, resume',
    background: '#1e293b',
    color: '#f8fafc'
  });

  if (result.isConfirmed) {
    try {
      showLoading();
      var response = await fetch('/api/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coinId: coinId })
      });
      var data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      hideLoading();
      await Swal.fire({
        icon: 'success',
        title: 'Resumed!',
        text: 'Coin is back in active tracking',
        background: '#1e293b',
        color: '#f8fafc',
        timer: 1500,
        showConfirmButton: false
      });

      loadClosedPositions(currentCloseFilter);
      updateTrackedCount();
    } catch (err) {
      hideLoading();
      Swal.fire({
        icon: 'error',
        title: 'Failed to resume',
        text: err.message,
        background: '#1e293b',
        color: '#f8fafc'
      });
    }
  }
}

async function deleteClosedPosition(coinId) {
  var result = await Swal.fire({
    title: 'Delete permanently?',
    text: 'This will remove all history for this coin. This action cannot be undone!',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Yes, delete',
    background: '#1e293b',
    color: '#f8fafc'
  });

  if (result.isConfirmed) {
    try {
      showLoading();
      var response = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coinId: coinId, action: 'remove' })
      });
      var data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      hideLoading();
      await Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Closed position has been removed',
        background: '#1e293b',
        color: '#f8fafc',
        timer: 1500,
        showConfirmButton: false
      });

      loadClosedPositions(currentCloseFilter);
    } catch (err) {
      hideLoading();
      Swal.fire({
        icon: 'error',
        title: 'Failed to delete',
        text: err.message,
        background: '#1e293b',
        color: '#f8fafc'
      });
    }
  }
}

// ============================================
// CLOSE POSITION MODAL
// ============================================

function openCloseModal(coinId, coinName) {
  currentCloseCoinId = coinId;

  // Reset form
  document.querySelectorAll('input[name="closeReason"]').forEach(function(radio) {
    radio.checked = false;
  });
  document.getElementById('closeReasonOther').value = '';
  document.getElementById('closeReasonOther').disabled = true;

  var modal = document.getElementById('closeModal');
  document.querySelector('#closeModal .modal-content h2').textContent = 'Close Position - ' + coinName;
  modal.style.display = 'block';
}

function closeCloseModal() {
  document.getElementById('closeModal').style.display = 'none';
  currentCloseCoinId = null;
}

function confirmClosePosition() {
  var selectedReason = document.querySelector('input[name="closeReason"]:checked');

  if (!selectedReason) {
    Swal.fire({
      icon: 'warning',
      title: 'Please select a reason',
      text: 'Why are you closing this position?',
      background: '#1e293b',
      color: '#f8fafc'
    });
    return;
  }

  var reason = selectedReason.value;
  if (reason === 'other') {
    var otherText = document.getElementById('closeReasonOther').value.trim();
    if (!otherText) {
      Swal.fire({
        icon: 'warning',
        title: 'Please specify',
        text: 'Enter a reason for closing',
        background: '#1e293b',
        color: '#f8fafc'
      });
      return;
    }
    reason = otherText;
  }

  closePositionWithReason(currentCloseCoinId, reason);
}

async function closePositionWithReason(coinId, reason) {
  try {
    showLoading();
    var response = await fetch('/api/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coinId: coinId, reason: reason })
    });
    var data = await response.json();

    if (!data.success) {
      throw new Error(data.error);
    }

    hideLoading();
    closeCloseModal();

    await Swal.fire({
      icon: 'success',
      title: 'Position closed!',
      text: 'Moved to Closed tab',
      background: '#1e293b',
      color: '#f8fafc',
      timer: 1500,
      showConfirmButton: false
    });

    loadTrackedCoins();
    updateTrackedCount();
  } catch (err) {
    hideLoading();
    Swal.fire({
      icon: 'error',
      title: 'Failed to close',
      text: err.message,
      background: '#1e293b',
      color: '#f8fafc'
    });
  }
}

// Handle "Other" radio button
document.addEventListener('DOMContentLoaded', function() {
  var otherRadio = document.querySelector('input[name="closeReason"][value="other"]');
  var otherInput = document.getElementById('closeReasonOther');

  if (otherRadio && otherInput) {
    otherRadio.addEventListener('change', function() {
      otherInput.disabled = !this.checked;
      if (this.checked) {
        otherInput.focus();
      }
    });
  }
});

window.onclick = function(event) {
  var historyModal = document.getElementById('historyModal');
  var closeModal = document.getElementById('closeModal');
  var scoringModal = document.getElementById('scoringModal');

  if (event.target === historyModal) {
    closeHistoryModal();
  }
  if (event.target === closeModal) {
    closeCloseModal();
  }
  if (event.target === scoringModal) {
    closeScoringModal();
  }
};

// Restore tab state from localStorage
var savedTab = localStorage.getItem('coinscope_active_tab');
if (savedTab && ['top5', 'tracked', 'closed'].includes(savedTab)) {
  currentTab = savedTab;
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.classList.remove('active');
    if (btn.dataset.tab === savedTab) {
      btn.classList.add('active');
    }
  });
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(function(content) {
    content.classList.remove('active');
  });
  document.getElementById('tab-' + savedTab).classList.add('active');
}

// Initialize app
async function initApp() {
  await fetchData();
  // Load data for the restored tab
  if (currentTab === 'tracked') {
    loadTrackedCoins();
  } else if (currentTab === 'closed') {
    loadClosedPositions();
  }
}

initApp();

// ============================================
// PHASE 3: POLISH - SCORING INFO MODAL
// ============================================

function showScoringInfo() {
  var modal = document.getElementById('scoringModal');
  modal.style.display = 'block';
}

function closeScoringModal() {
  document.getElementById('scoringModal').style.display = 'none';
}

// ============================================
// PHASE 3: PULL-TO-REFRESH
// ============================================

var pullToRefresh = document.getElementById('pullToRefresh');
var pullIndicator = pullToRefresh?.querySelector('.pull-indicator');
var pullText = pullToRefresh?.querySelector('.pull-text');
var startY = 0;
var currentY = 0;
var isPulling = false;
var pullThreshold = 80; // px
var refreshThreshold = 120; // px

function handleTouchStart(e) {
  if (window.scrollY === 0) {
    startY = e.touches[0].clientY;
    isPulling = true;
  }
}

function handleTouchMove(e) {
  if (!isPulling) return;

  currentY = e.touches[0].clientY;
  var diff = currentY - startY;

  if (diff > 0 && window.scrollY === 0) {
    // Prevent default pull-to-refresh
    e.preventDefault();

    var progress = Math.min(diff / refreshThreshold, 1);

    if (diff > pullThreshold) {
      pullToRefresh.classList.add('visible');
      pullText.textContent = 'Release to refresh';

      if (diff >= refreshThreshold) {
        pullToRefresh.classList.add('ready');
        pullText.textContent = 'Release to refresh';
      } else {
        pullToRefresh.classList.remove('ready');
      }
    } else {
      pullToRefresh.classList.remove('visible', 'ready');
    }
  }
}

function handleTouchEnd(e) {
  if (!isPulling) return;

  var diff = currentY - startY;

  if (diff >= refreshThreshold) {
    // Trigger refresh
    pullToRefresh.classList.add('refreshing');
    pullText.textContent = 'Refreshing...';

    refreshData().finally(function() {
      setTimeout(function() {
        pullToRefresh.classList.remove('visible', 'ready', 'refreshing');
      }, 500);
    });
  } else {
    // Cancel
    pullToRefresh.classList.remove('visible', 'ready');
  }

  isPulling = false;
  startY = 0;
  currentY = 0;
}

// Add event listeners for pull-to-refresh
if (pullToRefresh) {
  document.addEventListener('touchstart', handleTouchStart, { passive: false });
  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd);
}
