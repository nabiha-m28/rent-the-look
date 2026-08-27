export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url param required' });

  console.log('Scraping:', url);

  try {
    console.time('zyte-fetch');
    const html = await scrapeWithZyte(url);
    console.timeEnd('zyte-fetch');
    console.log('HTML size:', html.length);

    console.time('extract');
    const data = extractStructuredData(html);
    console.timeEnd('extract');

    console.log('Final:', data);
    res.status(200).json(data);
  } catch (e) {
    console.log('Error:', e.message);
    // Distinguish a timeout from other errors so the frontend can show a clear message
    if (e.name === 'AbortError') {
      return res.status(504).json({ error: 'Scrape timed out — try a different product link.' });
    }
    res.status(500).json({ error: e.message });
  }
}

function extractStructuredData(html) {
  let price = null, name = null, brand = null, image = null;
  const jsonLdMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const script of jsonLdMatches) {
    try {
      const content = script.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
      const json = JSON.parse(content);
      const items = Array.isArray(json) ? json : [json];
      for (const item of items) {
        const nodes = item['@graph'] ? item['@graph'] : [item];
        for (const node of nodes) {
          if (node['@type'] === 'Product' || (Array.isArray(node['@type']) && node['@type'].includes('Product'))) {
            name = name || node.name;
            brand = brand || (typeof node.brand === 'string' ? node.brand : node.brand?.name);
            image = image || (Array.isArray(node.image) ? node.image[0] : node.image);
            const offers = node.offers;
            if (offers) {
              const offer = Array.isArray(offers) ? offers[0] : offers;
              price = price || offer.price || offer.lowPrice;
            }
          }
        }
      }
    } catch { }
  }
  if (!name) {
    const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    if (ogTitle) name = ogTitle[1];
  }
  const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
  if (ogImage) image = ogImage[1];
  if (!price) {
    const priceMatch = html.match(/"price"\s*:\s*"?([\d.]+)"?/);
    if (priceMatch) price = priceMatch[1];
  }
  return {
    price: price ? parseFloat(String(price).replace(/[^0-9.]/g, '')) : null,
    name: name ? name.trim() : null,
    brand: brand ? brand.trim() : null,
    image: image ? image.trim().replace(/(?<!:)\/{2,}/g, '/') : null,
  };
}

async function scrapeWithZyte(url, { timeoutMs = 40000 } = {}) {
  const apiKey = process.env.ZYTE_API_KEY;

  // First attempt: fast plain-HTML fetch (no browser rendering).
  // Most product pages have JSON-LD / og: tags in the raw HTML, so this
  // usually succeeds in 1-3 seconds instead of 10-40+ for a rendered page.
  try {
    const fastHtml = await fetchZyte(url, apiKey, { browserHtml: false, timeoutMs: 12000 });
    if (fastHtml && /application\/ld\+json|og:title|og:image/i.test(fastHtml)) {
      console.log('Fast path succeeded (no browser rendering needed)');
      return fastHtml;
    }
  } catch (e) {
    console.log('Fast path failed, falling back to browserHtml:', e.message);
  }

  // Fallback: full headless-browser render, but capped so we always fail
  // well before Vercel's own 60s hard limit kicks in.
  return fetchZyte(url, apiKey, { browserHtml: true, timeoutMs });
}

async function fetchZyte(url, apiKey, { browserHtml, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.zyte.com/v1/extract', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(apiKey + ':').toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, browserHtml }),
      signal: controller.signal,
    });
    const data = await response.json();
    return data.browserHtml || data.httpResponseBody
      ? (data.browserHtml || Buffer.from(data.httpResponseBody, 'base64').toString('utf-8'))
      : '';
  } finally {
    clearTimeout(timer);
  }
}