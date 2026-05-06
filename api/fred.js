// 文件路径: api/fred.js

export default async function handler(req, res) {
    const API_KEY = '23835d5e437aaad477975e3d90a48655';
    
    async function fetchSingleData(seriesId) {
        try {
            // 升级：拉取最近 5 天的数据，防范节假日的 "." 数据
            const url = `https://api.stlouisfed.org/series/observations?series_id=${seriesId}&api_key=${API_KEY}&file_type=json&sort_order=desc&limit=5`;
            
            const resp = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            
            // 升级：如果接口报错，直接把美联储的报错原文抓回来！
            if (!resp.ok) {
                const errText = await resp.text();
                return `美联储报错: HTTP ${resp.status} - ${errText}`;
            }
            
            const data = await resp.json();
            
            // 升级：在最近的 5 条记录里，找到第一个不是 "." 的真实有效数据
            const validObs = data.observations.find(obs => obs.value !== ".");
            
            if (validObs) {
                return validObs.value;
            } else {
                return null;
            }
        } catch (err) {
            return `代码异常: ${err.message}`;
        }
    }

    try {
        const val10Y2Y = await fetchSingleData('T10Y2Y');
        const valHY = await fetchSingleData('BAMLH0A0HYM2');
        const valGDP = await fetchSingleData('GDP');

        res.status(200).json({
            // 判断拿回来的是不是正常数字。如果是报错文本，就原样输出方便排查
            yieldCurve: !isNaN(parseFloat(val10Y2Y)) ? parseFloat(val10Y2Y).toFixed(2) : val10Y2Y,
            highYield: !isNaN(parseFloat(valHY)) ? parseFloat(valHY).toFixed(2) : valHY,
            gdp: valGDP,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({ error: "服务器内部处理出错" });
    }
}