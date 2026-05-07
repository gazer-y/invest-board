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

// ── CBOE Put/Call：解析官网 HTML ────────────────────────────
async function fetchPutCall() {
  const resp = await fetch('https://www.cboe.com/us/options/market_statistics/daily/', {
    headers: { ...H, 'Referer': 'https://www.cboe.com' }
  });
  if (!resp.ok) throw new Error(`CBOE HTTP ${resp.status}`);
  const html = await resp.text();
  if (html.includes('Incapsula') || html.includes('Access Denied')) throw new Error('CBOE被拦截');

  // 方法1：找 Total 附近的比率值
  const totalMatch = html.match(/[Tt]otal[\s\S]{0,300}?(\d\.\d{2})/);
  if (totalMatch) {
    const v = parseFloat(totalMatch[1]);
    if (v >= 0.3 && v <= 2.5) return v.toFixed(2);
  }
  // 方法2：扫描所有合理候选值
  const allNums = [...html.matchAll(/\b(0\.[5-9]\d|1\.[0-4]\d)\b/g)]
    .map(x => parseFloat(x[1]))
    .filter(v => v >= 0.5 && v <= 1.5);
  if (allNums.length > 0) return allNums[0].toFixed(2);

  throw new Error('CBOE 解析失败');
}

// ── 散户情绪：ApeWisdom（WSB + Reddit，无需 Key）─────────────
async function fetchAAII() {
  const resp = await fetch('https://apewisdom.io/api/v1.0/filter/all-stocks/page/1', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!resp.ok) throw new Error(`ApeWisdom HTTP ${resp.status}`);
  const data = await resp.json();
  const results = data?.results;
  if (!Array.isArray(results) || results.length === 0) throw new Error('ApeWisdom 无数据');

  let target = results.find(r => r.ticker === 'SPY') || results.find(r => r.ticker === 'QQQ');

  if (!target) {
    const top10 = results.slice(0, 10);
    const trend = top10.reduce((s, r) => s + ((r.mentions_24h_ago || 0) > 0 ? (r.mentions - r.mentions_24h_ago) / r.mentions_24h_ago : 0), 0) / top10.length;
    const bullPct = Math.min(Math.max(50 + trend * 10, 20), 80);
    const bearPct = 100 - bullPct;
    return { bullish: bullPct.toFixed(1), bearish: bearPct.toFixed(1), spread: (bullPct - bearPct).toFixed(1), note: 'WSB市场热度' };
  }

  const now = target.mentions || 0;
  const ago = target.mentions_24h_ago || now;
  const change = ago > 0 ? (now - ago) / ago : 0;
  const upvoteRatio = target.upvotes && now > 0 ? target.upvotes / now : 1;
  const rawBull = 50 + change * 20 + (upvoteRatio - 1) * 5;
  const bullPct = Math.min(Math.max(rawBull, 15), 85);
  const bearPct = 100 - bullPct;
  return {
    bullish: bullPct.toFixed(1),
    bearish: bearPct.toFixed(1),
    spread: (bullPct - bearPct).toFixed(1),
    note: `WSB/${target.ticker}`
  };
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