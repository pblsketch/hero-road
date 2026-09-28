// index.html을 파일로 바로 열어도(서버 없이) 타이틀과 서장이 뜨는지 본다: node file.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const url = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html')).href;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.waitForSelector('.title-screen');
// 파일로 열어도 배경음 파일이 흐르는지(요소 음량으로 조절)
await page.mouse.click(10, 400);
await page.waitForTimeout(1500);
const bgm = await page.evaluate(() => G.audio.nowFile());
if (!bgm || bgm.paused || !(bgm.t > 0.3) || bgm.graph) errors.push('file://에서 배경음 파일이 나오지 않음: ' + JSON.stringify(bgm));
await page.locator('button', { hasText: '이야기 시작' }).click();
await page.locator('.sheet button', { hasText: '처음 배우기' }).click();
await page.locator('.dlg-tray button.primary').click(); // 펼치기
await page.waitForSelector('canvas.wcv');
await page.waitForFunction(() => G.world.goal());
await page.evaluate(() => G.world.test.complete()); // 전기수에게 말 걸기
await page.waitForSelector('.dlg .say');
const drawn = await page.evaluate(() => { const c = document.querySelector('canvas.wcv'); return c.width > 0 && Object.keys(SPRITES).length > 30; });
if (!drawn) errors.push('맵이 그려지지 않음');
await page.screenshot({ path: 'shots/file_open.png' });
const saved = await page.evaluate(() => { G.save.write(); return !!localStorage.getItem('hero-road-v1'); });
console.log('배경음:', JSON.stringify(bgm));
console.log('file:// 열기', errors.length ? '오류: ' + errors.join(' / ') : '오류 없음', '· 저장', saved ? '됨' : '안 됨');
await browser.close();
process.exit(errors.length ? 1 : 0);
