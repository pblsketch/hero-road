// 소리 점검: 곡 악보·음량·클리핑, 장면마다 곡이 바뀌는지, 배경음·효과음 켜고 끄기.
//   cd tests && node audio.mjs [--preview]
// --preview: 곡마다 20초 미리 듣기 파일(design/audio_preview/*.wav, ffmpeg가 있으면 .mp3도)을 만든다.
// 게임 폴더는 테스트가 스스로 서빙한다(serve.mjs).
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { base } from './serve.mjs';
const BASE = await base();
const PREVIEW = process.argv.includes('--preview');
const problems = [];
const bad = (m) => { problems.push(m); console.log('  ✗ ' + m); };

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const warns = [];
let expect404 = false; // 없는 파일 시험 중에는 404가 나는 게 맞다
page.on('console', (m) => { if (expect404 && m.text().includes('404')) return; if (m.type() === 'error' || (m.type() === 'warning' && m.text().includes('악보'))) warns.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => warns.push('pageerror: ' + e.message));

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.goto(BASE);
await page.waitForSelector('.title-screen');

// 1) 데이터: STORY의 music이 모두 곡 목록에 있는지
const names = await page.evaluate(() => {
  const used = new Set();
  for (const c of STORY) { if (c.music) used.add(c.music); for (const s of c.steps) if (s.music) used.add(s.music); }
  return { used: [...used], tracks: Object.keys(G.audio.TRACKS), chNoMusic: STORY.filter((c) => !c.music).map((c) => c.id) };
});
console.log('곡:', names.tracks.join(', '));
for (const u of names.used) if (!names.tracks.includes(u)) bad('없는 곡 이름: ' + u);
for (const c of names.chNoMusic) bad('곡이 없는 장: ' + c);
for (const t of names.tracks) if (!names.used.includes(t) && !['market', 'battle', 'final', 'tension', 'victory'].includes(t)) bad('쓰지 않는 곡: ' + t);

// 1-2) 배경음 파일: bgm.js의 곡이 모두 TRACKS에 있고 파일이 실제로 있는지
const files = await page.evaluate(async () => {
  const out = [];
  for (const [name, t] of Object.entries(window.BGM ? BGM.tracks : {})) {
    const r = await fetch(t.src, { method: 'HEAD' }).catch(() => null);
    out.push({ name, ok: !!(r && r.ok), inSynth: !!G.audio.TRACKS[name] });
  }
  return out;
});
console.log('배경음 파일:', files.map((f) => f.name).join(', '));
if (!files.length) bad('배경음 파일 목록(BGM)이 없음');
for (const f of files) { if (!f.ok) bad('배경음 파일이 없음: ' + f.name); if (!f.inSynth) bad('합성음 대신할 곡이 없음: ' + f.name); }
for (const t of names.tracks) if (!files.find((f) => f.name === t)) bad('파일이 없는 곡: ' + t);

// 2) 곡마다 오프라인 렌더 → 음량(RMS)·최고치·마디 길이
const report = await page.evaluate(async (preview) => {
  const out = [];
  for (const name of Object.keys(G.audio.TRACKS)) {
    const def = G.audio.TRACKS[name];
    const L = G.audio._parse(def.lead.mel, def.mode, def.tonic);
    const buf = await G.audio.render(name, 20, 44100);
    let peak = 0, sum = 0, n = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += d[i] * d[i]; n++; }
    }
    const row = { name, bars: L.len / def.bar, loopSec: +(L.len * def.unit).toFixed(1), peak: +peak.toFixed(3), rmsDb: +(10 * Math.log10(sum / n)).toFixed(1) };
    if (preview) {
      // 22.05kHz 모노 16비트 WAV로 줄여 base64로 넘긴다
      const L0 = buf.getChannelData(0), R0 = buf.getChannelData(1), step = 2, len = Math.floor(L0.length / step);
      const ab = new ArrayBuffer(44 + len * 2), dv = new DataView(ab);
      const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
      w(0, 'RIFF'); dv.setUint32(4, 36 + len * 2, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
      dv.setUint32(24, 22050, true); dv.setUint32(28, 44100, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, len * 2, true);
      for (let i = 0; i < len; i++) { const v = Math.max(-1, Math.min(1, (L0[i * step] + R0[i * step]) / 2)); dv.setInt16(44 + i * 2, v * 32767, true); }
      let bin = ''; const u8 = new Uint8Array(ab);
      for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      row.wav = btoa(bin);
    }
    out.push(row);
  }
  return out;
}, PREVIEW);

console.log('\n곡          마디  한바퀴(초)  최고치   RMS(dB)');
for (const r of report) {
  console.log(`${r.name.padEnd(10)} ${String(r.bars).padStart(5)} ${String(r.loopSec).padStart(10)} ${String(r.peak).padStart(8)} ${String(r.rmsDb).padStart(9)}`);
  if (!Number.isInteger(r.bars)) bad(`${r.name}: 마디 수가 딱 떨어지지 않음(${r.bars})`);
  if (r.peak >= 0.99) bad(`${r.name}: 소리가 찢어질 수 있음(최고치 ${r.peak})`);
  if (r.rmsDb < -40) bad(`${r.name}: 너무 작음(${r.rmsDb} dB)`);
  if (r.rmsDb > -14) bad(`${r.name}: 너무 큼(${r.rmsDb} dB)`);
}
const dbs = report.map((r) => r.rmsDb);
if (Math.max(...dbs) - Math.min(...dbs) > 4) bad(`곡 사이 음량 차이가 큼(${Math.min(...dbs)} ~ ${Math.max(...dbs)} dB)`);

if (PREVIEW) {
  const dir = new URL('../design/audio_preview/', import.meta.url);
  fs.mkdirSync(fileURLToPath(dir), { recursive: true });
  let ff = null;
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); ff = 'ffmpeg'; } catch (e) { /* ffmpeg 없음 */ }
  for (const r of report) {
    const wav = fileURLToPath(new URL(r.name + '.wav', dir));
    fs.writeFileSync(wav, Buffer.from(r.wav, 'base64'));
    if (ff) { execFileSync(ff, ['-y', '-loglevel', 'error', '-i', wav, '-b:a', '96k', wav.replace(/\.wav$/, '.mp3')]); fs.unlinkSync(wav); }
  }
  console.log('\n미리 듣기 파일:', fileURLToPath(dir), ff ? '(mp3)' : '(wav)');
}

// 3) 실제 재생: 첫 터치 → 세책방 곡, 장에 들어가면 장의 곡, 단계의 곡, 배경음 끄기
const now = () => page.evaluate(() => ({ track: G.audio.track, playing: G.audio.now(), state: G.audio.ctx && G.audio.ctx.state }));
await page.locator('.music-toggle').waitFor();
await page.mouse.click(10, 400); // 첫 터치(소리 풀기)
await page.waitForTimeout(400);
let s = await now();
console.log('\n타이틀:', JSON.stringify(s));
if (s.playing !== 'market') bad('타이틀에서 이야기판 곡이 나오지 않음: ' + JSON.stringify(s));
if (s.state !== 'running') bad('소리 장치가 켜지지 않음: ' + s.state);
// 파일 배경음이 실제로 흐르는지(시간이 가는지)
const f1 = await page.evaluate(() => G.audio.nowFile());
await page.waitForTimeout(1200);
const f2 = await page.evaluate(() => G.audio.nowFile());
console.log('파일 재생:', JSON.stringify(f2));
if (!f2 || !/market\.mp3$/.test(f2.src)) bad('타이틀에서 이야기판 파일이 나오지 않음: ' + JSON.stringify(f2));
else if (f2.paused || !(f2.t > (f1 ? f1.t : 0))) bad('배경음 파일이 멈춰 있음: ' + JSON.stringify(f2));
if (f2 && !f2.graph) bad('웹에서 배경음 파일이 음량 길(WebAudio)로 이어지지 않음');

await page.locator('.music-toggle').click();
await page.waitForTimeout(300);
s = await now();
if (s.playing !== null) bad('타이틀 배경음 끄기가 안 됨: ' + JSON.stringify(s));
if (await page.evaluate(() => G.save.state.music) !== false) bad('배경음 끄기가 저장되지 않음');
await page.locator('.music-toggle').click();
await page.waitForTimeout(300);
if ((await now()).playing !== 'market') bad('타이틀 배경음 다시 켜기가 안 됨');

for (const [ch, want] of [['ch0', 'market'], ['ch3', 'child'], ['ch7', 'final']]) {
  await page.evaluate((id) => { const st = G.save.state; st.teacher = true; st.path = 'm'; st.surname = '홍'; st.given = '대웅'; G.app.play(id); }, ch);
  await page.waitForTimeout(500);
  s = await now();
  console.log(ch + ':', JSON.stringify(s));
  if (s.playing !== want) bad(`${ch}에서 ${want} 곡이 나오지 않음: ${s.playing}`);
  const fl = await page.evaluate(() => G.audio.nowFile());
  if (!fl || !fl.src.endsWith(want + '.mp3')) bad(`${ch}에서 ${want} 파일이 나오지 않음: ${JSON.stringify(fl)}`);
}
// 단계의 곡: 4장 집이 불타는 대목(c4-3)까지 넘겨 본다
await page.evaluate(() => { const st = G.save.state; for (const id of ['c4-1', 'c4-2', 'b:b4-1', 'b:b4-2']) st.done[id] = true; G.save.write(); G.app.play('ch4'); });
await page.waitForTimeout(400);
await page.locator('button', { hasText: '이어서' }).first().click();
await page.waitForTimeout(600);
s = await now();
console.log('ch4 c4-3:', JSON.stringify(s));
if (s.playing !== 'ruin') bad('가문 몰락 장면에서 몰락 곡이 나오지 않음: ' + s.playing);

// 파일을 못 읽으면 합성음으로 바뀌는지
expect404 = true;
await page.evaluate(() => { BGM.tracks.boudoir = { src: 'assets/bgm/없는파일.mp3' }; G.audio.play('boudoir'); });
await page.waitForTimeout(1500);
expect404 = false;
s = await now();
const fb = await page.evaluate(() => G.audio.nowFile());
console.log('없는 파일:', JSON.stringify(s), JSON.stringify(fb));
if (s.playing !== 'boudoir' || fb) bad('없는 배경음 파일에서 합성음으로 바뀌지 않음: ' + JSON.stringify({ s, fb }));

// 결과 화면
await page.evaluate(() => { G.app.result(); }); // Promise를 돌려주면 학생 입력을 끝까지 기다리므로 버린다
await page.waitForTimeout(500);
if ((await now()).playing !== 'victory') bad('결과 화면에서 승리 곡이 나오지 않음');

// 효과음이 오류 없이 나는지
const sfxErr = await page.evaluate(() => { const e = []; for (const k of ['tap', 'pick', 'page', 'stamp', 'ok', 'no', 'chapter', 'fanfare', 'slash', 'guard', 'magic', 'heal', 'hurt', 'grow', 'doubt', 'heaven', 'win']) { try { G.audio[k](); } catch (x) { e.push(k + ': ' + x.message); } } return e; });
sfxErr.forEach(bad);
// 설정에서 배경음 끄기
await page.evaluate(() => { G.save.state.music = false; G.audio.music(false); });
await page.waitForTimeout(300);
if ((await now()).playing !== null) bad('설정에서 배경음을 꺼도 곡이 계속됨');
await page.waitForTimeout(1800);
const left = await page.evaluate(() => [...document.querySelectorAll('audio')].length + ':' + (G.audio.nowFile() ? 'on' : 'off'));
if (!left.endsWith('off')) bad('배경음을 꺼도 파일이 계속됨: ' + left);

warns.forEach((w) => bad(w));
await browser.close();
console.log(problems.length ? `\n문제 ${problems.length}개` : '\n문제 0개');
process.exit(problems.length ? 1 : 0);
