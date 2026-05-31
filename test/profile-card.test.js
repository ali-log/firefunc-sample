// Regression test for: profile card greeting renders nearly invisible (issue #9).
// Parses the CSS in profile-card.html and verifies the .greeting colour is
// readable (not the near-white #f5f5f4 that caused the bug).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, '../web/profile-card.html'), 'utf8');

function extractGreetingColor(source) {
  // Find the .greeting { ... } block and extract its color value.
  const blockMatch = source.match(/\.greeting\s*\{([^}]*)\}/s);
  if (!blockMatch) return null;
  const colorMatch = blockMatch[1].match(/\bcolor\s*:\s*([^;]+);/);
  if (!colorMatch) return null;
  return colorMatch[1].trim();
}

test('profile-card .greeting color is not the near-white bug value #f5f5f4', () => {
  const color = extractGreetingColor(html);
  assert.notEqual(
    color,
    null,
    '.greeting CSS block with a color property must exist',
  );
  assert.notEqual(
    color.toLowerCase(),
    '#f5f5f4',
    '.greeting color must not be the nearly-invisible #f5f5f4 (bug value)',
  );
});

test('profile-card .greeting color is a readable dark tone (uses --ink or equivalent dark hex)', () => {
  const color = extractGreetingColor(html);
  // Accept var(--ink) or a dark hex colour (luminance check via simple heuristic).
  const isVarInk = /^var\(\s*--ink\s*\)$/.test(color);
  const darkHexMatch = color.match(/^#([0-9a-f]{3,6})$/i);
  let isDarkHex = false;
  if (darkHexMatch) {
    // Expand shorthand hex if needed.
    let hex = darkHexMatch[1];
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    // Relative luminance: dark colours have low values.
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    isDarkHex = luminance < 100; // 0..255 scale; #1c1917 ≈ 30
  }
  assert.ok(
    isVarInk || isDarkHex,
    `.greeting color "${color}" should be var(--ink) or a dark hex value for readable contrast`,
  );
});
