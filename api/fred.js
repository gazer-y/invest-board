// 文件路径: api/fred.js

export default async function handler(req, res) {
    const API_KEY = '23835d5e437aaad477975e3d90a48655';
    
    async function fetchSingleData(seriesId) {
        try {
            // 🐛 终极修复：在 /series 前面加上了必不可少的 /fred ！！！
            const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${API_KEY}&file_type=json&sort_order=desc&limit=5`;
            
            const resp = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            
            if (!resp.ok) {
                // 如果还报错，只截取前30个字符，防止前端 UI 再次被撑爆
                const errText = await resp.text();
                return `拦截: ${errText.substring(0, 30)}...`;
            }
            
            const data = await resp.json();
            
            // 在最近的 5 条记录里，找到第一个不是 "." 的真实有效数据
            const validObs = data.observations.find(obs => obs.value !== ".");
            
            if (validObs) {
                return validObs.value;
            } else {
                return null;
            }
        } catch (err) {
            return `异常: ${err.message.substring(0, 20)}`;
        }
    }

    try {
        const val10Y2Y = await fetchSingleData('T10Y2Y');
        const valHY = await fetchSingleData('BAMLH0A0HYM2');
        const valGDP = await fetchSingleData('GDP');

        res.status(200).json({
            // 判断拿回来的是不是正常数字
            yieldCurve: !isNaN(parseFloat(val10Y2Y)) ? parseFloat(val10Y2Y).toFixed(2) : val10Y2Y,
            highYield: !isNaN(parseFloat(valHY)) ? parseFloat(valHY).toFixed(2) : valHY,
            gdp: valGDP,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({ error: "服务器内部错误" });
    }
}