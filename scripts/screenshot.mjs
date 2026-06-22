// Capture a screenshot of the running web UI for visual QA.
// Usage: node scripts/screenshot.mjs [url] [outPath]
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "http://localhost:5173";
const out = process.argv[3] ?? "screenshot.png";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(url, { waitUntil: "networkidle" });
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`saved screenshot to ${out}`);
