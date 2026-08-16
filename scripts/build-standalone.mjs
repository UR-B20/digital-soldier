#!/usr/bin/env node
/* Builds dist/digital-soldier-standalone.html — the whole app (Three.js
 * included) inlined into one file you can double-click or share.
 *   node scripts/build-standalone.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const SCRIPTS = [
  'vendor/three.min.js',
  'vendor/OrbitControls.js',
  'js/soldier.js',
  'js/poses.js',
  'js/animation.js',
  'js/capture.js',
  'js/ui.js',
  'js/main.js',
];

const css = read('css/style.css');

let scriptBlocks = '';
for (const p of SCRIPTS) {
  const src = read(p);
  if (/<\/script/i.test(src)) {
    throw new Error(`${p} contains "</script>", cannot inline safely`);
  }
  scriptBlocks += `<script>\n/* ==== ${p} ==== */\n${src}\n</script>\n`;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Digital Soldier — drill pose studio</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🪖</text></svg>" />
<style>
${css}
</style>
</head>
<body>
<div id="layout">
  <div id="viewport">
    <div id="toolbar">
      <span id="app-title">🪖 Digital Soldier</span>
      <button id="tb-snapshot" class="tb-btn" title="Snapshot PNG (2×)">📷</button>
      <button id="tb-record" class="tb-btn" title="Record video">⏺</button>
      <span id="rec-dot"><i></i><span>0s</span></span>
    </div>
  </div>
  <div id="panel"></div>
</div>
${scriptBlocks}</body>
</html>
`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/digital-soldier-standalone.html'), html);
console.log('dist/digital-soldier-standalone.html written (' + (html.length / 1024).toFixed(0) + ' KB)');
