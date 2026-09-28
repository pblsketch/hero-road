// 맵 화면 눈으로 보기: 장마다 맵을 열고 조금 걸어 본 뒤 찍는다.
//   node world_shots.mjs [phone|desktop] [ch0,ch1,…]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { base } from './serve.mjs';

const BASE = await base();
const size = process.argv[2] || 'phone';
const chs = (process.argv[3] || 'ch0,ch1,ch2,ch3,ch4,ch5,ch6,ch7').split(',');
const SIZE = { phone: { width: 390, height: 844, isMobile: true, hasTouch: true, dpr: 3 }, desktop: { width: 1366, height: 800, dpr: 1 } };
const OUT = new URL(`./shots/world-${size}/`, import.meta.url);
fs.rmSync(fileURLToPath(OUT), { recursive: true, force: true });
fs.mkdirSync(fileURLToPath(OUT), { recursive: true });
const vp = SIZE[size];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.dpr });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400) errors.push('http ' + r.status() + ': ' + r.url()); });
const shot = (name) => page.screenshot({ path: fileURLToPath(new URL(name + '.png', OUT)) });

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
for (const ch of chs) {
  await page.goto(BASE + '?teacher=1&ch=' + ch);
  await page.waitForSelector('canvas.wcv', { timeout: 8000 });
  await page.waitForSelector('.dlg .btn.primary', { timeout: 8000 });
  await shot(ch + '_0title');
  await page.locator('.dlg .btn.primary').click();
  await page.waitForTimeout(700);
  // 바로 펼치는 대목이 있으면 닫힐 때까지 넘긴다
  for (let i = 0; i < 40 && (await page.locator('.dlg').count()); i++) {
    const opt = page.locator('.dlg .opt:not([disabled])');
    if (await opt.count()) await opt.first().click();
    else if (await page.locator('.dlg .btn.primary').count()) await page.locator('.dlg .btn.primary').last().click();
    else if (await page.locator('.sheet .actions button').count()) await page.locator('.sheet .actions button').last().click();
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(300);
  await shot(ch + '_1map');
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(700); await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(500); await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(200);
  // 가상 조이스틱: 왼쪽 아래를 누른 채 위로 끈다
  const before = await page.evaluate(() => G.world.test.state());
  await page.mouse.move(90, vp.height - 200); await page.mouse.down();
  await page.mouse.move(90, vp.height - 250, { steps: 4 }); await page.waitForTimeout(600); await page.mouse.up();
  const after = await page.evaluate(() => G.world.test.state());
  if (!(after.y < before.y - 10)) errors.push(`${ch}: 조이스틱으로 움직이지 않음 ${before.y} → ${after.y}`);
  await shot(ch + '_2walk');
  console.log(ch, JSON.stringify(await page.evaluate(() => G.world.test.state())));
}
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no errors');
await browser.close();
