// 이어 하기 검사(QA-001 재발 방지): 중간에 새로고침해도 보상을 두 번 받지 않는지
//  1) 5장 수련을 한 번 마친 뒤 새로고침 → 이어 하기 → 수련 2/3부터, 능력치는 그대로
//  2) 1장 가문 내력을 고른 뒤(보상 받음) 대답을 읽는 도중 새로고침 → 이어 하기 → 다시 고르면 앞의 보상은 되돌려짐
//   node resume.mjs
import { chromium } from 'playwright';
import { base } from './serve.mjs';
const BASE = await base();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const fail = (m) => errors.push(m);
const sum = (a) => a.mu + a.byeong + a.sul;
const st = () => page.evaluate(() => JSON.parse(JSON.stringify(G.save.state)));
const goalText = () => page.evaluate(() => (G.world.goal() || {}).text || '');
async function setup(fn) {
  await page.goto(BASE);
  await page.evaluate(fn);
  await page.goto(BASE);
}
async function resume() {
  await page.locator('button', { hasText: '이어 하기' }).click();
  await page.locator('.dlg-tray button.primary').click(); // 이어서
}
async function nextUntilClosed() {
  for (let i = 0; i < 30 && (await page.locator('.dlg').count()); i++) {
    const b = page.locator('.dlg-tray button.primary').filter({ visible: true });
    if (await b.count()) await b.last().click(); else await page.waitForTimeout(150);
    await page.waitForTimeout(120);
  }
}
// 대화창이 뜨면 넘기면서 맵 목표가 나올 때까지 기다린다(맵을 옮기는 동안에는 대화창이 늦게 뜬다)
async function waitGoal() {
  for (let i = 0; i < 150; i++) {
    const s = await page.evaluate(() => ({ dlg: !!document.querySelector('.dlg'), goal: !!(window.G && G.world.goal()) }));
    if (!s.dlg && s.goal) return;
    if (s.dlg) { const b = page.locator('.dlg-tray button.primary').filter({ visible: true }); if (await b.count()) await b.last().click(); }
    await page.waitForTimeout(150);
  }
  throw new Error('목표가 나오지 않음');
}

// 1) 수련
await setup(() => {
  localStorage.clear();
  const s = G.save.fresh();
  Object.assign(s, { path: 'm', surname: '홍', given: '대웅', look: 'youth', abil: { mu: 1, byeong: 1, sul: 1 } });
  for (const c of STORY.slice(0, 5)) { s.chDone[c.id] = true; for (const x of c.steps) s.done[x.id] = true; for (const b of QUESTS[c.id].beats) s.done['b:' + b.id] = true; }
  for (const id of ['c5-1', 'c5-6', 'b:b5-1', 'b:b5-2', 'b:b5-3']) s.done[id] = true;
  localStorage.setItem('hero-road-v1', JSON.stringify(s));
});
await resume();
await waitGoal(); // 스승의 첫말을 넘기고
if (!(await goalText()).includes('1/3')) fail('수련 첫 목표가 1/3이 아님: ' + (await goalText()));
await page.evaluate(() => G.world.test.complete());
await nextUntilClosed();
await waitGoal();
const a1 = (await st()).abil;
if (sum(a1) !== 4) fail('수련 1회 뒤 능력치 합이 4가 아님: ' + JSON.stringify(a1));
if (!(await goalText()).includes('2/3')) fail('수련 1회 뒤 목표가 2/3이 아님');
await page.reload();
await resume();
await page.waitForTimeout(900);
if (await page.locator('.dlg .say').count()) fail('이어 하기에서 스승의 첫말이 다시 나옴');
await waitGoal();
const g2 = await goalText();
const a2 = (await st()).abil;
if (!g2.includes('2/3')) fail('이어 하기 뒤 수련이 2/3부터가 아님: ' + g2);
if (sum(a2) !== 4) fail('이어 하기 뒤 능력치가 바뀜: ' + JSON.stringify(a2));
for (let r = 0; r < 2; r++) { await page.evaluate(() => G.world.test.complete()); await nextUntilClosed(); await page.waitForTimeout(200); }
const s3 = await st();
if (sum(s3.abil) !== 6) fail('수련 세 번 뒤 능력치 합이 6이 아님: ' + JSON.stringify(s3.abil));
if (!s3.flags.train || s3.flags.train.length !== 3) fail('수련 기록이 3개가 아님: ' + JSON.stringify(s3.flags.train));
if (s3.flags.trainProg) fail('수련 진행 기록이 남아 있음');
console.log('수련 이어 하기:', JSON.stringify({ first: a1, afterReload: a2, goal: g2, final: s3.abil, train: s3.flags.train }));

// 2) 선택 도중
await setup(() => {
  localStorage.clear();
  const s = G.save.fresh();
  Object.assign(s, { path: 'm', surname: '홍', given: '대웅', abil: { mu: 1, byeong: 1, sul: 1 } });
  s.chDone.ch0 = true; for (const x of STORY[0].steps) s.done[x.id] = true; for (const b of QUESTS.ch0.beats) s.done['b:' + b.id] = true;
  for (const id of ['c1-1', 'b:b1-1', 'b:b1-2']) s.done[id] = true;
  localStorage.setItem('hero-road-v1', JSON.stringify(s));
});
await resume();
await waitGoal();
await page.evaluate(() => G.world.test.complete()); // 사당
await page.waitForSelector('.dlg .opt:not([disabled])');
await page.locator('.dlg .opt').nth(0).click(); // 개국 공신: 武 +1
await page.waitForTimeout(500);
const b1 = (await st()).abil;
if (b1.mu !== 2) fail('첫 선택의 보상이 없음: ' + JSON.stringify(b1));
await page.reload(); // 대답을 읽는 도중
await resume();
await waitGoal();
await page.evaluate(() => G.world.test.complete());
await page.waitForSelector('.dlg .opt:not([disabled])');
const b2 = (await st()).abil;
if (b2.mu !== 1) fail('다시 고르기 전에 앞의 보상이 되돌려지지 않음: ' + JSON.stringify(b2));
await page.locator('.dlg .opt').nth(1).click(); // 재상: 兵 +1
await nextUntilClosed();
const b3 = await st();
if (b3.abil.mu !== 1 || b3.abil.byeong !== 2) fail('다시 고른 뒤 능력치가 맞지 않음: ' + JSON.stringify(b3.abil));
if (b3.flags['snap:c1-2']) fail('단계 보상 기록이 남아 있음');
console.log('선택 이어 하기:', JSON.stringify({ firstPick: b1, beforeRepick: b2, final: b3.abil, lineage: b3.flags.lineage }));

console.log(errors.length ? '실패:\n - ' + errors.join('\n - ') : '이어 하기 검사 통과');
await browser.close();
process.exit(errors.length ? 1 : 0);
