const H = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache'
};

function parseMultpl(html, patterns) {
  // 方案A: id="current-value"
  const m1 = html.match(/id=["']current-value["'][^>]*>([\s\S]*?)<\/span>/i);
  if (m1) {
    const inner = m1[1].replace(/<[^>]+>/g, '').trim();
    const num = inner.match(/([\d.]+)/);
    if (num) return num[1];
  }
  // 方案B: id="bignumber"
  const m2 = html.match(/id=["']bignumber["'][^>]*>([\s\S]*?)<\/div>/i);
  if (m2) {
    const inner = m2[1].replace(/<[^>]+>/g, '').trim();
    const num = inner.match(/([\d.]+)/);
    if (num) return num[1];
  }
  // 方案C: 调用方传入的特定 patterns
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m) return m[1];
  }
  return null;
}

async function fetchMultplPE() {
  const resp = await fetch('https://www.multpl.com/s-p-500-pe-ratio', { headers: H });
  if (!resp.ok) throw new Error(`PE HTTP ${resp.status}`);
  const html = await resp.text();
  const val = parseMultpl(html, [
    /Current\s+S&P\s+500\s+PE\s+Ratio[^:]*:\s*\*?\*?([\d.]+)/i,
    /PE\s+Ratio[^:]*:\s*\*?\*?([\d.]+)/i,
    /\b([\d]{2,3}\.[\d]{2})\b/
  ]);
  if (!val) throw new Error('PE页面结构变更');
  return parseFloat(val).toFixed(2);
}

async function fetchMultplDiv() {
  const resp = await fetch('https://www.multpl.com/s-p-500-dividend-yield', { headers: H });
  if (!resp.ok) throw new Error(`Div HTTP ${resp.status}`);
  const html = await resp.text();
  const val = parseMultpl(html, [
    /Current\s+Yield[^:]*:\s*\*?\*?([\d.]+)%/i,
    /Dividend\s+Yield[^:]*:\s*\*?\*?([\d.]+)%/i,
    /\b([1-9]\.\d{2})%/
  ]);
  if (!val) throw new Error('股息率页面结构变更');
  return parseFloat(val).toFixed(2);
}

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
  const trMatch = html.match(/<tr[^>]*>\s*<td[^>]*>[\d\/\-]+<\/td>\s*<td[^>]*>([\d.]+)<\/td>/i);
  if (trMatch) return parseFloat(trMatch[1]).toFixed(2);
  const idx = html.search(/NAAIM Exposure Index/i);
  if (idx !== -1) {
    const nearby = html.substring(idx, idx + 500);
    const m = nearby.match(/>\s*([\d]{1,3}\.[\d]{1,2})\s*</);
    if (m) return parseFloat(m[1]).toFixed(2);
  }
  throw new Error('NAAIM结构变更');
}

async function fetchAAII() {
  // 方案A: JSON API（最稳）
  try {
    const r1 = await fetch('https://www.aaii.com/sentiment/data.json', {
      headers: { ...H, 'Referer': 'https://www.aaii.com/sentimentsurvey', 'Accept': 'application/json' }
    });
    if (r1.ok) {
      const j = await r1.json();
      const bull = parseFloat(j.bullish ?? j.Bullish ?? (Array.isArray(j) ? j[0]?.bullish : null));
      const bear = parseFloat(j.bearish ?? j.Bearish ?? (Array.isArray(j) ? j[0]?.bearish : null));
      if (!isNaN(bull) && !isNaN(bear)) {
        const spread = bull - bear;
        return { bullish: bull.toFixed(1), bearish: bear.toFixed(1), spread: spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1) };
      }
    }
  } catch {}

  // 方案B: CSV
  try {
    const r2 = await fetch('https://www.aaii.com/sentimentsurvey/sent_results', {
      headers: { ...H, 'Referer': 'https://www.aaii.com/sentimentsurvey' }
    });
    if (r2.ok) {
      const text = await r2.text();
      const lines = text.trim().split('\n');
      if (lines.length > 1) {
        const cols = lines[1].split(',');
        const bull = parseFloat(cols[1]);
        const bear = parseFloat(cols[3]);
        if (!isNaN(bull) && !isNaN(bear)) {
          const spread = bull - bear;
          return { bullish: bull.toFixed(1), bearish: bear.toFixed(1), spread: spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1) };
        }
      }
    }
  } catch {}

  // 方案C: 页面抓取
  try {
    const r3 = await fetch('https://www.aaii.com/sentimentsurvey', {
      headers: { ...H, 'Referer': 'https://www.aaii.com' }
    });
    if (r3.ok) {
      const html = await r3.text();
      const bullM = html.match(/Bullish[^<]{0,30}?([\d]{1,2}\.[\d])\s*%/i);
      const bearM = html.match(/Bearish[^<]{0,30}?([\d]{1,2}\.[\d])\s*%/i);
      if (bullM && bearM) {
        const bull = parseFloat(bullM[1]), bear = parseFloat(bearM[1]);
        const spread = bull - bear;
        return { bullish: bull.toFixed(1), bearish: bear.toFixed(1), spread: spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1) };
      }
    }
  } catch {}

  throw new Error('AAII所有方案均失败');
}

async function fetchPutCall() {
  const resp = await fetch('https://www.cboe.com/us/options/market_statistics/daily/', {
    headers: { ...H, 'Referer': 'https://www.cboe.com' }
  });
  if (!resp.ok) throw new Error(`CBOE HTTP ${resp.status}`);
  const html = await resp.text();
  const m = html.match(/Total[\s\S]*?([\d,]+)\s+([\d,]+)\s+([\d.]+)/i);
  if (m) return parseFloat(m[3]).toFixed(2);
  const m2 = html.match(/Put\/Call[^<]*<\/[^>]+>[^<]*<[^>]+>([\d.]+)/i);
  if (m2) return parseFloat(m2[1]).toFixed(2);
  throw new Error('CBOE结构变更');
}

export default async function handler(req, res) {
  const [nr, ar, tpeR, divR, pcR] = await Promise.allSettled([
    fetchNAAIM(),
    fetchAAII(),
    fetchMultplPE(),
    fetchMultplDiv(),
    fetchPutCall()
  ]);

  const ok  = r => r.status === 'fulfilled' ? r.value : null;
  const err = r => r.status === 'rejected'  ? r.reason?.message : undefined;

  res.status(200).json({
    naaim:     ok(nr),  naaimError:    err(nr),
    aaii:      ok(ar),  aaiiError:     err(ar),
    ttmPe:     ok(tpeR), ttmPeError:  err(tpeR),
    divYield:  ok(divR), divYieldError: err(divR),
    putCall:   ok(pcR), putCallError:  err(pcR),
    timestamp: new Date().toISOString()
  });
}