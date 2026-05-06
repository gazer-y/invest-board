// 文件路径: api/cape.js

export default async function handler(req, res) {
    try {
        const response = await fetch('https://www.multpl.com/shiller-pe', {
            headers: {
                // 升级伪装：模拟一个更真实的 Mac 浏览器，加入更多请求头
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });
        
        const html = await response.text();

        // 升级版手术刀：允许数字前后有任意的换行、空格、甚至其他杂乱标签 ([\s\S]*?)
        const regex = /id="bignumber"[^>]*>[\s\S]*?([\d.]+)[\s\S]*?<\/div>/i;
        const match = html.match(regex);

        if (match && match[1]) {
            res.status(200).json({
                cape: match[1],
                timestamp: new Date().toISOString()
            });
        } else {
            // 如果切歪了，主动承认错误，而不是返回空数据
            res.status(500).json({ error: "HTML结构改变，未找到数字", htmlSnippet: html.substring(0, 200) });
        }

    } catch (error) {
        console.error("CAPE 数据抓取失败:", error);
        res.status(500).json({ error: "网络请求失败" });
    }
}