const H = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

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
  throw new Error('NAAIM结构变更');
}

async function fetchAAII() {
  // 方案A：CSV
  try {
    const r = await fetch('https://www.aaii.com/sentimentsurvey/sent_results', {
      headers: { ...H, 'Referer': 'https://www.aaii.com/sentimentsurvey' }
    });
    if (r.ok) {
      const text = await r.text();
      if (!text.includes('Incapsula') && !text.includes('NOINDEX')) {
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
              spread: spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1)
            };
          }
        }
      }
    }
  } catch {}

  // 方案B：JSON API
  try {
    const r = await fetch('https://www.aaii.com/sentiment/data.json', {
      headers: { ...H, 'Referer': 'https://www.aaii.com/sentimentsurvey', 'Accept': 'application/json' }
    });
    if (r.ok) {
      const text = await r.text();
      if (!text.includes('Incapsula')) {
        const j = JSON.parse(text);
        let bull = parseFloat(j.bullish ?? j.Bullish ?? (Array.isArray(j) ? j[0]?.bullish : null));
        let bear = parseFloat(j.bearish ?? j.Bearish ?? (Array.isArray(j) ? j[0]?.bearish : null));
        if (bull < 1) { bull *= 100; bear *= 100; }
        if (!isNaN(bull) && !isNaN(bear)) {
          const spread = bull - bear;
          return {
            bullish: bull.toFixed(1),
            bearish: bear.toFixed(1),
            spread: spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1)
          };
        }
      }
    }
  } catch {}

  throw new Error('AAII被服务器拦截');
}

async function fetchPutCall() {
  const resp = await fetch('https://www.cboe.com/us/options/market_statistics/daily/', {
    headers: { ...H, 'Referer': 'https://www.cboe.com' }
  });
  if (!resp.ok) throw new Error(`CBOE HTTP ${resp.status}`);
  const html = await resp.text();
  // 精确匹配 TOTAL PUT/CALL RATIO 后的小数
  const m1 = html.match(/TOTAL\s+PUT[\/\-]CALL\s+RATIO[\s\S]{0,300}?(0\.\d{2}|1\.\d{2})/i);
  if (m1) return parseFloat(m1[1]).toFixed(2);
  // 备用：页面中第一个合理范围的 put/call 比率值
  const all = [...html.matchAll(/>[\s]*(0\.[3-9]\d|1\.[0-4]\d)[\s]*</g)];
  if (all.length > 0) return parseFloat(all[0][1]).toFixed(2);
  throw new Error('CBOE结构变更');
}

async function fetchTtmPE() {
  const resp = await fetch(
    'https://data.nasdaq.com/api/v3/datasets/MULTPL/SP500_PE_RATIO_MONTH.json?rows=1',
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  );
  if (!resp.ok) throw new Error(`Nasdaq PE HTTP ${resp.status}`);
  const data = await resp.json();
  const val = data?.dataset?.data?.[0]?.[1];
  if (!val) throw new Error('Nasdaq PE 无数据');
  return parseFloat(val).toFixed(2);
}

async function fetchDivYield() {
  const resp = await fetch(
    'https://data.nasdaq.com/api/v3/datasets/MULTPL/SP500_DIV_YIELD_MONTH.json?rows=1',
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  );
  if (!resp.ok) throw new Error(`Nasdaq Div HTTP ${resp.status}`);
  const data = await resp.json();
  const val = data?.dataset?.data?.[0]?.[1];
  if (!val) throw new Error('Nasdaq Div 无数据');
  return parseFloat(val).toFixed(2);
}

export default async function handler(req, res) {
  const [nr, ar, pcR, tpeR, divR] = await Promise.allSettled([
    fetchNAAIM(),
    fetchAAII(),
    fetchPutCall(),
    fetchTtmPE(),
    fetchDivYield()
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