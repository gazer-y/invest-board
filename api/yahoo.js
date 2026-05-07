export default async function handler(req, res) {
  async function fetchYahoo(symbol) {
    const cookieResp = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
    });
    const cookies = cookieResp.headers.get('set-cookie') || '';
    const crumbResp = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': cookies }
    });
    const crumb = await crumbResp.text();
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d&crumb=${encodeURIComponent(crumb)}`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': cookies, 'Accept': 'application/json' } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) throw new Error('无数据');
    return meta.regularMarketPrice;
  }

  async function fetchStooq(symbol) {
    const url = `https://stooq.com/q/l/?s=${symbol}&f=sd2t2ohlcv&h&e=json`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok) throw new Error(`Stooq HTTP ${resp.status}`);
    const data = await resp.json();
    const close = data?.symbols?.[0]?.close;
    if (!close) throw new Error('无数据');
    return parseFloat(close);
  }

  async function getPrice(yahooSym, stooqSym) {
    try { return await fetchYahoo(yahooSym); }
    catch { return await fetchStooq(stooqSym); }
  }

  try {
    const [vix, spx, ndx, dji, dxy] = await Promise.all([
      getPrice('^VIX',     '^vix'),
      getPrice('^GSPC',    '^spx'),
      getPrice('^IXIC',    '^nasdaq'),
      getPrice('^DJI',     '^dji'),
      getPrice('DX-Y.NYB', 'dxy')
    ]);
    res.status(200).json({
      vix: parseFloat(vix).toFixed(2),
      spx: parseFloat(spx).toFixed(2),
      ndx: parseFloat(ndx).toFixed(2),
      dji: parseFloat(dji).toFixed(2),
      dxy: parseFloat(dxy).toFixed(2),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: '市场数据获取失败', detail: error.message });
  }
}