'use strict';
// 탑뷰 맵 RPG 엔진
//  - 캔버스에 도트 맵(PPU 32)을 그리고, 주인공을 움직여 NPC와 말하고, 잡병과 실시간으로 싸운다.
//  - 이야기(대사·선택·이름·수련·카드 전투)는 기존 단계 실행기(js/game/steps.js)를 대화창에 띄워 그대로 쓴다.
//  - 한 장 = 맵 위의 "목표" 여러 개(js/data/quests.js). 목표를 이루면 그 목표에 묶인 단계가 대화창에서 펼쳐진다.
//  - 손맛(영상에서 배운 것): 히트 스톱 · 흰 번쩍임 · 넉백 · 화면 흔들림 · 파편 · 찌그러짐(스쿼시)
(function () {
  const T = 32;
  const { h, boldNodes } = G.util;
  const W = (G.world = {});
  const S = () => G.save.state;
  const SP = () => window.SPRITES || {};
  const fill = (s) => G.util.T(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ───────── 그림 불러오기 ─────────
  const imgs = {}, tints = {};
  function img(key) {
    let im = imgs[key];
    if (!im) { const m = SP()[key]; if (!m) return null; im = imgs[key] = new Image(); im.src = m.img; }
    return im.complete && im.naturalWidth ? im : null;
  }
  // 맞았을 때 번쩍이는 흰(또는 붉은) 실루엣
  function tint(key, color) {
    const k = key + color;
    if (tints[k]) return tints[k];
    const im = img(key); if (!im) return null;
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    return (tints[k] = c);
  }
  W.preload = function (keys) {
    return Promise.all(keys.map((k) => new Promise((res) => {
      const m = SP()[k]; if (!m) return res();
      let im = imgs[k];
      if (im && im.complete && im.naturalWidth) return res();
      if (!im) im = imgs[k] = new Image();
      const done = () => res();
      im.addEventListener('load', done, { once: true }); im.addEventListener('error', done, { once: true });
      if (!im.src) im.src = m.img;
      setTimeout(done, 4000);
    })));
  };
  // 대화창 얼굴: 도트 인물의 윗몸을 크게
  W.spriteFace = function (sp) {
    const c = document.createElement('canvas'); c.width = 40; c.height = 40; c.className = 'pxface';
    const draw = () => {
      const m = SP()[sp], im = img(sp); if (!m || !im) return false;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      const a = m.anims.walk_down; const i = a.start;
      const sx = (i % m.cols) * m.fw, sy = Math.floor(i / m.cols) * m.fh;
      // 머리 위 빈칸을 건너뛰고 윗몸 40×40만
      g.drawImage(im, sx + m.px - 20, sy + m.py - 50, 40, 40, 0, 0, 40, 40);
      return true;
    };
    if (!draw()) W.preload([sp]).then(draw);
    return c;
  };

  // ───────── 도트 글자(숫자·느낌표) ─────────
  const FONT = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001010010', 8: '111101111101111', 9: '111101111001111', '!': '010010010000010', '+': '000010111010000', '-': '000000111000000', '?': '111001011000010' };
  function ptext(g, s, x, y, color, sc = 1) {
    s = String(s);
    const w = s.length * 4 * sc - sc;
    const x0 = Math.round(x - w / 2), y0 = Math.round(y);
    for (let pass = 0; pass < 2; pass++) {
      let cx = x0;
      for (const ch of s) {
        const gl = FONT[ch];
        if (gl) for (let i = 0; i < 15; i++) if (gl[i] === '1') {
          const X = cx + (i % 3) * sc, Y = y0 + Math.floor(i / 3) * sc;
          if (pass) { g.fillStyle = color; g.fillRect(X, Y, sc, sc); } else { g.fillStyle = '#1b1612'; g.fillRect(X - 1, Y - 1, sc + 2, sc + 2); }
        }
        cx += 4 * sc;
      }
    }
  }

  // ───────── 상태 ─────────
  let M = null;              // 지금 맵
  let P = null;              // 주인공
  let cv, g0, buf, g, dark, gd, root, hudEl, padEl, joyEl, fadeEl, labelsOn = true;
  let scale = 2, vw = 320, vh = 240, dpr = 1;
  const cam = { x: 0, y: 0 };
  let shake = 0, hitstop = 0, scrFlash = null, time = 0;
  const parts = [], fx = [], texts = [];
  W.busy = 0; W.closedAt = 0;
  let goal = null;           // { text, targets:[id], resolve, kind }
  let running = false, last = 0, acc = 0, slowT = 0, slowK = 1;

  // ───────── 입력 ─────────
  const keys = new Set();
  const inp = { jx: 0, jy: 0, atk: false, talk: false, slot: [false, false, false], tree: false };
  const KEYMAP = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
  function typing(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); }
  function onKeyDown(e) {
    if (!running || typing(e)) return;
    if (W.busy || document.querySelector('.sheet-back, .overlay')) { keys.clear(); return; }
    const k = KEYMAP[e.code];
    if (k) { keys.add(k); e.preventDefault(); return; }
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'KeyJ') { inp.atk = true; e.preventDefault(); }
    else if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'KeyZ') { if (performance.now() - W.closedAt > 300) inp.talk = true; e.preventDefault(); }
    else if (e.code === 'KeyQ' || e.code === 'Digit1') { inp.slot[0] = true; e.preventDefault(); }
    else if (e.code === 'KeyR' || e.code === 'Digit2') { inp.slot[1] = true; e.preventDefault(); }
    else if (e.code === 'KeyF' || e.code === 'Digit3') { inp.slot[2] = true; e.preventDefault(); }
    else if (e.code === 'KeyT') { inp.tree = true; e.preventDefault(); }
  }
  function onKeyUp(e) { const k = KEYMAP[e.code]; if (k) keys.delete(k); }
  function onBlur() { keys.clear(); inp.jx = inp.jy = 0; }

  // 떠다니는 가상 조이스틱(왼쪽 아래 어디든 누른 자리에서 시작)
  function setupJoystick(zone) {
    const base = h('div.joy-base'), knob = h('div.joy-knob');
    joyEl = h('div.joy', base, knob);
    zone.appendChild(joyEl);
    let id = null, ox = 0, oy = 0;
    const R = 44;
    zone.addEventListener('pointerdown', (e) => {
      if (id !== null || W.busy) return;
      id = e.pointerId; ox = e.clientX; oy = e.clientY;
      zone.setPointerCapture(id);
      joyEl.classList.add('on');
      joyEl.style.left = ox + 'px'; joyEl.style.top = oy + 'px';
      knob.style.transform = 'translate(-50%,-50%)';
      G.audio.unlock();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - ox, dy = e.clientY - oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const m = Math.min(1, d / R);
      if (m < 0.18) { inp.jx = inp.jy = 0; return; }
      inp.jx = dx / R; inp.jy = dy / R;
    });
    const end = (e) => { if (e.pointerId !== id) return; id = null; inp.jx = inp.jy = 0; joyEl.classList.remove('on'); };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  }

  // ───────── 화면 만들기 ─────────
  const ICON = {
    toc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>',
  };
  const iconBtn = (name, label, fn) => h('button.icon-btn', { type: 'button', tabindex: -1, 'aria-label': label, title: label, html: ICON[name], on: { click: (e) => { e.currentTarget.blur(); G.audio.tap(); fn(); } } });
  let goalEl, goalSub, statusEl, talkBtn, atkBtn, slotBtns = [], treeBtn, hintEl;

  function mount() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    cv = h('canvas.wcv');
    const zone = h('div.joy-zone');
    goalEl = h('strong.goal-t');
    treeBtn = h('button.icon-btn.treebtn', { type: 'button', tabindex: -1, 'aria-label': '기술', title: '기술(T)', on: { click: (e) => { e.currentTarget.blur(); G.audio.tap(); inp.tree = true; } } }, h('span.th', '技'), h('span.badge'));
    goalSub = h('small.goal-s');
    statusEl = h('div.hud-status');
    hudEl = h('div.hud',
      h('div.hud-top', iconBtn('toc', '목차', () => G.app.toc()), h('div.goal', goalSub, goalEl), treeBtn, iconBtn('book', '편람', () => G.app.book('life')), iconBtn('gear', '설정', () => G.app.settings())),
      statusEl,
      h('div.bossbar', h('span.bn'), h('span.bb', h('i')), h('span.pz', h('i'))),
      h('div.tipbar'));
    const press = (el, fn) => {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); G.audio.unlock(); fn(); el.classList.add('down'); });
      const up = () => el.classList.remove('down');
      el.addEventListener('pointerup', up); el.addEventListener('pointerleave', up); el.addEventListener('pointercancel', up);
    };
    talkBtn = h('button.pbtn.talk', { type: 'button', tabindex: -1 }, h('span.pl', '말 걸기'), h('kbd', 'E'));
    atkBtn = h('button.pbtn.atk', { type: 'button', tabindex: -1, 'aria-label': '공격' }, h('span.ph', '⚔'), h('kbd', 'Space'));
    slotBtns = ['Q', 'R', 'F'].map((kb, i) => { const b = h('button.pbtn.slot.s' + i, { type: 'button', tabindex: -1, 'aria-label': '기술 ' + (i + 1) }, h('span.ph'), h('span.cd'), h('kbd', kb)); press(b, () => { inp.slot[i] = true; }); return b; });
    press(talkBtn, () => { inp.talk = true; });
    press(atkBtn, () => { inp.atk = true; });
    padEl = h('div.pad', talkBtn, h('div.slots', slotBtns), atkBtn);
    hintEl = h('div.keyhint', '이동 ← ↑ → ↓ / WASD · 말 걸기 E · 베기 Space · 기술 Q R F · 기술 익히기 T');
    fadeEl = h('div.wfade');
    root = h('div.world', cv, zone, hudEl, padEl, hintEl, fadeEl);
    app.appendChild(root);
    setupJoystick(zone);
    g0 = cv.getContext('2d');
    buf = document.createElement('canvas'); g = buf.getContext('2d');
    dark = document.createElement('canvas'); gd = dark.getContext('2d');
    resize();
    if (!W._listening) {
      W._listening = true;
      window.addEventListener('resize', () => { if (running) resize(); });
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onBlur);
    }
    setTimeout(() => hintEl && hintEl.classList.add('fade'), 9000);
    if (!running) { running = true; last = performance.now(); acc = 0; requestAnimationFrame(loop); }
  }

  function resize() {
    if (!cv) return;
    dpr = window.devicePixelRatio || 1;
    const cw = root.clientWidth || window.innerWidth, ch = root.clientHeight || window.innerHeight;
    const Wd = Math.round(cw * dpr), Hd = Math.round(ch * dpr);
    // 정수 배율: 휴대폰 세로면 가로 12칸 안팎, PC면 20칸 안팎이 보이게
    scale = Math.max(1, Math.round(Math.min(Wd / 400, Hd / 330)));
    cv.width = Wd; cv.height = Hd;
    vw = Math.ceil(Wd / scale); vh = Math.ceil(Hd / scale);
    buf.width = vw; buf.height = vh; dark.width = vw; dark.height = vh;
    g.imageSmoothingEnabled = false; g0.imageSmoothingEnabled = false;
  }

  // ───────── 맵 ─────────
  function tileAt(tx, ty) { const r = M.grid[ty]; return r ? r[tx] : undefined; }
  function feet(tx, ty) { return [(tx + 0.5) * T, (ty + 0.78) * T]; }

  function build(id) {
    const def = MAPS[id];
    if (!def) throw new Error('맵 없음: ' + id);
    const grid = def.grid;
    const m = {
      id, def, grid, gw: grid[0].length, gh: grid.length,
      ground: G.tiles.render(grid), props: [], boxes: [], chars: [], spots: {}, npcs: {}, enemies: [],
      night: !!def.night, fires: [], lights: [], hits: {}, combat: !!def.combat,
    };
    m.w = m.gw * T; m.h = m.gh * T;
    for (const p of def.props || []) {
      const [key, tx, ty, o = {}] = p;
      const sm = SP()[key]; if (!sm) continue;
      const x = Math.round(tx * T), y = Math.round((ty + 1) * T - sm.h);
      const e = { kind: 'prop', key, x, y, w: sm.w, h: sm.h, flat: !!o.flat || key === 'pr_lotus' || key === 'pr_flowers', hit: o.hit || null, dx: 0, flash: 0 };
      const f = sm.foot;
      e.sortY = y + (f[3] > f[1] ? f[3] : sm.h);
      if (f[2] > f[0] && !o.walk) { e.box = [x + f[0], y + f[1], x + f[2], y + f[3]]; m.boxes.push(e.box); }
      if (key === 'pr_bonfire' || key === 'pr_lantern') m.lights.push({ x: x + sm.w / 2, y: y + sm.h * 0.6, r: key === 'pr_bonfire' ? 84 : 52, fire: key === 'pr_bonfire' });
      m.props.push(e);
    }
    for (const sid in def.spots || {}) {
      const s = def.spots[sid];
      m.spots[sid] = Object.assign({ id: sid, w: 1, h: 1 }, s, { rx: s.x * T, ry: s.y * T, rw: (s.w || 1) * T, rh: (s.h || 1) * T });
    }
    return m;
  }

  function addNpc(id, d) {
    if (!d || (d.when && !G.steps.ok(d.when))) return;
    const old = M.npcs[id];
    if (old) M.chars.splice(M.chars.indexOf(old), 1);
    const [x, y] = freeSpot(...feet(d.x, d.y), 6);
    const who = d.who || null;
    const e = {
      kind: 'npc', id, sp: d.sp, x, y, hx: x, hy: y, dir: d.dir || 'down', t: 0, moving: false,
      who, name: d.name || (who ? G.util.who(who) : ''), talk: d.talk || null, talkBy: d.talkBy || null, ti: 0, solid: true, hw: 6,
      wander: d.wander || 0, wt: Math.random() * 3, sx: 1, sy: 1,
    };
    M.npcs[id] = e; M.chars.push(e);
  }
  function removeNpc(id) { const e = M.npcs[id]; if (!e) return; M.chars.splice(M.chars.indexOf(e), 1); delete M.npcs[id]; }

  W.avatar = function () {
    const q = QUESTS[W.chId] || {};
    if (W.avatarOverride) return W.avatarOverride;
    if (q.avatar) return q.avatar;
    const st = S(), look = st.look || 'child';
    const tb = st.path === 'f'
      ? { child: 'sp_hero_f_child', youth: 'sp_hero_f_scholar', general: 'sp_hero_f_general', lady: 'sp_hero_f_lady', sage: 'sp_hero_f_sage' }
      : { child: 'sp_hero_m_child', youth: 'sp_hero_m_youth', general: 'sp_hero_m_general', lady: 'sp_hero_m_youth', sage: 'sp_hero_m_youth' };
    return tb[look] || tb.child;
  };
  function refreshAvatar() {
    if (!P) return;
    P.sp = W.avatar();
    const m = SP()[P.sp];
    P.canAtk = !!(m && m.anims.atk_down);
    P.child = /child/.test(P.sp);
    P.speed = P.child ? 84 : 92;
    P.maxHp = heroMaxHp();
    if (P.hp == null || P.hp > P.maxHp) P.hp = P.maxHp;
  }
  function heroMaxHp() {
    const st = S();
    if (/child/.test(W.avatar())) return 6;
    return 10 + st.abil.mu + st.abil.byeong + (st.relic === 'armor' ? 3 : 0) + G.combat.hpBonus();
  }

  function placePlayer(sp) {
    const s = sp || M.def.spawn;
    const [x, y] = freeSpot(...feet(s[0], s[1]), 6);
    P.x = x; P.y = y; P.dir = s[2] || 'down';
    snapCam();
  }

  async function loadMap(id, spawn, cast) {
    const keys = new Set(['sp_hero_m_child', W.avatar()]);
    for (const p of MAPS[id].props || []) keys.add(p[0]);
    for (const n of Object.values(MAPS[id].npcs || {})) keys.add(n.sp);
    for (const n of Object.values(cast || {})) if (n) keys.add(n.sp);
    await W.preload([...keys]);
    M = build(id);
    if (!P) P = { kind: 'player', x: 0, y: 0, dir: 'down', t: 0, moving: false, atk: 0, atkDur: 0.22, atkCd: 0, skillCd: 0, inv: 0, flash: 0, kx: 0, ky: 0, sx: 1, sy: 1, hw: 6, dust: 0 };
    refreshAvatar();
    M.chars.push(P);
    const amb = MAPS[id].npcs || {};
    for (const nid in amb) if (!amb[nid].chs || amb[nid].chs.includes(W.chId)) addNpc(nid, amb[nid]);
    for (const nid in cast || {}) addNpc(nid, cast[nid]);
    placePlayer(spawn);
    W.setMusic(MAPS[id].music);
  }
  async function changeMap(id, spawn, cast) {
    fadeEl.classList.add('on');
    await G.util.wait(260);
    await loadMap(id, spawn, cast);
    fadeEl.classList.remove('on');
  }
  W.setMusic = function (name) { if (name) { W.music = name; G.audio.play(name); } };

  // ───────── 충돌 ─────────
  function blocked(x0, y0, x1, y1, self) {
    const tx0 = Math.floor(x0 / T), tx1 = Math.floor((x1 - 0.01) / T), ty0 = Math.floor(y0 / T), ty1 = Math.floor((y1 - 0.01) / T);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const c = tileAt(tx, ty);
      if (c === undefined || G.tiles.SOLID.has(c)) return true;
    }
    for (const b of M.boxes) if (x1 > b[0] && x0 < b[2] && y1 > b[1] && y0 < b[3]) return true;
    if (self === P) for (const e of M.chars) if (e.kind === 'npc' && e.solid) { if (x1 > e.x - 7 && x0 < e.x + 7 && y1 > e.y - 6 && y0 < e.y + 1) return true; }
    return false;
  }
  function move(e, dx, dy) {
    const hw = e.hw || 6, hh = 5;
    let mx = false, my = false;
    if (dx) { const nx = e.x + dx; if (!blocked(nx - hw, e.y - hh, nx + hw, e.y, e)) { e.x = nx; mx = true; } }
    if (dy) { const ny = e.y + dy; if (!blocked(e.x - hw, ny - hh, e.x + hw, ny, e)) { e.y = ny; my = true; } }
    // 모서리에 걸리면 살짝 비켜 준다(주인공만)
    if (e === P && dx && !mx && !dy) {
      for (const o of [3, 6, 9]) for (const s of [-1, 1]) {
        if (!blocked(e.x + dx - hw, e.y + s * o - hh, e.x + dx + hw, e.y + s * o, e)) { e.y += s * Math.min(1.5, o); return; }
      }
    }
    if (e === P && dy && !my && !dx) {
      for (const o of [3, 6, 9]) for (const s of [-1, 1]) {
        if (!blocked(e.x + s * o - hw, e.y + dy - hh, e.x + s * o + hw, e.y + dy, e)) { e.x += s * Math.min(1.5, o); return; }
      }
    }
  }
  const overlap = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  const body = (e) => { if (e.boss) return [e.x - 16, e.y - 62, e.x + 16, e.y]; const hgt = /child/.test(e.sp) ? 30 : 40; return [e.x - 9, e.y - hgt, e.x + 9, e.y]; };
  function atkBox(e, reach = 1) {
    const x = e.x, y = e.y, r = reach;
    switch (e.dir) {
      case 'up': return [x - 18, y - 48 * r, x + 18, y - 12];
      case 'left': return [x - 36 * r, y - 34, x - 2, y + 4];
      case 'right': return [x + 2, y - 34, x + 36 * r, y + 4];
      default: return [x - 18, y - 16, x + 18, y + 20 * r];
    }
  }
  function faceTo(e, tx, ty) {
    const dx = tx - e.x, dy = ty - e.y;
    e.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
  }

  // ───────── 효과 ─────────
  function burst(x, y, n, colors, pow = 90, up = 90, size = 2, life = 0.5) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = pow * (0.4 + Math.random() * 0.8);
      parts.push({ x, y, z: 10 + Math.random() * 14, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, vz: up * (0.5 + Math.random()), t: 0, life: life * (0.6 + Math.random() * 0.6), c: colors[i % colors.length], s: size + (Math.random() < 0.3 ? 1 : 0), grav: 320 });
    }
  }
  function puff(x, y, c = 'rgba(214,196,160,.9)') { parts.push({ x: x + (Math.random() * 6 - 3), y, z: 1, vx: (Math.random() - 0.5) * 20, vy: -4, vz: 14, t: 0, life: 0.35, c, s: 2, grav: 0 }); }
  function floatText(x, y, s, c) { texts.push({ x, y, s: String(s), c, t: 0 }); }
  W.shake = (n) => { shake = Math.max(shake, n); };
  W.flash = (c, t = 0.15) => { scrFlash = { c, t, max: t }; };

  // ───────── 싸움 ─────────
  const FOE = {
    sp_phantom: { hp: 2, dmg: 1, speed: 44, reach: 30, name: '허깨비 병사' },
    sp_assassin: { hp: 3, dmg: 2, speed: 56, reach: 28, name: '자객' },
    sp_barbarian: { hp: 3, dmg: 2, speed: 50, reach: 30, name: '오랑캐 군사' },
  };
  function spawnFoe(sp, tx, ty, o = {}) {
    const d = Object.assign({}, FOE[sp] || FOE.sp_barbarian, o);
    const [x, y] = freeSpot(...feet(tx, ty), 6);
    const e = { kind: 'enemy', sp, x, y, dir: 'down', t: Math.random(), moving: false, hp: d.hp, max: d.hp, dmg: d.dmg, speed: d.speed, reach: d.reach, state: 'idle', st: 0, cd: 0.6 + Math.random() * 0.8, atk: 0, atkDur: 0.26, flash: 0, kx: 0, ky: 0, sx: 1, sy: 1, hw: 6, stun: 0, aggro: o.aggro || 999, noAtk: !!o.noAtk };
    M.enemies.push(e); M.chars.push(e);
    // 나타날 때 먹물 연기
    burst(x, y - 10, 10, ['#2a2119', '#4a3f35', '#6d6259'], 50, 60, 2, 0.5);
    return e;
  }
  function heroDmg() { const mu = S().abil.mu; return 1 + (mu >= 3 ? 1 : 0) + (mu >= 5 ? 1 : 0); }
  function hitEnemy(e, dmg, pow = 170, src = 'slash', from = P) {
    if (e.dead) return;
    if (e.boss) { dmg = G.combat.bossDamage(e, dmg, src); pow *= 0.1; }
    e.hp -= dmg; e.flash = 0.12;
    const a = Math.atan2(e.y - from.y, e.x - from.x);
    e.kx = Math.cos(a) * pow; e.ky = Math.sin(a) * pow;
    e.sx = e.boss ? 1.08 : 1.25; e.sy = e.boss ? 0.93 : 0.8;
    if (!e.boss) e.stun = Math.max(e.stun, 0.28);
    if (!e.boss && (e.state === 'wind' || e.state === 'atk')) { e.state = 'chase'; e.atk = 0; }
    burst(e.x, e.y - 18, 7, ['#ffffff', '#ffe08a', '#f2a93b'], 110, 70, 2, 0.35);
    floatText(e.x, e.y - (e.boss ? 76 : 50), dmg, src === 'heavy' ? '#ffe08a' : '#ffffff');
    hitstop = Math.max(hitstop, src === 'heavy' ? 0.09 : 0.055); W.shake(src === 'heavy' ? 4 : 2.5);
    G.audio.guard();
    if (e.hp <= 0) {
      e.dead = true; e.deadT = 0;
      hitstop = 0.11; W.shake(5);
      burst(e.x, e.y - 16, 18, ['#1b1612', '#2a2119', '#b3342a', '#5a4a3a'], 140, 110, 3, 0.7);
      G.audio.hurt();
    }
  }
  function hitProp(p) {
    p.flash = 0.12; p.dx = 3;
    burst(p.x + p.w / 2, p.y + p.h * 0.75, 8, ['#e0c070', '#c9a13b', '#8a6a2a'], 90, 90, 2, 0.45);
    hitstop = Math.max(hitstop, 0.05); W.shake(2);
    G.audio.guard();
    M.hits[p.hit] = (M.hits[p.hit] || 0) + 1;
    floatText(p.x + p.w / 2, p.y + 4, M.hits[p.hit], '#ffe08a');
  }
  function playerAttack() {
    if (!P.canAtk || P.atk > 0 || P.atkCd > 0 || P.dash || P.whirl) return;
    P.atk = P.atkDur; P.hitDone = false; P.atkCd = 0.32;
    // 연환검: 베기를 이어 가면 세 번째가 크게
    P.combo = time - (P.lastSwing || -9) < 0.9 ? (P.combo || 0) + 1 : 1;
    P.lastSwing = time;
    P.heavy = G.combat.has('combo') && P.combo % 3 === 0;
    P.sx = P.heavy ? 1.24 : 1.14; P.sy = P.heavy ? 0.8 : 0.88;
    fx.push({ k: 'slash', x: P.x, y: P.y, dir: P.dir, t: 0, life: P.heavy ? 0.2 : 0.14, big: P.heavy });
    G.audio.slash();
  }
  function hurtPlayer(dmg, from) {
    if (P.inv > 0 || W.busy) return;
    const st = S();
    dmg = Math.max(1, dmg - (st.abil.byeong >= 5 ? 1 : 0) - G.combat.guard());
    P.hp -= dmg; P.inv = 0.9; P.flash = 0.12;
    const a = Math.atan2(P.y - from.y, P.x - from.x);
    P.kx = Math.cos(a) * 150; P.ky = Math.sin(a) * 150;
    P.sx = 0.82; P.sy = 1.18;
    floatText(P.x, P.y - 50, '-' + dmg, '#ff6b5a');
    burst(P.x, P.y - 18, 6, ['#b3342a', '#ff6b5a'], 90, 60, 2, 0.35);
    W.flash('rgba(179,52,42,.28)', 0.18);
    hitstop = Math.max(hitstop, 0.07); W.shake(4);
    G.audio.hurt();
    W.hud();
    if (P.hp <= 0 && W.onDown) W.onDown();
  }

  // ───────── 갱신 ─────────
  function update(dt) {
    time += dt;
    updateFx(dt);
    if (hitstop > 0) { hitstop -= dt; return; }
    // 대화창·목차·편람·설정이 떠 있으면 세상이 멈춘다
    if (W.busy || document.querySelector('.overlay, .sheet-back')) { keys.clear(); idleNpcs(dt); return; }
    // 입력
    let ix = inp.jx, iy = inp.jy;
    if (keys.has('l')) ix -= 1; if (keys.has('r')) ix += 1; if (keys.has('u')) iy -= 1; if (keys.has('d')) iy += 1;
    const im = Math.hypot(ix, iy);
    if (im > 1) { ix /= im; iy /= im; }
    const slow = P.atk > 0 ? 0.25 : 1;
    P.moving = im > 0.05 && !P.frozen;
    if (P.moving) {
      if (P.atk <= 0) P.dir = Math.abs(ix) > Math.abs(iy) ? (ix < 0 ? 'left' : 'right') : (iy < 0 ? 'up' : 'down');
      move(P, ix * P.speed * slow * dt, iy * P.speed * slow * dt);
      P.t += dt * Math.min(1, im + 0.2);
      P.dust -= dt;
      if (P.dust <= 0) { P.dust = 0.16; puff(P.x, P.y); }
    }
    if (P.kx || P.ky) { move(P, P.kx * dt, P.ky * dt); P.kx *= 0.82; P.ky *= 0.82; if (Math.abs(P.kx) + Math.abs(P.ky) < 4) P.kx = P.ky = 0; }
    P.inv = Math.max(0, P.inv - dt); P.atkCd = Math.max(0, P.atkCd - dt);
    if (inp.atk) { inp.atk = false; playerAttack(); }
    for (let i = 0; i < 3; i++) if (inp.slot[i]) { inp.slot[i] = false; G.combat.cast(i); }
    if (inp.tree) { inp.tree = false; if (G.combat.shown()) G.combat.openTree(); }
    G.combat.update(dt);
    if (P.atk > 0) {
      P.atk -= dt;
      if (!P.hitDone && P.atk < P.atkDur * 0.72) {
        P.hitDone = true;
        const box = atkBox(P);
        for (const e of M.enemies) if (!e.dead && overlap(box, body(e))) hitEnemy(e, heroDmg() * (P.heavy ? 2 : 1), P.heavy ? 320 : 170, P.heavy ? 'heavy' : 'slash');
        for (const p of M.props) if (p.hit && overlap(box, [p.x + 4, p.y + p.h * 0.3, p.x + p.w - 4, p.y + p.h])) hitProp(p);
      }
      if (P.atk <= 0) P.atk = 0;
    }
    // 적
    for (const e of M.enemies) updateEnemy(e, dt);
    for (let i = 0; i < M.enemies.length; i++) for (let j = i + 1; j < M.enemies.length; j++) {
      const a = M.enemies[i], b = M.enemies[j]; if (a.dead || b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d < 16 && d > 0.01) { const push = (16 - d) * 0.5; move(a, -dx / d * push, -dy / d * push); move(b, dx / d * push, dy / d * push); }
    }
    for (let i = M.enemies.length - 1; i >= 0; i--) if (M.enemies[i].gone) { M.chars.splice(M.chars.indexOf(M.enemies[i]), 1); M.enemies.splice(i, 1); }
    idleNpcs(dt);
    // 말 걸기
    const near = nearest();
    W.near = near;
    if (inp.talk) { inp.talk = false; if (near) interact(near); }
    // 저절로 밟는 자리(출구·목표 지점)
    for (const sid in M.spots) {
      const s = M.spots[sid];
      if (!s.auto && !(goal && goal.zones && goal.zones.includes(sid))) continue;
      if (P.x > s.rx && P.x < s.rx + s.rw && P.y > s.ry && P.y < s.ry + s.rh) {
        if (goal && goal.zones && goal.zones.includes(sid)) goal.hit(sid);
      }
    }
    if (goal && goal.tick) goal.tick(dt);
    padState(near);
  }

  function updateEnemy(e, dt) {
    if (e.boss) return G.combat.updateBoss(e, dt);
    if (e.slow > 0) { e.slow -= dt; dt *= 0.55; }
    e.flash = Math.max(0, e.flash - dt);
    e.sx += (1 - e.sx) * Math.min(1, dt * 14); e.sy += (1 - e.sy) * Math.min(1, dt * 14);
    if (e.dead) { e.deadT += dt; e.alpha = Math.max(0, 1 - e.deadT / 0.45) * (Math.floor(e.deadT * 30) % 2 ? 0.5 : 1); if (e.deadT > 0.45) e.gone = true; return; }
    if (e.kx || e.ky) { move(e, e.kx * dt, e.ky * dt); e.kx *= 0.8; e.ky *= 0.8; if (Math.abs(e.kx) + Math.abs(e.ky) < 4) e.kx = e.ky = 0; }
    if (e.stun > 0) { e.stun -= dt; e.moving = false; return; }
    e.cd -= dt;
    const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (e.state === 'idle') { if (d < e.aggro * T) e.state = 'chase'; return; }
    if (e.state === 'chase') {
      faceTo(e, P.x, P.y);
      if (!e.noAtk && d < e.reach + 6 && e.cd <= 0) { e.state = 'wind'; e.st = 0.4; e.moving = false; return; }
      if (e.noAtk && d < 14) { hurtPlayer(e.dmg, e); }
      if (d > e.reach - 6 || e.noAtk) { move(e, dx / d * e.speed * dt, dy / d * e.speed * dt); e.moving = true; e.t += dt; }
      else e.moving = false;
      return;
    }
    if (e.state === 'wind') {
      e.st -= dt; e.moving = false;
      if (e.st <= 0) { e.state = 'atk'; e.atk = e.atkDur; e.hitDone = false; e.sx = 1.12; e.sy = 0.9; }
      return;
    }
    if (e.state === 'atk') {
      e.atk -= dt;
      if (!e.hitDone && e.atk < e.atkDur * 0.55) { e.hitDone = true; fx.push({ k: 'slash', x: e.x, y: e.y, dir: e.dir, t: 0, life: 0.12, foe: true }); if (overlap(atkBox(e, 0.85), body(P))) hurtPlayer(e.dmg, e); }
      if (e.atk <= 0) { e.atk = 0; e.state = 'chase'; e.cd = 0.8 + Math.random() * 0.6; }
    }
  }

  function idleNpcs(dt) {
    for (const e of M.chars) {
      if (e.kind === 'player') { e.flash = Math.max(0, e.flash - dt); e.sx += (1 - e.sx) * Math.min(1, dt * 14); e.sy += (1 - e.sy) * Math.min(1, dt * 14); continue; }
      if (e.kind !== 'npc') continue;
      if (!e.wander || W.busy) { e.moving = false; continue; }
      e.wt -= dt;
      if (e.wt <= 0) {
        e.wt = 1.5 + Math.random() * 3;
        const r = e.wander * T;
        e.goal = Math.random() < 0.4 ? null : [e.hx + (Math.random() * 2 - 1) * r, e.hy + (Math.random() * 2 - 1) * r];
      }
      if (e.goal && Math.hypot(P.x - e.x, P.y - e.y) > 40) {
        const dx = e.goal[0] - e.x, dy = e.goal[1] - e.y, d = Math.hypot(dx, dy);
        if (d < 2) { e.goal = null; e.moving = false; continue; }
        const ox = e.x, oy = e.y;
        move(e, dx / d * 30 * dt, dy / d * 30 * dt);
        if (ox === e.x && oy === e.y) { e.goal = null; e.moving = false; continue; }
        faceTo(e, e.goal[0], e.goal[1]); e.moving = true; e.t += dt;
      } else e.moving = false;
    }
  }

  function updateFx(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= p.grav * dt;
      if (p.z < 0) { p.z = 0; p.vz *= -0.35; p.vx *= 0.6; p.vy *= 0.6; }
    }
    for (let i = fx.length - 1; i >= 0; i--) { fx[i].t += dt; if (fx[i].t >= fx[i].life) fx.splice(i, 1); }
    for (let i = texts.length - 1; i >= 0; i--) { texts[i].t += dt; if (texts[i].t > 0.8) texts.splice(i, 1); }
    for (const p of M.props) { if (p.flash > 0) p.flash -= dt; if (p.dx) p.dx = Math.abs(p.dx) < 0.5 ? 0 : -p.dx * 0.7; }
    if (P) P.flash = Math.max(0, P.flash - dt);
    shake = shake > 0.2 ? shake * Math.pow(0.001, dt) : 0;
    if (scrFlash) { scrFlash.t -= dt; if (scrFlash.t <= 0) scrFlash = null; }
    // 불길
    for (const f of M.fires) {
      // 불길: 굵은 불덩이 + 튀는 불티 + 연기
      if (Math.random() < dt * 40) parts.push({ x: f[0] + (Math.random() - 0.5) * 40, y: f[1], z: 10 + Math.random() * 20, vx: (Math.random() - 0.5) * 14, vy: 0, vz: 30 + Math.random() * 40, t: 0, life: 0.5 + Math.random() * 0.4, c: ['#ffd24a', '#ff8a2a', '#e04a1a', '#ffe9a0'][Math.floor(Math.random() * 4)], s: 3 + Math.floor(Math.random() * 3), grav: -30, glow: true });
      if (Math.random() < dt * 14) parts.push({ x: f[0] + (Math.random() - 0.5) * 30, y: f[1], z: 30 + Math.random() * 20, vx: (Math.random() - 0.5) * 30, vy: 0, vz: 70 + Math.random() * 60, t: 0, life: 0.8 + Math.random() * 0.6, c: '#ffe9a0', s: 1, grav: 10, glow: true });
      if (Math.random() < dt * 6) parts.push({ x: f[0] + (Math.random() - 0.5) * 30, y: f[1], z: 50 + Math.random() * 20, vx: 8 + Math.random() * 10, vy: 0, vz: 24, t: 0, life: 1.6, c: 'rgba(60,50,50,.55)', s: 5, grav: 0 });
    }
    // 카메라
    const tx = P.x - vw / 2, ty = P.y - 20 - vh / 2;
    const k = Math.min(1, dt * 9);
    cam.x += (camClampX(tx) - cam.x) * k; cam.y += (camClampY(ty) - cam.y) * k;
  }
  const camClampX = (x) => (M.w <= vw ? (M.w - vw) / 2 : clamp(x, 0, M.w - vw));
  const camClampY = (y) => (M.h <= vh ? (M.h - vh) / 2 : clamp(y, 0, M.h - vh));
  function snapCam() { if (!P || !M) return; cam.x = camClampX(P.x - vw / 2); cam.y = camClampY(P.y - 20 - vh / 2); }

  // ───────── 말 걸기·살피기 ─────────
  function nearest() {
    let best = null, bd = 1e9;
    const isGoal = (id) => goal && goal.targets && goal.targets.includes(id);
    for (const id in M.npcs) {
      const e = M.npcs[id];
      if (!e.talk && !isGoal(id)) continue;
      const d = Math.hypot(e.x - P.x, (e.y - P.y) * 1.3);
      if (d < 36) { const s = d - (isGoal(id) ? 100 : 0); if (s < bd) { bd = s; best = { type: 'npc', id, e }; } }
    }
    for (const id in M.spots) {
      const s = M.spots[id];
      if (s.auto) continue;
      if (!s.look && !isGoal(id) && !s.hint) continue;
      const pad = 14;
      if (P.x > s.rx - pad && P.x < s.rx + s.rw + pad && P.y > s.ry - pad && P.y < s.ry + s.rh + pad + 6) {
        const d = Math.hypot(s.rx + s.rw / 2 - P.x, s.ry + s.rh / 2 - P.y) - (isGoal(id) ? 100 : 0) + 20;
        if (d < bd) { bd = d; best = { type: 'spot', id, s }; }
      }
    }
    return best;
  }
  async function interact(n) {
    const id = n.id;
    if (n.type === 'npc') { faceTo(n.e, P.x, P.y); faceTo(P, n.e.x, n.e.y); }
    if (goal && goal.targets && goal.targets.includes(id)) { goal.hit(id); return; }
    if (n.type === 'npc' && n.e.talk) return chat(n.e);
    if (n.type === 'spot') {
      if (n.s.look) return chat({ name: n.s.name || '', lines: [].concat(n.s.look) });
      if (n.s.hint) G.ui.toast(fill(n.s.hint));
    }
  }

  // 대화창: 기존 단계 실행기가 그리는 자리
  function openDlg(o = {}) {
    const main = h('div.dlg-main.main-inner');
    const tray = h('div.dlg-tray.hide');
    const box = h('div.dlg-box', h('div.dlg-scroll', main), tray);
    const back = h('div.dlg' + (o.full ? '.full' : '') + (o.small ? '.small' : ''), box);
    root.appendChild(back);
    W.busy++; keys.clear(); inp.jx = inp.jy = 0;
    if (joyEl) joyEl.classList.remove('on');
    root.classList.add('talking');
    return {
      main, dlg: back,
      tray(content) { tray.innerHTML = ''; if (content) tray.appendChild(content); tray.classList.toggle('hide', !content); },
      trayEl: () => tray,
      refresh() { W.hud(); },
    };
  }
  function closeDlg(ctx) {
    if (ctx.dlg.isConnected) ctx.dlg.remove();
    W.busy = Math.max(0, W.busy - 1);
    if (!W.busy) root.classList.remove('talking');
    W.closedAt = performance.now();
    refreshAvatar(); W.hud();
  }
  W.openDlg = openDlg; W.closeDlg = closeDlg;

  function npcLine(npc, t) {
    if (npc.who) return G.steps.line({ who: npc.who, t }, null);
    return h('div.para.say.show', { style: { '--pc': '#5a4a3a' } }, h('div.who', W.spriteFace(npc.sp)), h('div.bubble', h('span.nm', npc.name), boldNodes(fill(t))));
  }
  async function chat(npc) {
    let lines;
    if (npc.lines) lines = npc.lines;
    else {
      // 장마다 다른 말(talkBy.ch3 …)이 있으면 그것을, 없으면 늘 하는 말을 차례로
      const all = (npc.talkBy && npc.talkBy[W.chId]) || npc.talk;
      const pick = all[npc.ti % all.length]; npc.ti++; lines = [].concat(pick);
    }
    lines = lines.filter((l) => typeof l === 'string' || G.steps.ok(l.when));
    const ctx = openDlg({ small: true });
    const box = h('div.says'); ctx.main.appendChild(box);
    G.audio.page();
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      let el;
      if (typeof l === 'string') el = npc.sp || npc.who ? npcLine(npc, l) : h('div.para.narr.show', boldNodes(fill(l)));
      else if (l.t != null && !l.who && (npc.sp || npc.who)) el = npcLine(npc, l.t); // { when, t }: 그 사람이 하는 조건 붙은 말
      else el = G.steps.line(l, ctx);
      if (!el) continue;
      box.appendChild(el);
      el.scrollIntoView({ block: 'nearest' });
      await G.steps.nextButton(ctx, i === lines.length - 1 ? '닫기' : '▶');
    }
    closeDlg(ctx);
  }
  W.chat = chat;

  // ───────── 그리기 ─────────
  function drawChar(e, cx, cy) {
    const m = SP()[e.sp], im = img(e.sp); if (!m || !im) return;
    let dir = e.dir, flip = 1;
    if (dir === 'right') { dir = 'left'; flip = -1; }
    const atkAn = m.anims['atk_' + dir];
    let a, f;
    if (e.atk > 0 && atkAn) { a = atkAn; f = Math.min(a.n - 1, Math.floor((1 - e.atk / e.atkDur) * a.n)); }
    else if (e.state === 'wind' && atkAn) { a = atkAn; f = 0; }
    else { a = m.anims['walk_' + dir] || m.anims.walk_down; f = e.moving ? Math.floor(e.t * a.fps) % a.n : 0; }
    const i = a.start + f, sx = (i % m.cols) * m.fw, sy = Math.floor(i / m.cols) * m.fh;
    const x = Math.round(e.x - cx), y = Math.round(e.y - cy);
    if (x < -m.fw || x > vw + m.fw || y < -10 || y > vh + m.fh) return;
    // 그림자
    g.fillStyle = 'rgba(20,16,10,.28)';
    g.beginPath(); g.ellipse(x, y - 1, e.boss ? 18 : /child/.test(e.sp) ? 7 : 9, e.boss ? 5 : 3, 0, 0, Math.PI * 2); g.fill();
    if (e.kind === 'player' && e.inv > 0 && Math.floor(e.inv * 20) % 2) return; // 무적 깜빡임
    g.save();
    g.translate(x, y);
    g.scale(flip * (e.sx || 1), e.sy || 1);
    if (e.alpha != null) g.globalAlpha = e.alpha;
    g.drawImage(im, sx, sy, m.fw, m.fh, -m.px, -m.py, m.fw, m.fh);
    if (e.state === 'wind') { const r = tint(e.sp, '#ff3b2a'); if (r) { g.globalAlpha = 0.35 + 0.35 * Math.sin(time * 40); g.drawImage(r, sx, sy, m.fw, m.fh, -m.px, -m.py, m.fw, m.fh); } }
    if (e.flash > 0) { const w = tint(e.sp, '#ffffff'); if (w) { g.globalAlpha = 1; g.drawImage(w, sx, sy, m.fw, m.fh, -m.px, -m.py, m.fw, m.fh); } }
    g.restore();
    // 적 기력 막대
    if (e.kind === 'enemy' && !e.boss && !e.dead && e.hp < e.max) {
      const bw = 18; g.fillStyle = '#1b1612'; g.fillRect(x - bw / 2 - 1, y - 48, bw + 2, 4);
      g.fillStyle = '#b3342a'; g.fillRect(x - bw / 2, y - 47, Math.round(bw * e.hp / e.max), 2);
    }
    if (e.state === 'wind') ptext(g, '!', x, y - 58, '#ff5a3a');
  }
  function drawProp(p, cx, cy) {
    const im = img(p.key); if (!im) return;
    const x = Math.round(p.x - cx + (p.dx || 0)), y = Math.round(p.y - cy);
    if (x > vw || y > vh || x + p.w < 0 || y + p.h < 0) return;
    g.drawImage(im, x, y);
    if (p.flash > 0) { const w = tint(p.key, '#ffffff'); if (w) g.drawImage(w, x, y); }
  }
  function drawSlash(f, cx, cy) {
    const k = f.t / f.life;
    const x = f.x - cx, y = f.y - cy - 18;
    const ang = { down: Math.PI / 2, up: -Math.PI / 2, left: Math.PI, right: 0 }[f.dir];
    g.save();
    g.translate(Math.round(x), Math.round(y));
    g.strokeStyle = f.foe ? `rgba(255,120,90,${1 - k})` : `rgba(255,255,255,${1 - k})`;
    g.lineWidth = 3;
    if (f.big) { g.lineWidth = 5; g.strokeStyle = `rgba(255,224,138,${1 - k})`; }
    g.beginPath(); g.arc(0, 0, (f.big ? 30 : 22) + k * 6, ang - 1.1 + k * 0.5, ang + 1.1 - k * 0.3); g.stroke();
    g.lineWidth = 3;
    g.lineWidth = 1; g.strokeStyle = f.foe ? `rgba(255,200,160,${1 - k})` : `rgba(255,236,160,${1 - k})`;
    g.beginPath(); g.arc(0, 0, 17 + k * 6, ang - 0.8, ang + 0.8); g.stroke();
    g.restore();
  }
  function marker(x, y, kind) {
    const b = Math.round(Math.sin(time * 5) * 2);
    y = Math.round(y + b); x = Math.round(x);
    if (kind === 'goal') {
      g.fillStyle = '#1b1612'; g.fillRect(x - 5, y - 13, 11, 13);
      g.fillStyle = '#f2c94c'; g.fillRect(x - 4, y - 12, 9, 11);
      g.fillStyle = '#1b1612'; g.fillRect(x - 1, y - 11, 3, 6); g.fillRect(x - 1, y - 4, 3, 2);
      g.fillStyle = '#1b1612'; g.fillRect(x - 1, y, 3, 2);
    } else {
      g.fillStyle = '#1b1612'; g.fillRect(x - 6, y - 9, 13, 9);
      g.fillStyle = '#f7efdc'; g.fillRect(x - 5, y - 8, 11, 7);
      g.fillStyle = '#5a4a3a'; g.fillRect(x - 3, y - 5, 1, 1); g.fillRect(x, y - 5, 1, 1); g.fillRect(x + 3, y - 5, 1, 1);
      g.fillStyle = '#1b1612'; g.fillRect(x - 1, y, 3, 2);
    }
  }
  function targetPos(id) {
    if (M.npcs[id]) { const e = M.npcs[id]; const m = SP()[e.sp]; return [e.x, e.y - (m ? m.py - 6 : 48) + 4, e.name]; }
    const s = M.spots[id]; if (s) return [s.rx + s.rw / 2, s.ry + s.rh / 2 - (s.mh || 20), s.name || ''];
    if (id && id[0] === '@') { const p = M.props.find((q) => q.hit === id.slice(1)); if (p) return [p.x + p.w / 2, p.y - 2, '']; }
    return null;
  }

  function render() {
    const sx = shake ? (Math.random() * 2 - 1) * shake : 0, sy = shake ? (Math.random() * 2 - 1) * shake : 0;
    const cx = Math.round(cam.x + sx), cy = Math.round(cam.y + sy);
    g.fillStyle = '#1b1a17'; g.fillRect(0, 0, vw, vh);
    // 땅: 보이는 부분만 옮겨 그린다
    const gx = Math.max(0, cx), gy = Math.max(0, cy);
    const gw = Math.min(M.w - gx, vw - (gx - cx)), gh = Math.min(M.h - gy, vh - (gy - cy));
    if (gw > 0 && gh > 0) g.drawImage(M.ground.canvas, gx, gy, gw, gh, gx - cx, gy - cy, gw, gh);
    // 물결
    const wf = Math.floor(time * 3) % 8;
    const tx0 = Math.floor(cx / T), ty0 = Math.floor(cy / T), tx1 = Math.ceil((cx + vw) / T), ty1 = Math.ceil((cy + vh) / T);
    for (const [wx, wy] of M.ground.water) if (wx >= tx0 && wx <= tx1 && wy >= ty0 && wy <= ty1) G.tiles.draw(g, '~', wx * T - cx, wy * T - cy, wx, wy, wf);
    // 바닥에 붙은 소품
    for (const p of M.props) if (p.flat) drawProp(p, cx, cy);
    G.combat.drawGround(g, cx, cy);
    // 세워진 것들을 발밑 y로 정렬
    const list = [];
    for (const p of M.props) if (!p.flat) list.push([p.sortY, p]);
    for (const e of M.chars) list.push([e.y, e]);
    list.sort((a, b) => a[0] - b[0]);
    for (const [, o] of list) (o.kind === 'prop' ? drawProp : drawChar)(o, cx, cy);
    // 파편
    const drawParts = (glow) => {
      for (const p of parts) {
        if (!!p.glow !== glow) continue;
        const a = 1 - p.t / p.life;
        g.globalAlpha = Math.min(1, a * 1.6);
        g.fillStyle = p.c;
        g.fillRect(Math.round(p.x - cx), Math.round(p.y - cy - p.z), p.s, p.s);
      }
      g.globalAlpha = 1;
    };
    drawParts(false);
    G.combat.drawTop(g, cx, cy);
    for (const f of fx) {
      if (f.k === 'slash') drawSlash(f, cx, cy);
      else if (f.k === 'ring') {
        const k = f.t / f.life;
        g.strokeStyle = f.c ? f.c : `rgba(242,210,75,${1 - k})`; g.globalAlpha = f.c ? 1 - k : 1; g.lineWidth = 3;
        g.beginPath(); g.ellipse(Math.round(f.x - cx), Math.round(f.y - cy + 10), f.r * k, f.r * k * 0.6, 0, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = `rgba(179,52,42,${1 - k})`; g.lineWidth = 1;
        g.beginPath(); g.ellipse(Math.round(f.x - cx), Math.round(f.y - cy + 10), f.r * k * 0.8, f.r * k * 0.48, 0, 0, Math.PI * 2); g.stroke();
        g.globalAlpha = 1;
      }
    }
    // 밤
    if (M.night) {
      gd.globalCompositeOperation = 'source-over';
      gd.clearRect(0, 0, vw, vh);
      gd.fillStyle = 'rgba(10,14,40,.72)'; gd.fillRect(0, 0, vw, vh);
      gd.globalCompositeOperation = 'destination-out';
      const light = (x, y, r) => { const gr = gd.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); gd.fillStyle = gr; gd.fillRect(x - r, y - r, r * 2, r * 2); };
      light(P.x - cx, P.y - cy - 16, 72);
      for (const l of M.lights) light(l.x - cx, l.y - cy, l.r * (l.fire ? 0.92 + Math.random() * 0.1 : 1));
      for (const f of M.fires) light(f[0] - cx, f[1] - cy - 10, 110 + Math.random() * 12);
      g.drawImage(dark, 0, 0);
      if (M.fires.length) {
        g.fillStyle = 'rgba(255,120,40,.07)'; g.fillRect(0, 0, vw, vh);
        g.globalCompositeOperation = 'lighter';
        for (const f of M.fires) { const x = f[0] - cx, y = f[1] - cy - 24, r = 60 + Math.random() * 8; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,140,40,.35)'); gr.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
        g.globalCompositeOperation = 'source-over';
      }
    }
    drawParts(true); // 불티는 어둠 위에서 빛난다
    // 목표 표시
    const labels = [];
    if (goal && goal.targets && !W.busy) for (const id of goal.targets) {
      const tp = targetPos(id); if (!tp) continue;
      const [x, y, nm] = tp;
      const inView = x - cx > 8 && x - cx < vw - 8 && y - cy > 8 && y - cy < vh - 8;
      if (inView) { marker(x - cx, y - cy, 'goal'); if (goal.labels !== false) labels.push([x - cx, y - cy - 16, goal.labelOf ? goal.labelOf(id) : nm]); }
      else edgeArrow(x - cx, y - cy);
    }
    if (!W.busy) for (const id in M.npcs) {
      const e = M.npcs[id];
      if (!e.talk || (goal && goal.targets && goal.targets.includes(id))) continue;
      if (Math.hypot(e.x - P.x, e.y - P.y) < 70) { const m = SP()[e.sp]; marker(e.x - cx, e.y - cy - (m ? m.py - 6 : 48) + 4, 'talk'); }
    }
    for (const t of texts) {
      const k = t.t / 0.8;
      ptext(g, t.s, t.x - cx, t.y - cy - k * 16, t.c);
    }
    if (scrFlash) { g.globalAlpha = scrFlash.t / scrFlash.max; g.fillStyle = scrFlash.c; g.fillRect(0, 0, vw, vh); g.globalAlpha = 1; }
    // 화면에 크게 옮기기
    g0.drawImage(buf, 0, 0, vw, vh, 0, 0, vw * scale, vh * scale);
    // 글자(또렷하게 원래 해상도로)
    if (labels.length && labelsOn) {
      const fs = Math.round(12 * dpr);
      g0.font = `700 ${fs}px ${W.font || (W.font = getComputedStyle(document.body).fontFamily)}`;
      g0.textAlign = 'center'; g0.textBaseline = 'bottom';
      for (const [x, y, s] of labels) {
        if (!s) continue;
        const X = x * scale, Y = y * scale;
        const tw = g0.measureText(s).width + 12 * dpr;
        g0.fillStyle = 'rgba(27,22,18,.82)';
        g0.fillRect(X - tw / 2, Y - fs - 6 * dpr, tw, fs + 8 * dpr);
        g0.fillStyle = '#f7efdc';
        g0.fillText(s, X, Y - 2 * dpr);
      }
    }
  }
  function edgeArrow(x, y) {
    const m = 14;
    const ex = clamp(x, m, vw - m), ey = clamp(y, m + 30, vh - m - 40);
    const a = Math.atan2(y - ey, x - ex);
    g.save(); g.translate(Math.round(ex), Math.round(ey)); g.rotate(a);
    const b = Math.sin(time * 6) * 2;
    g.fillStyle = '#1b1612'; g.beginPath(); g.moveTo(9 + b, 0); g.lineTo(-6 + b, -8); g.lineTo(-6 + b, 8); g.closePath(); g.fill();
    g.fillStyle = '#f2c94c'; g.beginPath(); g.moveTo(6 + b, 0); g.lineTo(-4 + b, -5); g.lineTo(-4 + b, 5); g.closePath(); g.fill();
    g.restore();
  }

  function loop(now) {
    if (!running) return;
    if (!cv || !cv.isConnected) { running = false; keys.clear(); return; }
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000; last = now;
    if (!M || !P) return; // 맵을 불러오는 중
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    const step = 1 / 60;
    let n = 0;
    try {
      while (acc >= step && n < 6) { update(step * (slowT > 0 ? slowK : 1)); if (slowT > 0) slowT -= step; acc -= step; n++; }
      if (n === 6) acc = 0;
      render();
      G.combat.frame();
    } catch (e) {
      if (!W._err) { W._err = true; console.error(e); } // 한 번만 알리고 계속 돈다
    }
  }

  // ───────── 머리 위 알림판(HUD) ─────────
  W.hud = function () {
    if (!statusEl) return;
    const st = S();
    statusEl.innerHTML = '';
    if (P && M && (M.enemies.length || M.combat)) {
      const k = clamp(P.hp / P.maxHp, 0, 1);
      statusEl.appendChild(h('div.hp', h('span.hl', '기력'), h('span.hbar' + (k < 0.35 ? '.low' : ''), h('i', { style: { width: Math.round(k * 100) + '%' } })), h('span.hv', Math.max(0, P.hp) + '/' + P.maxHp)));
    }
    if (st.path && W.chId !== 'ch0' && !(QUESTS[W.chId] || {}).avatar) {
      const ab = ['mu', 'byeong', 'sul'].map((k) => h('span.ab.' + k, h('b', G.battle.STAT_HAN[k]), String(st.abil[k])));
      const relic = st.relic ? h('span.ab.relic', h('b', BATTLE.relics[st.relic].han)) : null;
      const gauge = st.disguised ? h('span.doubt', h('span.dl', '의심'), h('span.dbar' + (st.doubt >= 70 ? '.hot' : ''), h('i', { style: { width: st.doubt + '%' } }))) : null;
      statusEl.appendChild(h('button.status-btn', { type: 'button', tabindex: -1, on: { click: (e) => { e.currentTarget.blur(); G.audio.tap(); G.app.showStats(); } } }, h('span.abs', ab, relic), gauge));
    }
    if (goal) setGoalText(goal.text, goal.sub);
    if (treeBtn) {
      const sk = G.combat.state();
      treeBtn.classList.toggle('on', G.combat.shown() && W.chId !== 'ch0' && !(QUESTS[W.chId] || {}).avatar);
      treeBtn.classList.toggle('glow', sk.points > 0);
      treeBtn.querySelector('.badge').textContent = sk.points > 0 ? String(sk.points) : '';
    }
  };
  function setGoalText(t, sub) {
    if (!goalEl) return;
    goalEl.textContent = t ? fill(t) : '';
    goalSub.textContent = sub || (W.ch ? W.ch.no + (W.ch.stage ? ' · 일대기 ' + W.ch.stage + '단계' : '') : '');
  }
  function padState(near) {
    if (!talkBtn) return;
    const lab = near ? (near.type === 'npc' ? '말 걸기' : (near.s.act || '살피기')) : '';
    talkBtn.classList.toggle('on', !!near);
    if (talkBtn._lab !== lab) { talkBtn._lab = lab; talkBtn.firstChild.textContent = lab || '말 걸기'; }
    const fight = P.canAtk && (M.enemies.length > 0 || M.props.some((p) => p.hit) || M.combat);
    atkBtn.classList.toggle('on', !!fight);
    const slots = G.combat.slots();
    slotBtns.forEach((b, i) => {
      const id = slots[i];
      b.classList.toggle('on', !!(fight && id));
      if (!id) return;
      const d = SKILLS.list[id], c = G.combat.cooldown(id);
      if (b._id !== id) { b._id = id; b.querySelector('.ph').textContent = d.icon; b.setAttribute('aria-label', d.name); b.title = d.name; }
      const txt = c.left > 0 ? String(Math.ceil(c.left)) : '';
      const cdEl = b.querySelector('.cd');
      if (cdEl.textContent !== txt) cdEl.textContent = txt;
      b.classList.toggle('cool', c.left > 0);
      b.style.setProperty('--cd', c.left > 0 ? Math.round(c.left / c.full * 100) + '%' : '0%');
    });
  }

  // ───────── 목표 기다리기 ─────────
  function waitGoal(o) {
    return new Promise((res) => {
      goal = Object.assign({}, o, {
        hit(id) { if (goal !== this) return; goal = null; res(id); },
      });
      W.hud();
    });
  }
  W.goal = () => goal;

  // 싸움: 모든 적을 물리치면 끝. 기력이 다하면 천우신조로 다시 일어난다.
  async function fight(def) {
    const waves = def.waves || [def.foes];
    M.combat = true;
    P.hp = P.maxHp = heroMaxHp();
    let total = waves.reduce((n, w) => n + w.length, 0), killed = 0;
    for (let wi = 0; wi < waves.length; wi++) {
      if (wi > 0) { G.ui.toast(def.waveMsg || '적이 더 몰려온다!'); await G.util.wait(500); }
      const foes = waves[wi].map(([sp, x, y, o]) => spawnFoe(sp, x, y, Object.assign({}, def.opt, o)));
      G.audio.play(def.music || 'battle');
      await new Promise((res) => {
        const text = def.text || '적을 모두 물리쳐라';
        goal = {
          text: text + ` (${killed}/${total})`, targets: [],
          tick() {
            const left = foes.filter((e) => !e.dead).length;
            const k = killed + (foes.length - left);
            const t = text + ` (${k}/${total})`;
            if (this.text !== t) { this.text = t; setGoalText(t); }
            if (left === 0 && !this.over) { this.over = true; setTimeout(res, 650); }
          },
          hit() {},
        };
        W.hud();
      });
      killed += foes.length;
      goal = null;
    }
    W.flash('rgba(255,255,255,.4)', 0.2);
    G.combat.clearAllies();
    G.audio.win();
    M.combat = !!M.def.combat;
    W.setMusic(M.def.music);
    W.hud();
  }
  // 쓰러지면: 천우신조
  W.onDown = async function () {
    if (W.escaping) { W.escaping(); return; }
    const st = S();
    W.busy++;
    st.heaven++; G.save.write();
    G.audio.heaven();
    W.flash('rgba(255,255,255,.8)', 0.5);
    const first = !st.seen.heaven;
    st.seen.heaven = true;
    await G.ui.sheet([
      h('div.center', h('span.seal-mark.big', '天佑神助')),
      h('h3.center', '천우신조(天佑神助) — 하늘이 돕다'),
      h('p', boldNodes(fill(W.heavenText || '쓰러지려는 순간, 하늘에서 오색구름이 내려와 {호:를} 감쌌다. 적들이 눈이 부셔 뒷걸음질 쳤다.'))),
      h('p.small', boldNodes('기력이 다시 차올랐어요. 영웅소설의 영웅은 죽을 고비에서 **하늘이나 조력자의 도움**으로 살아나곤 해요.')),
      first ? G.ui.card({ kind: 'fiction', title: '이 게임에는 게임 오버가 없어요', body: '기력이 다하면 천우신조로 이야기가 이어지고, 결과 화면에는 "천우신조 몇 번"으로만 적혀요.', real: '천우신조는 실제 영웅소설에 자주 나오는 **관습**이에요. 영웅은 천상계의 보살핌을 받는 존재라서, 위기에 빠지면 하늘이나 신이한 조력자가 돕습니다.' }) : null,
    ], [{ label: '다시 일어선다', value: true, cls: 'primary' }], { dismiss: false });
    if (!st.conv.heaven) { st.conv.heaven = true; G.save.write(); }
    W.busy = Math.max(0, W.busy - 1);
    P.hp = P.maxHp; P.inv = 1.5;
    for (const e of M.enemies) if (!e.dead) { const a = Math.atan2(e.y - P.y, e.x - P.x); e.kx = Math.cos(a) * 320; e.ky = Math.sin(a) * 320; e.stun = 1.4; e.state = 'chase'; }
    fx.push({ k: 'ring', x: P.x, y: P.y - 14, t: 0, life: 0.6, r: 110 });
    W.hud();
  };

  // ───────── 한 장 진행 ─────────
  function stepById(ch, id) { return ch.steps.find((s) => s.id === id); }
  async function runSteps(ch, ids, o = {}) {
    const st = S();
    const list = ids.map((id) => stepById(ch, id)).filter((s) => s && !st.done[s.id]);
    if (!list.some((s) => G.steps.ok(s.when))) return;
    const ctx = openDlg();
    ctx.preset = o.preset || null;
    const token = G.app._playToken;
    for (const step of list) {
      if (!G.steps.ok(step.when)) continue;
      ctx.main.innerHTML = ''; ctx.tray(null);
      ctx.dlg.classList.remove('full');
      ctx.dlg.scrollTop = 0;
      if (step.music) G.audio.play(step.music);
      // 이 단계를 하다 말고 껐다면(보상만 받고 끝나지 않음) 그때 받은 것을 되돌리고 다시 한다
      const sk = 'snap:' + step.id;
      if (st.flags[sk]) Object.assign(st, JSON.parse(JSON.stringify(st.flags[sk])));
      else st.flags[sk] = { abil: Object.assign({}, st.abil), doubt: st.doubt, doubtMax: st.doubtMax, relic: st.relic, crises: st.crises, heaven: st.heaven };
      G.save.write();
      if (step.type === 'battle' && o.noCard) await battleWords(step, ctx);
      else if (step.type === 'battle') await G.combat.bossBattle(step, ctx, o.boss || {});
      else await G.steps[step.type](step, ctx);
      if (G.app._playToken !== token) return;
      st.done[step.id] = true;
      delete st.flags[sk];
      if (step.fx) G.steps.apply(step.fx, ctx);
      G.save.write();
    }
    closeDlg(ctx);
    G.audio.play(W.music);
  }
  function juice() { W.flash('rgba(255,255,255,.35)', 0.2); }
  // 잡병 싸움으로 대신한 전투 단계: 앞뒤 이야기만 보여 준다
  async function battleWords(step, ctx) {
    const lines = (step.after || []).filter((l) => typeof l === 'string' || G.steps.ok(l.when));
    const box = h('div.says'); ctx.main.appendChild(box);
    for (let i = 0; i < lines.length; i++) {
      const el = G.steps.line(lines[i], ctx); if (!el) continue;
      box.appendChild(el); el.scrollIntoView({ block: 'nearest' });
      await G.steps.nextButton(ctx, i === lines.length - 1 ? '다음 ▶' : '▶');
    }
  }
  async function sayLines(lines, ctx0) {
    const ctx = ctx0 || openDlg({ small: true });
    const box = h('div.says'); ctx.main.appendChild(box);
    const ls = lines.filter((l) => typeof l === 'string' || G.steps.ok(l.when));
    for (let i = 0; i < ls.length; i++) {
      const el = G.steps.line(ls[i], ctx); if (!el) continue;
      box.appendChild(el); G.audio.page(); el.scrollIntoView({ block: 'nearest' });
      await G.steps.nextButton(ctx, i === ls.length - 1 ? '다음 ▶' : '▶');
    }
    if (!ctx0) closeDlg(ctx);
  }
  W.sayLines = sayLines;

  function applyCast(b) {
    if (b.hide) for (const id of [].concat(b.hide)) removeNpc(id);
    if (b.show) for (const id in b.show) addNpc(id, b.show[id]);
    if (b.fire) M.fires = b.fire.map(([x, y]) => [(x + 0.5) * T, (y + 0.8) * T]);
    if (b.night != null) M.night = b.night;
    if (b.ambient === false) for (const id of Object.keys(M.npcs)) if ((MAPS[M.id].npcs || {})[id]) removeNpc(id);
  }

  async function runBeat(b, ch, q) {
    const st = S();
    W.avatarOverride = b.avatar || null;
    if (b.map && b.map !== M.id) await changeMap(b.map, b.spawn, castFor(q, b.map));
    else if (b.spawn && !b.map) placePlayer(b.spawn);
    refreshAvatar();
    applyCast(b);
    if (b.music) W.setMusic(b.music);
    const text = b.goal;
    let preset = null;
    if (b.say) await sayLines(b.say);
    if (b.sayPre) { const ps = stepById(ch, b.sayPre); if (ps && !S().done[ps.id]) await sayLines(ps.pre || []); }
    if (b.fight) {
      await fight(b.fight);
    } else if (b.train) {
      await train(b, ch);
    } else if (b.escape) {
      const E = b.escape;
      const foes = E.foes.map(([sp, x, y, o]) => spawnFoe(sp, x, y, Object.assign({ noAtk: true }, o)));
      P.hp = P.maxHp = heroMaxHp();
      M.combat = true;
      const got = await new Promise((res) => {
        W.escaping = () => {
          // 붙잡히면 가까운 쪽으로 간 것으로 친다
          let best = null, bd = 1e9;
          for (const z of Object.keys(E.exits)) { const s = M.spots[z]; const d = Math.hypot(s.rx + s.rw / 2 - P.x, s.ry + s.rh / 2 - P.y); if (d < bd) { bd = d; best = z; } }
          goal = null; res(best);
        };
        waitGoal({ text, targets: Object.keys(E.exits), zones: Object.keys(E.exits), labelOf: (id) => M.spots[id].name }).then(res);
      });
      W.escaping = null;
      for (const e of foes) { e.dead = true; e.deadT = 0.2; }
      M.combat = !!M.def.combat;
      preset = { [b.steps[b.steps.length - 1]]: E.exits[got] };
    } else if (b.pick) {
      const id = await waitGoal({ text, targets: Object.keys(b.pick), labelOf: (id) => (M.spots[id] || M.npcs[id] || {}).name });
      preset = { [b.steps[0]]: b.pick[id] };
      if (b.pickFx && b.pickFx[id]) applyCast(b.pickFx[id]);
    } else if (b.talk || b.at) {
      await waitGoal({ text, targets: [b.talk || b.at], labels: b.label !== false });
    } else if (b.go) {
      await waitGoal({ text, targets: [b.go], zones: [b.go] });
    }
    if (b.steps) await runSteps(ch, b.steps, { preset, noCard: b.noCard, boss: b.boss });
    if (b.points) { G.combat.addPoints(b.points); if (G.combat.anyReady()) await G.combat.openTree(); }
    if (b.skillTree) await G.combat.openTree({ intro: true });
    if (b.then) applyCast(b.then);
  }
  function castFor(q, mapId) { return (q.cast && q.cast[mapId]) || {}; }
  // { c: 남장하지 않는 길의 값, _: 그 밖의 값 } 꼴이면 길에 맞춰 고른다
  function byBranch(v) { if (v && !Array.isArray(v) && typeof v === 'object') return S().branch === 'c' && 'c' in v ? v.c : v._; return v; }
  // 막힌 자리에 서게 되면 가까운 빈자리를 찾는다
  function freeSpot(x, y, hw) {
    const ok = (a, b) => !blocked(a - hw, b - 5, a + hw, b, null);
    if (ok(x, y)) return [x, y];
    for (let r = 4; r <= 96; r += 4) for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r;
      if (ok(nx, ny)) return [nx, ny];
    }
    return [x, y];
  }

  // 수련: 수련터 세 곳 가운데 골라 세 번(무예는 허수아비를 직접 벤다)
  async function train(b, ch) {
    const st = S();
    const step = stepById(ch, b.train.step);
    if (st.done[step.id]) return;
    // 한 번 닦을 때마다 저장해 두고, 중간에 껐다가 이어 하면 그다음 번부터(같은 보상을 두 번 받지 않게)
    const picked = Array.isArray(st.flags.trainProg) ? st.flags.trainProg : (st.flags.trainProg = []);
    if (!picked.length) await sayLines(step.pre || []);
    const at = b.train.at; // { spotId: 'mu'|'byeong'|'sul' }
    for (let r = picked.length; r < step.rounds; r++) {
      const text = `수련 ${r + 1}/${step.rounds} — 수련터 한 곳을 골라 닦는다`;
      const hitKey = Object.keys(at).find((k) => k[0] === '@');
      const need = 3;
      const base = hitKey ? (M.hits[hitKey.slice(1)] || 0) : 0;
      const k = await new Promise((res) => {
        const wg = waitGoal({
          text, targets: Object.keys(at),
          labelOf: (id) => ({ mu: '武 무예', byeong: '兵 병법', sul: '術 도술' })[at[id]],
          tick() {
            if (hitKey && (M.hits[hitKey.slice(1)] || 0) - base >= need) this.hit(hitKey);
          },
        });
        wg.then((id) => res(at[id]));
      });
      picked.push(k);
      G.combat.addPoints(1, true);
      G.steps.apply({ abil: { [k]: 1 } }, null); // 저장도 여기서 함께
      G.ui.toast('기술 점수 +1');
      refreshAvatar(); W.hud();
      const lines = step.opts[k].reply;
      await sayLines([lines[Math.min(r, lines.length - 1)]]);
    }
    st.flags.train = picked.slice(); delete st.flags.trainProg; st.done[step.id] = true; G.save.write();
  }
  // 무예 수련터: 가까이 가서 누르면 "공격으로 베라"는 안내
  W.trainHint = function () { G.ui.toast('공격(⚔ · Space)으로 허수아비를 세 번 베어 보세요'); };

  async function titleCard(ch, resume) {
    const ctx = openDlg({ small: true });
    const st = S();
    ctx.main.appendChild(h('div.ch-head',
      h('div.muted.small', st.path && st.surname ? fill('「{전}」') : '영웅의 길'),
      h('h2', ch.no), h('div.ch-title', fill(ch.title)),
      ch.stage ? h('div.ch-stage', h('span.num', ch.stage), G.app.stageOf(ch.stage).name) : null));
    const q = QUESTS[ch.id];
    if (q && q.intro) ctx.main.appendChild(h('p.small.center.muted', boldNodes(fill(q.intro))));
    await G.steps.nextButton(ctx, resume ? '이어서 ▶' : '펼치기 ▶');
    closeDlg(ctx);
  }

  W.play = async function (chId) {
    const app = G.app;
    G.ui.unpop();
    const st = S();
    const ci = STORY.findIndex((c) => c.id === chId);
    const ch = STORY[ci], q = QUESTS[chId];
    const token = (app._playToken = {});
    W.token = token;
    W.chId = chId; W.ch = ch; W.avatarOverride = null;
    goal = null; W.busy = 0; W.escaping = null;
    parts.length = 0; fx.length = 0; texts.length = 0;
    G.combat.reset(); slowT = 0;
    // 다 끝낸 장을 다시 펼치면 처음부터
    if (st.chDone[chId]) {
      for (const s of ch.steps) delete st.done[s.id];
      for (const b of q.beats) delete st.done['b:' + b.id];
      for (const k of Object.keys(st.flags)) if (k === 'trainProg' || k.startsWith('snap:')) delete st.flags[k];
      delete st.chDone[chId];
      G.save.write();
    }
    mount();
    G.audio.chapter();
    // 이어 하기: 끝내지 않은 첫 목표부터. 맵은 그 앞 목표들이 옮겨 둔 곳에서
    let start = q.beats.findIndex((b) => !st.done['b:' + b.id] && G.steps.ok(b.when));
    if (start < 0) start = q.beats.length;
    let mapId = byBranch(q.map), spawn = byBranch(q.spawn);
    for (let i = 0; i < start; i++) { const b = q.beats[i]; if (!G.steps.ok(b.when)) continue; if (b.map && b.map !== mapId) { mapId = b.map; spawn = b.spawn || null; } }
    P = null;
    await W.preload(Object.keys(SP()));
    await loadMap(mapId, spawn, castFor(q, mapId));
    // 이미 지나온 목표들이 이 맵에 남긴 변화(사람 나타남·숨김, 밤)를 다시 적용한다
    let here = byBranch(q.map);
    for (let i = 0; i < start; i++) {
      const b = q.beats[i]; if (!G.steps.ok(b.when)) continue;
      if (b.map) here = b.map;
      if (here !== mapId) continue;
      applyCast(b);
      if (b.then) applyCast(b.then);
    }
    W.setMusic(q.music || ch.music);
    setGoalText('', '');
    W.hud();
    await titleCard(ch, start > 0);
    if (G.app._playToken !== token) return;
    for (let i = start; i < q.beats.length; i++) {
      const b = q.beats[i];
      if (!G.steps.ok(b.when)) continue;
      await runBeat(b, ch, q);
      if (G.app._playToken !== token) return;
      st.done['b:' + b.id] = true; G.save.write();
    }
    goal = null; setGoalText('', '');
    st.chDone[chId] = true; G.save.write();
    const ctx = openDlg({ full: true });
    await app.chapterEnd(ch, ci, ctx, ctx.main, token);
  };

  // ───────── 싸움 확장(js/game/combat.js)이 쓰는 속살 ─────────
  W._k = {
    get M() { return M; }, get P() { return P; }, get time() { return time; },
    T, fx, parts, feet, move, blocked, freeSpot, overlap, body, faceTo, burst, floatText, ptext,
    spawnFoe, hitEnemy, hurtPlayer, heroDmg, heroMaxHp, removeNpc, openDlg, closeDlg,
    stop(t) { hitstop = Math.max(hitstop, t); },
    slowmo(k, secs) { slowK = k; slowT = secs; },
    input() { let x = inp.jx, y = inp.jy; if (keys.has('l')) x -= 1; if (keys.has('r')) x += 1; if (keys.has('u')) y -= 1; if (keys.has('d')) y += 1; return [x, y]; },
    view() { return [cam.x, cam.y, vw, vh]; },
    setGoal(o) { goal = o; W.hud(); },
    // 대화창을 잠시 내리고(맵에서 싸우는 동안) 다시 올린다
    hideDlg(ctx, hide) {
      ctx.dlg.style.display = hide ? 'none' : '';
      W.busy = Math.max(0, W.busy + (hide ? -1 : 1));
      root.classList.toggle('talking', !!W.busy);
      if (hide) { keys.clear(); W.hud(); }
    },
  };

  // ───────── 시험용 손잡이(자동 테스트가 목표를 대신 이룬다) ─────────
  W.test = {
    state: () => ({ map: M && M.id, goal: goal && { text: goal.text, targets: goal.targets }, busy: W.busy, x: P && P.x, y: P && P.y, hp: P && P.hp, enemies: M ? M.enemies.filter((e) => !e.dead).length : 0, foes: M ? M.enemies.filter((e) => !e.dead).map((e) => [e.x, e.y]) : [], escaping: !!W.escaping }),
    complete() {
      if (!goal || W.busy) return false;
      if (M.enemies.some((e) => !e.dead) && !W.escaping) { for (const e of M.enemies) if (!e.dead) { e.hp = 0; e.dead = true; e.deadT = 0; } return true; }
      const t = goal.targets && goal.targets[Math.floor(Math.random() * goal.targets.length)];
      if (t) { goal.hit(t); return true; }
      return false;
    },
    // 읽기 전용: QA 봇이 실제 키 입력으로 길을 찾아가게 돕는다(게임 상태를 바꾸지 않음)
    targets: () => ((goal && goal.targets) || []).map((id) => {
      const e = M.npcs[id], s = M.spots[id], tp = targetPos(id);
      return { id, kind: e ? 'npc' : s ? 'spot' : 'hit', x: e ? e.x : s ? s.rx + s.rw / 2 : tp && tp[0], y: e ? e.y : s ? s.ry + s.rh / 2 : tp && tp[1] + 40, rect: s ? [s.rx, s.ry, s.rw, s.rh] : null, zone: !!(goal.zones && goal.zones.includes(id)) };
    }),
    blocked: (x0, y0, x1, y1) => blocked(x0, y0, x1, y1, P),
    near: () => (W.near ? { type: W.near.type, id: W.near.id } : null),
    map: () => ({ id: M.id, T, w: M.gw, h: M.gh, grid: M.grid, night: M.night }),
    npcs: () => Object.values(M.npcs).map((e) => ({ id: e.id, name: e.name, x: e.x, y: e.y, talk: !!e.talk })),
    teleport(id) { const tp = targetPos(id); if (tp) { P.x = tp[0]; P.y = tp[1] + 30; snapCam(); } },
    hurt(n) { hurtPlayer(n || 99, { x: P.x + 10, y: P.y }); },
    labels(on) { labelsOn = on; },
  };
})();
