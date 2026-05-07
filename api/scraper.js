const H = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
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
        return {
          bullish: bull.toFixed(1),
          bearish: bear.toFixed(1),
          spread: spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1)
        };
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
      return {
        bullish: bull.toFixed(1),
        bearish: bear.toFixed(1),
        spread: spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1)
      };
    }
  }
  throw new Error('AAII所有方案失败');
}

export default async function handler(req, res) {
  const [nr, ar] = await Promise.allSettled([fetchNAAIM(), fetchAAII()]);
  res.status(200).json({
    naaim: nr.status === 'fulfilled' ? nr.value : null,
    naaimError: nr.status === 'rejected' ? nr.reason?.message : undefined,
    aaii: ar.status === 'fulfilled' ? ar.value : null,
    aaiiError: ar.status === 'rejected' ? ar.reason?.message : undefined,
    timestamp: new Date().toISOString()
  });
}