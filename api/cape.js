// CAPE / Shiller PE 说明：
// multpl.com / nasdaq data link 均被 Incapsula 拦截服务端请求
// 改用 FMP 前5大权重股 PE 加权平均作为市场 TTM PE 近似

const FMP_KEY = '85I8IGs1tQIbcVJiNYjzoqPBbi1COoyM';

export default async function handler(req, res) {
  const symbols = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META'];

  const results = await Promise.allSettled(
    symbols.map(sym =>
      fetch(`https://financialmodelingprep.com/stable/ratios?symbol=${sym}&limit=1&apikey=${FMP_KEY}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }).then(r => r.json())
    )
  );

  const pes = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value) && r.value[0]) {
      const pe = r.value[0].priceToEarningsRatio;
      if (pe && pe > 0 && pe < 500) pes.push(pe);
    }
  }

  if (pes.length === 0) {
    return res.status(500).json({ error: 'TTM PE 所有数据源失败' });
  }

  const avg = pes.reduce((a, b) => a + b, 0) / pes.length;

  res.status(200).json({
    cape: avg.toFixed(2),
    note: '前5大权重股平均TTM PE（AAPL/MSFT/NVDA/AMZN/META）',
    timestamp: new Date().toISOString()
  });
}
