// 데이터 점검(브라우저 없이): node content.mjs
//  - 단계 id 중복, 알려진 단계 종류, 관습·게임 설정·작품·적·인물 참조가 있는지
//  - 이름 자리({…})가 알려진 것인지, 조사 표시가 맞는지
//  - 갈래마다 7장까지 끝까지 갈 수 있는지(나의 일대기 7칸이 모두 채워지는지)
//  - 에셋 파일이 있는지, 괄호·따옴표 짝
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['people', 'works', 'story', 'battle', 'notes', 'sprites', 'maps', 'quests', 'skills', 'bosses']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/data', f + '.js'), 'utf8'), sandbox, { filename: f + '.js' });
}
const { STORY, PEOPLE, WORKS, STAGES, PASSAGES, BATTLE, NOTES, SPRITES, MAPS, QUESTS, SKILLS, BOSSES } = sandbox;
const problems = [];
const bad = (m) => problems.push(m);

const TYPES = new Set(['say', 'choice', 'name', 'gender', 'alias', 'blocked', 'train', 'relic', 'battle']);
const NAMES = new Set(['성명', '이름', '성', '호', '공명', '부', '아이', '전', '남장명']);
const JOSA = new Set(['이', '가', '은', '는', '을', '를', '과', '와', '으로', '로', '아', '야', '이여', '여', '이라', '라']);
const MUSIC = new Set(['market', 'court', 'heaven', 'child', 'scheme', 'ruin', 'mountain', 'palace', 'tension', 'battle', 'final', 'victory', 'boudoir']);
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
// 장면 이름은 문자열이거나 { m, f, c } 객체(길마다 다른 그림)
const scenes = (x) => (x == null ? [] : typeof x === 'string' ? [x] : Object.values(x).filter(Boolean));
const sceneMissing = (x) => scenes(x).filter((n) => !exists(`assets/sc/${n}.webp`));

function checkText(where, s) {
  if (typeof s !== 'string') return;
  for (const m of s.matchAll(/\{([^}]*)\}/g)) {
    const [k, j] = m[1].split(':');
    if (!NAMES.has(k)) bad(`${where}: 알 수 없는 이름 자리 {${m[1]}}`);
    if (j && !JOSA.has(j)) bad(`${where}: 알 수 없는 조사 {${m[1]}}`);
  }
  const pairs = [['(', ')'], ['「', '」'], ['『', '』'], ['**', '**']];
  for (const [a, b] of pairs) {
    if (a === b) { if ((s.split(a).length - 1) % 2) bad(`${where}: ${a} 짝이 맞지 않음: ${s.slice(0, 40)}`); }
    else if (s.split(a).length !== s.split(b).length) bad(`${where}: ${a}${b} 짝이 맞지 않음: ${s.slice(0, 40)}`);
  }
  if (/\s{2,}/.test(s.replace(/\n/g, ''))) bad(`${where}: 빈칸이 두 번: ${s.slice(0, 40)}`);
  if (/[가-힣]\{(이름|성명|호|공명|남장명)(?::|\})/.test(s)) bad(`${where}: 이름 자리 앞에 글자가 붙음: ${s.slice(0, 40)}`);
  // 이름은 받침이 있을 수도 없을 수도 있으므로 조사는 {이름:을}처럼 써야 한다
  const m = /\{(성명|이름|호|공명|남장명)\}(이|가|은|는|을|를|과|와|으로|로|아|야)(?=[\s,.!?…"'」]|$)/.exec(s);
  if (m) bad(`${where}: 조사를 이름 자리 안에 써야 함 {${m[1]}:${m[2]}}: ${s.slice(0, 40)}`);
}
function checkLine(where, l) {
  if (typeof l === 'string') return checkText(where, l);
  if (l.t) checkText(where, l.t);
  if (l.who && !PEOPLE[l.who]) bad(`${where}: 없는 인물 ${l.who}`);
  if (l.conv && !NOTES.conv[l.conv]) bad(`${where}: 없는 관습 ${l.conv}`);
  if (l.fiction && !NOTES.fiction[l.fiction]) bad(`${where}: 없는 게임 설정 카드 ${l.fiction}`);
  if (l.seal && !WORKS[l.seal]) bad(`${where}: 없는 작품 ${l.seal}`);
  for (const n of sceneMissing(l.scene)) bad(`${where}: 그림 없음 ${n}`);
  if (l.card) { checkText(where, l.card.title); checkText(where, l.card.body); }
}

// 단계 점검
const ids = new Set();
for (const ch of STORY) {
  if (!MUSIC.has(ch.music)) bad(`${ch.id}: 없는 곡 ${ch.music}`);
  for (const n of sceneMissing(ch.scene)) bad(`${ch.id}: 그림 없음 ${n}`);
  for (const s of ch.steps) {
    const w = `${ch.id}/${s.id}`;
    if (ids.has(s.id)) bad(`${w}: id 중복`); ids.add(s.id);
    if (!TYPES.has(s.type)) bad(`${w}: 모르는 단계 종류 ${s.type}`);
    if (s.music && !MUSIC.has(s.music)) bad(`${w}: 없는 곡 ${s.music}`);
    for (const n of [...sceneMissing(s.scene), ...sceneMissing(s.bg)]) bad(`${w}: 그림 없음 ${n}`);
    checkText(w, s.q); checkText(w, s.hint);
    for (const k of ['lines', 'pre', 'after', 'end']) for (const l of s[k] || []) checkLine(w, l);
    for (const o of s.options || []) { checkText(w, o.t); for (const l of o.reply || []) checkLine(w, l); for (const k in o.abil || {}) if (!['mu', 'byeong', 'sul'].includes(k)) bad(`${w}: 능력치 이름 ${k}`); }
    for (const o of s.tries || []) { checkText(w, o.t); checkText(w, o.reply); }
    if (s.type === 'battle' && !BATTLE.enemies[s.enemy]) bad(`${w}: 없는 적 ${s.enemy}`);
    if (s.type === 'train') for (const k in s.opts) for (const l of s.opts[k].reply) checkLine(w, l);
    if (s.fiction && !NOTES.fiction[s.fiction]) bad(`${w}: 없는 게임 설정 카드 ${s.fiction}`);
  }
}
// 작품·낯선 대목
for (const id in WORKS) {
  const W = WORKS[id];
  for (const n in W.stages) if (W.stages[n]) checkText(`작품 ${id} ${n}`, W.stages[n].t);
}
for (const p of PASSAGES) {
  if (!WORKS[p.work]) bad(`대목 ${p.id}: 없는 작품 ${p.work}`);
  if (!(p.stage >= 1 && p.stage <= 7)) bad(`대목 ${p.id}: 단계 번호`);
  if (p.group === 'f' && p.stage === 7) bad(`대목 ${p.id}: 딸의 길에는 7단계 대목을 싣지 않음`);
  checkText(`대목 ${p.id}`, p.t);
}
for (const g of ['m', 'f']) {
  const n = PASSAGES.filter((p) => p.group === g).length;
  if (n < 3) bad(`${g} 길의 낯선 대목이 ${n}개뿐(결과 화면에 3개 필요)`);
}
for (const b of [...NOTES.branchInfo.m, ...NOTES.branchInfo.f]) if (!WORKS[b.work]) bad(`갈래 ${b.id}: 없는 작품 ${b.work}`);
for (const k in BATTLE.enemies) { const E = BATTLE.enemies[k]; if (!exists(`assets/pt/${E.pt}.webp`)) bad(`적 ${k}: 초상 없음 ${E.pt}`); if (E.bg && !exists(`assets/sc/${E.bg}.webp`)) bad(`적 ${k}: 배경 없음 ${E.bg}`); checkText(`적 ${k}`, E.heaven); }
for (const id in PEOPLE) if (PEOPLE[id].pt && !exists(`assets/pt/${PEOPLE[id].pt}.webp`)) bad(`인물 ${id}: 초상 없음`);
for (const f of ['pt_m_child', 'pt_m_scholar', 'pt_m_hero', 'pt_f_child', 'pt_f_scholar', 'pt_f_general', 'pt_f_lady', 'pt_f_sage']) if (!exists(`assets/pt/${f}.webp`)) bad(`주인공 초상 없음 ${f}`);
for (const k in NOTES.conv) { checkText(`관습 ${k}`, NOTES.conv[k].body); }

// 갈래마다 끝까지 따라가 보기(조건만 흉내 낸다)
function walk(path, disguise, branch7) {
  const st = { path, branch: null, disguised: false, revealed: false, doubtMax: 50, mode: 'basic', flags: {}, myStage: {} };
  const ok = (when) => {
    if (!when) return true;
    if (when.path && st.path !== when.path) return false;
    if (when.branch && ![].concat(when.branch).includes(st.branch)) return false;
    if (when.notBranch && st.branch === when.notBranch) return false;
    if (when.disguised != null && !!st.disguised !== when.disguised) return false;
    if (when.revealed != null && !!st.revealed !== when.revealed) return false;
    return true;
  };
  const apply = (fx) => { if (!fx) return; if (fx.set) Object.assign(st, fx.set); if (fx.my) Object.assign(st.myStage, fx.my); };
  const run = [];
  for (const ch of STORY) for (const s of ch.steps) {
    if (!ok(s.when)) continue;
    run.push(s.id);
    const lines = [...(s.lines || []), ...(s.after || []), ...(s.end || [])].filter((l) => typeof l !== 'string' && ok(l.when));
    if (s.type === 'choice') {
      const opts = s.options.filter((o) => ok(o.when));
      let o = opts[0];
      if (s.id === 'c5-3') o = opts[disguise ? 0 : 1];
      if (s.id === 'c7-7') o = opts[branch7 === 'a' ? 0 : 1];
      apply(o);
      if (s.my) st.myStage[s.my.stage] = s.my.text;
    }
    if (s.type === 'blocked' && s.my) apply({ my: s.my });
    for (const l of lines) apply(l.fx);
  }
  const label = path === 'm' ? '아들의 길' : `딸의 길 ${st.branch}`;
  for (let n = 1; n <= 7; n++) if (!st.myStage[n]) bad(`${label}: 나의 일대기 ${n}단계가 비어 있음`);
  if (path === 'f' && !st.branch) bad(`${label}: 갈래가 정해지지 않음`);
  return { label, steps: run.length };
}
const walks = [walk('m'), walk('f', true, 'a'), walk('f', true, 'b'), walk('f', false)];
for (const w of walks) console.log(`${w.label}: 단계 ${w.steps}개`);

// ───────── 맵과 장별 목표(탑뷰 RPG) ─────────
const TILES = new Set([...'.,m:=_se prb#fchx~'].filter((c) => c !== ' '));
for (const id in MAPS) {
  const M = MAPS[id];
  const w = M.grid[0].length;
  M.grid.forEach((r, y) => { if (r.length !== w) bad(`맵 ${id}: ${y}번째 줄 길이 ${r.length} ≠ ${w}`); for (const c of r) if (!TILES.has(c)) bad(`맵 ${id}: 모르는 땅 글자 '${c}'`); });
  if (M.music && !MUSIC.has(M.music)) bad(`맵 ${id}: 없는 음악 ${M.music}`);
  for (const p of M.props || []) { if (!SPRITES[p[0]]) bad(`맵 ${id}: 없는 소품 ${p[0]}`); else if (!exists(SPRITES[p[0]].img)) bad(`맵 ${id}: 소품 그림 파일 없음 ${p[0]}`); }
  for (const n in M.npcs || {}) { if (!SPRITES[M.npcs[n].sp]) bad(`맵 ${id}: 인물 ${n}의 스프라이트 없음 ${M.npcs[n].sp}`); (M.npcs[n].talk || []).flat().forEach((t) => typeof t === 'string' && checkText(`맵 ${id} ${n}`, t)); }
  const [sx, sy] = M.spawn;
  const c = M.grid[Math.floor(sy + 0.78)][Math.floor(sx + 0.5)];
  if ('#fchx~'.includes(c)) bad(`맵 ${id}: 시작 자리가 막힌 칸(${c})`);
}
for (const s of Object.values(SPRITES)) if (s.anims && !exists(s.img)) bad(`스프라이트 그림 없음 ${s.img}`);
const covered = new Set();
for (const ch of STORY) {
  const q = QUESTS[ch.id];
  if (!q) { bad(`${ch.id}: 맵 목표(quests.js)가 없음`); continue; }
  const maps = [q.map].flatMap((m) => (typeof m === 'object' ? Object.values(m) : [m]));
  for (const m of maps) if (!MAPS[m]) bad(`${ch.id}: 없는 맵 ${m}`);
  if (q.avatar && !SPRITES[q.avatar]) bad(`${ch.id}: 없는 주인공 스프라이트 ${q.avatar}`);
  for (const mid in q.cast || {}) { if (!MAPS[mid]) bad(`${ch.id}: 인물 배치에 없는 맵 ${mid}`); for (const n in q.cast[mid]) { const d = q.cast[mid][n]; if (!SPRITES[d.sp]) bad(`${ch.id}: ${n} 스프라이트 없음 ${d.sp}`); if (d.who && !PEOPLE[d.who]) bad(`${ch.id}: ${n} 없는 인물 ${d.who}`); } }
  const bids = new Set();
  // 남장하지 않는 길(c)과 그 밖의 길은 맵을 따로 따라간다
  const lane = { c: typeof q.map === 'object' ? q.map.c : q.map, o: typeof q.map === 'object' ? q.map._ : q.map };
  for (const b of q.beats) {
    if (bids.has(b.id)) bad(`${ch.id}: 목표 id 중복 ${b.id}`); bids.add(b.id);
    const ln = b.when && [].concat(b.when.branch || []).includes('c') ? 'c' : 'o';
    if (b.map) { if (!MAPS[b.map]) bad(`${b.id}: 없는 맵 ${b.map}`); lane[ln] = b.map; }
    const where = lane[ln];
    for (const sid of b.steps || []) { const st = ch.steps.find((x) => x.id === sid); if (!st) bad(`${b.id}: 이 장에 없는 단계 ${sid}`); covered.add(sid); }
    if (b.train) { covered.add(b.train.step); for (const t in b.train.at) if (t[0] !== '@' && !MAPS[where].spots[t]) bad(`${b.id}: ${where}에 없는 수련터 ${t}`); }
    if (b.sayPre && !ch.steps.some((x) => x.id === b.sayPre)) bad(`${b.id}: 없는 단계 ${b.sayPre}`);
    const known = (t) => (MAPS[where].spots || {})[t] || (MAPS[where].npcs || {})[t] || ((q.cast || {})[where] || {})[t] || (b.show || {})[t] || q.beats.some((o) => o.show && o.show[t]) || Object.values(q.cast || {}).some((c) => c[t]);
    for (const t of [b.talk, b.at, b.go, ...Object.keys(b.pick || {}), ...Object.keys((b.escape || {}).exits || {})].filter(Boolean)) if (!known(t)) bad(`${b.id}: ${where}에 없는 대상 ${t}`);
    for (const w of (b.fight || {}).waves || (b.fight ? [b.fight.foes] : [])) for (const f of w) if (!SPRITES[f[0]]) bad(`${b.id}: 없는 적 스프라이트 ${f[0]}`);
    if (b.pick) { const st = ch.steps.find((x) => x.id === b.steps[0]); for (const k in b.pick) if (!st.options[b.pick[k]]) bad(`${b.id}: ${k}의 선택지 번호 ${b.pick[k]} 없음`); }
    for (const l of b.say || []) checkLine(`${b.id} say`, l);
    if (b.goal) checkText(`${b.id} 목표`, b.goal);
  }
}
for (const ch of STORY) for (const st of ch.steps) if (!covered.has(st.id)) bad(`${st.id}: 어느 맵 목표에도 묶이지 않음(펼쳐지지 않는다)`);
// 기술·적장전
for (const t of SKILLS.trees) for (const id of t.ids) { const d = SKILLS.list[id]; if (!d) bad(`기술 ${id}: 목록에 없음`); else if (d.kind === 'active' && !(d.cd > 0 && d.icon)) bad(`기술 ${id}: 단추 기술인데 재사용 시간·글자가 없음`); }
const MOVES = new Set(['slash', 'thrust', 'dash', 'slam', 'hex', 'summon', 'charge']);
for (const id in BOSSES) {
  const b = BOSSES[id];
  if (!BATTLE.enemies[id]) bad(`적장 ${id}: battle.js에 이름·천우신조 글이 없음`);
  for (const k of [b.sp, b.summon]) if (!SPRITES[k] || !SPRITES[k].anims.atk_down) bad(`적장 ${id}: 공격 동작이 있는 스프라이트가 아님 ${k}`);
  for (const m of [...b.moves, ...((b.phase2 || {}).moves || [])]) if (!MOVES.has(m)) bad(`적장 ${id}: 모르는 수 ${m}`);
}
for (const ch of STORY) {
  const q = QUESTS[ch.id];
  for (const bt of q.beats) for (const sid of bt.steps || []) {
    const st = ch.steps.find((x) => x.id === sid);
    if (st && st.type === 'battle' && !bt.noCard && !BOSSES[st.enemy]) bad(`${sid}: 적장전 자료(bosses.js)에 없는 적 ${st.enemy}`);
  }
}

if (problems.length) { console.log(`문제 ${problems.length}개`); for (const p of problems) console.log(' -', p); process.exit(1); }
console.log('데이터 점검 통과');
