const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('https://www.nuuly.com', { waitUntil: 'networkidle2', timeout: 20000 });
  await new Promise(r => setTimeout(r, 5000));
  const text = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log('text:', text);
  await browser.close();
})();
