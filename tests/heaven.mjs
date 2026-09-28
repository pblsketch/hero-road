// 천우신조 확인(게임 오버 없음)
//  1) 맵 위 잡병 싸움에서 기력이 다하면 천우신조 창이 뜨고 기력이 다시 차는지
//  2) 7장 적장 철목달과의 결전(맵 위 실시간)에서 기력이 다하면 천우신조로 이어지고 싸움이 계속되는지
//   node heaven.mjs
import { chromium } from 'playwright';
import { base } from './serve.mjs';
const BASE = await base();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
async function setup(extraDone) {
  await page.goto(BASE);
  await page.evaluate((extra) => {
    localStorage.clear();
    const s = G.save.fresh();
    Object.assign(s, { path: 'm', surname: '홍', given: '대웅', look: 'general', abil: { mu: 1, byeong: 1, sul: 1 }, relic: 'sword' });
    for (const c of STORY) if (c.id !== 'ch7') { s.chDone[c.id] = true; for (const st of c.steps) s.done[st.id] = true; }
    for (const id of ['c7-1', 'b:b7-1', ...extra]) s.done[id] = true;
    localStorage.setItem('hero-road-v1', JSON.stringify(s));
  }, extraDone);
  await page.goto(BASE + '?ch=ch7');
  await page.locator('.dlg-tray button.primary').click(); // 이어서
}

// 1) 잡병 싸움
await setup([]);
await page.waitForFunction(() => G.world.test.state().enemies > 0);
await page.evaluate(() => G.world.test.hurt(99));
await page.waitForSelector('.sheet-back');
const t1 = await page.locator('.sheet').textContent();
const actionHeaven = t1.includes('천우신조');
await page.screenshot({ path: 'shots/heaven_action.png' });
await page.locator('.sheet .actions button').last().click();
await page.waitForTimeout(300);
const hp = await page.evaluate(() => G.world.test.state());
if (!actionHeaven) errors.push('잡병 싸움에서 천우신조 창이 뜨지 않음');
if (!(hp.hp > 0)) errors.push('천우신조 뒤 기력이 차지 않음: ' + hp.hp);

// 2) 적장전
await setup(['b:b7-2']);
await page.waitForFunction(() => G.world.goal());
await page.evaluate(() => G.world.test.complete()); // 철목달에게 말 걸기
for (let i = 0; i < 20 && !(await page.locator('.bossbar.on').count()); i++) {
  const b = page.locator('.dlg-tray button.primary').filter({ visible: true });
  if (await b.count()) await b.first().click();
  await page.waitForTimeout(200);
}
let sawHeaven = 0;
await page.waitForTimeout(1500);
await page.evaluate(() => G.world.test.hurt(99));
await page.waitForSelector('.sheet-back');
if ((await page.locator('.sheet').textContent()).includes('천우신조')) { sawHeaven++; await page.screenshot({ path: 'shots/heaven.png' }); }
await page.locator('.sheet .actions button').last().click();
await page.waitForTimeout(500);
const after2 = await page.evaluate(() => ({ s: G.world.test.state(), boss: !!document.querySelector('.bossbar.on') }));
if (!after2.boss || !(after2.s.hp > 0)) errors.push('천우신조 뒤 적장전이 이어지지 않음: ' + JSON.stringify(after2));
await page.screenshot({ path: 'shots/heaven_end.png' });
const st = await page.evaluate(() => G.save.state.heaven);
console.log('잡병 싸움 천우신조', actionHeaven ? '뜸' : '안 뜸', '· 적장전 천우신조 창', sawHeaven, '번 · 저장된 횟수', st, errors.length ? '오류: ' + errors.join(' / ') : '오류 없음');
await browser.close();
process.exit(sawHeaven > 0 && actionHeaven && !errors.length ? 0 : 1);
