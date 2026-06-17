

import { useState } from "react";
import "./App.css";
import useAuth from "./hooks/useAuth";
import { signOut } from "./lib/auth";
import SaveButton from "./components/SaveButton";
import ProfileMenu from "./components/ProfileMenu";
import LoginPage from "./components/LoginPage";
import { useNavigate } from "react-router-dom";

export default function App() {
  const session = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();
  const [result, setResult] = useState(() => {
    const saved = sessionStorage.getItem('lastResult');
    return saved ? JSON.parse(saved) : null;
  });

  const [listings, setListings] = useState(() => {
    const saved = sessionStorage.getItem('lastListings');
    return saved ? JSON.parse(saved) : [];
  });

  const [url, setUrl] = useState(() => {
    return sessionStorage.getItem('lastUrl') || '';
  });
  const [error, setError] = useState("");
  const SIZE_GROUPS = [
    { label: "XXS (0)", values: ["XXS", "0"] },
    { label: "XS (0–2)", values: ["XS", "0", "2"] },
    { label: "S (4)", values: ["S", "4"] },
    { label: "M (6–8)", values: ["M", "6", "8"] },
    { label: "L (10)", values: ["L", "10"] },
    { label: "XL (12–14)", values: ["XL", "12", "14"] },
    { label: "XXL (16)", values: ["XXL", "16"] },
    { label: "1X (16–18)", values: ["1X", "16", "18"] },
    { label: "2X (20)", values: ["2X", "20"] },
    { label: "3X (22)", values: ["3X", "22"] },
    { label: "4X (24)", values: ["4X", "24"] }
  ];
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [selectedSizeGroup, setSelectedSizeGroup] = useState("");

  function updateResult(val) {
    setResult(val);
    if (val) sessionStorage.setItem('lastResult', JSON.stringify(val));
    else sessionStorage.removeItem('lastResult');
  }

  function updateListings(val) {
    setListings(val);
    if (val.length) sessionStorage.setItem('lastListings', JSON.stringify(val));
    else sessionStorage.removeItem('lastListings');
  }

  function updateUrl(val) {
    setUrl(val);
    sessionStorage.setItem('lastUrl', val);
  }

  function extractSlug(rawUrl) {
    try {
      const u = new URL(rawUrl);
      const parts = u.pathname.split("/").filter(p => p.length > 3 && !/^\d+$/.test(p));
      return parts.join(" ").replace(/[-_]/g, " ");
    } catch {
      return rawUrl;
    }
  }

  async function findRentals() {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    updateResult(null);
    updateListings([]);
    setProgress(5);

    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    const API_URL = '';

    try {
      setLoadingMsg("Reading product page…");
      setProgress(15);
      const scrapeRes = await fetch(`${API_URL}/api/scrape?url=${encodeURIComponent(url.trim())}`); const scraped = await scrapeRes.json();
      console.log('Scraped product:', scraped);

      setLoadingMsg("Identifying item…");
      setProgress(45);
      const slug = extractSlug(url.trim());
      const prompt = `You are a fashion assistant. Here is data scraped from a product page:
- URL slug: "${slug}"
- Scraped name: "${scraped.name || 'unknown'}"
- Scraped brand: "${scraped.brand || 'unknown'}"
- Scraped price: "${scraped.price || 'unknown'}"

Use this to identify the item accurately. If the scraped price looks correct use it, otherwise estimate.

Respond ONLY with a valid JSON object, no markdown:
{
  "brand": "Brand Name",
  "name": "Item Name",
  "retailPrice": 000,
  "description": "one sentence description"
}`;

      const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
        }),
      });

      const aiData = await aiRes.json();
      const text = aiData.choices?.[0]?.message?.content || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (!parsed.brand || parsed.brand.length <= 3) {
        try {
          const domain = new URL(url.trim()).hostname.replace('www.', '').split('.')[0];
          parsed.brand = domain.charAt(0).toUpperCase() + domain.slice(1);
        } catch { }
      }
      parsed.brand = parsed.brand.replace(/\bactive\b/gi, '').trim()
      parsed.image = scraped.image || scraped.imageUrl || (scraped.images && scraped.images[0]) || null;
      console.log('Image URL:', parsed.image);

      updateResult(parsed);

      setLoadingMsg("Searching rental sites…");
      setProgress(75);
      const colorWords = ['off', 'off-white', 'white', 'black', 'red', 'blue', 'green', 'pink', 'yellow', 'orange', 'purple', 'brown', 'grey', 'gray', 'navy', 'cream', 'ivory', 'nude', 'beige', 'gold', 'silver', 'rose', 'coral', 'mint', 'lavender', 'lilac', 'olive', 'rust', 'tan', 'blush', 'mauve', 'teal', 'aqua', 'cobalt', 'emerald', 'burgundy', 'champagne', 'cognac', 'camel', 'leopard', 'stripe', 'striped', 'print', 'printed', 'pattern', 'patterned', 'floral'];
      const nameWords = parsed.name.toLowerCase().replace(/-/g, ' ').split(' ');
      const firstWord = nameWords.find(w => w.length > 2 && !colorWords.includes(w)) || nameWords[0];
      const cleanBrand = parsed.brand.replace(/\bactive\b/gi, '').trim();
      const secondWord = nameWords.find(w => w.length > 2 && !colorWords.includes(w) && w !== firstWord) || '';
      const query = secondWord ? `${cleanBrand} ${firstWord} ${secondWord}` : `${cleanBrand} ${firstWord}`;
      const rentalRes = await fetch(`${API_URL}/api/search?query=${encodeURIComponent(query)}&itemName=${encodeURIComponent(parsed.name)}&fullName=${encodeURIComponent(parsed.name)}&brand=${encodeURIComponent(cleanBrand)}`); const rentalData = await rentalRes.json();
      updateListings(rentalData.results || []);

      setProgress(100);

    } catch (e) {
      console.log('Error:', e);
      setError("Couldn't identify this item. Try a direct product page URL.");
    } finally {
      setLoading(false);
      setLoadingMsg("");
      setProgress(0);
    }
  }

  const siteColor = {
    "Pickle": "#1a1a2e",
    "Rent the Runway": "#1a1a2e",
    "Nuuly": "#1a1a2e",
  };

  const sortedListings = [...listings].sort((a, b) => {
    const priceA = a.rentPrice ?? Infinity;
    const priceB = b.rentPrice ?? Infinity;
    return priceA - priceB;
  });

  const allSizes = [...new Set(
    listings.flatMap(l => {
      if (l.size) return [l.size];
      if (l.availableSizes?.length) return l.availableSizes;
      return [];
    })
  )].sort((a, b) => {
    const order = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    const ai = order.indexOf(a.toUpperCase());
    const bi = order.indexOf(b.toUpperCase());
    if (ai !== -1 && bi !== -1) return ai - bi;
    return a.localeCompare(b);
  });


  function toggleSize(size) {
    setSelectedSizes(prev =>
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    );
  }

  const filteredListings = sortedListings.filter(l => {
    if (selectedSizes.length === 0) return true;
    if (l.size) return selectedSizes.includes(l.size);
    if (l.availableSizes?.length) return l.availableSizes.some(s => selectedSizes.includes(s));
    return true;
  });


  return (
    <>
      <span className="logo-link" onClick={() => navigate('/')}>Rent the Look</span>
      {showLogin && <LoginPage onClose={() => setShowLogin(false)} />}
      <div className="app">
        <div className="app-header">
          {session
            ? <ProfileMenu session={session} />
            : <button className="login-btn" onClick={() => setShowLogin(true)}>Log In</button>
          }
        </div>
        <div className="container">
          <header>
            <p>Paste a product link and we'll find it on rental sites, matching your size and saving you the hassle of browsing multiple platforms.</p>
          </header>

          <div className="search-row">
            <input
              type="text"
              value={url}
              onChange={(e) => updateUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && findRentals()}
              placeholder="Paste a product URL"
            />
            <button type="button" onClick={findRentals} disabled={loading}>
              {loading ? "Searching…" : "Find Rentals"}
            </button>
          </div>

          <div className="size-filter">
            <span className="size-filter-label">Filter by size (optional):</span>
            <select className="size-dropdown"
              value={selectedSizeGroup}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedSizeGroup(value);

                if (value === "") {
                  setSelectedSizes([]);
                  return;
                }

                const group = SIZE_GROUPS.find(g => g.label === value);
                setSelectedSizes(group ? group.values : []);
              }}
            >
              <option value="">All sizes</option>

              {SIZE_GROUPS.map(group => (
                <option key={group.label} value={group.label}>
                  {group.label}
                </option>
              ))}
            </select>
          </div>

          {/* Progress bar before we have a result yet (reading/identifying) */}
          {loading && !result && (
            <div className="progress-wrap">
              <div className="progress-label">{loadingMsg}</div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {error && <p className="error">{error}</p>}

          {result && (
            <div className="results">
              <div className="item-card">
                {result.image && (
                  <img src={result.image} alt={result.name} className="product-image" />
                )}
                <div className="brand">{result.brand}</div>
                <h2>{result.name}</h2>
                {result.retailPrice > 0 && (
                  <div className="retail-price">${result.retailPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} retail</div>
                )}
              </div>

              {/* Progress bar continues here once we're searching rental sites */}
              {loading && (
                <div className="progress-wrap">
                  <div className="progress-label">{loadingMsg}</div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              {!loading && (
                <>
                  <h3 className="section-label">
                    {filteredListings.length > 0
                      ? `${filteredListings.length} rental listing${filteredListings.length > 1 ? "s" : ""} found`
                      : "0 rental listings found"}
                  </h3>

                  {filteredListings.length > 0 && (
                    <div className="rental-grid">
                      {filteredListings.map((listing, i) => (
                        <div key={i} className="rental-card">
                          <SaveButton item={listing} />
                          <div className="site-name" style={{ color: siteColor[listing.site] || "#333" }}>{listing.site}</div>
                          <div className="listing-name">{listing.name}</div>
                          {listing.size && <div className="listing-meta">Size: {listing.size}</div>}
                          {listing.availableSizes?.length > 0 && (
                            <div className="listing-meta">Sizes: {listing.availableSizes.join(', ')}</div>
                          )}
                          {listing.sizesNote && !listing.availableSizes?.length && (
                            <div className="listing-meta">{listing.sizesNote}</div>
                          )}
                          {listing.rentPrice && (
                            <div className="rental-price">
                              ${listing.rentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span>/{listing.period === 'month (for 6 items)' ? 'month (for 6 items)' : 'week'}</span>
                              {result.retailPrice > 0 && (
                                <span className="savings"> · save ${(result.retailPrice - listing.rentPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>)}
                            </div>
                          )}
                          <a href={listing.url} target="_blank" rel="noopener noreferrer" className="view-link">
                            View on {listing.site} →
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                  {filteredListings.length === 0 && listings.length > 0 && (
                    <p className="no-results">No listings match the selected size.</p>
                  )}
                  {listings.length === 0 && (
                    <div className="no-results">
                      No exact listings found.
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}