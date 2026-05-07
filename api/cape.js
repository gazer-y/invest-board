// CAPE / TTM PE 说明：
// multpl.com / nasdaq data link 均被 Incapsula 拦截服务端请求（403）
// 改用 FRED 企业利润 / SP500 市值 近似估算市场 earnings yield
// earnings yield = 1/PE，PE = 1/earningsYield

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
    // SP500 价格来自 FRED，企业税后利润来自 NIPA CP 系列
    // 这是近似估算，非精确 Shiller CAPE
    const [sp500, corpProfits, gdp] = await Promise.all([
      fredLatest('SP500'),   // 标普500日价格
      fredLatest('CP'),      // 企业税后利润（十亿，季度）
      fredLatest('GDP'),     // GDP
    ]);

    // 用 Wilshire/GDP 近似替代巴菲特指标
    // 市场市值约 = SP500 * 9.3（经验乘数，Wilshire ≈ SP500 * 系数）
    // 更准确：用 FRED NCBEILQ027S（非金融企业股票市值）
    const approxMktCap = sp500.value * 9.3; // 十亿
    const buffett = (approxMktCap / gdp.value * 100).toFixed(1);
    const buffettLevel = buffett < 80 ? '低估' : buffett < 100 ? '合理' : buffett < 140 ? '高估' : '极度高估';

    // Earnings yield = 企业利润(年化) / GDP * 一个系数 → 近似 1/PE
    // 直接返回企业利润数据，供前端参考
    return res.status(200).json({
      sp500Price: sp500.value,
      sp500Date: sp500.date,
      corpProfits: corpProfits.value,
      corpProfitsDate: corpProfits.date,
      buffett,
      buffettLevel,
      note: '巴菲特指标为近似估算（SP500价格×系数/GDP）',
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}