// 文件路径: api/yahoo.js

export default async function handler(req, res) {
    try {
        // 请求 Yahoo Finance 的非官方隐藏 API，获取 VIX 指数
        // ^VIX 是恐慌指数的全球通用代码
        const response = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/^VIX?interval=1d&range=1d', {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        const data = await response.json();
        
        // 深入 JSON 结构，精准提取当前价格
        const currentVix = data.chart.result[0].meta.regularMarketPrice;

        res.status(200).json({
            vix: currentVix.toFixed(2),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("VIX 数据抓取失败:", error);
        res.status(500).json({ error: "无法连接雅虎财经接口" });
    }
}