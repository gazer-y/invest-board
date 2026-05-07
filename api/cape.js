const FRED_KEY = '23835d5e437aaad477975e3d90a48655';

async function fredLatest(id) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=12`;
  const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!resp.ok) throw new Error(`FRED ${id} HTTP ${resp.status}`);
  const data = await resp.json();
  const valid = data?.observations?.find(o => o.value !== '.' && !isNaN(parseFloat(o.value)));
  if (!valid) throw new Error(`${id} 无有效数据`);
  return { value: valid.value, date: valid.date };
}

export default async function handler(req, res) {
  try {
    const { value, date } = await fredLatest('CAPE');
    res.status(200).json({ cape: parseFloat(value).toFixed(2), dataDate: date, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'CAPE获取失败', detail: error.message });
  }
}