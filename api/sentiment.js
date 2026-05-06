// 文件路径: api/sentiment.js

export default async function handler(req, res) {
    try {
        // 去互联网上抓取 CNN 恐慌与贪婪指数的官方隐藏 API
        const response = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
            // 伪装一下请求头，防止被对方的防火墙拦截
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        // 将抓取到的数据解析为 JSON 格式
        const data = await response.json();

        // 像手术刀一样，只提取我们需要的核心分数和当前状态文本
        const currentScore = data.fear_and_greed.score;
        const currentRating = data.fear_and_greed.rating; // 会返回 "greed", "extreme fear" 等

        // 把清理干净的数据返回给你的前端网页
        res.status(200).json({
            indicator: "Fear & Greed Index",
            score: Math.round(currentScore),
            rating: currentRating,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        // 如果抓取失败，返回一个错误提示
        console.error(error);
        res.status(500).json({ error: "抓取市场情绪数据失败，请检查网络或目标接口" });
    }
}