const FRED_KEY = '23835d5e437aaad477975e3d90a48655';

async function fredLatest(id) {
try {
const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=12`;
const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
if (!resp.ok) return { value: null, error: `HTTP ${resp.status}` };
const data = await resp.json();
const valid = data?.observations?.find(o => o.value !== '.' && !isNaN(parseFloat(o.value)));
if (!valid) return { value: null, error: '无有效数据' };
return { value: valid.value, date: valid.date };
} catch (err) {
return { value: null, error: err.message };
}
}

export default async function handler(req, res) {
try {
const [t10y2y, hy, unemployment, m2, ffr, t10y] = await Promise.all([
fredLatest('T10Y2Y'),
fredLatest('BAMLH0A0HYM2'),
fredLatest('UNRATE'),
fredLatest('M2SL'),
fredLatest('FEDFUNDS'),
fredLatest('DGS10'),
]);
res.status(200).json({
yieldCurve: t10y2y,
highYield: hy,
unemployment,
m2,
ffr,
tenYear: t10y,
timestamp: new Date().toISOString()
});
} catch (e) {
res.status(500).json({ error: '宏观数据失败', detail: e.message });
}
}