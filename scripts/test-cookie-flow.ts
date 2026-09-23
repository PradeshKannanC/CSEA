import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/login');

  const evalResult = await page.evaluate(async () => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'leader@test.local', password: 'Password123!' }),
    });
    const data = await res.json();
    return { status: res.status, data };
  });

  console.log('Login API result:', evalResult);

  const cookies = await page.cookies();
  console.log('Cookies in Puppeteer page after fetch:', cookies);

  const clientCookie = await page.evaluate(() => document.cookie);
  console.log('document.cookie:', clientCookie);

  await browser.close();
}

main().catch(console.error);
