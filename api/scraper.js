const H = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const FMP_KEY = '85I8IGs1tQIbcVJiNYjzoqPBbi1COoyM';
const FRED_KEY = '23835d5e437aaad477975e3d90a48655';

// ── NAAIM ──────────────────────────────────────────────────
async function fetchNAAIM() {
  const resp = await fetch('https://www.naaim.org/programs/naaim-exposure-index/', { headers: H });
  if (!resp.ok) throw new Error(`NAAIM HTTP ${resp.status}`);
  const html = await resp.text();

  // 方案A: chartData JSON
  const jsonMatch = html.match(/var\s+chartData\s*=\s*(\[[\s\S]*?\]);/);
  if (jsonMatch) {
    try {
      const arr = JSON.parse(jsonMatch[1]);
      const last = arr[arr.length - 1];
      const val = Array.isArray(last) ? last[1] : (last.value ?? last.exposure);
      if (val != null) return parseFloat(val).toFixed(2);
    } catch {}
  }

  // 方案B: HTML 表格第一行数据
  const trMatch = html.match(/<tr[^>]*>\s*<td[^>]*>[\d\/\-]+<\/td>\s*<td[^>]*>([\d.]+)<\/td>/i);
  if (trMatch) return parseFloat(trMatch[1]).toFixed(2);

  throw new Error('NAAIM结构变更，无法解析');
}

// ── AAII ───────────────────────────────────────────────────
async function fetchAAII() {
  // 方案A: CSV 端点
  try {
    const r = await fetch('https://www.aaii.com/sentimentsurvey/sent_results', {
      headers: { ...H, 'Referer': 'https://www.aaii.com/sentimentsurvey' }
    });
    if (r.ok) {
      const text = await r.text();
      if (!text.includes('Incapsula') && !text.includes('NOINDEX') && text.includes(',')) {
        const lines = text.trim().split('\n');
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',');
          if (cols.length < 4) continue;
          let bull = parseFloat(cols[1]);
          let bear = parseFloat(cols[3]);
          if (bull < 1) { bull *= 100; bear *= 100; }
          if (!isNaN(bull) && bull > 0 && !isNaN(bear) && bear > 0) {
            const spread = bull - bear;
            return {
              bullish: bull.toFixed(1),
              bearish: bear.toFixed(1),
              spread: (spread > 0 ? '+' : '') + spread.toFixed(1)
            };
          }
        }
      }
    }
  } catch {}

  // 方案B: JSON API
  try {
    const r = await fetch('https://www.aaii.com/sentiment/data.json', {
      headers: { ...H, 'Referer': 'https://www.aaii.com/sentimentsurvey', 'Accept': 'application/json' }
    });
    if (r.ok) {
      const text = await r.text();
      if (!text.includes('Incapsula')) {
        const j = JSON.parse(text);
        const src = Array.isArray(j) ? j[0] : j;
        let bull = parseFloat(src?.bullish ?? src?.Bullish);
        let bear = parseFloat(src?.bearish ?? src?.Bearish);
        if (bull < 1) { bull *= 100; bear *= 100; }
        if (!isNaN(bull) && !isNaN(bear) && bull > 0) {
          const spread = bull - bear;
          return {
            bullish: bull.toFixed(1),
            bearish: bear.toFixed(1),
            spread: (spread > 0 ? '+' : '') + spread.toFixed(1)
          };
        }
      }
    }
  } catch {}

  throw new Error('AAII被Incapsula拦截，服务端无法访问');
}

// ── CBOE Put/Call ──────────────────────────────────────────
async function fetchPutCall() {
  // CBOE 是 Next.js 客户端渲染，HTML 里没有数据
  // 改用 FRED VXVCLS 近似，或 CBOE 的下载文件
  try {
    // 尝试 CBOE 历史数据文件（CSV格式）
    const today = new Date();
    // 往前找最近交易日
    for (let i = 0; i <= 3; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const day = d.getDay();
      if (day === 0 || day === 6) continue; // 跳过周末
      const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
      const url = `https://cdn.cboe.com/data/us/options/market_statistics/daily/${dateStr}_options_statistics.csv`;
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.cboe.com' } });
      if (!r.ok) continue;
      const text = await r.text();
      if (text.includes('Incapsula')) continue;
      // 找 TOTAL 行
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.toUpperCase().includes('TOTAL')) {
          const cols = line.split(',');
          // put/call ratio 一般在第4或5列
          for (const col of cols) {
            const v = parseFloat(col.trim());
            if (!isNaN(v) && v >= 0.3 && v <= 2.0) return v.toFixed(2);
          }
        }
      }
    }
  } catch {}

  // 备用：FRED VXVCLS (VIX close，不是put/call，但作为volatility指标)
  // 直接返回错误，前端显示"暂无"
  throw new Error('CBOE为Next.js客户端渲染，服务端无法获取实时数据');
}

// ── TTM PE（FMP个股加权近似）──────────────────────────────
async function fetchTtmPE() {
  // FMP 免费版无法直接获取 SP500 整体 PE
  // 用前10大权重股加权平均近似
  const symbols = 'AAPL,MSFT,NVDA,AMZN,META,GOOGL,TSLA,BRK.B,JPM,UNH';
  const r = await fetch(
    `https://financialmodelingprep.com/stable/ratios?symbol=${symbols}&limit=1&apikey=${FMP_KEY}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  );
  if (!r.ok) throw new Error(`FMP ratios HTTP ${r.status}`);
  const data = await r.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('FMP ratios 无数据');
  const pes = data
    .map(d => d.priceToEarningsRatio)
    .filter(v => v && v > 0 && v < 500);
  if (pes.length === 0) throw new Error('无有效PE数据');
  const avg = pes.reduce((a, b) => a + b, 0) / pes.length;
  return avg.toFixed(2);
}

// ── 股息率（FMP SPY）──────────────────────────────────────
async function fetchDivYield() {
  const r = await fetch(
    `https://financialmodelingprep.com/stable/dividends?symbol=SPY&apikey=${FMP_KEY}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  );
  if (!r.ok) throw new Error(`FMP dividends HTTP ${r.status}`);
  const data = await r.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('FMP dividends 无数据');
  // 取最近4条季度 yield 加总 = 年化 yield
  const recentYields = data.slice(0, 4).map(d => d.yield ?? 0);
  const annualYield = recentYields.reduce((a, b) => a + b, 0);
  return annualYield.toFixed(2);
}

// ── 主入口 ──────────────────────────────────────────────────
export default async function handler(req, res) {
  const [nr, ar, pcR, tpeR, divR] = await Promise.allSettled([
    fetchNAAIM(),
    fetchAAII(),
    fetchPutCall(),
    fetchTtmPE(),
    fetchDivYield(),
  ]);

  const ok  = r => r.status === 'fulfilled' ? r.value : null;
  const err = r => r.status === 'rejected'  ? r.reason?.message : undefined;

  res.status(200).json({
    naaim:     ok(nr),   naaimError:    err(nr),
    aaii:      ok(ar),   aaiiError:     err(ar),
    putCall:   ok(pcR),  putCallError:  err(pcR),
    ttmPe:     ok(tpeR), ttmPeError:    err(tpeR),
    divYield:  ok(divR), divYieldError: err(divR),
    timestamp: new Date().toISOString()
  });
}