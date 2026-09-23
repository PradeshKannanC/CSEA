import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const VIEWPORTS = [
  { name: 'Mobile 320px', width: 320, height: 640 },
  { name: 'Mobile 375px', width: 375, height: 667 },
  { name: 'Mobile 390px', width: 390, height: 844 },
  { name: 'Mobile 430px', width: 430, height: 932 },
  { name: 'Tablet 768px', width: 768, height: 1024 },
  { name: 'Desktop 1024px', width: 1024, height: 768 },
  { name: 'Desktop 1280px', width: 1280, height: 800 },
  { name: 'Desktop 1440px', width: 1440, height: 900 },
  { name: 'Full HD 1920px', width: 1920, height: 1080 },
];

const PAGES_TO_TEST = [
  { name: 'Login Page', path: '/login' },
  { name: 'Register Page', path: '/register' },
  { name: 'Forgot Password', path: '/forgot-password' },
  { name: 'How It Works', path: '/how-it-works' },
];

async function main() {
  console.log('============================================================');
  console.log('PHASE 23: RESPONSIVE VIEWPORT FINAL AUDIT');
  console.log('============================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  let totalChecked = 0;
  let overflowIssues = 0;

  try {
    for (const vp of VIEWPORTS) {
      console.log(`\nTesting Viewport: ${vp.name} (${vp.width}x${vp.height})...`);
      await page.setViewport({ width: vp.width, height: vp.height });

      for (const p of PAGES_TO_TEST) {
        totalChecked++;
        await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Check horizontal overflow: scrollWidth should equal or be extremely close to clientWidth
        const overflow = await page.evaluate(() => {
          const docEl = document.documentElement;
          const body = document.body;
          const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
          const clientWidth = docEl.clientWidth;
          return {
            hasOverflow: scrollWidth > clientWidth + 2, // 2px margin for subpixel rounding
            scrollWidth,
            clientWidth,
          };
        });

        if (overflow.hasOverflow) {
          overflowIssues++;
          console.error(`  ❌ [OVERFLOW] ${p.name} @ ${vp.name}: scrollWidth=${overflow.scrollWidth} > clientWidth=${overflow.clientWidth}`);
        } else {
          console.log(`  ✓ [PASS] ${p.name}: No horizontal overflow (${overflow.scrollWidth} <= ${overflow.clientWidth})`);
        }
      }
    }

    console.log('\n============================================================');
    console.log(`TOTAL RESPONSIVE CHECKS: ${totalChecked}`);
    console.log(`OVERFLOW ISSUES FOUND: ${overflowIssues}`);
    console.log('============================================================');

    if (overflowIssues > 0) {
      throw new Error(`Responsive audit failed: ${overflowIssues} horizontal overflow issues detected.`);
    } else {
      console.log('✅ ALL RESPONSIVE VIEWPORT CHECKS PASSED WITH ZERO OVERFLOW!');
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Fatal responsive test error:', err);
  process.exit(1);
});
