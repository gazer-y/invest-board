const H = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};
const FMP_KEY = '85I8IGs1tQIbcVJiNYjzoqPBbi1COoyM';

// ── NAAIM 机构仓位 ──────────────────────────────────────────
async function fetchNAAIM() {
  const resp = await fetch('https://www.naaim.org/programs/naaim-exposure-index/', { headers: H });
  if (!resp.ok) throw new Error(`NAAIM HTTP ${resp.status}`);
  const html = await resp.text();
  const jsonMatch = html.match(/var\s+chartData\s*=\s*(\[[\s\S]*?\]);/);
  if (jsonMatch) {
    try {
      const arr = JSON.parse(jsonMatch[1]);
      const last = arr[arr.length - 1];
      const val = Array.isArray(last) ? last[1] : (last.value ?? last.exposure);
      if (val != null) return parseFloat(val).toFixed(2);
    } catch {}
  }
  const trMatch = html.match(/<tr[^>]*>[\s\S]*?<td[^>]*>[\d.]+<\/td>[\s\S]*?<td[^>]*>([\d.]+)<\/td>/);
  if (trMatch) return parseFloat(trMatch[1]).toFixed(2);
  throw new Error('NAAIM 解析失败');
}

// ── AAII 散户情绪 ──────────────────────────────────────────
async function fetchAAII() {
  const resp = await fetch('https://www.aaii.com/sentimentsurvey/sent_results', {
    headers: { ...H, 'Referer': 'https://www.aaii.com/sentimentsurvey' }
  });
  if (!resp.ok) throw new Error(`AAII HTTP ${resp.status}`);
  const text = await resp.text();
  if (text.includes('Incapsula') || text.includes('NOINDEX')) throw new Error('AAII被拦截');
  if (!text.includes(',')) throw new Error('AAII响应不含CSV');
  const lines = text.trim().split('\n');
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 4) continue;
    let bull = parseFloat(cols[1]);
    let bear = parseFloat(cols[3]);
    if (bull < 1) { bull *= 100; bear *= 100; }
    if (!isNaN(bull) && bull > 0 && !isNaN(bear) && bear > 0) {
      const spread = bull - bear;
      return { bullish: bull.toFixed(1), bearish: bear.toFixed(1), spread: spread.toFixed(1) };
    }
  }
  throw new Error('AAII CSV解析失败');
}

// ── CBOE Put/Call ──────────────────────────────────────────
async function fetchPutCall() {
  const today = new Date();
  for (let i = 0; i <= 4; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if ([0, 6].includes(d.getDay())) continue;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;
    try {
      const url = `https://cdn.cboe.com/data/us/options/market_statistics/daily/${dateStr}_options_statistics.csv`;
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.cboe.com' } });
      if (!r.ok) continue;
      const text = await r.text();
      if (text.includes('Incapsula') || !text.includes(',')) continue;
      for (const line of text.split('\n')) {
        if (line.toUpperCase().includes('TOTAL')) {
          for (const col of line.split(',')) {
            const v = parseFloat(col.trim());
            if (!isNaN(v) && v >= 0.3 && v <= 2.5) return v.toFixed(2);
          }
        }
      }
    } catch {}
  }
  throw new Error('CBOE数据获取失败');
}

// ── TTM PE（前5大权重股均值）─────────────────────────────
async function fetchTtmPE() {
  const symbols = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META'];
  const results = await Promise.allSettled(
    symbols.map(sym =>
      fetch(`https://financialmodelingprep.com/stable/ratios?symbol=${sym}&limit=1&apikey=${FMP_KEY}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }).then(r => r.json())
    )
  );
  const pes = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value) && r.value[0]) {
      const pe = r.value[0].priceToEarningsRatio;
      if (pe && pe > 0 && pe < 500) pes.push(pe);
    }
  }
  if (pes.length === 0) throw new Error('TTM PE 所有数据源失败');
  return (pes.reduce((a, b) => a + b, 0) / pes.length).toFixed(2);
}

// ── SPY 股息率 ────────────────────────────────────────────
async function fetchDivYield() {
  const [divResp, quoteResp] = await Promise.all([
    fetch(`https://financialmodelingprep.com/stable/dividends?symbol=SPY&apikey=${FMP_KEY}`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
    fetch(`https://financialmodelingprep.com/stable/quote?symbol=SPY&apikey=${FMP_KEY}`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  ]);
  if (!divResp.ok) throw new Error(`FMP dividends HTTP ${divResp.status}`);
  if (!quoteResp.ok) throw new Error(`FMP quote HTTP ${quoteResp.status}`);
  const divData = await divResp.json();
  const quoteData = await quoteResp.json();
  if (!Array.isArray(divData) || divData.length === 0) throw new Error('FMP dividends 无数据');
  if (!Array.isArray(quoteData) || quoteData.length === 0) throw new Error('FMP quote 无数据');
  const annualDiv = divData.slice(0, 4).reduce((sum, d) => sum + (d.dividend ?? 0), 0);
  const price = quoteData[0].price;
  if (!price || price <= 0) throw new Error('SPY 价格异常');
  return (annualDiv / price * 100).toFixed(2);
}

// ── Handler ───────────────────────────────────────────────
export default async function handler(req, res) {
  const [naaimR, aaiiR, pcR, tpeR, divR] = await Promise.allSettled([
    fetchNAAIM(), fetchAAII(), fetchPutCall(), fetchTtmPE(), fetchDivYield()
  ]);
  const ok  = r => r.status === 'fulfilled' ? r.value : null;
  const err = r => r.status === 'rejected'  ? r.reason?.message : undefined;

  res.status(200).json({
    naaim:      ok(naaimR),  naaimError:    err(naaimR),
    aaii:       ok(aaiiR),   aaiiError:     err(aaiiR),
    putCall:    ok(pcR),     putCallError:  err(pcR),
    ttmPe:      ok(tpeR),    ttmPeError:    err(tpeR),
    divYield:   ok(divR),    divYieldError: err(divR),
    timestamp:  new Date().toISOString()
  });
}