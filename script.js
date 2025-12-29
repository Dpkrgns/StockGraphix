// StockGraphix - Main JavaScript File

// Global data storage
let stockData = {
  recommendations: [],
  correlations: {},
  mstEdges: [],
  returns: [],
  stockNames: {
    'AAPL': 'Apple Inc.',
    'MSFT': 'Microsoft Corporation',
    'GOOG': 'Alphabet Inc.',
    'AMZN': 'Amazon.com Inc.',
    'PAYTM.NS': 'Paytm',
    'HDFCBANK.NS': 'HDFC Bank',
    'ICICIBANK.NS': 'ICICI Bank',
    'RELIANCE.NS': 'Reliance Industries',
    'ITC.NS': 'ITC Limited',
    'TCS.NS': 'Tata Consultancy Services'
  }
};

// Global variables for graph interactivity
let graphCanvas = null;
let graphCtx = null;
let graphPositions = {};
let graphNodeList = [];
let hoveredNode = null;
let marketChart = null;

// CSV Parser
function parseCSV(text) {
  const lines = text.trim().split('\n').filter(line => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], data: [] };
  
  const headers = lines[0].split(',').map(h => h.trim());
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index]?.trim() || '';
    });
    data.push(obj);
  }
  
  return { headers, data };
}

// Load CSV file - try multiple paths
async function loadCSV(filename) {
  const paths = [
    `data/${filename}`,           // Most common: data folder in same directory
    `./data/${filename}`,       // Explicit relative path
    `../data/${filename}`        // Fallback: data folder at project root
  ];
  
  for (const path of paths) {
    try {
      console.log(`Trying to load: ${path}`);
      const response = await fetch(path);
      if (response.ok) {
        const text = await response.text();
        console.log(`Successfully loaded: ${path}`);
        return parseCSV(text);
      }
    } catch (error) {
      console.log(`Failed to load ${path}:`, error.message);
      continue;
    }
  }
  
  console.error(`Failed to load ${filename} from all attempted paths`);
  return null;
}

// Load all data
async function loadAllData() {
  console.log('Starting to load data...');
  
  // Show loading indicator
  const resultDiv = document.getElementById('result');
  if (resultDiv) {
    resultDiv.innerHTML = '<p style="color: #58a6ff;">Loading stock data...</p>';
  }
  
  try {
    // Load recommendations
    console.log('Loading recommendations...');
    const recData = await loadCSV('recommendations.csv');
    if (recData && recData.data.length > 0) {
      stockData.recommendations = recData.data.map(row => ({
        ticker: row.Ticker,
        momentum: parseFloat(row.momentum_mean) || 0,
        avgCorr: parseFloat(row.avg_corr_mst) || 0,
        degree: parseInt(row.degree) || 0,
        score: parseFloat(row.score) || 0,
        label: row.label
      }));
      console.log(`Loaded ${stockData.recommendations.length} recommendations`);
    } else {
      console.warn('No recommendations data loaded');
    }

    // Load correlation matrix
    console.log('Loading correlations...');
    const corrData = await loadCSV('corr.csv');
    if (corrData && corrData.data.length > 0) {
      const tickers = corrData.headers.slice(1); // Skip 'Ticker' header
      tickers.forEach(ticker => {
        stockData.correlations[ticker] = {};
      });
      corrData.data.forEach(row => {
        const rowTicker = row.Ticker;
        tickers.forEach(ticker => {
          stockData.correlations[rowTicker][ticker] = parseFloat(row[ticker]) || 0;
        });
      });
      console.log('Correlation matrix loaded');
    } else {
      console.warn('No correlation data loaded');
    }

    // Load MST edges
    console.log('Loading MST edges...');
    const mstData = await loadCSV('mst_edges.csv');
    if (mstData && mstData.data.length > 0) {
      stockData.mstEdges = mstData.data.map(row => ({
        u: row.u,
        v: row.v,
        corr: parseFloat(row.corr) || 0,
        distance: parseFloat(row.distance) || 0
      }));
      console.log(`Loaded ${stockData.mstEdges.length} MST edges`);
    } else {
      console.warn('No MST edges data loaded');
    }

    // Load returns (for market trends)
    console.log('Loading returns...');
    const returnsData = await loadCSV('returns.csv');
    if (returnsData && returnsData.data.length > 0) {
      stockData.returns = returnsData.data;
      console.log(`Loaded ${stockData.returns.length} days of returns data`);
    } else {
      console.warn('No returns data loaded');
    }

    // Clear loading indicator
    if (resultDiv) {
      resultDiv.innerHTML = '';
    }

    // Initialize UI
    console.log('Initializing UI...');
    updateTrendingStocks();
    drawMSTGraph();
    updateMarketTrends();
    drawMarketTrendsChart();
    
    console.log('Data loading complete!');

  } catch (error) {
    console.error('Error loading data:', error);
    if (resultDiv) {
      resultDiv.innerHTML = `<p style="color: #f85149;">Error loading data. Check console for details. Make sure data files are accessible.</p>`;
    }
  }
}

// Update trending stocks section
function updateTrendingStocks() {
  const trendGrid = document.querySelector('.trend-grid');
  if (!trendGrid) {
    console.error('Trend grid not found in DOM');
    return;
  }
  
  if (stockData.recommendations.length === 0) {
    console.warn('No recommendations data available for trending stocks');
    return;
  }
  
  console.log(`Updating trending stocks with ${stockData.recommendations.length} recommendations`);

  // Sort by score (descending) and take top 4
  const sorted = [...stockData.recommendations]
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  trendGrid.innerHTML = '';
  
  sorted.forEach(stock => {
    const card = document.createElement('div');
    const momentumPercent = (stock.momentum * 100).toFixed(2);
    const isGain = stock.momentum >= 0;
    const sign = isGain ? '+' : '';
    
    card.className = `card ${isGain ? 'gain' : 'loss'}`;
    card.innerHTML = `
      <div style="font-weight: bold;">${stock.ticker}</div>
      <div style="font-size: 12px; margin-top: 5px; opacity: 0.8;">${stockData.stockNames[stock.ticker] || stock.ticker}</div>
      <span>${sign}${momentumPercent}%</span>
      <div style="font-size: 11px; margin-top: 3px; color: ${stock.label === 'BUY' ? '#3fb950' : stock.label === 'AVOID' ? '#f85149' : '#8b949e'};">
        ${stock.label}
      </div>
    `;
    
    card.style.cursor = 'pointer';
    card.onclick = () => showStockDetails(stock.ticker);
    trendGrid.appendChild(card);
  });
}

// Search functionality
function searchStock() {
  const input = document.getElementById('searchInput');
  const resultDiv = document.getElementById('result');
  const query = input.value.trim().toUpperCase();

  if (!query) {
    resultDiv.innerHTML = '<p style="color: #8b949e;">Please enter a stock symbol or name</p>';
    return;
  }

  // Find matching stock
  let match = null;
  for (const rec of stockData.recommendations) {
    const ticker = rec.ticker.toUpperCase();
    const name = (stockData.stockNames[rec.ticker] || '').toUpperCase();
    
    if (ticker.includes(query) || name.includes(query)) {
      match = rec;
      break;
    }
  }

  if (match) {
    const momentumPercent = (match.momentum * 100).toFixed(2);
    const sign = match.momentum >= 0 ? '+' : '';
    const labelColor = match.label === 'BUY' ? '#3fb950' : match.label === 'AVOID' ? '#f85149' : '#8b949e';
    
    // Get top correlated stocks
    const correlations = stockData.correlations[match.ticker] || {};
    const topCorrelated = Object.entries(correlations)
      .filter(([ticker, corr]) => ticker !== match.ticker && !isNaN(corr))
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 5)
      .map(([ticker, corr]) => ({
        ticker,
        corr: parseFloat(corr) || 0
      }));
    
    let correlationHTML = '';
    if (topCorrelated.length > 0) {
      correlationHTML = `
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #30363d;">
          <div style="color: #8b949e; font-size: 14px; margin-bottom: 10px;">Top Correlated Stocks:</div>
          <div style="display: flex; flex-wrap: wrap; gap: 10px;">
            ${topCorrelated.map(item => {
              const corrPercent = (item.corr * 100).toFixed(1);
              const corrColor = item.corr > 0.5 ? '#3fb950' : item.corr < -0.5 ? '#f85149' : '#8b949e';
              return `
                <div style="background: #161b22; padding: 8px 12px; border-radius: 6px; border: 1px solid #30363d;">
                  <div style="font-size: 12px; color: #e6edf3;">${item.ticker}</div>
                  <div style="font-size: 11px; color: ${corrColor}; margin-top: 2px;">${corrPercent}%</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
    
    // Calculate mock price (using momentum as a base)
    const basePrice = 100;
    const mockPrice = (basePrice * (1 + match.momentum)).toFixed(2);
    const mockPriceNSE = parseFloat(mockPrice);
    const mockPriceBSE = (mockPriceNSE * 0.999).toFixed(2);
    
    resultDiv.innerHTML = `
      <div style="background: #0d1117; padding: 20px; border-radius: 10px; margin-top: 15px; border: 1px solid #30363d;">
        <!-- Stock Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="color: #58a6ff; margin: 0;">${match.ticker} - ${stockData.stockNames[match.ticker] || match.ticker}</h3>
          <div style="text-align: right;">
            <div style="color: #8b949e; font-size: 12px;">NSE ₹${mockPriceNSE.toFixed(2)}</div>
            <div style="color: #8b949e; font-size: 12px;">BSE ₹${mockPriceBSE}</div>
            <div style="color: ${match.momentum >= 0 ? '#3fb950' : '#f85149'}; font-size: 12px; margin-top: 2px;">
              (${sign}${momentumPercent}%)
            </div>
          </div>
        </div>
        
        <!-- Middle Section: Chart and Trading Interface -->
        <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; margin-bottom: 20px;">
          <!-- Left: Price Chart -->
          <div style="background: #161b22; padding: 15px; border-radius: 10px; border: 1px solid #30363d;">
            <div style="color: #e6edf3; font-size: 16px; font-weight: 500; margin-bottom: 15px;">Price Chart (6 Months)</div>
            <div style="height: 350px; position: relative;">
              <canvas id="stockPriceChart"></canvas>
            </div>
          </div>
          
          <!-- Right: Trading Interface -->
          <div>
            ${createTradingInterface(match.ticker, mockPriceNSE, mockPriceBSE)}
          </div>
        </div>
        
        <!-- Bottom: Analysis Section -->
        <div style="background: #161b22; padding: 20px; border-radius: 10px; border: 1px solid #30363d; margin-top: 20px;">
          <div style="color: #e6edf3; font-size: 18px; font-weight: 500; margin-bottom: 15px;">Analysis</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
            <div>
              <div style="color: #8b949e; font-size: 14px;">Recommendation</div>
              <div style="color: ${labelColor}; font-size: 18px; font-weight: bold; margin-top: 5px;">${match.label}</div>
            </div>
            <div>
              <div style="color: #8b949e; font-size: 14px;">Momentum</div>
              <div style="color: ${match.momentum >= 0 ? '#3fb950' : '#f85149'}; font-size: 18px; font-weight: bold; margin-top: 5px;">
                ${sign}${momentumPercent}%
              </div>
            </div>
            <div>
              <div style="color: #8b949e; font-size: 14px;">Score</div>
              <div style="color: #58a6ff; font-size: 18px; font-weight: bold; margin-top: 5px;">${match.score.toFixed(3)}</div>
            </div>
            <div>
              <div style="color: #8b949e; font-size: 14px;">Avg Correlation</div>
              <div style="color: #58a6ff; font-size: 18px; font-weight: bold; margin-top: 5px;">${match.avgCorr.toFixed(3)}</div>
            </div>
          </div>
          ${correlationHTML}
        </div>
      </div>
    `;
    
    // Initialize trading interface handlers
    initializeTradingInterface();
    
    // Load and draw price chart
    loadStockPriceChart(match.ticker);
  } else {
    resultDiv.innerHTML = `<p style="color: #f85149;">Stock "${query}" not found. Try: AAPL, MSFT, GOOG, AMZN, TCS.NS, etc.</p>`;
  }
}

// Create trading interface HTML
function createTradingInterface(ticker, priceNSE, priceBSE) {
  return `
    <div class="trading-interface" id="tradingInterface">
      <div class="trading-tabs">
        <button class="trading-tab buy active" data-action="buy">BUY</button>
        <button class="trading-tab sell" data-action="sell">SELL</button>
      </div>
      
      <div class="order-type-buttons">
        <button class="order-type-btn active" data-type="delivery">Delivery</button>
        <button class="order-type-btn" data-type="intraday">Intraday</button>
        <button class="order-type-btn" data-type="mtf">MTF</button>
        <span class="trading-settings-icon">⚙️</span>
      </div>
      
      <div class="trading-input-group">
        <div class="trading-input-label">
          <span>Qty</span>
        </div>
        <div class="trading-input-wrapper">
          <select class="trading-select" id="tradingExchange">
            <option value="BSE">BSE</option>
            <option value="NSE">NSE</option>
          </select>
          <input type="number" class="trading-input" id="tradingQuantity" placeholder="Enter quantity" min="1" value="1">
        </div>
      </div>
      
      <div class="trading-input-group">
        <div class="trading-input-label">
          <span>Price</span>
        </div>
        <div class="trading-input-wrapper">
          <select class="trading-select" id="tradingPriceType">
            <option value="limit">Limit</option>
            <option value="market">Market</option>
          </select>
          <input type="number" class="trading-input" id="tradingPrice" placeholder="Enter price" step="0.01" value="${priceNSE.toFixed(2)}">
        </div>
      </div>
      
      <div class="trading-summary">
        <div class="trading-summary-item">
          <div>Balance:</div>
          <div class="trading-summary-value" id="tradingBalance">₹0</div>
        </div>
        <div class="trading-summary-item">
          <div>Approx req.:</div>
          <div class="trading-summary-value" id="tradingRequirement">₹0</div>
        </div>
      </div>
      
      <button class="trading-submit-btn" id="tradingSubmitBtn">Buy</button>
    </div>
  `;
}

// Initialize trading interface event handlers
function initializeTradingInterface() {
  const tradingInterface = document.getElementById('tradingInterface');
  if (!tradingInterface) return;
  
  // Buy/Sell tab switching
  const tabs = tradingInterface.querySelectorAll('.trading-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const action = tab.dataset.action;
      const submitBtn = document.getElementById('tradingSubmitBtn');
      if (submitBtn) {
        submitBtn.textContent = action === 'buy' ? 'Buy' : 'Sell';
        submitBtn.classList.toggle('sell', action === 'sell');
      }
      updateTradingSummary();
    });
  });
  
  // Order type buttons
  const orderTypeBtns = tradingInterface.querySelectorAll('.order-type-btn');
  orderTypeBtns.forEach(btn => {
    if (btn.dataset.type) {
      btn.addEventListener('click', () => {
        orderTypeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    }
  });
  
  // Update summary on input change
  const quantityInput = document.getElementById('tradingQuantity');
  const priceInput = document.getElementById('tradingPrice');
  const exchangeSelect = document.getElementById('tradingExchange');
  
  if (quantityInput) {
    quantityInput.addEventListener('input', updateTradingSummary);
    quantityInput.addEventListener('change', updateTradingSummary);
  }
  if (priceInput) {
    priceInput.addEventListener('input', updateTradingSummary);
    priceInput.addEventListener('change', updateTradingSummary);
  }
  if (exchangeSelect) {
    exchangeSelect.addEventListener('change', () => {
      // Update price based on exchange
      const priceNSE = parseFloat(priceInput.value) || 0;
      if (exchangeSelect.value === 'BSE') {
        priceInput.value = (priceNSE * 0.999).toFixed(2);
      } else {
        priceInput.value = (priceNSE / 0.999).toFixed(2);
      }
      updateTradingSummary();
    });
  }
  
  // Submit button
  const submitBtn = document.getElementById('tradingSubmitBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', handleTradingSubmit);
  }
  
  // Initial summary update
  updateTradingSummary();
}

// Update trading summary (balance and requirement)
function updateTradingSummary() {
  const quantityInput = document.getElementById('tradingQuantity');
  const priceInput = document.getElementById('tradingPrice');
  const balanceEl = document.getElementById('tradingBalance');
  const requirementEl = document.getElementById('tradingRequirement');
  
  if (!quantityInput || !priceInput || !balanceEl || !requirementEl) return;
  
  const quantity = parseFloat(quantityInput.value) || 0;
  const price = parseFloat(priceInput.value) || 0;
  const requirement = quantity * price;
  
  requirementEl.textContent = `₹${requirement.toFixed(2)}`;
  // Balance stays at ₹0 for demo purposes
  balanceEl.textContent = '₹0';
}

// Handle trading submit (Buy/Sell button)
function handleTradingSubmit() {
  const activeTab = document.querySelector('.trading-tab.active');
  const action = activeTab ? activeTab.dataset.action : 'buy';
  const quantityInput = document.getElementById('tradingQuantity');
  const priceInput = document.getElementById('tradingPrice');
  const exchangeSelect = document.getElementById('tradingExchange');
  const orderTypeBtn = document.querySelector('.order-type-btn.active');
  const priceTypeSelect = document.getElementById('tradingPriceType');
  
  if (!quantityInput || !priceInput || !exchangeSelect) return;
  
  const quantity = parseFloat(quantityInput.value) || 0;
  const price = parseFloat(priceInput.value) || 0;
  const exchange = exchangeSelect.value;
  const orderType = orderTypeBtn ? orderTypeBtn.dataset.type : 'delivery';
  const priceType = priceTypeSelect ? priceTypeSelect.value : 'limit';
  
  if (quantity <= 0) {
    alert('Please enter a valid quantity');
    return;
  }
  
  if (price <= 0 && priceType === 'limit') {
    alert('Please enter a valid price');
    return;
  }
  
  // Show confirmation (demo - not actually executing trade)
  const actionText = action === 'buy' ? 'Buy' : 'Sell';
  const orderTypeText = orderType.charAt(0).toUpperCase() + orderType.slice(1);
  const priceTypeText = priceType.charAt(0).toUpperCase() + priceType.slice(1);
  
  alert(`${actionText} order placed!\n\n` +
        `Quantity: ${quantity}\n` +
        `Exchange: ${exchange}\n` +
        `Order Type: ${orderTypeText}\n` +
        `Price Type: ${priceTypeText}\n` +
        `Price: ₹${price.toFixed(2)}\n` +
        `Total: ₹${(quantity * price).toFixed(2)}\n\n` +
        `(This is a demo - no actual trade was executed)`);
}

// Load and draw stock price chart (6 months)
let stockPriceChart = null;

async function loadStockPriceChart(ticker) {
  try {
    // Load stock CSV file directly (different format than other CSVs)
    const response = await fetch(`data/${ticker}.csv`);
    if (!response.ok) {
      console.warn(`Could not load price data for ${ticker}`);
      return;
    }
    
    const text = await response.text();
    const lines = text.trim().split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length < 4) {
      console.warn(`Insufficient data for ${ticker}`);
      return;
    }
    
    // Parse the special format: 
    // Line 1: Price,Close,High,Low,Open,Volume
    // Line 2: Ticker,TCS.NS,TCS.NS,TCS.NS,TCS.NS,TCS.NS
    // Line 3: Date,,,,,
    // Line 4+: Date,Close,High,Low,Open,Volume
    const priceData = [];
    for (let i = 3; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length >= 5) {
        const date = values[0].trim();
        // Based on the header: Price,Close,High,Low,Open,Volume
        // So values are: Date,Close,High,Low,Open,Volume
        const close = parseFloat(values[1]) || 0;  // Close price
        const high = parseFloat(values[2]) || 0;   // High
        const low = parseFloat(values[3]) || 0;    // Low
        const open = parseFloat(values[4]) || 0;   // Open
        
        if (date && close > 0) {
          priceData.push({ date, close, high, low, open });
        }
      }
    }
    
    if (priceData.length === 0) {
      console.warn(`No valid price data for ${ticker}`);
      return;
    }
    
    // Get last 6 months (approximately 130 trading days)
    const last6Months = priceData.slice(-130);
    
    // Draw chart
    drawStockPriceChart(last6Months, ticker);
  } catch (error) {
    console.error(`Error loading price chart for ${ticker}:`, error);
  }
}

function drawStockPriceChart(priceData, ticker) {
  const canvas = document.getElementById('stockPriceChart');
  if (!canvas) return;

  // Destroy existing chart if it exists
  if (stockPriceChart) {
    stockPriceChart.destroy();
  }

  const dates = priceData.map(d => d.date);
  const closes = priceData.map(d => d.close);
  const highs = priceData.map(d => d.high);
  const lows = priceData.map(d => d.low);

  // Determine color based on price trend
  const firstPrice = closes[0];
  const lastPrice = closes[closes.length - 1];
  const isPositive = lastPrice >= firstPrice;
  const chartColor = isPositive ? '#3fb950' : '#f85149';

  const ctx = canvas.getContext('2d');
  stockPriceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'Close Price',
          data: closes,
          borderColor: chartColor,
          backgroundColor: isPositive ? 'rgba(63, 185, 80, 0.1)' : 'rgba(248, 81, 73, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: '#161b22',
          titleColor: '#e6edf3',
          bodyColor: '#e6edf3',
          borderColor: '#30363d',
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              const index = context.dataIndex;
              const data = priceData[index];
              return [
                `Open: ₹${data.open.toFixed(2)}`,
                `High: ₹${data.high.toFixed(2)}`,
                `Low: ₹${data.low.toFixed(2)}`,
                `Close: ₹${data.close.toFixed(2)}`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#8b949e',
            maxRotation: 45,
            minRotation: 45,
            maxTicksLimit: 10
          },
          grid: {
            color: '#21262d'
          }
        },
        y: {
          ticks: {
            color: '#8b949e',
            callback: function(value) {
              return '₹' + value.toFixed(0);
            }
          },
          grid: {
            color: '#21262d'
          }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    }
  });
}

// Show stock details (for clickable cards)
function showStockDetails(ticker) {
  const stock = stockData.recommendations.find(s => s.ticker === ticker);
  if (stock) {
    document.getElementById('searchInput').value = ticker;
    searchStock();
    document.getElementById('searchInput').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// Draw MST Graph with interactivity
function drawMSTGraph() {
  const placeholder = document.querySelector('.graph-placeholder');
  if (!placeholder || stockData.mstEdges.length === 0) return;

  // Create canvas for graph
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 500;
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  canvas.style.maxWidth = '100%';
  canvas.style.border = '1px solid #30363d';
  canvas.style.borderRadius = '10px';
  canvas.style.background = '#0d1117';
  canvas.style.cursor = 'pointer';

  placeholder.innerHTML = '';
  placeholder.appendChild(canvas);
  placeholder.style.padding = '20px';

  graphCanvas = canvas;
  graphCtx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Collect all unique nodes
  const nodes = new Set();
  stockData.mstEdges.forEach(edge => {
    nodes.add(edge.u);
    nodes.add(edge.v);
  });
  graphNodeList = Array.from(nodes);

  // Simple force-directed layout
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.35;

  // Position nodes in a circle
  graphNodeList.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / graphNodeList.length;
    graphPositions[node] = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    };
  });

  // Draw function
  function redrawGraph() {
    graphCtx.clearRect(0, 0, width, height);

    // Draw edges
    stockData.mstEdges.forEach(edge => {
      const u = graphPositions[edge.u];
      const v = graphPositions[edge.v];
      if (u && v) {
        // Highlight edge if connected to hovered node
        const isHighlighted = hoveredNode && (edge.u === hoveredNode || edge.v === hoveredNode);
        const corr = Math.abs(edge.corr);
        const alpha = isHighlighted ? 1.0 : Math.max(0.3, corr);
        const lineWidth = isHighlighted ? 3 : 2;
        
        graphCtx.strokeStyle = `rgba(88, 166, 255, ${alpha})`;
        graphCtx.lineWidth = lineWidth;
        graphCtx.beginPath();
        graphCtx.moveTo(u.x, u.y);
        graphCtx.lineTo(v.x, v.y);
        graphCtx.stroke();

        // Draw edge weight (distance preferred, fallback to correlation) at midpoint
        const weightValue = !isNaN(edge.distance) && edge.distance !== 0 ? edge.distance : edge.corr;
        if (!isNaN(weightValue)) {
          const midX = (u.x + v.x) / 2;
          const midY = (u.y + v.y) / 2;
          const label = weightValue.toFixed(2);
          graphCtx.save();
          graphCtx.font = '10px "Segoe UI", sans-serif';
          const textWidth = graphCtx.measureText(label).width;
          const padding = 4;
          graphCtx.fillStyle = 'rgba(13, 17, 23, 0.85)';
          graphCtx.fillRect(midX - textWidth / 2 - padding, midY - 8, textWidth + padding * 2, 16);
          graphCtx.fillStyle = isHighlighted ? '#58a6ff' : '#8b949e';
          graphCtx.textAlign = 'center';
          graphCtx.textBaseline = 'middle';
          graphCtx.fillText(label, midX, midY);
          graphCtx.restore();
        }
      }
    });

    // Draw nodes
    graphNodeList.forEach(node => {
      const pos = graphPositions[node];
      const stock = stockData.recommendations.find(s => s.ticker === node);
      const label = stock ? stock.label : 'HOLD';
      const isHovered = hoveredNode === node;
      
      // Node color based on recommendation
      let nodeColor = '#8b949e'; // HOLD
      if (label === 'BUY') nodeColor = '#3fb950';
      if (label === 'AVOID') nodeColor = '#f85149';

      // Draw node circle (larger if hovered)
      const nodeRadius = isHovered ? 20 : 15;
      graphCtx.fillStyle = nodeColor;
      graphCtx.beginPath();
      graphCtx.arc(pos.x, pos.y, nodeRadius, 0, 2 * Math.PI);
      graphCtx.fill();
      graphCtx.strokeStyle = isHovered ? '#58a6ff' : '#161b22';
      graphCtx.lineWidth = isHovered ? 3 : 2;
      graphCtx.stroke();

      // Draw node label
      graphCtx.fillStyle = isHovered ? '#58a6ff' : '#e6edf3';
      graphCtx.font = isHovered ? 'bold 13px "Segoe UI", sans-serif' : '12px "Segoe UI", sans-serif';
      graphCtx.textAlign = 'center';
      graphCtx.textBaseline = 'middle';
      
      // Shorten ticker for display
      const displayName = node.replace('.NS', '');
      graphCtx.fillText(displayName, pos.x, pos.y - 30);
      
      // Show additional info on hover
      if (isHovered && stock) {
        const momentumPercent = (stock.momentum * 100).toFixed(2);
        const sign = stock.momentum >= 0 ? '+' : '';
        graphCtx.fillStyle = '#8b949e';
        graphCtx.font = '10px "Segoe UI", sans-serif';
        graphCtx.fillText(`${sign}${momentumPercent}%`, pos.x, pos.y + 35);
        graphCtx.fillText(stock.label, pos.x, pos.y + 48);
      }
    });

    // Add legend
    graphCtx.fillStyle = '#8b949e';
    graphCtx.font = '11px "Segoe UI", sans-serif';
    graphCtx.textAlign = 'left';
    graphCtx.fillText('BUY', 20, height - 50);
    graphCtx.fillText('HOLD', 20, height - 35);
    graphCtx.fillText('AVOID', 20, height - 20);
    
    graphCtx.fillStyle = '#3fb950';
    graphCtx.beginPath();
    graphCtx.arc(10, height - 50, 5, 0, 2 * Math.PI);
    graphCtx.fill();
    
    graphCtx.fillStyle = '#8b949e';
    graphCtx.beginPath();
    graphCtx.arc(10, height - 35, 5, 0, 2 * Math.PI);
    graphCtx.fill();
    
    graphCtx.fillStyle = '#f85149';
    graphCtx.beginPath();
    graphCtx.arc(10, height - 20, 5, 0, 2 * Math.PI);
    graphCtx.fill();
  }

  // Mouse move handler for hover
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    let foundNode = null;
    graphNodeList.forEach(node => {
      const pos = graphPositions[node];
      const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
      if (distance <= 20) {
        foundNode = node;
      }
    });

    if (foundNode !== hoveredNode) {
      hoveredNode = foundNode;
      redrawGraph();
    }
  });

  // Mouse leave handler
  canvas.addEventListener('mouseleave', () => {
    hoveredNode = null;
    redrawGraph();
  });

  // Click handler
  canvas.addEventListener('click', (e) => {
    if (hoveredNode) {
      showStockDetails(hoveredNode);
    }
  });

  // Initial draw
  redrawGraph();
}

// Update market trends
function updateMarketTrends() {
  if (stockData.returns.length === 0) return;

  const trendBox = document.querySelector('.trend-box');
  if (!trendBox) return;

  // Calculate aggregate metrics from returns
  const usStocks = ['AAPL', 'MSFT', 'GOOG', 'AMZN'];
  const indianStocks = ['PAYTM.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'RELIANCE.NS', 'ITC.NS', 'TCS.NS'];

  // Calculate average returns for US and Indian markets
  let usAvgReturn = 0;
  let indianAvgReturn = 0;
  let usCount = 0;
  let indianCount = 0;

  stockData.returns.forEach(day => {
    usStocks.forEach(ticker => {
      const ret = parseFloat(day[ticker]);
      if (!isNaN(ret)) {
        usAvgReturn += ret;
        usCount++;
      }
    });
    indianStocks.forEach(ticker => {
      const ret = parseFloat(day[ticker]);
      if (!isNaN(ret)) {
        indianAvgReturn += ret;
        indianCount++;
      }
    });
  });

  usAvgReturn = usCount > 0 ? (usAvgReturn / usCount) * 100 : 0;
  indianAvgReturn = indianCount > 0 ? (indianAvgReturn / indianCount) * 100 : 0;

  // Calculate portfolio value (assuming starting at 10000)
  let portfolioValue = 10000;
  stockData.returns.forEach(day => {
    let dayReturn = 0;
    let count = 0;
    Object.keys(day).forEach(key => {
      if (key !== 'Date') {
        const ret = parseFloat(day[key]);
        if (!isNaN(ret)) {
          dayReturn += ret;
          count++;
        }
      }
    });
    if (count > 0) {
      portfolioValue *= (1 + dayReturn / count);
    }
  });

  trendBox.innerHTML = `
    <p>US Market Avg: <span>${usAvgReturn >= 0 ? '+' : ''}${usAvgReturn.toFixed(2)}%</span></p>
    <p>Indian Market Avg: <span>${indianAvgReturn >= 0 ? '+' : ''}${indianAvgReturn.toFixed(2)}%</span></p>
    <p>Portfolio Value: <span>$${portfolioValue.toFixed(2)}</span></p>
  `;
}

// Draw market trends chart
function drawMarketTrendsChart() {
  if (stockData.returns.length === 0) return;

  const canvas = document.getElementById('marketChart');
  if (!canvas) return;

  // Prepare data for chart
  const dates = stockData.returns.map(day => day.Date).slice(-30); // Last 30 days
  const usStocks = ['AAPL', 'MSFT', 'GOOG', 'AMZN'];
  const indianStocks = ['PAYTM.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'RELIANCE.NS', 'ITC.NS', 'TCS.NS'];

  // Calculate cumulative returns for US and Indian markets
  const usReturns = [];
  const indianReturns = [];
  const portfolioValues = [];
  
  let usCumulative = 0;
  let indianCumulative = 0;
  let portfolioValue = 10000;

  stockData.returns.slice(-30).forEach(day => {
    // US market average return
    let usDayReturn = 0;
    let usCount = 0;
    usStocks.forEach(ticker => {
      const ret = parseFloat(day[ticker]);
      if (!isNaN(ret)) {
        usDayReturn += ret;
        usCount++;
      }
    });
    if (usCount > 0) {
      usCumulative += usDayReturn / usCount;
    }
    usReturns.push(usCumulative * 100);

    // Indian market average return
    let indianDayReturn = 0;
    let indianCount = 0;
    indianStocks.forEach(ticker => {
      const ret = parseFloat(day[ticker]);
      if (!isNaN(ret)) {
        indianDayReturn += ret;
        indianCount++;
      }
    });
    if (indianCount > 0) {
      indianCumulative += indianDayReturn / indianCount;
    }
    indianReturns.push(indianCumulative * 100);

    // Portfolio value
    let dayReturn = 0;
    let count = 0;
    Object.keys(day).forEach(key => {
      if (key !== 'Date') {
        const ret = parseFloat(day[key]);
        if (!isNaN(ret)) {
          dayReturn += ret;
          count++;
        }
      }
    });
    if (count > 0) {
      portfolioValue *= (1 + dayReturn / count);
    }
    portfolioValues.push(portfolioValue);
  });

  // Destroy existing chart if it exists
  if (marketChart) {
    marketChart.destroy();
  }

  // Create new chart
  const ctx = canvas.getContext('2d');
  marketChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'US Market (Cumulative Return %)',
          data: usReturns,
          borderColor: '#58a6ff',
          backgroundColor: 'rgba(88, 166, 255, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Indian Market (Cumulative Return %)',
          data: indianReturns,
          borderColor: '#3fb950',
          backgroundColor: 'rgba(63, 185, 80, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Portfolio Value ($)',
          data: portfolioValues,
          borderColor: '#f85149',
          backgroundColor: 'rgba(248, 81, 73, 0.1)',
          tension: 0.4,
          yAxisID: 'y1',
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#e6edf3'
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: '#161b22',
          titleColor: '#e6edf3',
          bodyColor: '#e6edf3',
          borderColor: '#30363d',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#8b949e',
            maxRotation: 45,
            minRotation: 45
          },
          grid: {
            color: '#21262d'
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          ticks: {
            color: '#8b949e'
          },
          grid: {
            color: '#21262d'
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          ticks: {
            color: '#8b949e'
          },
          grid: {
            drawOnChartArea: false
          }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    }
  });
}

// Allow Enter key to trigger search
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded - Initializing StockGraphix...');
  
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        searchStock();
      }
    });
  } else {
    console.error('Search input not found!');
  }

  // Load data when page loads
  console.log('Starting data load...');
  loadAllData();
});

