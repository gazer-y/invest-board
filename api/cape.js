// 文件路径: api/cape.js

export default async function handler(req, res) {
    try {
        // 1. 伪装成普通浏览器去访问 multpl.com 的席勒 CAPE 页面
        const response = await fetch('https://www.multpl.com/shiller-pe', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        // 2. 拿到的不再是干净的 JSON，而是一大堆杂乱的 HTML 网页源代码
        const html = await response.text();

        // 3. 爬虫黑客技巧：正则表达式 (Regex)
        // 我们通过分析 multpl.com 的源码，发现数字永远藏在一个 id="bignumber" 的标签里
        // 比如: <div id="bignumber"> 34.21 </div>
        // 下面这行代码的意思是：在这堆代码里，寻找 id="bignumber" 后面跟着的数字
        const regex = /id="bignumber"[^>]*>\s*([\d.]+)\s*</i;
        const match = html.match(regex);

        let capeValue = "N/A";
        if (match && match[1]) {
            capeValue = match[1]; // 成功抠出数字！
        } else {
            throw new Error("HTML 解析失败，目标网站结构可能已改变");
        }

        // 4. 把抠出来的干净数字返回给前端
        res.status(200).json({
            cape: capeValue,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("CAPE 数据抓取失败:", error);
        res.status(500).json({ error: "网页爬取失败" });
    }
}