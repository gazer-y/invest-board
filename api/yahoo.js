// 文件路径: api/yahoo.js

export default async function handler(req, res) {
    try {
        // 认怂：去掉了不存在的 ^PCR，专心抓 VIX 保平安
        const vixResponse = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/^VIX?interval=1d&range=1d', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        
        if (!vixResponse.ok) throw new Error("VIX 抓取失败");
        
        const vixData = await vixResponse.json();
        const currentVix = vixData.chart.result[0].meta.regularMarketPrice;

        res.status(200).json({
            vix: currentVix.toFixed(2),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("雅虎接口异常:", error);
        res.status(500).json({ error: "雅虎接口异常" });
    }
}