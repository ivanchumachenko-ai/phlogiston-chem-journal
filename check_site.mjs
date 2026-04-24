import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch({ 
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));
  await page.goto('http://localhost:5000', { waitUntil: 'networkidle0' });
  console.log("Page loaded successfully");
  await browser.close();
})();
