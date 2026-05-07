const FRED_KEY = '23835d5e437aaad477975e3d90a48655';

async function fredLatest(id) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=12`;
  const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!resp.ok) throw new Error(`FRED ${id} HTTP ${resp.status}`);
  const data = await resp.json();
  const valid = data?.observations?.find(o => o.value !== '.' && !isNaN(parseFloat(o.value)));
  if (!valid) throw new Error(`FRED ${id} 无有效数据`);
  return parseFloat(valid.value);
}

export default async function handler(req, res) {
  // 方案A：Nasdaq Data Link
  try {
    const resp = await fetch(
      'https://data.nasdaq.com/api/v3/datasets/MULTPL/MARKET_CAP_GDP_PERCENT.json?rows=1',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (resp.ok) {
      const data = await resp.json();
      const val = data?.dataset?.data?.[0]?.[1];
      if (val && parseFloat(val) > 0) {
        const ratio = parseFloat(val);
        const level = ratio < 80 ? '低估' : ratio < 100 ? '合理' : ratio < 140 ? '高估' : '极度高估';
        return res.status(200).json({ buffett: ratio.toFixed(1), level, timestamp: new Date().toISOString() });
      }
    }
  } catch {}

  // 方案B：FRED 自行计算（全市场市值 / GDP）
  try {
    const [mktCap, gdp] = await Promise.all([
      fredLatest('BOGZ1FL073164003Q'),
      fredLatest('GDP')
    ]);
    const ratio = (mktCap / gdp) * 100;
    const level = ratio < 80 ? '低估' : ratio < 100 ? '合理' : ratio < 140 ? '高估' : '极度高估';
    return res.status(200).json({ buffett: ratio.toFixed(1), level, timestamp: new Date().toISOString() });
  } catch {}

  res.status(500).json({ error: '巴菲特指标所有方案失败' });
}