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

async function scrapeWithZyte(url) {
    const apiKey = process.env.ZYTE_API_KEY;
    const response = await fetch('https://api.zyte.com/v1/extract', {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(apiKey + ':').toString('base64'),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            url,
            browserHtml: true,
        }),
    });
    const data = await response.json();
    return data.browserHtml || '';
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url param required' });
    console.log('Scraping:', url);
    try {
        const html = await scrapeWithZyte(url);
        const data = extractStructuredData(html);
        console.log('Final:', data);
        res.status(200).json(data);
    } catch (e) {
        console.log('Error:', e.message);
        res.status(500).json({ error: e.message });
    }
};