/* Part 2 smoke test: load → enter → explore → dests → film chapters + scroll-scrub.
   Usage: node tools/shot2.js [port] */
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
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 400)); });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message + '\nSTACK: ' + (e.stack || '').split('\n').slice(0, 6).join('\n')));

  await page.goto(`http://localhost:${PORT}/beyond.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__boot && window.__boot.started === true, { timeout: 45000 }).catch(() => errors.push('[timeout] boot never started'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'b-01-enter.png') });

  await page.click('#btn-enter');
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(OUT, 'b-02-explore.png') });

  // 目的地：木星
  await page.evaluate(() => document.querySelectorAll('.dest-item')[15].click());
  await page.waitForTimeout(4200);
  await page.screenshot({ path: path.join(OUT, 'b-03-jupiter.png') });

  // 目的地：太阳系全景
  await page.evaluate(() => document.querySelectorAll('.dest-item')[9].click());
  await page.waitForTimeout(4200);
  await page.screenshot({ path: path.join(OUT, 'b-04-system.png') });

  // 目的地：南门二（星际）
  await page.evaluate(() => document.querySelectorAll('.dest-item')[20].click());
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(OUT, 'b-05-alphacen.png') });

  // 目的地：银河系尺度（宇宙阶梯 MILKY WAY）
  await page.evaluate(() => { const btns = document.querySelectorAll('#ladder button'); btns[btns.length - 1].click(); });
  await page.waitForTimeout(5200);
  await page.screenshot({ path: path.join(OUT, 'b-06-galaxy.png') });

  // 影片各章
  await page.click('#b-play');
  for (let ch = 0; ch < 6; ch++) {
    const durs = [30, 35, 30, 35, 25, 19];
    await page.waitForTimeout(Math.min(6000, durs[ch] * 1000 - 500));
    await page.screenshot({ path: path.join(OUT, `b-1${ch}-ch${ch + 1}.png`) });
    if (ch < 5) await page.keyboard.press('ArrowRight');
  }
  // 滚轮穿越时间提示
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(1500);
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'b-20-scrolltime.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);

  const stats = await page.evaluate(() => window.__stats || {});
  console.log('stats:', JSON.stringify(stats));
  fs.writeFileSync(path.join(OUT, 'errors-b.txt'), errors.join('\n') || 'NONE');
  console.log('Errors:', errors.length ? errors.slice(0, 10) : 'NONE');
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
