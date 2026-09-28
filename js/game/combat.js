'use strict';
// 싸움 확장: 기술 나무(스킬)와 적장과의 실시간 결전(보스전)
//  - 맵 엔진(js/game/world.js)의 속살(G.world._k)을 빌려 쓴다.
//  - 기술: js/data/skills.js · 적장: js/data/bosses.js
//  - 적장은 공격 전에 땅에 붉은 자리(부채꼴·줄·원)를 먼저 보여 준다. 칠 때마다 기세가 쌓이고, 가득 차면 비틀거린다.
(function () {
  const C = (G.combat = {});
  const K = () => G.world._k;
  const S = () => G.save.state;
  const { h, boldNodes } = G.util;
  const SK = () => window.SKILLS;
  const fill = (s) => G.util.T(s);
  const cds = {}; // 기술별 남은 재사용 시간(초)

  // ───────── 기술 상태(저장) ─────────
  function sk() {
    const st = S();
    if (!st.skills) st.skills = { learned: [], equip: [], points: 0, got: 0 };
    return st.skills;
  }
  C.state = sk;
  C.has = (id) => sk().learned.includes(id);
  C.slots = () => sk().equip.slice(0, 3);
  C.shown = () => sk().got > 0 || sk().learned.length > 0;
  C.addPoints = function (n, quiet) {
    const s = sk();
    s.points += n; s.got += n;
    G.save.write();
    if (!quiet) { G.ui.toast(`기술 점수 +${n} — 技 단추를 눌러 새 기술을 익혀요`); G.audio.grow(); }
    G.world.hud();
  };
  function where(id) {
    for (const t of SK().trees) { const i = t.ids.indexOf(id); if (i >= 0) return { tree: t, i }; }
    return null;
  }
  C.check = function (id) {
    const s = sk(), st = S();
    if (s.learned.includes(id)) return { state: 'learned' };
    const { tree, i } = where(id);
    const need = SK().need[i];
    if (st.abil[tree.stat] < need) return { state: 'locked', why: `${tree.han} ${tree.name} ${need} 이상이어야 해요 (지금 ${st.abil[tree.stat]})` };
    if (i > 0 && !s.learned.includes(tree.ids[i - 1])) return { state: 'locked', why: `먼저 「${SK().list[tree.ids[i - 1]].name}」을 익혀야 해요` };
    if (s.points <= 0) return { state: 'open', why: '기술 점수가 모자라요' };
    return { state: 'ready' };
  };
  // 지금 익힐 수 있는 기술이 있는가(점수가 있고 조건도 맞는 것)
  C.anyReady = () => SK().trees.some((t) => t.ids.some((id) => C.check(id).state === 'ready'));
  C.learn = function (id) {
    if (C.check(id).state !== 'ready') return false;
    const s = sk();
    s.points--; s.learned.push(id);
    if (SK().list[id].kind === 'active' && s.equip.length < 3) s.equip.push(id);
    G.save.write();
    return true;
  };
  C.toggleEquip = function (id) {
    const s = sk();
    const i = s.equip.indexOf(id);
    if (i >= 0) s.equip.splice(i, 1);
    else if (s.equip.length < 3) s.equip.push(id);
    else { G.ui.toast('단추에는 기술을 셋까지 올릴 수 있어요. 하나를 먼저 내리세요.'); return; }
    G.save.write();
  };
  C.hpBonus = () => (C.has('formation') ? 4 : 0);
  C.guard = () => (C.has('formation') ? 1 : 0);
  const cdScale = () => Math.max(0.6, 1 - 0.05 * S().abil.sul); // 도술이 높을수록 기술을 자주 쓴다
  C.cooldown = (id) => ({ left: cds[id] || 0, full: (SK().list[id].cd || 1) * cdScale() });
  C.reset = function () { for (const k in cds) delete cds[k]; };

  // ───────── 기술 쓰기 ─────────
  C.cast = function (slot) {
    const id = C.slots()[slot];
    const k = K(), P = k.P;
    if (!id || !P || !P.canAtk || P.dash || P.whirl) return;
    if ((cds[id] || 0) > 0) return;
    cds[id] = SK().list[id].cd * cdScale();
    ACT[id](k, P);
  };
  const dirVec = (d) => ({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] })[d] || [0, 1];
  const alive = (k) => k.M.enemies.filter((e) => !e.dead);
  const ACT = {
    talisman(k, P) {
      const st = S();
      k.fx.push({ k: 'ring', x: P.x, y: P.y - 14, t: 0, life: 0.42, r: 80 });
      k.burst(P.x, P.y - 20, 16, ['#f2d24b', '#fff3b0', '#b3342a'], 150, 60, 3, 0.6);
      G.world.flash('rgba(255,236,150,.35)', 0.18); G.audio.magic(); k.stop(0.05); G.world.shake(3);
      for (const e of alive(k)) if (Math.hypot(e.x - P.x, e.y - P.y) < 84) { k.hitEnemy(e, 1 + Math.floor(st.abil.sul / 2), 280, 'talisman'); if (!e.boss) e.stun = 0.9; }
    },
    rush(k, P) {
      let [vx, vy] = k.input();
      if (!vx && !vy) [vx, vy] = dirVec(P.dir);
      const m = Math.hypot(vx, vy) || 1;
      P.dash = { t: 0.2, vx: vx / m * 460, vy: vy / m * 460, hit: new Set() };
      P.inv = Math.max(P.inv, 0.32); P.sx = 1.25; P.sy = 0.82;
      G.audio.slash(); G.world.shake(2);
    },
    whirl(k, P) {
      P.whirl = { t: 0.55, hits: 0 };
      P.inv = Math.max(P.inv, 0.55);
      k.fx.push({ k: 'ring', x: P.x, y: P.y - 12, t: 0, life: 0.5, r: 76, c: '#b3342a' });
      G.audio.slash();
    },
    ambush(k, P) {
      for (const s of [-1, 1]) {
        const [x, y] = k.freeSpot(P.x + s * 26, P.y + 8, 6);
        const a = { kind: 'ally', sp: 'sp_soldier', x, y, dir: P.dir, t: 0, moving: false, life: 10, cd: 0.3, sx: 1, sy: 1, hw: 6, flash: 0 };
        k.M.chars.push(a); allies.push(a);
        k.burst(x, y - 12, 12, ['#6d6259', '#4a3f35', '#b3342a'], 60, 60, 2, 0.5);
      }
      G.audio.guard(); hint('복병이 나타났다! 10초 동안 함께 싸운다.');
    },
    stratagem(k, P) {
      G.audio.magic(); G.world.flash('rgba(120,150,220,.3)', 0.25); k.stop(0.08);
      for (const e of alive(k)) {
        k.floatText(e.x, e.y - 58, '!', '#9ec1ff');
        if (e.boss) {
          if (e.state === 'charge') { stagger(e, 3.2); hint('계책이 먹혔다! 기를 모으던 적장이 무너졌다.'); }
          else addPoise(e, 6);
        } else { e.stun = Math.max(e.stun || 0, 1.6); e.state = 'chase'; e.atk = 0; }
      }
      k.fx.push({ k: 'ring', x: P.x, y: P.y - 14, t: 0, life: 0.5, r: 120, c: '#36548f' });
    },
    blink(k, P) {
      let [vx, vy] = k.input();
      if (!vx && !vy) [vx, vy] = dirVec(P.dir);
      const m = Math.hypot(vx, vy) || 1; vx /= m; vy /= m;
      let bx = P.x, by = P.y;
      for (let d = 8; d <= 80; d += 8) { const nx = P.x + vx * d, ny = P.y + vy * d; if (k.blocked(nx - 6, ny - 5, nx + 6, ny, null)) break; bx = nx; by = ny; }
      k.burst(P.x, P.y - 16, 10, ['#e2f0ee', '#1f7474', '#ffffff'], 60, 40, 2, 0.4);
      P.x = bx; P.y = by; P.inv = Math.max(P.inv, 0.4);
      k.burst(P.x, P.y - 16, 10, ['#e2f0ee', '#1f7474', '#ffffff'], 60, 40, 2, 0.4);
      G.audio.magic();
    },
    storm(k, P) {
      const st = S();
      G.world.flash('rgba(160,180,200,.4)', 0.35); G.audio.magic(); G.world.shake(5); k.stop(0.06);
      rain = 2.2;
      const [cx, cy, vw, vh] = k.view();
      for (const e of alive(k)) {
        if (e.x < cx - 20 || e.x > cx + vw + 20 || e.y < cy - 20 || e.y > cy + vh + 40) continue;
        k.hitEnemy(e, 2 + Math.floor(st.abil.sul / 3), 120, 'storm');
        e.slow = 4;
      }
    },
  };

  // ───────── 매 순간(맵 엔진이 부른다) ─────────
  const allies = [];
  let rain = 0, hintEl = null, hintT = 0;
  C.update = function (dt) {
    const k = K(), P = k.P;
    for (const id in cds) cds[id] = Math.max(0, cds[id] - dt);
    // 돌격
    if (P.dash) {
      const d = P.dash;
      k.move(P, d.vx * dt, d.vy * dt);
      if (Math.random() < 0.8) k.parts.push({ x: P.x + (Math.random() - 0.5) * 8, y: P.y, z: 8 + Math.random() * 20, vx: -d.vx * 0.05, vy: 0, vz: 0, t: 0, life: 0.25, c: 'rgba(255,255,255,.8)', s: 2, grav: 0 });
      for (const e of alive(k)) if (!d.hit.has(e) && Math.hypot(e.x - P.x, e.y - P.y) < 26) { d.hit.add(e); k.hitEnemy(e, k.heroDmg() + 1, 260, 'rush'); }
      d.t -= dt;
      if (d.t <= 0) P.dash = null;
    }
    // 일기당천(한 바퀴)
    if (P.whirl) {
      const w = P.whirl;
      const before = w.t;
      w.t -= dt;
      P.dir = ['down', 'left', 'up', 'right'][Math.floor(k.time * 16) % 4];
      for (const at of [0.42, 0.18]) if (before > at && w.t <= at) {
        w.hits++;
        k.fx.push({ k: 'ring', x: P.x, y: P.y - 12, t: 0, life: 0.3, r: 74, c: '#ffffff' });
        for (const e of alive(k)) if (Math.hypot(e.x - P.x, e.y - P.y) < 76) k.hitEnemy(e, k.heroDmg() + 1, 300, 'whirl');
        G.audio.slash(); G.world.shake(3);
      }
      if (w.t <= 0) P.whirl = null;
    }
    // 복병
    for (let i = allies.length - 1; i >= 0; i--) {
      const a = allies[i];
      a.life -= dt; a.cd -= dt; a.flash = Math.max(0, a.flash - dt);
      if (a.life <= 0 || !k.M.chars.includes(a)) {
        k.burst(a.x, a.y - 12, 10, ['#6d6259', '#4a3f35'], 50, 50, 2, 0.4);
        const j = k.M.chars.indexOf(a); if (j >= 0) k.M.chars.splice(j, 1);
        allies.splice(i, 1); continue;
      }
      let best = null, bd = 1e9;
      for (const e of alive(k)) { const d = Math.hypot(e.x - a.x, e.y - a.y); if (d < bd) { bd = d; best = e; } }
      const tx = best ? best.x : P.x + 20, ty = best ? best.y : P.y;
      const dd = Math.hypot(tx - a.x, ty - a.y) || 1;
      k.faceTo(a, tx, ty);
      if (best && dd < 26) {
        a.moving = false;
        if (a.cd <= 0) { a.cd = 0.75; a.sx = 1.2; a.sy = 0.85; k.fx.push({ k: 'slash', x: a.x, y: a.y, dir: a.dir, t: 0, life: 0.12 }); k.hitEnemy(best, 1, 140, 'ally', a); }
      } else if (dd > (best ? 20 : 34)) { k.move(a, (tx - a.x) / dd * 86 * dt, (ty - a.y) / dd * 86 * dt); a.moving = true; a.t += dt; }
      else a.moving = false;
      a.sx += (1 - a.sx) * Math.min(1, dt * 12); a.sy += (1 - a.sy) * Math.min(1, dt * 12);
    }
    // 비바람
    if (rain > 0) {
      rain -= dt;
      const [cx, cy, vw, vh] = k.view();
      for (let i = 0; i < 6; i++) k.parts.push({ x: cx + Math.random() * vw, y: cy + Math.random() * vh, z: 60, vx: -30, vy: 0, vz: -260, t: 0, life: 0.25, c: 'rgba(200,220,240,.8)', s: 1, grav: 0 });
    }
    if (hintEl && hintT > 0) { hintT -= dt; if (hintT <= 0) hintEl.classList.remove('on'); }
  };
  C.clearAllies = function () { const k = K(); for (const a of allies) { const j = k.M.chars.indexOf(a); if (j >= 0) k.M.chars.splice(j, 1); } allies.length = 0; };
  function hint(text, secs = 3.2) {
    if (!hintEl || !hintEl.isConnected) { hintEl = document.querySelector('.world .tipbar'); if (!hintEl) return; }
    hintEl.textContent = fill(text); hintEl.classList.add('on'); hintT = secs;
  }
  C.hint = hint;

  // ───────── 적장 ─────────
  let boss = null;
  const quickOf = (e) => (e.phase === 2 && e.def.phase2 ? e.def.phase2.quick || 1 : 1) * (e.def.tutorial ? 1.3 : 1);
  function spawnBoss(id, x, y) {
    const k = K();
    const def = BOSSES[id], E = BATTLE.enemies[id];
    const [fx, fy] = k.freeSpot(x, y, 8);
    const e = {
      kind: 'enemy', boss: true, bid: id, def, name: E.name, sp: def.sp, x: fx, y: fy, dir: 'down', t: 0, moving: false,
      hp: def.hp, max: def.hp, dmg: def.dmg, speed: def.speed, poise: 0, poiseMax: def.poise, phase: 1, moves: def.moves.slice(), mi: 0,
      state: 'intro', st: 1.1, flash: 0, kx: 0, ky: 0, sx: 1, sy: 1, hw: 9, stun: 0, atk: 0, atkDur: 0.3, tele: [], seen: {}, slow: 0, stag: 0,
    };
    k.M.enemies.push(e); k.M.chars.push(e);
    k.burst(fx, fy - 20, 24, ['#1b1612', '#2a2119', '#b3342a', '#6d6259'], 90, 90, 3, 0.8);
    G.world.shake(6); G.audio.hurt();
    return e;
  }
  function addPoise(e, n) {
    if (e.dead || e.stag > 0) return;
    e.poise += n;
    if (e.state === 'charge') e.chargeHit = (e.chargeHit || 0) + n;
    if (e.poise >= e.poiseMax) stagger(e, 2.4);
  }
  function stagger(e, secs) {
    e.stag = secs; e.poise = 0; e.state = 'rec'; e.st = 0; e.tele = []; e.atk = 0; e.moving = false;
    e.sx = 1.3; e.sy = 0.75;
    G.world.flash('rgba(255,255,255,.35)', 0.15); G.world.shake(5); K().stop(0.12);
    K().floatText(e.x, e.y - 84, '!', '#ffe08a');
    if (e.def.tutorial && !e.seen.stagger) { e.seen.stagger = true; hint(e.def.tips.stagger); }
  }
  // 맵 엔진의 hitEnemy가 적장을 칠 때: 비틀거리면 1.5배, 기세 쌓기
  C.bossDamage = function (e, dmg, src) {
    if (e.state === 'intro' || e.state === 'roar') return 0;
    const mul = e.stag > 0 ? 1.5 : 1;
    addPoise(e, src === 'heavy' || src === 'whirl' || src === 'rush' ? 2 : src === 'storm' || src === 'talisman' ? 3 : 1);
    return Math.max(1, Math.round(dmg * mul));
  };
  // 공격 모양 만들기
  function aimAngle(e, P) { return Math.atan2((P.y - 10) - (e.y - 10), P.x - e.x); }
  const MOVES = {
    slash(e, P) { const a = aimAngle(e, P); e.tele = [{ shape: 'arc', x: e.x, y: e.y - 8, r: 70, a, ha: 1.05, t: 0, dur: 0.8 * quickOf(e), dmg: e.dmg }]; e.aimDir = a; },
    thrust(e, P) {
      e.tele = []; const a = aimAngle(e, P);
      for (let i = 0; i < 3; i++) {
        const aa = a + (i - 1) * 0.35;
        e.tele.push({ shape: 'line', x0: e.x, y0: e.y - 8, x1: e.x + Math.cos(aa) * 130, y1: e.y - 8 + Math.sin(aa) * 130, w: 22, t: -i * 0.35, dur: 0.55 * quickOf(e), dmg: e.dmg - 1 });
      }
    },
    dash(e, P) {
      const a = aimAngle(e, P), L = Math.min(210, Math.hypot(P.x - e.x, P.y - e.y) + 60);
      e.tele = [{ shape: 'line', x0: e.x, y0: e.y - 8, x1: e.x + Math.cos(a) * L, y1: e.y - 8 + Math.sin(a) * L, w: 30, t: 0, dur: 0.85 * quickOf(e), dmg: e.dmg, dash: { a, L } }];
    },
    slam(e) { e.tele = [{ shape: 'circle', x: e.x, y: e.y - 4, r: 78, t: 0, dur: 0.95 * quickOf(e), dmg: e.dmg + 1, big: true }]; },
    hex(e, P) {
      e.tele = [];
      for (let i = 0; i < 6; i++) {
        const r = i === 0 ? 0 : 30 + Math.random() * 80, a = Math.random() * Math.PI * 2;
        e.tele.push({ shape: 'circle', x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r * 0.72, r: 28, t: -i * 0.14, dur: 1.0 * quickOf(e), dmg: e.dmg - 1, bolt: true });
      }
    },
    summon(e) { e.tele = [{ shape: 'none', t: 0, dur: 0.75, summon: true }]; e.atk = 0.001; },
    charge(e) { e.state = 'charge'; e.st = 1.7; e.chargeHit = 0; },
  };
  function hitsPlayer(tl, P) {
    const px = P.x, py = P.y - 10;
    if (tl.shape === 'circle') { const dx = px - tl.x, dy = (py - tl.y) / 0.72; return Math.hypot(dx, dy) <= tl.r + 5; }
    if (tl.shape === 'arc') {
      const dx = px - tl.x, dy = (py - tl.y) / 0.72;
      if (Math.hypot(dx, dy) > tl.r + 6) return false;
      let da = Math.atan2(dy, dx) - Math.atan2(Math.sin(tl.a) / 0.72, Math.cos(tl.a));
      da = Math.atan2(Math.sin(da), Math.cos(da));
      return Math.abs(da) <= tl.ha;
    }
    if (tl.shape === 'line') {
      const vx = tl.x1 - tl.x0, vy = tl.y1 - tl.y0, L2 = vx * vx + vy * vy;
      const u = Math.max(0, Math.min(1, ((px - tl.x0) * vx + (py - tl.y0) * vy) / L2));
      return Math.hypot(px - (tl.x0 + vx * u), py - (tl.y0 + vy * u)) <= tl.w / 2 + 5;
    }
    return false;
  }
  function fire(e, tl, k) {
    const P = k.P;
    if (tl.summon) {
      const n = k.M.enemies.filter((m) => !m.dead && !m.boss).length;
      for (let i = 0; i < Math.min(2, 3 - n); i++) { const a = Math.random() * Math.PI * 2; k.spawnFoe(e.def.summon, (e.x + Math.cos(a) * 44) / k.T - 0.5, (e.y + Math.sin(a) * 30) / k.T - 0.78); }
      G.audio.guard(); G.world.shake(3); return;
    }
    if (tl.dash) { e.state = 'dash'; e.dashT = tl.dash.L / 430; e.dvx = Math.cos(tl.dash.a) * 430; e.dvy = Math.sin(tl.dash.a) * 430; e.dashHit = false; G.audio.slash(); return; }
    if (tl.bolt) { k.fx.push({ k: 'bolt', x: tl.x, y: tl.y, t: 0, life: 0.2 }); k.burst(tl.x, tl.y, 10, ['#fff3b0', '#f2d24b', '#9ec1ff'], 120, 80, 2, 0.4); G.world.shake(3); G.audio.magic(); }
    else if (tl.shape === 'circle') { k.fx.push({ k: 'ring', x: tl.x, y: tl.y, t: 0, life: 0.4, r: tl.r, c: '#e0a060' }); k.burst(tl.x, tl.y, 22, ['#b8925f', '#8a6a3f', '#d2b27e'], 160, 80, 3, 0.6); G.world.shake(tl.big ? 9 : 5); G.audio.hurt(); }
    else { e.atk = e.atkDur; k.fx.push({ k: 'bigslash', x: tl.x !== undefined ? tl.x : tl.x0, y: (tl.y !== undefined ? tl.y : tl.y0), a: tl.a !== undefined ? tl.a : Math.atan2(tl.y1 - tl.y0, tl.x1 - tl.x0), r: tl.r || 110, line: tl.shape === 'line', t: 0, life: 0.18 }); G.audio.slash(); G.world.shake(3); }
    if (hitsPlayer(tl, P)) k.hurtPlayer(tl.dmg, { x: e.x, y: e.y });
  }

  C.updateBoss = function (e, dt) {
    const k = K(), P = k.P;
    e.flash = Math.max(0, e.flash - dt);
    e.sx += (1 - e.sx) * Math.min(1, dt * 10); e.sy += (1 - e.sy) * Math.min(1, dt * 10);
    if (e.atk > 0) e.atk = Math.max(0, e.atk - dt);
    if (e.dead) {
      e.deadT += dt; e.tele = [];
      e.alpha = Math.max(0, 1 - e.deadT / 1.4) * (Math.floor(e.deadT * 20) % 2 ? 0.6 : 1);
      if (Math.random() < 0.5) k.burst(e.x + (Math.random() - 0.5) * 30, e.y - 20 - Math.random() * 30, 2, ['#1b1612', '#b3342a'], 60, 60, 3, 0.6);
      return;
    }
    if (e.kx || e.ky) { k.move(e, e.kx * dt, e.ky * dt); e.kx *= 0.8; e.ky *= 0.8; if (Math.abs(e.kx) + Math.abs(e.ky) < 4) e.kx = e.ky = 0; }
    if (e.slow > 0) e.slow -= dt;
    if (e.stag > 0) { e.stag -= dt; e.moving = false; if (e.stag <= 0) { e.state = 'idle'; e.st = 0.4; } return; }
    // 둘째 마당: 기력이 반 남으면 더 거세진다
    const p2 = e.def.phase2;
    if (p2 && e.phase === 1 && e.hp <= e.max * p2.at) {
      e.phase = 2; e.moves = p2.moves.slice(); e.mi = 0; e.speed *= p2.speed || 1;
      e.state = 'roar'; e.st = 1.0; e.tele = [];
      G.world.flash('rgba(179,52,42,.35)', 0.4); G.world.shake(8); G.audio.heaven();
      hint(p2.say, 3.6);
      return;
    }
    const spd = e.speed * (e.slow > 0 ? 0.5 : 1);
    const dist = Math.hypot(P.x - e.x, P.y - e.y) || 1;
    e.st -= dt;
    switch (e.state) {
      case 'intro': case 'roar':
        e.moving = false; k.faceTo(e, P.x, P.y);
        if (e.st <= 0) { e.state = 'idle'; e.st = 0.5; }
        break;
      case 'idle':
        k.faceTo(e, P.x, P.y);
        if (dist > 62) { k.move(e, (P.x - e.x) / dist * spd * dt, (P.y - e.y) / dist * spd * dt); e.moving = true; e.t += dt; } else e.moving = false;
        if (e.st <= 0) {
          const m = e.moves[e.mi++ % e.moves.length];
          e.cur = m;
          if (e.def.tutorial && e.def.tips && e.def.tips[m] && !e.seen[m]) { e.seen[m] = true; hint(e.def.tips[m], 3.6); }
          e.moving = false;
          if (m === 'charge') { MOVES.charge(e); break; }
          MOVES[m](e, P);
          e.state = 'tele';
        }
        break;
      case 'tele': {
        e.moving = false;
        let pending = 0;
        for (const tl of e.tele) {
          if (tl.done) continue;
          tl.t += dt;
          if (tl.t >= tl.dur) { tl.done = true; fire(e, tl, k); if (e.state !== 'tele') break; }
          else pending++;
        }
        if (e.state === 'tele' && !pending) { e.tele = []; e.state = 'rec'; e.st = (e.cur === 'slam' ? 1.0 : 0.75) * (e.def.tutorial ? 1.3 : 1); }
        break;
      }
      case 'dash': {
        const ox = e.x, oy = e.y;
        k.move(e, e.dvx * dt, e.dvy * dt);
        e.moving = true; e.t += dt * 2;
        if (!e.dashHit && Math.hypot(P.x - e.x, P.y - e.y) < 24) { e.dashHit = true; k.hurtPlayer(e.dmg, { x: e.x - e.dvx, y: e.y - e.dvy }); }
        if (Math.random() < 0.7) k.parts.push({ x: e.x, y: e.y, z: 2, vx: -e.dvx * 0.05, vy: 0, vz: 20, t: 0, life: 0.3, c: 'rgba(184,146,95,.9)', s: 3, grav: 0 });
        e.dashT -= dt;
        const stuck = Math.hypot(e.x - ox, e.y - oy) < 1;
        if (stuck) { stagger(e, 1.3); K().floatText(e.x, e.y - 70, '!', '#ffffff'); break; } // 벽에 부딪히면 비틀
        if (e.dashT <= 0) { e.tele = []; e.state = 'rec'; e.st = 0.9 * (e.def.tutorial ? 1.3 : 1); }
        break;
      }
      case 'charge':
        e.moving = false;
        if (Math.random() < 0.6) k.parts.push({ x: e.x + (Math.random() - 0.5) * 40, y: e.y, z: Math.random() * 10, vx: 0, vy: 0, vz: 60 + Math.random() * 40, t: 0, life: 0.6, c: e.phase === 2 ? '#ff6b5a' : '#f2d24b', s: 2, grav: 0 });
        if ((e.chargeHit || 0) >= Math.ceil(e.poiseMax * 0.45)) { stagger(e, 2.6); hint('기를 모으던 적장이 흔들렸다!', 2.4); break; }
        if (e.st <= 0) { e.tele = [{ shape: 'circle', x: e.x, y: e.y - 4, r: 112, t: 0, dur: 0.45, dmg: e.dmg + 3, big: true }]; e.cur = 'slam'; e.state = 'tele'; }
        break;
      case 'rec':
        e.moving = false; k.faceTo(e, P.x, P.y);
        if (e.st <= 0) { e.state = 'idle'; e.st = 0.35 + Math.random() * 0.6; }
        break;
    }
  };

  // 땅에 그리는 붉은 자리(공격 예고)
  C.drawGround = function (g, cx, cy) {
    const k = K();
    for (const e of k.M.enemies) {
      if (!e.boss) continue;
      for (const tl of e.tele) {
        if (tl.done || tl.t < 0 || tl.shape === 'none') continue;
        const p = Math.min(1, tl.t / tl.dur);
        g.save();
        g.fillStyle = `rgba(200,40,30,${0.14 + 0.1 * p})`;
        g.strokeStyle = `rgba(255,${120 - 60 * p},80,.9)`; g.lineWidth = 1;
        if (tl.shape === 'circle') {
          const x = tl.x - cx, y = tl.y - cy;
          g.beginPath(); g.ellipse(x, y, tl.r, tl.r * 0.72, 0, 0, Math.PI * 2); g.fill(); g.stroke();
          g.fillStyle = `rgba(230,60,40,${0.25 + 0.2 * p})`;
          g.beginPath(); g.ellipse(x, y, tl.r * p, tl.r * 0.72 * p, 0, 0, Math.PI * 2); g.fill();
        } else if (tl.shape === 'arc') {
          const x = tl.x - cx, y = tl.y - cy;
          g.translate(x, y); g.scale(1, 0.72);
          const a = Math.atan2(Math.sin(tl.a) / 0.72, Math.cos(tl.a));
          g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, tl.r, a - tl.ha, a + tl.ha); g.closePath(); g.fill(); g.stroke();
          g.fillStyle = `rgba(230,60,40,${0.25 + 0.2 * p})`;
          g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, tl.r * p, a - tl.ha, a + tl.ha); g.closePath(); g.fill();
        } else if (tl.shape === 'line') {
          const x0 = tl.x0 - cx, y0 = tl.y0 - cy, L = Math.hypot(tl.x1 - tl.x0, tl.y1 - tl.y0), a = Math.atan2(tl.y1 - tl.y0, tl.x1 - tl.x0);
          g.translate(x0, y0); g.rotate(a);
          g.fillRect(0, -tl.w / 2, L, tl.w); g.strokeRect(0, -tl.w / 2, L, tl.w);
          g.fillStyle = `rgba(230,60,40,${0.25 + 0.2 * p})`; g.fillRect(0, -tl.w / 2, L * p, tl.w);
        }
        g.restore();
      }
    }
  };
  // 사람 위에 그리는 것: 기 모음·비틀거림·벼락·큰 칼빛
  C.drawTop = function (g, cx, cy) {
    const k = K();
    for (const e of k.M.enemies) {
      if (!e.boss || e.dead) continue;
      const x = Math.round(e.x - cx), y = Math.round(e.y - cy);
      if (e.state === 'charge') {
        const r = 30 + Math.sin(k.time * 20) * 4;
        g.strokeStyle = e.phase === 2 ? 'rgba(255,90,70,.9)' : 'rgba(242,201,76,.9)'; g.lineWidth = 2;
        g.beginPath(); g.ellipse(x, y - 30, r, r * 1.2, 0, 0, Math.PI * 2); g.stroke();
        k.ptext(g, '!', x, y - 92, '#f2c94c', 2);
      }
      if (e.stag > 0) for (let i = 0; i < 3; i++) {
        const a = k.time * 5 + i * 2.1;
        g.fillStyle = '#ffe08a'; g.fillRect(Math.round(x + Math.cos(a) * 14) - 1, Math.round(y - 80 + Math.sin(a) * 4) - 1, 3, 3);
      }
    }
    for (const f of k.fx) {
      const q = f.t / f.life;
      if (f.k === 'bolt') {
        const x = f.x - cx, y = f.y - cy;
        g.strokeStyle = `rgba(255,250,210,${1 - q})`; g.lineWidth = 3;
        g.beginPath(); g.moveTo(x + 6, y - 160);
        for (let i = 1; i <= 6; i++) g.lineTo(x + (i % 2 ? -8 : 8) * (1 - i / 7), y - 160 + i * 26.6);
        g.stroke();
      } else if (f.k === 'bigslash') {
        const x = f.x - cx, y = f.y - cy;
        g.save(); g.translate(x, y); g.strokeStyle = `rgba(255,220,200,${1 - q})`; g.lineWidth = 4;
        if (f.line) { g.rotate(f.a); g.beginPath(); g.moveTo(10, 0); g.lineTo(f.r, 0); g.stroke(); }
        else { g.scale(1, 0.72); g.beginPath(); g.arc(0, 0, f.r * (0.7 + q * 0.3), Math.atan2(Math.sin(f.a) / 0.72, Math.cos(f.a)) - 1, Math.atan2(Math.sin(f.a) / 0.72, Math.cos(f.a)) + 1); g.stroke(); }
        g.restore();
      }
    }
  };

  // ───────── 적장과의 결전(단계 실행) ─────────
  let bossBar = null;
  function drawBossBar() {
    if (!bossBar || !bossBar.isConnected) return;
    const e = boss;
    if (!e) { bossBar.classList.remove('on'); return; }
    bossBar.classList.add('on');
    const hp = Math.max(0, e.hp) / e.max, pz = e.stag > 0 ? 1 : e.poise / e.poiseMax;
    const key = `${Math.round(hp * 200)}:${Math.round(pz * 50)}:${e.phase}:${e.stag > 0}`;
    if (bossBar._k === key) return;
    bossBar._k = key;
    bossBar.querySelector('.bb i').style.width = hp * 100 + '%';
    bossBar.querySelector('.pz i').style.width = pz * 100 + '%';
    bossBar.classList.toggle('stag', e.stag > 0);
    bossBar.classList.toggle('p2', e.phase === 2);
  }
  C.frame = drawBossBar;
  C.bossBattle = async function (step, ctx, opt = {}) {
    const st = S(), k = K();
    const say = async (lines, last) => {
      const ls = lines.filter((l) => typeof l === 'string' || G.steps.ok(l.when));
      if (!ls.length) return;
      ctx.main.innerHTML = '';
      const box = h('div.says'); ctx.main.appendChild(box);
      for (let i = 0; i < ls.length; i++) {
        const el = G.steps.line(ls[i], ctx); if (!el) continue;
        box.appendChild(el); G.audio.page(); el.scrollIntoView({ block: 'nearest' });
        await G.steps.nextButton(ctx, i === ls.length - 1 ? last : '▶');
      }
    };
    await say(step.pre || [], '싸운다 ⚔');
    if (!st.seen.bossfight) {
      ctx.main.innerHTML = '';
      ctx.main.appendChild(G.ui.card({ kind: 'fiction', title: '적장과의 결전', body: '적장은 공격하기 전에 땅에 **붉은 자리**(부채꼴·줄·원)를 먼저 보여 줘요. 그 밖으로 피하고, 공격이 끝나 **빈틈**이 생길 때 베세요. 칠 때마다 **기세**가 쌓여 가득 차면 적장이 비틀거려요. 기를 모을 때는 몰아쳐 베거나 **계책**으로 끊으세요.', real: '영웅소설의 **군담**에서 영웅은 적장과 여러 합을 겨룬 끝에 이겨요. 붉은 자리·기세 같은 규칙은 게임 설정이에요.' }));
      await G.steps.nextButton(ctx, '싸움 시작 ⚔');
      st.seen.bossfight = true; G.save.write();
    }
    // 대화창을 잠시 내리고 맵에서 싸운다
    k.hideDlg(ctx, true);
    const t0 = performance.now();
    await fightBoss(step.enemy, opt);
    k.hideDlg(ctx, false);
    st.flags['battle:' + step.id] = Math.round((performance.now() - t0) / 1000);
    G.save.write();
    await say(step.after || [], '다음 ▶');
  };
  async function fightBoss(id, opt) {
    const k = K(), M = k.M, P = k.P;
    const E = BATTLE.enemies[id];
    G.world.heavenText = E.heaven;
    let x, y;
    const from = opt.from && M.npcs[opt.from];
    if (from) { x = from.x; y = from.y; k.removeNpc(opt.from); }
    else if (opt.at) [x, y] = k.feet(opt.at[0], opt.at[1]);
    else { const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[P.dir]; x = P.x + d[0] * 110; y = P.y + d[1] * 110; }
    boss = spawnBoss(id, x, y);
    bossBar = document.querySelector('.world .bossbar');
    if (bossBar) bossBar.querySelector('.bn').textContent = E.name;
    M.combat = true;
    P.hp = P.maxHp = k.heroMaxHp(); P.inv = 1;
    G.audio.play(E.final ? 'final' : 'battle');
    await new Promise((res) => {
      k.setGoal({
        text: fill(E.name + G.util.josa(E.name, '을') + ' 물리쳐라'), targets: [],
        tick() {
          if (boss.dead && !this.over) {
            this.over = true;
            k.slowmo(0.3, 0.9); G.world.flash('rgba(255,255,255,.7)', 0.5); G.world.shake(10); G.audio.win();
            for (const m of M.enemies) if (!m.dead && !m.boss) { m.hp = 0; m.dead = true; m.deadT = 0; }
            setTimeout(res, 1700);
          }
        },
        hit() {},
      });
    });
    k.setGoal(null);
    const j = M.chars.indexOf(boss); if (j >= 0) M.chars.splice(j, 1);
    const i = M.enemies.indexOf(boss); if (i >= 0) M.enemies.splice(i, 1);
    boss = null; drawBossBar();
    C.clearAllies();
    M.combat = !!M.def.combat;
    G.world.heavenText = null;
    G.world.setMusic(M.def.music);
  }

  // ───────── 기술 나무 화면 ─────────
  C.openTree = function (o = {}) {
    const k = K();
    return new Promise((res) => {
      const ctx = k.openDlg({ full: true });
      ctx.dlg.classList.add('tree');
      const draw = () => {
        const s = sk(), st = S();
        ctx.main.innerHTML = '';
        ctx.main.appendChild(h('div.tree-head',
          h('h2', '기술 익히기'),
          h('div.tree-pts', h('span', '기술 점수'), h('b', String(s.points))),
          h('div.tree-abil', ['mu', 'byeong', 'sul'].map((key) => h('span.ab.' + key, h('b', G.battle.STAT_HAN[key]), G.battle.STAT_KO[key] + ' ' + st.abil[key])))));
        if (o.intro) ctx.main.appendChild(h('p.small.muted', boldNodes('지금까지 쌓은 **능력치**에 따라 익힐 수 있는 기술이 달라요. 2단계는 그 능력치 **3 이상**, 3단계는 **5 이상**이어야 해요. 단추로 쓰는 기술은 셋까지 올릴 수 있어요.')));
        const cols = h('div.tree-cols');
        for (const t of SK().trees) {
          const col = h('div.tree-col.' + t.stat, h('div.tree-title', h('span.han-big.' + t.stat, t.han), t.name + ' ' + st.abil[t.stat]));
          t.ids.forEach((id, i) => {
            const d = SK().list[id], c = C.check(id);
            const eq = s.equip.includes(id);
            const node = h('button.sk.' + c.state + (eq ? '.eq' : ''), { type: 'button' },
              h('span.sk-tier', `${i + 1}단계 · ${d.kind === 'active' ? '단추' : '늘 효과'}`),
              h('span.sk-name', h('b', d.name), ' ', h('small', d.hanja)),
              h('span.sk-desc', d.desc),
              h('span.sk-state', c.state === 'learned' ? (d.kind === 'active' ? (eq ? '✔ 단추에 올림(누르면 내리기)' : '익힘 · 누르면 단추에 올리기') : '✔ 익힘') : c.state === 'ready' ? '▶ 눌러서 익히기' : c.why));
            node.addEventListener('click', () => {
              if (c.state === 'ready') { C.learn(id); G.audio.grow(); G.ui.toast(`「${d.name}」을 익혔다!`); draw(); G.world.hud(); }
              else if (c.state === 'learned' && d.kind === 'active') { C.toggleEquip(id); G.audio.tap(); draw(); G.world.hud(); }
              else { G.audio.no(); G.ui.toast(c.why || ''); }
            });
            col.appendChild(node);
          });
          cols.appendChild(col);
        }
        ctx.main.appendChild(cols);
        if (!st.seen.skills) ctx.main.appendChild(G.ui.card({ kind: 'fiction', title: '기술', body: '기술과 그 효과는 게임 설정이에요.', real: '기술 이름은 영웅소설의 **군담**에 자주 나오는 무예·병법·도술(일기당천, 진법, 복병, 둔갑과 축지, 바람과 비를 부르는 도술 등)에서 따왔어요.' }));
        const done = h('button.btn.primary', { type: 'button', on: { click: () => { G.audio.tap(); st.seen.skills = true; G.save.write(); k.closeDlg(ctx); G.world.hud(); res(); } } }, s.points > 0 ? '나중에 익히기 ▶' : '다 익혔다 ▶');
        ctx.tray(h('div.actions', done));
      };
      draw();
    });
  };
})();
