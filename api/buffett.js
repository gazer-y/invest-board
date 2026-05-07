const FRED_KEY = '23835d5e437aaad477975e3d90a48655';

async function fredLatest(id) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=12`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`FRED ${id} HTTP ${r.status}`);
  const data = await r.json();
  const valid = data?.observations?.find(o => o.value !== '.' && !isNaN(parseFloat(o.value)));
  if (!valid) throw new Error(`FRED ${id} 无有效数据`);
  return { value: parseFloat(valid.value), date: valid.date };
}

export default async function handler(req, res) {
  try {
    const [mktCap, gdp] = await Promise.all([
      fredLatest('NCBEILQ027S'), // 非金融企业股票市值，单位：百万美元
      fredLatest('GDP'),         // GDP，单位：十亿美元
    ]);

    // ⚠️ 单位换算：百万→十亿 需要除以1000
    const mktCapBn = mktCap.value / 1000;
    const ratio = ((mktCapBn / gdp.value) * 100).toFixed(1);

    const level =
      ratio < 80  ? '低估' :
      ratio < 100 ? '合理' :
      ratio < 140 ? '高估' : '极度高估';

    res.status(200).json({
      buffett: ratio,
      level,
      mktCapBn: mktCapBn.toFixed(0),
      gdpBn: gdp.value.toFixed(0),
      mktCapDate: mktCap.date,
      gdpDate: gdp.date,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
