export default async function handler(req, res) {
  try {
    const resp = await fetch('https://www.multpl.com/buffett-indicator', {
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

    // 方案A: id="current-value"
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

    // 方案C: "Current Buffett Indicator: 198.3%"
    if (!value) {
      const m3 = html.match(/Buffett\s+Indicator[^:]*:\s*\*?\*?([\d.]+)\s*%/i);
      if (m3) value = m3[1];
    }

    // 方案D: "Current.*?: 数字%"
    if (!value) {
      const m4 = html.match(/Current[^:]*:\s*\*?\*?\s*([\d]{2,3}\.[\d]+)\s*%/i);
      if (m4) value = m4[1];
    }

    // 方案E: 页面中 150-300 范围的百分比（巴菲特指标历史范围）
    if (!value) {
      const m5 = html.match(/\b(1[5-9]\d\.\d|2\d\d\.\d|3\d\d\.\d)\s*%/);
      if (m5) value = m5[1];
    }

    if (!value) throw new Error('页面结构未匹配');

    const ratio = parseFloat(value);
    let level;
    if (ratio < 80) level = '低估';
    else if (ratio < 100) level = '合理';
    else if (ratio < 140) level = '高估';
    else level = '极度高估';

    res.status(200).json({
      buffett: ratio.toFixed(1),
      level,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: '巴菲特指标失败', detail: error.message });
  }
}