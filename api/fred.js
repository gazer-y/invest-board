// 文件路径: api/fred.js

export default async function handler(req, res) {
    const API_KEY = '23835d5e437aaad477975e3d90a48655';
    
    // 专门写一个独立抓取的子函数，失败了也不影响别人
    async function fetchSingleData(seriesId) {
        try {
            const url = `https://api.stlouisfed.org/series/observations?series_id=${seriesId}&api_key=${API_KEY}&file_type=json&sort_order=desc&limit=1`;
            
            // 加上请求头伪装，防止被美联储墙掉
            const resp = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            
            if (!resp.ok) {
                console.error(`FRED 拒绝了请求 ${seriesId}，状态码:`, resp.status);
                return null;
            }
            
            const data = await resp.json();
            const rawValue = data.observations[0].value;
            
            // 核心防错：如果美联储传回来一个点 "."（代表节假日休市无数据），我们直接返回 null
            if (rawValue === ".") return null;
            
            return rawValue;
        } catch (err) {
            console.error(`抓取 ${seriesId} 时发生代码异常:`, err);
            return null;
        }
    }

    try {
        // 分别派出三个独立小分队去拿数据
        const val10Y2Y = await fetchSingleData('T10Y2Y');
        const valHY = await fetchSingleData('BAMLH0A0HYM2');
        const valGDP = await fetchSingleData('GDP');

        // 整理成果，发回给大屏
        res.status(200).json({
            // 如果拿到了正常数字，就保留两位小数返回；如果拿到 null，就原样返回 null
            yieldCurve: val10Y2Y ? parseFloat(val10Y2Y).toFixed(2) : null,
            highYield: valHY ? parseFloat(valHY).toFixed(2) : null,
            gdp: valGDP,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("FRED 核心调度报错:", error);
        res.status(500).json({ error: "服务器内部处理出错" });
    }
}