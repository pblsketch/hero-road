// 처음부터 끝까지 자동으로 플레이해 보는 E2E 테스트.
//   cd tests && npm install && node e2e.mjs [m|fa|fb|fc] [phone|desktop] [--real] [--deep] [--fixed]
//   --deep: 깊이 읽기 방식으로, --fixed: 선생님이 주소(?path=m|f)로 길을 정한 상태로 시작
// 게임 폴더는 테스트가 스스로 서빙한다(serve.mjs). 이미 설치된 크롬을 쓴다(브라우저를 따로 내려받지 않음).
//  - 탑뷰 맵: 목표는 시험용 손잡이(G.world.test.complete)로 이루되, 5장 허깨비 병사와는 키보드로 직접 싸운다.
//  - 선생님용을 켜고 진행하되, 5장 대련은 카드를 직접 눌러 싸운다(--real이면 모든 전투를 직접).
//  - 장 끝 물음·낯선 대목은 한 번 일부러 틀린 뒤 맞힌다.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { base } from './serve.mjs';

const BASE = await base();
const route = process.argv[2] || 'm';
const size = process.argv[3] || 'phone';
const REAL = process.argv.includes('--real');
const DEEP = process.argv.includes('--deep');
const FIXED = process.argv.includes('--fixed');
const SIZE = { phone: { width: 390, height: 844, isMobile: true, hasTouch: true }, desktop: { width: 1366, height: 860 } };
const OUT = new URL(`./shots/${route}-${size}${DEEP ? '-deep' : ''}${FIXED ? '-fixed' : ''}/`, import.meta.url);
fs.rmSync(fileURLToPath(OUT), { recursive: true, force: true });
fs.mkdirSync(fileURLToPath(OUT), { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const vp = SIZE[size];
const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
// 곡을 바꾸면 받던 배경음 파일을 끊는다(ERR_ABORTED) — 이건 오류가 아니다
page.on('requestfailed', (r) => { if (/\/assets\/bgm\//.test(r.url()) && /ABORTED/.test((r.failure() || {}).errorText || '')) return; errors.push('requestfailed: ' + r.url() + ' ' + ((r.failure() || {}).errorText || '')); });
page.on('response', (r) => { if (r.status() >= 400) errors.push('http ' + r.status() + ': ' + r.url()); });

let n = 0;
const shot = async (name) => { n++; await page.screenshot({ path: fileURLToPath(new URL(String(n).padStart(3, '0') + '_' + name + '.png', OUT)) }); };
const vis = (sel) => page.locator(sel).filter({ visible: true });

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.goto(BASE + '?teacher=1' + (FIXED ? '&path=' + (route === 'm' ? 'm' : 'f') : ''));
await page.waitForSelector('.title-screen');
await page.waitForTimeout(400);
await shot('title');
await vis('button:has-text("이야기 시작")').first().click();
await page.waitForSelector('.sheet');
await vis('.sheet button:has-text("' + (DEEP ? '깊이 읽기' : '처음 배우기') + '")').click();

const seen = new Set();
let battlesFought = 0, quizWrong = 0, lastSig = '', still = 0, actionFights = 0, bossFights = 0;
const PRIMARY = '.dlg-tray button.primary, .tray button.primary';
// 맵 위 싸움: 가장 가까운 적에게 다가가 벤다
async function botFight() {
  for (let k = 0; k < 900; k++) {
    if (await vis('.sheet-back').count()) { await shot('heaven'); await vis('.sheet .actions button').last().click(); continue; }
    const s = await page.evaluate(() => G.world.test.state());
    if (!s.foes.length || s.busy) return;
    let best = s.foes[0], bd = 1e9;
    for (const f of s.foes) { const d = Math.hypot(f[0] - s.x, f[1] - s.y); if (d < bd) { bd = d; best = f; } }
    const dx = best[0] - s.x, dy = best[1] - s.y;
    const kx = dx < -6 ? 'ArrowLeft' : dx > 6 ? 'ArrowRight' : null, ky = dy < -6 ? 'ArrowUp' : dy > 6 ? 'ArrowDown' : null;
    const keys = bd > 26 ? [kx, ky].filter(Boolean) : [Math.abs(dx) > Math.abs(dy) ? kx : ky].filter(Boolean);
    for (const kk of keys) await page.keyboard.down(kk);
    await page.waitForTimeout(bd > 26 ? 110 : 25);
    for (const kk of keys) await page.keyboard.up(kk);
    if (bd < 44) await page.keyboard.press('Space');
    if (k % 6 === 5) await page.keyboard.press(['KeyQ', 'KeyR', 'KeyF'][(k / 6 | 0) % 3]);
  }
}
for (let guard = 0; guard < 4000; guard++) {
  await page.waitForTimeout(60);
  if (await page.locator('.bookcover').count()) break;
  // 화면이 오래 그대로면(진행이 멈춤) 오류를 보여 주고 끝낸다
  const sig = await page.evaluate(() => (document.querySelector('.main-inner') || document.body).innerText.length + ':' + Object.keys(G.save.state.done).length + ':' + document.querySelectorAll('.tray button, .dlg-tray button').length + ':' + JSON.stringify(G.world.test.state().goal) + ':' + G.world.test.state().enemies);
  if (sig === lastSig) { if (++still > 120) { await shot('STUCK'); console.log('STUCK', await page.evaluate(() => JSON.stringify(G.world.test.state()))); for (const e of errors) console.log(' -', e); process.exit(1); } } else { still = 0; lastSig = sig; }
  // 떠 있는 판(천우신조 등)
  if (await vis('.sheet-back').count()) { await shot('sheet'); await vis('.sheet .actions button').last().click(); continue; }
  // 맵을 걷는 중(대화창이 없음): 목표를 이룬다
  // 기술 익히기 화면: 익힐 수 있는 것을 모두 익힌다
  if (await vis('.dlg.tree').count()) {
    await shot('skill_tree');
    for (let k = 0; k < 5; k++) { const r = vis('.dlg.tree .sk.ready'); if (!(await r.count())) break; await r.first().click(); await page.waitForTimeout(150); }
    await vis('.dlg.tree .dlg-tray button.primary').click();
    continue;
  }
  const roam = await page.evaluate(() => !!document.querySelector('.world') && !document.querySelector('.dlg:not([style*="display: none"])') && !!G.world.goal());
  if (roam) {
    const ws = await page.evaluate(() => G.world.test.state());
    const key = 'map:' + ws.map + ':' + (ws.goal && ws.goal.text.replace(/ \(\d+\/\d+\)/, ''));
    const bossOn = await page.evaluate(() => !!document.querySelector('.bossbar.on'));
    if (!seen.has(key)) { seen.add(key); await page.waitForTimeout(350); await shot(ws.map + '_goal'); }
    if (ws.enemies && !ws.escaping && (REAL || actionFights === 0 || (bossOn && bossFights === 0))) { if (bossOn) bossFights++; await botFight(); await shot(ws.map + (bossOn ? '_boss' : '_fought')); actionFights++; continue; }
    if (bossOn) bossFights++;
    await page.evaluate(() => G.world.test.complete());
    await page.waitForTimeout(150);
    continue;
  }
  const state = await page.evaluate(() => {
    const m = document.querySelector('.main-inner');
    const where = ((document.querySelector('.goal small') || {}).textContent || '') + ((document.querySelector('.topbar .where strong') || {}).textContent || '');
    const st = G.save.state;
    const q = (s) => m && m.querySelector(s);
    let kind = 'other';
    if (q('.battle')) kind = document.querySelector('.hand') ? 'battle' : 'battle-wait';
    else if (q('.opt.big') && !q('.opt.big[disabled]')) kind = 'gender';
    else if (q('input.name-input.sur')) kind = 'name';
    else if (q('input[placeholder="남장 이름"]')) kind = 'alias';
    else if (q('.stage-grid') && q('.stage-btn:not([disabled])')) kind = 'passage';
    else if (q('.opt.passage:not([disabled])')) kind = 'quiz';
    else if (q('.slots')) kind = 'order';
    else if (q('.options .opt:not([disabled])')) kind = 'choice';
    const stepId = Object.keys(st.done).length;
    return { kind, where, path: st.path, branch: st.branch, stepId };
  });
  const key = state.where + ':' + state.kind;
  if (!seen.has(key)) { seen.add(key); await page.waitForTimeout(250); await shot(state.where.replace(/[\s「」:]/g, '') + '_' + state.kind); }

  if (state.kind === 'gender') { await vis('.opt.big').nth(route === 'm' ? 0 : 1).click(); continue; }
  if (state.kind === 'name') {
    await page.fill('input.name-input.sur', '홍'); await page.fill('input.name-input:not(.sur)', route === 'm' ? '대웅' : '소화');
    await vis(PRIMARY).click(); continue;
  }
  if (state.kind === 'alias') { await page.fill('input[placeholder="남장 이름"]', '평국'); await vis(PRIMARY).click(); continue; }
  if (state.kind === 'choice') {
    const texts = await vis('.options .opt:not([disabled]) .ot').allTextContents();
    let idx = 0;
    const i1 = texts.findIndex((t) => t.includes('남장을 한다')), i2 = texts.findIndex((t) => t.includes('남장하지 않는다'));
    if (i1 >= 0 && i2 >= 0) idx = route === 'fc' ? i2 : i1;
    const a = texts.findIndex((t) => t.includes('계속 활약한다')), b = texts.findIndex((t) => t.includes('규방으로 돌아간다'));
    if (a >= 0 && b >= 0) idx = route === 'fb' ? b : a;
    if (texts.some((t) => t.includes('강물에 들어가') || t.includes('엄하게 거절'))) idx = 1; // 의심을 올려 본다
    await vis('.options .opt:not([disabled])').nth(idx).click();
    continue;
  }
  if (state.kind === 'quiz') {
    // 한 번 일부러 틀리고 맞힌다
    const right = await page.evaluate(() => {
      const ch = STORY.find((c) => c.id === G.world.chId);
      const w = WORKS[G.app.mainWork(ch.stage)];
      return w.stages[ch.stage].t.replace(/\*\*/g, '');
    });
    const opts = vis('.opt.passage:not([disabled])');
    const cnt = await opts.count();
    for (let i = 0; i < cnt; i++) {
      const t = (await opts.nth(i).textContent()).trim();
      if (!t.startsWith(right.slice(0, 12)) && quizWrong < 2) { quizWrong++; await opts.nth(i).click(); await page.waitForTimeout(200); await shot('quiz_wrong'); break; }
    }
    const opts2 = vis('.opt.passage:not([disabled])');
    const c2 = await opts2.count();
    for (let i = 0; i < c2; i++) { const t = (await opts2.nth(i).textContent()).trim(); if (t.startsWith(right.slice(0, 12))) { await opts2.nth(i).click(); break; } }
    await page.waitForTimeout(300);
    continue;
  }
  if (state.kind === 'passage') {
    const stage = await page.evaluate(() => { const t = document.querySelector('.card.work p').textContent; return PASSAGES.find((p) => t.includes(p.t.replace(/\*\*/g, '').slice(0, 14))).stage; });
    await vis('.stage-btn').nth(stage - 1).click();
    await page.waitForTimeout(200);
    continue;
  }
  if (state.kind === 'order') {
    const fill = vis('button:has-text("정답 채우기(선생님용)")');
    if (await fill.count()) await fill.click();
    await page.waitForTimeout(200);
    const next = vis(PRIMARY);
    if (await next.count()) await next.click();
    continue;
  }
  if (state.kind === 'battle') {
    const fight = REAL || battlesFought === 0;
    if (fight) {
      // 카드를 차례로 누른다(신물 카드가 있으면 적이 기를 모을 때 쓴다)
      const intent = await page.locator('.intent').first().getAttribute('class');
      const cards = vis('.hand .bcard');
      const cnt = await cards.count();
      let pick = 0;
      if (/charge|heavy|hex/.test(intent)) {
        const names = await cards.allTextContents();
        const k = names.findIndex((t) => t.includes('계책') || t.includes('천서') || t.includes('진법') || t.includes('둔갑') || t.includes('신갑'));
        if (k >= 0) pick = k;
      }
      if (pick >= cnt) pick = 0;
      await cards.nth(pick).click();
      await page.waitForTimeout(1200);
      const done = await page.evaluate(() => !document.querySelector('.hand'));
      if (done && !(await vis('.sheet-back').count())) { battlesFought++; await shot('battle_end'); }
      continue;
    }
    await shot('battle_' + battlesFought);
    await vis('button:has-text("바로 이기기(선생님용)")').click();
    battlesFought++;
    await page.waitForTimeout(900);
    continue;
  }
  // 그 밖: 트레이의 주 단추
  const b = vis(PRIMARY);
  if (await b.count()) { await b.first().click(); continue; }
  await page.waitForTimeout(300);
}
await page.waitForTimeout(700);
await shot('result_top');
await page.fill('input.name-input.wide', '2-3 12 김지은');
for (const ta of await page.locator('textarea.reflect').all()) await ta.fill('가문을 되살리는 일');
await page.locator('.bookcover').scrollIntoViewIfNeeded();
await shot('result_cover');
await page.locator('.branchmap').scrollIntoViewIfNeeded();
await shot('result_branch');
// 이미지 저장
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.locator('button:has-text("이미지로 저장")').click()]);
if (dl) { await dl.saveAs(fileURLToPath(new URL('result.png', OUT))); } else errors.push('이미지 저장이 안 됨');
// 편람
await page.locator('button[aria-label="편람"]').click();
for (const tab of ['일대기 7단계', '작품 도감', '관습 사전', '헷갈리기 쉬운 것', '실제와 설정', '모든 갈래']) {
  const t = page.locator('.overlay .tab', { hasText: tab });
  if (await t.count()) { await t.click(); await page.waitForTimeout(250); await shot('book_' + tab.replace(/\s/g, '')); }
}
const st = await page.evaluate(() => G.save.state);
console.log(JSON.stringify({ route, path: st.path, branch: st.branch, abil: st.abil, doubtMax: st.doubtMax, heaven: st.heaven, score: st.score, my: Object.keys(st.myStage).length, works: Object.keys(st.works) }));
console.log('SHOTS', n, 'BOSSES', bossFights, 'ACTION', actionFights, 'SKILLS', JSON.stringify(st.skills), 'ERRORS', errors.length);
for (const e of errors) console.log(' -', e);
await browser.close();
process.exit(errors.length ? 1 : 0);
