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
    // NCBEILQ027S：非金融企业股票市值（十亿，季度）
    // BOGZ1FL073164003Q：全市场股票市值（十亿，季度）
    // GDP：季度 GDP（十亿）
    const [mktCap, gdp] = await Promise.all([
      fredLatest('NCBEILQ027S'),
      fredLatest('GDP'),
    ]);

    const ratio = ((mktCap.value / gdp.value) * 100).toFixed(1);
    const level =
      ratio < 80  ? '低估' :
      ratio < 100 ? '合理' :
      ratio < 140 ? '高估' : '极度高估';

    res.status(200).json({
      buffett: ratio,
      level,
      mktCapBn: mktCap.value,
      gdpBn: gdp.value,
      mktCapDate: mktCap.date,
      gdpDate: gdp.date,
      timestamp: new Date().toISOString()
    });
  } catch (e1) {
    // 备用：用 SP500 价格 × 系数 / GDP 近似
    try {
      const [sp500, gdp] = await Promise.all([
        fredLatest('SP500'),
        fredLatest('GDP'),
      ]);
      // Wilshire ≈ SP500 × 9.3（历史经验近似系数）
      const approxMktCap = sp500.value * 9.3;
      const ratio = ((approxMktCap / gdp.value) * 100).toFixed(1);
      const level =
        ratio < 80  ? '低估' :
        ratio < 100 ? '合理' :
        ratio < 140 ? '高估' : '极度高估';
      return res.status(200).json({
        buffett: ratio, level,
        note: 'SP500×9.3/GDP近似估算',
        timestamp: new Date().toISOString()
      });
    } catch (e2) {
      res.status(500).json({ error: e1.message + ' | ' + e2.message });
    }
  }
}