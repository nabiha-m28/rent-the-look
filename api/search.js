const genericWords = ['dress', 'gown', 'top', 'skirt', 'pants', 'coat', 'jacket', 'blouse', 'shirt', 'shorts', 'jumpsuit', 'romper', 'set', 'suit', 'the', 'and', 'with', 'for'];
const colorWords = ['off', 'white', 'off-white', 'black', 'red', 'blue', 'green', 'pink', 'yellow', 'orange', 'purple', 'brown', 'grey', 'gray', 'navy', 'cream', 'ivory', 'nude', 'beige', 'gold', 'silver', 'rose', 'coral', 'mint', 'lavender', 'lilac', 'olive', 'rust', 'tan', 'blush', 'mauve', 'teal', 'aqua', 'cobalt', 'emerald', 'burgundy', 'champagne', 'cognac', 'camel', 'leopard', 'stripe', 'striped', 'print', 'printed', 'pattern', 'patterned', 'floral'];

function getKeyWord(query) {
  const words = query.toLowerCase().split(' ').filter(w => w.length > 2);
  return words.slice(2).find(w => !genericWords.includes(w));
}

function buildShortQuery(query) {
  const words = query.split(' ');
  const keyWord = getKeyWord(query);
  const brand = words.slice(0, 2).join(' ');
  return keyWord ? `${brand} ${keyWord}` : query;
}

async function scrapePickle(query, keyWord, itemName) {
  try {
    const response = await fetch('https://api.shoponpickle.com/rpc/products/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
      body: JSON.stringify({
        json: {
          searchText: query,
          categoryIds: [], subcategoryIds: [], brandNames: [], colors: [], sizes: [],
          offerType: [], deliveryType: [], priceRange: null, availableNow: false,
          topLender: false, discountFilter: false, discount50PlusFilter: false,
          nearMe: false, latitude: null, longitude: null, zipCodes: [],
          rentalDateFrom: null, rentalDateTo: null, sort: 'recommended', limit: 60, nextToken: 0,
        },
      }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    const items = data.json?.items || [];
    if (items.length === 0) return [];

    const searchWords = (itemName || query).toLowerCase()
      .replace(/-/g, ' ').split(' ')
      .filter(w => w.length > 2 && !genericWords.includes(w) && !colorWords.includes(w));
    const requiredWord = searchWords[0];
    const secondaryWord = searchWords[1];

    const scored = items.map(item => {
      const name = (item.title || '').toLowerCase();
      const hasRequired = requiredWord ? name.includes(requiredWord) : true;
      const hasSecondary = secondaryWord ? name.includes(secondaryWord) : true;
      const matches = searchWords.filter(w => name.includes(w)).length;
      const score = hasRequired && hasSecondary ? 2 : hasRequired ? 1 : 0;
      return { ...item, score, matches };
    });
    scored.sort((a, b) => b.score - a.score || b.matches - a.matches);
    const top = scored.filter(i => i.score === 2).slice(0, 3);

    return top.map(item => ({
      site: 'Pickle',
      name: item.title || item.brandName || 'View listing',
      image: item.image || null,
      size: item.size || null,
      rentPrice: item.rentalPrice || null,
      retailPrice: item.price || null,
      url: `https://www.shoponpickle.com/product/${item.productId}`,
    }));
  } catch (e) {
    console.log('Pickle error:', e.message);
    return [];
  }
}

async function scrapeRTR(query, brand, itemName) {
  try {
    const designerId = (brand || '').toLowerCase()
      .replace(/\bactive\b/g, '').trim()
      .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

    const res = await fetch(
      `https://gateway.renttherunway.com/disco-search/api/v2/membership/products/catalog/designer?designerId=${designerId}&sortOptions=RECOMMENDED&itemOffset=0&itemLimit=40`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.renttherunway.com/',
          'Origin': 'https://www.renttherunway.com',
        }
      }
    );
    console.log('RTR status:', res.status, designerId);
    if (!res.ok) return [];
    const data = await res.json();
    const items = data.items || [];
    if (items.length === 0) return [];

    const searchWords = (itemName || '').toLowerCase()
      .replace(/-/g, ' ').split(' ')
      .filter(w => w.length > 2 && !colorWords.includes(w) && !genericWords.includes(w));
    const requiredWord = searchWords[0];
    const secondaryWord = searchWords[1];

    const scored = items.map(item => {
      const name = item.displayName.toLowerCase();
      const hasRequired = requiredWord ? name.includes(requiredWord) : true;
      const hasSecondary = secondaryWord ? name.includes(secondaryWord) : true;
      const matches = searchWords.filter(w => name.includes(w)).length;
      const score = hasRequired && hasSecondary ? 2 : hasRequired ? 1 : 0;
      return { ...item, score, matches };
    });
    scored.sort((a, b) => b.score - a.score || b.matches - a.matches);
    const top = scored.filter(i => i.score === 2).slice(0, 3);

    const apiKey = process.env.ZYTE_API_KEY;
    const results = await Promise.all(top.map(async (item) => {
      const retailPrice = item.price?.find(p => p.id === 'msrp')?.value || null;
      let rentPrice = null;
      try {
        const resp = await fetch('https://api.zyte.com/v1/extract', {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(apiKey + ':').toString('base64'),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: item.pdpUrl, browserHtml: true }),
        });
        const data = await resp.json();
        const html = data.browserHtml || '';
        const match = html.match(/"id":"rental","value":([\d.]+)/);
        if (match) rentPrice = Math.round(parseFloat(match[1]));
      } catch (e) {
        console.log('RTR price fetch error:', e.message);
      }

      let availableSizes = [];
      try {
        const availRes = await fetch(
          `https://gateway.renttherunway.com/disco-search/api/v0/membership/availability/${item.productId}`,
          { headers: { 'Accept': 'application/json' } }
        );
        const availData = await availRes.json();
        availableSizes = (availData.items || [])
          .filter(s => s.availableCount > 0)
          .map(s => s.sku.split('_').pop())
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .sort((a, b) => {
            const order = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '1X', '2X', '3X', '4X'];
            const ai = order.indexOf(a);
            const bi = order.indexOf(b);
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
          });
      } catch (e) {
        console.log('RTR availability error:', e.message);
      }

      return {
        site: 'Rent the Runway',
        name: item.displayName,
        url: item.pdpUrl,
        image: item.imagesByTag?.find(i => i.isLead)?.path
          ? `https://pc-ap.rtrcdn.com/${item.imagesByTag.find(i => i.isLead).path.replace('270x', '480x')}`
          : item.images?.[0]
            ? `https://pc-ap.rtrcdn.com/${item.images[0].replace('270x', '480x')}`
            : null,
        retailPrice,
        rentPrice,
        availableSizes,
        period: 'one-time',
      };
    }));
    return results;
  } catch (e) {
    console.log('RTR error:', e.message);
    return [];
  }
}

async function scrapeNuuly(query, brand, itemName) {
  try {
    const apiKey = process.env.ZYTE_API_KEY;
    const cleanBrand = brand.replace(/\bactive\b/gi, '').trim();

    const searchWords = (itemName || '').toLowerCase()
      .replace(/-/g, ' ').replace(/[^a-z\s]/g, '').split(' ')
      .filter(w => w.length > 2 && !colorWords.includes(w) && !genericWords.includes(w));
    const requiredWord = searchWords[0];
    const secondaryWord = searchWords[1];

    const searchTerms = [requiredWord, secondaryWord].filter(Boolean).join(' ');
    const searchQuery = `${cleanBrand} ${searchTerms}`.trim();
    const searchUrl = `https://www.nuuly.com/api/catalog/v2/search?inStock=true&q=${encodeURIComponent(searchQuery)}&pageNumber=1&itemsPerPage=100`;

    const response = await fetch('https://api.zyte.com/v1/extract', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(apiKey + ':').toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: searchUrl,
        httpResponseBody: true,
        customHttpRequestHeaders: [
          { name: 'Accept', value: 'application/json, text/plain, */*' },
          { name: 'x-urbn-channel', value: 'rental-web-cx' },
          { name: 'x-urbn-country', value: 'US' },
          { name: 'x-urbn-region', value: 'NY' },
        ],
      }),
    });

    const data = await response.json();
    if (!data.httpResponseBody) return [];

    const jsonText = Buffer.from(data.httpResponseBody, 'base64').toString('utf-8');
    const json = JSON.parse(jsonText);
    const products = json.products || [];
    if (products.length === 0) return [];

    const seenSlugs = new Set();
    const uniqueProducts = products.filter(p => {
      if (seenSlugs.has(p.productSlug)) return false;
      seenSlugs.add(p.productSlug);
      return true;
    });

    const scored = uniqueProducts.map(p => {
      const nameLower = p.displayName.toLowerCase();
      const matchCount = searchWords.filter(w => nameLower.includes(w)).length;
      const hasRequired = requiredWord ? nameLower.includes(requiredWord) : true;
      const hasSecondary = secondaryWord ? nameLower.includes(secondaryWord) : true;
      const score = hasRequired && hasSecondary ? 2 : hasRequired ? 1 : 0;
      return { product: p, score, matchCount };
    });
    scored.sort((a, b) => b.score - a.score || b.matchCount - a.matchCount);
    const cleanBrandLower = cleanBrand.toLowerCase();
    const top = scored
      .filter(s => s.score >= 1 && s.product.brand?.toLowerCase().includes(cleanBrandLower))
      .slice(0, 5);
    if (top.length === 0) return [];

    return (await Promise.all(top.map(async ({ product }) => {
      const slug = product.productSlug;
      const url = `https://www.nuuly.com/rent/products/${slug}`;
      const productImage = product.images?.[0] || null;
      let listings = [];

      try {
        const apiUrl = `https://www.nuuly.com/api/product/slug/${slug}?excludeFromRecentlyViewed=false&view=rent`;
        const resp = await fetch('https://api.zyte.com/v1/extract', {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(apiKey + ':').toString('base64'),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: apiUrl,
            httpResponseBody: true,
            customHttpRequestHeaders: [
              { name: 'Accept', value: 'application/json, text/plain, */*' },
              { name: 'x-urbn-channel', value: 'rental-web-cx' },
              { name: 'x-urbn-country', value: 'US' },
              { name: 'x-urbn-region', value: 'NY' },
            ],
          }),
        });
        const pageData = await resp.json();
        if (pageData.httpResponseBody) {
          const jsonText2 = Buffer.from(pageData.httpResponseBody, 'base64').toString('utf-8');
          const json2 = JSON.parse(jsonText2);
          const choices = json2.choices || [];
          listings = choices.map(c => {
            const skus = c.sizeGroups?.[0]?.includedSkus || [];
            const availableSizes = skus
              .filter(sku => sku.availableInventory > 0)
              .map(sku => sku.size.displayName)
              .filter((v, i, arr) => arr.indexOf(v) === i);
            const colorCode = c.color?.code || '';
            const colorName = c.color?.displayName || '';
            return {
              site: 'Nuuly',
              name: colorName ? `${product.displayName} (${colorName})` : product.displayName,
              url: colorCode ? `${url}?color=${colorCode}` : url,
              image: product.images?.[0] || null,
              rentPrice: 98,
              period: 'month (for 6 items)',
              availableSizes,
            };
          }).filter(l => l.availableSizes.length > 0);
        }
      } catch (e) {
        console.log('Nuuly size fetch error:', e.message);
      }

      return listings.length > 0 ? listings : [{
        site: 'Nuuly',
        name: product.displayName,
        url,
        image: productImage,
        rentPrice: 98,
        period: 'month (for 6 items)',
        availableSizes: [],
      }];
    }))).flat();
  } catch (e) {
    console.log('Nuuly error:', e.message);
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { query, itemName, fullName, brand } = req.query;
  if (!query) return res.status(400).json({ error: 'query param required' });

  const keyWord = itemName
    ? itemName.toLowerCase().split(' ').find(w => w.length > 2 && !colorWords.includes(w) && !genericWords.includes(w))
    : getKeyWord(query);

  const itemTypes = ['dress', 'gown', 'top', 'skirt', 'pants', 'coat', 'jacket', 'blouse', 'shirt', 'shorts', 'jumpsuit', 'romper', 'set', 'suit', 'bodysuit', 'jeans', 'blazer'];
  const itemType = fullName ? itemTypes.find(t => fullName.toLowerCase().includes(t)) : null;

  console.log('Searching:', query, '| keyword:', keyWord, '| itemType:', itemType, '| brand:', brand);

  try {
    const [pickle, rtr, nuuly] = await Promise.all([
      scrapePickle(query, keyWord, itemName),
      scrapeRTR(query, brand, itemName),
      scrapeNuuly(query, brand, itemName),
    ]);

    let results = [...pickle, ...rtr, ...nuuly];

    if (itemType) {
      const wrongTypes = itemTypes.filter(t => t !== itemType);
      results = results.filter(r => {
        const name = r.name.toLowerCase();
        return !wrongTypes.some(t => name.includes(t));
      });
    }

    console.log('Results found:', results.length);
    res.status(200).json({ results });
  } catch (e) {
    console.log('Server error:', e.message);
    res.status(500).json({ error: e.message });
  }
}