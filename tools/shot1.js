/* Part 1 smoke test: load → title → explore → film chapters, capture console errors + screenshots.
   Usage: node tools/shot1.js [port] */
const { chromium } = require('E:/ZCODE/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const PORT = process.argv[2] || 8123;
const OUT = path.join(__dirname, '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message + '\nSTACK: ' + (e.stack || '').split('\n').slice(0, 8).join('\n')));

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  // 等加载完成（boot.started 或 title-screen 出现）
  await page.waitForFunction(() => window.__boot && window.__boot.started === true, { timeout: 45000 }).catch(() => {
    errors.push('[timeout] boot never started');
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, '01-title.png') });

  // 进入任务
  await page.click('#btn-start');
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(OUT, '02-explore.png') });

  // 地标 2（发动机集群）
  await page.keyboard.press('2');
  await page.waitForTimeout(3200);
  await page.screenshot({ path: path.join(OUT, '03-landmark2.png') });

  // 地标 5（天枢空间站）
  await page.keyboard.press('5');
  await page.waitForTimeout(3200);
  await page.screenshot({ path: path.join(OUT, '04-landmark5.png') });

  // 影片各章
  await page.keyboard.press('KeyJ');
  for (let ch = 0; ch < 6; ch++) {
    const dur = [10, 12, 10, 10, 11, 11][ch];
    await page.waitForTimeout(Math.min(5200, dur * 1000 - 400));
    await page.screenshot({ path: path.join(OUT, `10-ch${ch + 1}.png`) });
    // 快进到下一章中段
    if (ch < 5) await page.keyboard.press('ArrowRight');
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);

  // 第一人称
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, '20-fp.png') });
  await page.keyboard.press('Escape');

  const fps = await page.evaluate(() => window.__stats ? window.__stats.fps : -1);
  console.log('FPS(approx):', fps);
  fs.writeFileSync(path.join(OUT, 'errors.txt'), errors.join('\n') || 'NONE');
  console.log('Errors:', errors.length ? errors.slice(0, 12) : 'NONE');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
