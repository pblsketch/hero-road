// 기술 나무·적장전 눈으로 보기: 5장 수련 → 기술 익히기 → 허깨비 장수와 직접 싸우며 찍는다
//   node boss_shots.mjs [phone|desktop] [ch5|ch7]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { base } from './serve.mjs';

const BASE = await base();
const size = process.argv[2] || 'phone';
const CH = process.argv[3] || 'ch5';
const SIZE = { phone: { width: 390, height: 844, isMobile: true, hasTouch: true, dpr: 3 }, desktop: { width: 1366, height: 800, dpr: 1 } };
const OUT = new URL(`./shots/boss-${CH}-${size}/`, import.meta.url);
fs.rmSync(fileURLToPath(OUT), { recursive: true, force: true });
fs.mkdirSync(fileURLToPath(OUT), { recursive: true });
const vp = SIZE[size];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.dpr });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
let n = 0;
const shot = (name) => page.screenshot({ path: fileURLToPath(new URL(String(++n).padStart(2, '0') + '_' + name + '.png', OUT)) });

await page.goto(BASE);
await page.evaluate((ch) => {
  localStorage.clear();
  const s = G.save.fresh();
  Object.assign(s, { path: 'm', surname: '홍', given: '대웅', look: ch === 'ch7' ? 'general' : 'child', abil: { mu: 3, byeong: 2, sul: 2 }, relic: 'sword' });
  const upto = STORY.findIndex((c) => c.id === ch);
  for (const c of STORY.slice(0, upto)) { s.chDone[c.id] = true; for (const x of c.steps) s.done[x.id] = true; for (const b of QUESTS[c.id].beats) s.done['b:' + b.id] = true; }
  if (ch === 'ch7') { s.skills = { learned: ['combo', 'talisman', 'blink', 'formation'], equip: ['talisman', 'blink'], points: 1, got: 5 }; for (const id of ['c7-1', 'b:b7-1', 'b:b7-2']) s.done[id] = true; }
  localStorage.setItem('hero-road-v1', JSON.stringify(s));
}, CH);
await page.goto(BASE);
await page.locator('button', { hasText: '이어 하기' }).click();
await page.locator('.dlg-tray button.primary').click();

async function clickThrough(max = 40) {
  for (let i = 0; i < max; i++) {
    if (await page.locator('.sheet-back').count()) { await page.locator('.sheet .actions button').last().click(); continue; }
    if (!(await page.locator('.dlg').count())) return;
    if (await page.locator('.dlg.tree').count()) return;
    const opt = page.locator('.dlg .opt:not([disabled])');
    if (await opt.count()) { await opt.first().click(); await page.waitForTimeout(200); continue; }
    const b = page.locator('.dlg-tray button.primary').filter({ visible: true });
    if (await b.count()) await b.last().click(); else await page.waitForTimeout(150);
    await page.waitForTimeout(120);
  }
}
const state = () => page.evaluate(() => G.world.test.state());
// 목표를 이뤄 가며 적장전까지
for (let guard = 0; guard < 80; guard++) {
  await clickThrough();
  if (await page.locator('.dlg.tree').count()) {
    await shot('tree_open');
    for (let k = 0; k < 4; k++) { const r = page.locator('.dlg.tree .sk.ready'); if (!(await r.count())) break; await r.first().click(); await page.waitForTimeout(250); }
    await shot('tree_learned');
    await page.locator('.dlg.tree .dlg-tray button.primary').click();
    continue;
  }
  const s = await state();
  if (await page.evaluate(() => G.world.test.state().enemies > 0 && !!document.querySelector('.bossbar.on'))) break;
  if (s.enemies) { await page.evaluate(() => G.world.test.complete()); await page.waitForTimeout(700); continue; }
  if (s.goal) { await page.evaluate(() => G.world.test.complete()); await page.waitForTimeout(400); continue; }
  await page.waitForTimeout(300);
}
await shot('boss_start');
// 직접 싸운다: 다가가 베고, 기술을 쓰고, 붉은 자리가 보이면 물러선다
const t0 = Date.now();
let shots = 0;
while (Date.now() - t0 < 60000) {
  if (await page.locator('.sheet-back').count()) { await shot('heaven'); await page.locator('.sheet .actions button').last().click(); continue; }
  const info = await page.evaluate(() => { const s = G.world.test.state(); const b = s.foes[0]; return { s, boss: !!document.querySelector('.bossbar.on') }; });
  if (!info.boss) break;
  const { s } = info;
  if (!s.foes.length) break;
  let best = s.foes[0], bd = 1e9;
  for (const f of s.foes) { const d = Math.hypot(f[0] - s.x, f[1] - s.y); if (d < bd) { bd = d; best = f; } }
  const dx = best[0] - s.x, dy = best[1] - s.y;
  const kx = dx < -6 ? 'ArrowLeft' : dx > 6 ? 'ArrowRight' : null, ky = dy < -6 ? 'ArrowUp' : dy > 6 ? 'ArrowDown' : null;
  const keys = (bd > 30 ? [kx, ky] : [Math.abs(dx) > Math.abs(dy) ? kx : ky]).filter(Boolean);
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(bd > 30 ? 120 : 30);
  for (const k of keys) await page.keyboard.up(k);
  if (bd < 50) await page.keyboard.press('Space');
  if (Math.random() < 0.08) await page.keyboard.press(['KeyQ', 'KeyR', 'KeyF'][Math.floor(Math.random() * 3)]);
  if ((Date.now() - t0) > shots * 5000) { shots++; await shot('fight_' + shots); }
}
const after = await state();
console.log('boss after 60s:', JSON.stringify({ enemies: after.enemies, hp: after.hp, goal: after.goal }));
if (after.enemies) { await page.evaluate(() => G.world.test.complete()); }
await page.waitForTimeout(2200);
await clickThrough();
await shot('after');
console.log(JSON.stringify(await page.evaluate(() => ({ skills: G.save.state.skills, heaven: G.save.state.heaven, battle: Object.keys(G.save.state.flags).filter((k) => k.startsWith('battle:')).map((k) => k + '=' + G.save.state.flags[k]) }))));
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no errors');
await browser.close();
