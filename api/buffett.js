const FRED_KEY = '23835d5e437aaad477975e3d90a48655';

async function fredLatest(id) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=12`;
  const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!resp.ok) throw new Error(`FRED ${id} HTTP ${resp.status}`);
  const data = await resp.json();
  const valid = data?.observations?.find(o => o.value !== '.' && !isNaN(parseFloat(o.value)));
  if (!valid) throw new Error(`${id} 无有效数据`);
  return { value: parseFloat(valid.value), date: valid.date };
}

export default async function handler(req, res) {
  try {
    const [cap, gdp] = await Promise.all([fredLatest('WILL5000PRFC'), fredLatest('GDP')]);
    const ratio = (cap.value / gdp.value) * 100;
    let level;
    if (ratio < 80) level = '低估';
    else if (ratio < 100) level = '合理';
    else if (ratio < 140) level = '高估';
    else level = '极度高估';
    res.status(200).json({
      buffett: ratio.toFixed(1),
      level,
      marketCapDate: cap.date,
      gdpDate: gdp.date,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: '巴菲特指标失败', detail: error.message });
  }
}