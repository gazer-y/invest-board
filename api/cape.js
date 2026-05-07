export default async function handler(req, res) {
  // 方案A：Nasdaq Data Link（免费无需key）
  try {
    const resp = await fetch(
      'https://data.nasdaq.com/api/v3/datasets/MULTPL/SHILLER_PE_RATIO_MONTH.json?rows=1',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (resp.ok) {
      const data = await resp.json();
      const val = data?.dataset?.data?.[0]?.[1];
      if (val && parseFloat(val) > 0) {
        return res.status(200).json({
          cape: parseFloat(val).toFixed(2),
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch {}

  // 方案B：stooq TTM PE 近似替代
  try {
    const resp = await fetch(
      'https://stooq.com/q/l/?s=^spx&f=sd2t2ohlcvp&h&e=json',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (resp.ok) {
      const data = await resp.json();
      const pe = data?.symbols?.[0]?.p;
      if (pe && parseFloat(pe) > 5) {
        return res.status(200).json({
          cape: parseFloat(pe).toFixed(2),
          note: 'TTM PE（stooq备用）',
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch {}

  res.status(500).json({ error: 'CAPE所有数据源失败' });
}