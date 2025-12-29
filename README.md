## StockGraphix

StockGraphix is a lightweight analytics stack that ingests cross-market equity data (US mega-cap tech and Indian blue chips), derives diversification-aware trading signals, and surfaces the insights through an interactive web dashboard.

---

### Features
- **ETL + Analytics Pipeline (`src/preprocess.cpp`)**
  - Cleans Yahoo Finance OHLCV exports, aligns trading days, and writes aligned return series.
  - Computes a Pearson correlation matrix, edge list with graph distances, and a Minimum Spanning Tree (MST) via Kruskal’s algorithm.
  - Generates per-ticker features (momentum, MST degree, neighbor correlation, composite score) and BUY/HOLD/AVOID labels.
- **Interactive Dashboard (`website_main/`)**
  - Search-driven stock drill-down with recommendations, mock pricing, correlation chips, and a demo trading ticket.
  - Chart.js visualizations for 6‑month price history and 30‑day cumulative US vs India market performance.
  - Custom canvas renderer for the MST correlation network with hover-to-highlight behavior and quick access to stock details.
- **Data Transparency**
  - All engineered CSVs (`returns.csv`, `corr.csv`, `edges.csv`, `mst_edges.csv`, `recommendations.csv`) reside in `website_main/data/` for auditability.

---

### Repository Layout

```
StockGraphix-1/
├── README.md
├── report.txt                # Analyst-oriented project report
├── src/
│   └── preprocess.cpp        # End-to-end ETL + analytics pipeline
└── website_main/
    ├── index.html            # Dashboard markup
    ├── style.css             # GitHub-dark inspired theme
    ├── script.js             # Data loading, charts, MST rendering, trading UI
    └── data/                 # Raw and engineered CSV assets
```

---

### Prerequisites
- C++17-compatible compiler (tested with `g++` >= 10).
- Node.js is **not** required; the dashboard is static HTML/CSS/JS.
- Python is optional if you plan to extend analytics, but unused in the current stack.

---

### Rebuilding the Analytics Outputs
The generated CSVs inside `website_main/data/` were produced by `src/preprocess.cpp`. To refresh them with newer price data:

1. **Place raw CSVs**  
   Drop Yahoo Finance exports named `<Ticker>.csv` (Adj Close required) into `website_main/data/`. Expected tickers:
   ```
   AAPL MSFT GOOG AMZN PAYTM.NS HDFCBANK.NS ICICIBANK.NS RELIANCE.NS ITC.NS TCS.NS
   ```

2. **Compile the pipeline**
   ```bash
   cd /Users/deepak./Desktop/Projects/StockGraphix-1/src
   g++ -std=c++17 -O2 preprocess.cpp -o preprocess
   ```

3. **Run and generate artifacts**
   ```bash
   ./preprocess
   ```
   Outputs (written to `website_main/data/`):
   - `returns.csv`
   - `corr.csv`
   - `edges.csv`
   - `mst_edges.csv`
   - `recommendations.csv`

> ℹ️ The program logs parsing stats and warns about malformed rows (max 10 warnings per file).

---

### Running the Dashboard Locally
`website_main/` is a static bundle—you can serve it with any HTTP server. Two quick options:

**Option A: Python http.server**
```bash
cd /Users/deepak./Desktop/Projects/StockGraphix-1/website_main
python3 -m http.server 8000
```
Visit `http://localhost:8000`.

**Option B: VS Code / Cursor “Open with Live Server”**  
Open the folder in your editor and launch Live Server to get auto-reloads while editing.

> ⚠️ Opening `index.html` directly from disk (`file://`) may violate browser CORS rules when `script.js` fetches CSVs. Always use an HTTP server.

---

### Data Flow Summary
1. **Raw OHLCV** → `preprocess.cpp`  
2. **Derived metrics** → CSV artifacts in `website_main/data/`  
3. **Dashboard runtime** (`script.js`) fetches the CSVs, hydrates UI sections:
   - Trending cards = top `score` recommendations.
   - Search = ticker lookup with correlation callouts and mock trading interface.
   - MST canvas = visualizes `mst_edges.csv`.
   - Market trends = `returns.csv` to compute cumulative US/India curves and portfolio value trajectory.

---

### Extending the Project
- Increase ticker coverage (sector ETFs, indices) and re-run the pipeline.
- Add volatility-adjusted momentum or drawdown metrics before scoring.
- Convert the CSV-driven frontend to a lightweight API + client for better security and caching.
- Enhance MST interactions (node pinning, tooltips with neighbor lists, filtering by sector).

---

### Reference Report
See `report.txt` for a narrative summary: objectives, methodology, analytical highlights, and recommended next steps.

