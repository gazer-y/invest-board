// 文件路径: api/buffett.js

export default async function handler(req, res) {
    const FRED_API_KEY = '23835d5e437aaad477975e3d90a48655';

    try {
        const [yahooResp, fredResp] = await Promise.all([
            fetch('https://query1.finance.yahoo.com/v8/finance/chart/^W5000?interval=1d&range=1d', { headers: { 'User-Agent': 'Mozilla/5.0' } }),
            fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=GDP&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=1`)
        ]);

        if (!yahooResp.ok || !fredResp.ok) {
            throw new Error("底层数据源获取失败");
        }

        const yahooData = await yahooResp.json();
        const fredData = await fredResp.json();

        const w5000 = yahooData.chart.result[0].meta.regularMarketPrice;
        const gdp = parseFloat(fredData.observations[0].value);

        // 核心修正：现在的 Wilshire 5000 指数点位几乎 1:1 对应十亿美元市值
        const totalMarketCap = w5000 * 1.0; 
        const buffettRatio = (totalMarketCap / gdp) * 100;

        res.status(200).json({
            buffett: buffettRatio.toFixed(1), 
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("巴菲特指标生成失败:", error);
        res.status(500).json({ error: "服务器内部计算错误" });
    }
}