// Render web/tip-calculator.html in headless Chromium and capture two
// screenshots that visibly demonstrate the planted bugs. Outputs to
// .github/issue-assets/ so the GitHub Issue body can embed them via raw URL.
//
// Note: serves the page over http://127.0.0.1 (not file://) because the page
// uses ES-module imports, which most browsers block over file:// origins.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const webDir = resolve(repoRoot, 'web');
const outDir = resolve(repoRoot, '.github/issue-assets');
mkdirSync(outDir, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const file = url.pathname === '/' ? '/tip-calculator.html' : url.pathname;
    const body = await readFile(join(webDir, file));
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const pageUrl = `http://127.0.0.1:${port}/tip-calculator.html`;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1024, height: 720 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(pageUrl);

async function shoot(name, fillFn, expectInResult) {
  await fillFn();
  await page.click('#calc-btn');
  await page.waitForFunction(
    (token) => document.querySelector('#result')?.textContent?.includes(token),
    expectInResult,
    { timeout: 5000 },
  );
  await page.screenshot({ path: resolve(outDir, name), fullPage: false });
  console.log(`→ ${name}`);
}

await shoot(
  'bug-1-empty-bill-nan.png',
  async () => {
    await page.fill('#bill', '');
    await page.fill('#tip', '15');
    await page.fill('#guests', '4');
  },
  'NaN',
);

await shoot(
  'bug-2-zero-guests-infinity.png',
  async () => {
    await page.fill('#bill', '120');
    await page.fill('#tip', '15');
    await page.fill('#guests', '0');
  },
  'Infinity',
);

await shoot(
  'healthy-state.png',
  async () => {
    await page.fill('#bill', '120');
    await page.fill('#tip', '15');
    await page.fill('#guests', '4');
  },
  '34.50',
);

await browser.close();
server.close();
