export default async function handler(req, res) {
  try {
    const resp = await fetch('https://www.multpl.com/shiller-pe', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      }
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();

    let value = null;

    // 方案A: id="current-value" span（容错换行/空格）
    const m1 = html.match(/id=["']current-value["'][^>]*>([\s\S]*?)<\/span>/i);
    if (m1) {
      const inner = m1[1].replace(/<[^>]+>/g, '').trim();
      const num = inner.match(/([\d.]+)/);
      if (num) value = num[1];
    }

    // 方案B: id="bignumber"
    if (!value) {
      const m2 = html.match(/id=["']bignumber["'][^>]*>([\s\S]*?)<\/div>/i);
      if (m2) {
        const inner = m2[1].replace(/<[^>]+>/g, '').trim();
        const num = inner.match(/([\d.]+)/);
        if (num) value = num[1];
      }
    }

    // 方案C: Cloudflare 纯文本 "Current Shiller PE Ratio: 41.24"
    if (!value) {
      const m3 = html.match(/Current\s+Shiller\s+PE\s+Ratio[^:]*:\s*\*?\*?([\d.]+)/i);
      if (m3) value = m3[1];
    }

    // 方案D: 兜底，找页面中 20-100 范围的两位小数
    if (!value) {
      const m4 = html.match(/Shiller\s+PE[^>]{0,60}?([\d]{2,3}\.[\d]{1,2})/i);
      if (m4) value = m4[1];
    }

    if (!value) throw new Error('页面结构未匹配');

    res.status(200).json({
      cape: parseFloat(value).toFixed(2),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'CAPE获取失败', detail: error.message });
  }
}