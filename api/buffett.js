// 文件路径: api/buffett.js

export default async function handler(req, res) {
    const FRED_API_KEY = '23835d5e437aaad477975e3d90a48655';

    try {
        // 引入真正的全市场指数：^FTW5000
        const [yahooResp, fredResp] = await Promise.all([
            fetch('https://query1.finance.yahoo.com/v8/finance/chart/^FTW5000?interval=1d&range=1d', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
            fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=GDP&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=1`)
        ]);

        if (!yahooResp.ok || !fredResp.ok) throw new Error("数据源异常");

        const yahooData = await yahooResp.json();
        const fredData = await fredResp.json();

        // ftw5000 的点位本身就代表了美股总市值 (单位: 十亿美元)
        const ftw5000 = yahooData.chart.result[0].meta.regularMarketPrice;
        const gdp = parseFloat(fredData.observations[0].value);

        // 极其纯粹的除法，没有任何人工干预的乘数了！
        const buffettRatio = (ftw5000 / gdp) * 100;

        res.status(200).json({
            buffett: buffettRatio.toFixed(1), 
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("巴菲特计算失败:", error);
        res.status(500).json({ error: "服务器计算错误" });
    }
}