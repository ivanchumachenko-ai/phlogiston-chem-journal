import puppeteer from 'puppeteer';
(async () => {
  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err.message));
    await page.goto('http://localhost:5000', { waitUntil: 'networkidle0', timeout: 15000 });
    console.log("Page loaded successfully");
    await browser.close();
  } catch(e) {
    console.error("Puppeteer error:", e);
  }
})();
