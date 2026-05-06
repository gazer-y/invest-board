// 文件路径: api/fred.js

export default async function handler(req, res) {
    // 简单粗暴：直接把钥匙焊死在代码里！
    const API_KEY = '23835d5e437aaad477975e3d90a48655';
    
    // 我们要抓取的三个序列 ID: 
    // T10Y2Y (10年-2年利差), BAMLH0A0HYM2 (高收益债利差), GDP (美国GDP)
    const seriesIds = ['T10Y2Y', 'BAMLH0A0HYM2', 'GDP'];
    
    try {
        // 并发去美联储数据库抓取这三个硬核指标
        const results = await Promise.all(seriesIds.map(async (id) => {
            const url = `https://api.stlouisfed.org/series/observations?series_id=${id}&api_key=${API_KEY}&file_type=json&sort_order=desc&limit=1`;
            const resp = await fetch(url);
            
            // 如果美联储接口报错，抛出异常交由外层接管
            if (!resp.ok) throw new Error(`FRED 接口请求失败: ${id}`);
            
            const data = await resp.json();
            return { id, value: data.observations[0].value };
        }));

        // 把拿到手的杂乱数据，整理成干净的 JSON 返回给前端大屏
        res.status(200).json({
            // 确保利差保留两位小数，看起来更专业
            yieldCurve: parseFloat(results[0].value).toFixed(2),
            highYield: parseFloat(results[1].value).toFixed(2),
            gdp: results[2].value,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("FRED 数据抓取失败:", error);
        res.status(500).json({ error: "无法连接美联储数据库" });
    }
}