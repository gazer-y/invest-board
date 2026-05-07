export default async function handler(req, res) {
  try {
    const resp = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://edition.cnn.com/markets/fear-and-greed',
        'Origin': 'https://edition.cnn.com'
      }
    });
    if (!resp.ok) throw new Error(`CNN API HTTP ${resp.status}`);
    const data = await resp.json();
    const fg = data?.fear_and_greed;
    if (!fg) throw new Error('响应结构变更');
    const ratingMap = {
      'extreme fear': '极度恐惧', 'fear': '恐惧',
      'neutral': '中性', 'greed': '贪婪', 'extreme greed': '极度贪婪'
    };
    res.status(200).json({
      score: Math.round(fg.score),
      rating: fg.rating,
      ratingZh: ratingMap[fg.rating] ?? fg.rating,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: '情绪指数获取失败', detail: error.message });
  }
}