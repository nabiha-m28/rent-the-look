const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
require('dotenv').config();
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
function isBlocked(data) {
    if (!data.price && !data.brand) return true;
    const blockedPhrases = ['access denied', 'unusual activity', 'robot', 'captcha', 'forbidden', 'siteclosed'];
    if (data.name && blockedPhrases.some(p => data.name.toLowerCase().includes(p))) return true;
    return false;
}
async function scrapeWithPuppeteer(url) {
    let browser;
    try {
        browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
        await new Promise(r => setTimeout(r, 2000));
        return await page.content();
    } finally {
        if (browser) await browser.close();
    }
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
        console.log('Trying Puppeteer...');
        let html = await scrapeWithPuppeteer(url);
        let data = extractStructuredData(html);
        if (isBlocked(data)) {
            console.log('Puppeteer blocked, trying Zyte...');
            html = await scrapeWithZyte(url);
            data = extractStructuredData(html);
            console.log('Zyte result:', data);
        }
        console.log('Final:', data);
        res.status(200).json(data);
    } catch (e) {
        console.log('Error:', e.message);
        res.status(500).json({ error: e.message });
    }
};


