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
    const m1 = html.match(/id=["']current-value["'][^>]*>\s*([\d.]+)/);
    if (m1) value = m1[1];
    if (!value) {
      const m2 = html.match(/id=["']bignumber["'][^>]*>\s*([\d.]+)/);
      if (m2) value = m2[1];
    }
    if (!value) {
      const m3 = html.match(/<div[^>]*>\s*([\d.]+)\s*%\s*<\/div>/);
      if (m3) value = m3[1];
    }
    if (!value) throw new Error('页面结构变更，未找到数值');

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