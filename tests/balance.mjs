// 전투 난이도 모의실험(브라우저 없이): node balance.mjs
// js/game/battle.js의 규칙을 그대로 옮겨, 능력치 배분과 카드 고르는 방식(아무거나 / 적의 행동을 보고)에 따라
// 턴 수와 천우신조가 몇 번 나오는지 잰다.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sb = {}; sb.window = sb; vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/data/battle.js'), 'utf8'), sb);
const B = sb.BATTLE;

function fight(enemyId, abil, relic, policy, rnd, tutorial) {
  const E = B.enemies[enemyId];
  const val = (p, s) => Math.round(p[0] + p[1] * (abil[s] || 1));
  const max = 20 + 2 * abil.mu + abil.byeong + abil.sul;
  const hero = { hp: max, block: 0, evade: false, hexed: false };
  const foe = { hp: E.hp, block: 0, weak: false, stunned: false, idx: 0 };
  let relicUsed = false, turns = 0, heaven = 0;
  const pool = [];
  for (const id in B.cards) { const c = B.cards[id]; if (c.need && abil[c.stat] < c.need) continue; for (let i = 0; i < Math.max(1, abil[c.stat]); i++) pool.push(id); }
  while (turns < 60) {
    turns++;
    const hand = [];
    const p = pool.slice().sort(() => rnd() - 0.5);
    for (const id of p) { if (!hand.includes(id)) hand.push(id); if (hand.length >= 3) break; }
    const opts = hand.map((id) => ({ id, c: B.cards[id], relic: false }));
    if (relic && !relicUsed && !(tutorial && turns < 3)) opts.push({ id: relic, c: B.relics[relic], relic: true }); // 대련에서는 신물이 셋째 턴부터
    const [k] = E.pattern[foe.idx % E.pattern.length];
    let pick;
    if (policy === 'random') pick = opts[Math.floor(rnd() * opts.length)];
    else {
      // 적의 행동을 보고 고르기: 큰 수를 준비하면 계책·막기, 기력이 낮으면 회복, 아니면 가장 센 공격
      const has = (f) => opts.find(f);
      if (/charge|heavy|hex/.test(k)) pick = has((o) => o.c.counter) || has((o) => o.c.evade) || has((o) => o.c.block);
      if (!pick && hero.hp < max * 0.35) pick = has((o) => o.c.heal);
      if (!pick) pick = opts.filter((o) => o.c.dmg).sort((a, b) => val(b.c.dmg, b.c.stat) - val(a.c.dmg, a.c.stat))[0] || opts[0];
    }
    const c = pick.c;
    if (pick.relic) relicUsed = true;
    const halve = hero.hexed; hero.hexed = false;
    if (c.counter && /charge|heavy|hex/.test(k)) { foe.idx += k === 'charge' ? 2 : 1; foe.stunned = true; }
    if (c.dmg) { let d = val(c.dmg, c.stat); if (halve) d = Math.ceil(d / 2); const bl = Math.min(foe.block, d); foe.block -= bl; foe.hp -= d - bl; }
    if (c.block) hero.block += val(c.block, c.stat);
    if (c.heal) hero.hp = Math.min(max, hero.hp + val(c.heal, c.stat));
    if (c.weaken) foe.weak = true;
    if (c.evade) hero.evade = true;
    if (foe.hp <= 0) return { turns, heaven };
    if (foe.stunned) { foe.stunned = false; hero.block = 0; hero.evade = false; }
    else {
      const [kk, n] = E.pattern[foe.idx % E.pattern.length];
      foe.idx++; foe.block = 0;
      if (kk === 'guard') foe.block = n;
      else if (kk !== 'charge') {
        let d = n;
        if (foe.weak && (kk === 'atk' || kk === 'heavy')) { d = Math.ceil(d / 2); foe.weak = false; }
        if (hero.evade) d = 0;
        d -= Math.min(hero.block, d);
        hero.hp -= d;
        if (kk === 'hex') hero.hexed = true;
      }
      hero.block = 0; hero.evade = false;
    }
    if (hero.hp <= 0) { heaven++; hero.hp = Math.ceil(max * 0.6); foe.stunned = true; }
  }
  return { turns, heaven };
}

let seed = 7;
const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
// 능력치 합은 9(시작 1·1·1 + 1~3장 고르기 3 + 수련 3). 남장 없이 가는 길은 6장에서 1이 더 붙는다
const builds = {
  '고르게(武3 兵3 術3)': { mu: 3, byeong: 3, sul: 3 },
  '武만(武7 兵1 術1)': { mu: 7, byeong: 1, sul: 1 },
  '兵만(武1 兵7 術1)': { mu: 1, byeong: 7, sul: 1 },
  '術만(武1 兵1 術7)': { mu: 1, byeong: 1, sul: 7 },
  '武·術(武4 兵1 術4)': { mu: 4, byeong: 1, sul: 4 },
  '兵·術(武1 兵4 術4)': { mu: 1, byeong: 4, sul: 4 },
};
const fights = [['phantom', '5장 대련'], ['vanguard', '6장 선봉장'], ['boss', '7장 결전'], ['raiders', 'c 6장'], ['boss_c', 'c 7장'], ['second', 'a 재출전']];
console.log('능력치 배분 / 적 / 고르는 방식 → 평균 턴 · 천우신조가 나온 비율(200판)');
for (const [bn, abil] of Object.entries(builds)) {
  const row = [];
  for (const [eid, label] of fights) for (const policy of ['random', 'smart']) {
    let T = 0, H = 0;
    for (let i = 0; i < 200; i++) { const r = fight(eid, abil, 'sword', policy, rnd, eid === 'phantom'); T += r.turns; H += r.heaven > 0 ? 1 : 0; }
    row.push(`${label}${policy === 'random' ? '(아무거나)' : '(수 읽기)'} ${(T / 200).toFixed(1)}턴 ${Math.round(H / 2)}%`);
  }
  console.log('\n' + bn); for (const r of row) console.log('  ' + r);
}
