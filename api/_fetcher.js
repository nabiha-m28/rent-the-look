const SCRAPER_URL = 'https://api.scraperapi.com/';

async function request(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    return { ok: res.ok, status: res.status, contentType: res.headers.get('content-type') || '', text };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPage(
  url,
  { render = false, premium = false, headers = null, tryDirectFirst = false, timeoutMs = 40000 } = {}
) {
  if (tryDirectFirst) {
    try {
      const direct = await request(url, { headers: headers || {} }, 8000);
      if (direct.ok && /json/i.test(direct.contentType)) return direct.text;
      console.log('Direct fetch not usable, status', direct.status, '- using ScraperAPI');
    } catch (e) {
      console.log('Direct fetch failed, using ScraperAPI:', e.message);
    }
  }

  const apiKey = process.env.SCRAPERAPI_KEY;
  if (!apiKey) throw new Error('SCRAPERAPI_KEY env var is not set');

  const params = new URLSearchParams({ api_key: apiKey, url });
  if (render) params.set('render', 'true');
  if (premium) params.set('premium', 'true');
  if (headers) params.set('keep_headers', 'true');

  const result = await request(`${SCRAPER_URL}?${params}`, { headers: headers || {} }, timeoutMs);
  if (!result.ok) {
    throw new Error(`ScraperAPI returned ${result.status} for ${url}`);
  }
  return result.text;
}