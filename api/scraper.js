// 文件路径: api/scraper.js

export default async function handler(req, res) {
    try {
        // 1. 伪装成真实的 Mac 浏览器，并发冲进 NAAIM 和 AAII 的官网
        const headers = { 
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml'
        };

        const [naaimResp, aaiiResp] = await Promise.all([
            fetch('https://www.naaim.org/programs/naaim-exposure-index/', { headers }),
            fetch('https://www.aaii.com/sentimentsurvey', { headers })
        ]);

        // 把两个网站的网页源代码全部下载下来
        const naaimHtml = await naaimResp.text();
        const aaiiHtml = await aaiiResp.text();

        // 2. 暴力解剖 NAAIM 数据
        // 用正则在茫茫 HTML 中寻找 "Current NAAIM Exposure Index" 附近的数字
        const naaimRegex = /Exposure Index[\s\S]*?([0-9]{1,3}\.[0-9]{1,2})/i;
        const naaimMatch = naaimHtml.match(naaimRegex);
        const naaimValue = naaimMatch ? naaimMatch[1] : "改版拦截";

        // 3. 暴力解剖 AAII 牛熊数据
        // 在 HTML 里刮取 Bullish(看多) 和 Bearish(看空) 的百分比数值
        const bullMatch = aaiiHtml.match(/Bullish.*?([0-9.]{2,4})%/i);
        const bearMatch = aaiiHtml.match(/Bearish.*?([0-9.]{2,4})%/i);

        let aaiiValue = "改版拦截";
        if (bullMatch && bearMatch) {
            // 算差值：看多比例 减去 看空比例
            const spread = parseFloat(bullMatch[1]) - parseFloat(bearMatch[1]);
            // 如果是正数，前面加个 '+' 号，看起来更专业
            aaiiValue = spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1);
        }

        // 4. 将刮出来的战利品返回给前端
        res.status(200).json({
            naaim: naaimValue,
            aaii: aaiiValue,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("网页爬虫暴力刮取失败:", error);
        res.status(500).json({ error: "对方服务器防火墙拦截" });
    }
}