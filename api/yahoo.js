// 文件路径: api/yahoo.js

export default async function handler(req, res) {
    try {
        // 并发抓取 VIX 和 PCR (Put/Call Ratio 看跌看涨比率)
        const [vixResponse, pcrResponse] = await Promise.all([
            fetch('https://query1.finance.yahoo.com/v8/finance/chart/^VIX?interval=1d&range=1d', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
            fetch('https://query1.finance.yahoo.com/v8/finance/chart/^PCR?interval=1d&range=1d', { headers: { 'User-Agent': 'Mozilla/5.0' } })
        ]);

        const vixData = await vixResponse.json();
        const pcrData = await pcrResponse.json();
        
        const currentVix = vixData.chart.result[0].meta.regularMarketPrice;
        const currentPcr = pcrData.chart.result[0].meta.regularMarketPrice;

        res.status(200).json({
            vix: currentVix.toFixed(2),
            pcr: currentPcr.toFixed(2), // 成功拿到期权情绪数据
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({ error: "无法连接雅虎财经接口" });
    }
}