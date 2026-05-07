const H = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache'
};

async function fetchMultpl(path) {
  const resp = await fetch(`https://www.multpl.com/${path}`, { headers: H });
  if (!resp.ok) throw new Error(`multpl ${path} HTTP ${resp.status}`);
  const html = await resp.text();
  const m1 = html.match(/id=["']current-value["'][^>]*>\s*([\d.]+)/);
  if (m1) return m1[1];
  const m2 = html.match(/id=["']bignumber["'][^>]*>\s*([\d.]+)/);
  if (m2) return m2[1];
  const m3 = html.match(/class=["'][^"']*current[^"']*["'][^>]*>\s*([\d.]+)/);
  if (m3) return m3[1];
  throw new Error(`${path} 页面结构变更`);
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
  const resp = await fetch('https://www.aaii.com/sentimentsurvey/sent_results', {
    headers: { ...H, 'Referer': 'https://www.aaii.com/sentimentsurvey' }
  });
  if (resp.ok) {
    const text = await resp.text();
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
  const resp2 = await fetch('https://research.investors.com/psychological-market-indicators/chart?type=aaii', { headers: H });
  if (resp2.ok) {
    const html2 = await resp2.text();
    const bullM = html2.match(/Bullish[^%]*?([\d.]+)%/i);
    const bearM = html2.match(/Bearish[^%]*?([\d.]+)%/i);
    if (bullM && bearM) {
      const bull = parseFloat(bullM[1]), bear = parseFloat(bearM[1]);
      const spread = bull - bear;
      return { bullish: bull.toFixed(1), bearish: bear.toFixed(1), spread: spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1) };
    }
  }
  throw new Error('AAII所有方案失败');
}

async function fetchPutCall() {
  const resp = await fetch('https://www.cboe.com/us/options/market_statistics/daily/', {
    headers: { ...H, 'Referer': 'https://www.cboe.com' }
  });
  if (!resp.ok) throw new Error(`CBOE HTTP ${resp.status}`);
  const html = await resp.text();
  const m = html.match(/Total[\s\S]*?([\d]+,[\d]+)\s+([\d]+,[\d]+)\s+([\d.]+)/i);
  if (m) return parseFloat(m[3]).toFixed(2);
  const m2 = html.match(/Put\/Call[^<]*<\/[^>]+>[^<]*<[^>]+>([\d.]+)/i);
  if (m2) return parseFloat(m2[1]).toFixed(2);
  throw new Error('CBOE结构变更');
}

export default async function handler(req, res) {
  const [nr, ar, tpeR, divR, pcR] = await Promise.allSettled([
    fetchNAAIM(),
    fetchAAII(),
    fetchMultpl('s-p-500-pe-ratio'),
    fetchMultpl('s-p-500-dividend-yield'),
    fetchPutCall()
  ]);

  const ok = (r) => r.status === 'fulfilled' ? r.value : null;
  const err = (r) => r.status === 'rejected' ? r.reason?.message : undefined;

  res.status(200).json({
    naaim:         ok(nr),   naaimError:    err(nr),
    aaii:          ok(ar),   aaiiError:     err(ar),
    ttmPe:         ok(tpeR) ? parseFloat(ok(tpeR)).toFixed(2) : null, ttmPeError:   err(tpeR),
    divYield:      ok(divR) ? parseFloat(ok(divR)).toFixed(2) : null, divYieldError: err(divR),
    putCall:       ok(pcR),  putCallError:  err(pcR),
    timestamp: new Date().toISOString()
  });
}