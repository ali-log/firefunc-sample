// Render web/profile-card.html in headless Chromium and capture a screenshot
// that shows the contrast bug: the greeting heading "Welcome back, Alex 👋" is
// present in the DOM but renders nearly invisible (near-white on white).
//
// Outputs .github/issue-assets/profile-card-greeting-invisible.png — embedded
// in the GitHub issue so FireFunc/Claude can see the visual defect.
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
    const file = url.pathname === '/' ? '/profile-card.html' : url.pathname;
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

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 640, height: 520 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/profile-card.html`);
await page.waitForSelector('#card');

// Screenshot just the card so the invisible-heading gap is unmistakable.
const card = page.locator('#card');
await card.screenshot({ path: resolve(outDir, 'profile-card-greeting-invisible.png') });
console.log('→ profile-card-greeting-invisible.png');

await browser.close();
server.close();
