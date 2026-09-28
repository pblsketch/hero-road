'use strict';
// 화면 흐름: 타이틀 → 서장(전기수의 이야기판) → 1~7장 → 결과(나의 ○○전). 목차·편람·설정은 위에 겹쳐 뜬다.
(function () {
  const { h, $$, wait, T, boldNodes, shuffle } = G.util;
  const ui = G.ui;
  const app = (G.app = {});
  const S = () => G.save.state;
  const root = () => document.getElementById('app');

  const ICON = {
    toc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>',
    musicOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
    musicOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/><path d="M3 3l18 18"/></svg>',
  };
  const iconBtn = (name, label, fn) => h('button.icon-btn', { type: 'button', 'aria-label': label, title: label, html: ICON[name], on: { click: () => { G.audio.tap(); fn(); } } });

  app.fixedPath = null; // 선생님이 주소로 정한 길(?path=m|f)
  app.applySettings = function () {
    document.documentElement.style.setProperty('--fs', S().font);
  };

  // ───────── 길·작품 ─────────
  app.stageOf = (n) => STAGES[n - 1];
  // 지금 내 길에서 n단계와 맞대어 볼 대표 작품
  app.mainWork = function (n) {
    const st = S();
    if (st.path !== 'f') return 'yu';
    let w = 'hong';
    if (st.branch === 'c' && n >= 5) w = 'park';
    if (st.branch === 'b' && n === 7) w = WORKS.gyu ? 'gyu' : 'hong';
    return WORKS[w].stages[n] ? w : 'hong';
  };
  app.unlock = function (wid, n) {
    const st = S();
    st.works[wid] = st.works[wid] || {};
    if (n) st.works[wid][n] = true;
    G.save.write();
  };
  // 이 작품을 도감에서 볼 수 있는가(다른 길·다른 갈래의 작품은 잠가 둔다)
  app.workVisible = function (wid) {
    const st = S(), w = WORKS[wid];
    if (st.teacher) return true;
    if (w.group && w.group !== st.path) return false;
    if (w.branch && ![].concat(w.branch).includes(st.branch)) return !!st.works[wid];
    return true;
  };

  // ───────── 타이틀 ─────────
  function leavePlay() {
    app._playToken = null;
    watchTray(null);
    document.documentElement.style.setProperty('--tray-h', '0px');
  }

  app.title = function () {
    G.ui.unpop();
    leavePlay();
    const st = S();
    const started = Object.keys(st.done).length > 0;
    G.audio.play('market');
    const r = root(); r.innerHTML = '';
    const menu = h('div.menu');
    if (started) menu.appendChild(h('button.btn.primary', { on: { click: () => { G.audio.unlock(); app.continue(); } } }, '이어 하기'));
    menu.appendChild(h('button.btn' + (started ? '' : '.primary'), { on: { click: () => { G.audio.unlock(); app.newGame(started); } } }, started ? '처음부터 새로' : '이야기 시작'));
    menu.appendChild(h('button.btn', { on: { click: () => { G.audio.unlock(); app.toc(); } } }, '목차 · 장 고르기'));
    const art = h('div.art');
    const img = new Image();
    img.onload = () => { art.style.backgroundImage = 'url(assets/ui/title_art.webp)'; };
    img.onerror = () => { art.style.backgroundImage = 'url(assets/sc/sc_market.webp)'; art.classList.add('wide'); };
    img.src = 'assets/ui/title_art.webp';
    r.appendChild(h('div.title-screen',
      art,
      h('div.logo', h('div.pre', '영웅소설 서사 RPG'), h('h1', '영웅의 길'), h('div.sub', '약한 아이가 영웅이 되기까지, 일곱 걸음')),
      menu,
      app.fixedPath ? h('div.credit.fixed', app.fixedPath === 'f' ? '선생님이 정한 길: 딸의 길' : '선생님이 정한 길: 아들의 길') : null,
      h('div.credit', '영웅소설의 관습을 모아 새로 지은 이야기예요 · 실제 작품은 붉은 낙관으로 표시해요'),
      h('div.credit.maker', '만든이 박준일(온양여자고등학교 국어 교사)'),
      musicToggle()));
  };

  function musicToggle() {
    const b = h('button.icon-btn.music-toggle', { type: 'button' });
    const draw = () => { const on = S().music; b.innerHTML = ICON[on ? 'musicOn' : 'musicOff']; b.setAttribute('aria-label', on ? '배경음 끄기' : '배경음 켜기'); b.title = on ? '배경음 끄기' : '배경음 켜기'; b.classList.toggle('off', !on); };
    b.addEventListener('click', () => { const st = S(); st.music = !st.music; G.save.write(); G.audio.unlock(); G.audio.music(st.music); G.audio.tap(); draw(); });
    draw();
    return b;
  }

  app.newGame = async function (confirmReset) {
    if (confirmReset) {
      const ok = await ui.sheet([h('h3', '처음부터 새로 할까요?'), h('p', '지금까지 걸어온 길과 모은 작품 카드가 모두 지워져요.')],
        [{ label: '그만두기', value: false }, { label: '새로 시작', value: true, cls: 'seal' }]);
      if (!ok) return;
    }
    leavePlay();
    G.save.reset(true);
    const mode = await ui.sheet([
      h('h3', '어떻게 할까요?'),
      h('p', h('b', '처음 배우기'), ' — 영웅의 일대기를 처음 배워요. 단계마다 풀이가 함께 보이고, 도움이 넉넉해요.'),
      h('p', h('b', '깊이 읽기'), ' — 작품을 비교하며 깊이 읽어요. 장이 끝날 때마다 다른 작품의 낯선 대목에서도 단계를 찾고, 해석 질문이 더 나와요.'),
      h('p.small.muted', '설정에서 언제든 바꿀 수 있어요.'),
    ], [{ label: '깊이 읽기', value: 'deep' }, { label: '처음 배우기', value: 'basic', cls: 'primary' }], { dismiss: false });
    S().mode = mode || 'basic';
    S().startedAt = Date.now();
    if (app.fixedPath) S().path = app.fixedPath;
    G.save.write();
    app.play('ch0');
  };

  app.continue = function () {
    const st = S();
    const next = STORY.find((c) => !st.chDone[c.id]);
    if (!next) return app.result();
    app.play(next.id);
  };

  // ───────── 장 진행 ─────────
  let trayObs = null;
  function watchTray(tray) {
    if (trayObs) { trayObs.disconnect(); trayObs = null; }
    if (tray && window.ResizeObserver) { trayObs = new ResizeObserver(() => setTrayH(tray)); trayObs.observe(tray); }
  }
  function setTrayH(tray) {
    requestAnimationFrame(() => document.documentElement.style.setProperty('--tray-h', (tray.classList.contains('hide') ? 0 : tray.offsetHeight) + 'px'));
  }
  let statusEl = null;
  function mkCtx(main, tray) {
    watchTray(tray);
    return {
      main,
      tray(content) { tray.innerHTML = ''; if (content) tray.appendChild(content); tray.classList.toggle('hide', !content); setTrayH(tray); },
      trayEl: () => tray,
      refresh() { app.refreshStatus(); },
    };
  }

  // 능력치·신물·의심 게이지 줄
  app.refreshStatus = function () {
    if (!statusEl) return;
    const st = S();
    statusEl.innerHTML = '';
    if (!st.path) { statusEl.classList.add('hide'); return; }
    statusEl.classList.remove('hide');
    const who = h('span.st-who', ui.face('hero'), h('span', T('{공명}')));
    const ab = ['mu', 'byeong', 'sul'].map((k) => h('span.ab.' + k, h('b', G.battle.STAT_HAN[k]), String(st.abil[k])));
    const relic = st.relic ? h('span.ab.relic', h('b', BATTLE.relics[st.relic].han), BATTLE.relics[st.relic].name) : null;
    const gauge = st.disguised ? h('span.doubt', h('span.dl', '의심'), h('span.dbar' + (st.doubt >= 70 ? '.hot' : ''), h('i', { style: { width: st.doubt + '%' } }))) : null;
    const btn = h('button.status-btn', { type: 'button', 'aria-label': '능력치 보기', on: { click: () => { G.audio.tap(); app.showStats(); } } }, who, h('span.abs', ab, relic), gauge);
    statusEl.appendChild(btn);
  };
  app.showStats = function () {
    const st = S();
    const rows = ['mu', 'byeong', 'sul'].map((k) => h('div.stat-row', h('span.han-big.' + k, G.battle.STAT_HAN[k]), h('div', h('b', G.battle.STAT_KO[k] + ' ' + st.abil[k]), h('div.small', NOTES.abil[k]))));
    ui.sheet([
      h('h3', T('{공명}의 능력')),
      ...rows,
      st.relic ? h('p', h('b', '신물: '), BATTLE.relics[st.relic].name + ' — ' + BATTLE.relics[st.relic].desc) : null,
      st.disguised ? h('div', steps().gauge(), h('p.small', '남장한 동안 정체를 의심받을 만한 일이 생기면 오르고, 가득 차면 탄로 위기가 와요.')) : null,
      ui.card({ kind: 'fiction', title: '능력치', body: '무예(武)·병법(兵)·도술(術) 세 능력치와 수치는 게임 설정이에요.', real: '영웅소설의 영웅은 **보통 사람과 다른 탁월한 능력**을 지니고, 조력자에게 **무술·병법·도술**을 배워 더 강해져요. 세 능력치는 이 관습을 게임으로 옮긴 거예요.' }),
    ]);
  };
  const steps = () => G.steps;

  // 장 펼치기: 맵이 정해진 장은 탑뷰 맵 RPG(js/game/world.js)로, 아니면 글로 읽는다
  app.play = function (chId) {
    if (G.world && window.QUESTS && QUESTS[chId]) return G.world.play(chId);
    return app.playText(chId);
  };
  app.playText = async function (chId) {
    G.ui.unpop();
    const st = S();
    const ci = STORY.findIndex((c) => c.id === chId);
    const ch = STORY[ci];
    G.audio.play(ch.music);
    G.audio.chapter();
    const r = root(); r.innerHTML = '';
    const prog = h('i');
    const top = h('div.topbar',
      iconBtn('toc', '목차', () => app.toc()),
      h('div.where', h('small', ch.no + (ch.stage ? ' · 일대기 ' + ch.stage + '단계' : '')), h('strong', T(ch.title))),
      iconBtn('book', '편람', () => app.book('life')),
      iconBtn('gear', '설정', () => app.settings()));
    statusEl = h('div.statusbar');
    const main = h('div.main-inner');
    r.append(top, h('div.progress', prog), statusEl, h('div.stage', h('div.main', main)));
    const tray = h('div.tray'); r.appendChild(tray);
    const ctx = mkCtx(main, tray);
    app.refreshStatus();
    const token = (app._playToken = {});

    // 장 머리
    main.appendChild(h('div.ch-head',
      h('div.muted.small', st.path ? T('「{전}」') : '영웅의 길'),
      h('h2', ch.no), h('div.ch-title', T(ch.title)),
      ch.stage ? h('div.ch-stage', h('span.num', ch.stage), app.stageOf(ch.stage).name) : null));
    if (ch.scene) main.appendChild(steps().scene(ch.scene));
    const list = ch.steps;
    const firstUndone = list.findIndex((s) => !st.done[s.id] && steps().ok(s.when));
    const startAt = st.chDone[ch.id] || firstUndone < 0 ? 0 : firstUndone;
    await steps().nextButton(ctx, startAt > 0 ? '이어서 ▶' : '펼치기 ▶');
    if (app._playToken !== token) return;

    for (let i = startAt; i < list.length; i++) {
      const step = list[i];
      if (!steps().ok(step.when)) continue;
      prog.style.width = Math.round((i / list.length) * 100) + '%';
      main.innerHTML = '';
      window.scrollTo({ top: 0 });
      ctx.tray(null);
      G.audio.play(step.music || ch.music);
      const run = steps()[step.type];
      if (run) await run(step, ctx);
      if (app._playToken !== token) return;
      st.done[step.id] = true;
      if (step.fx) steps().apply(step.fx, ctx);
      G.save.write();
    }
    prog.style.width = '100%';
    st.chDone[ch.id] = true;
    G.save.write();
    await chapterEnd(ch, ci, ctx, main, token);
  };

  // ───────── 장 끝: 전기수의 물음(단계 판정) → 작품 카드 ─────────
  async function chapterEnd(ch, ci, ctx, main, token) {
    const st = S();
    main.innerHTML = '';
    window.scrollTo({ top: 0 });
    G.audio.play('market');
    if (ch.stage) {
      await stageQuiz(ch, ctx, main);
      if (app._playToken !== token) return;
      if (st.mode === 'deep') {
        await passageQuiz(ctx, main, app.pickPassages(1, ch.stage)[0], '깊이 읽기 · 낯선 대목');
        if (app._playToken !== token) return;
      }
    }
    main.innerHTML = '';
    window.scrollTo({ top: 0 });
    G.audio.fanfare();
    main.appendChild(h('div.center', h('span.seal-mark', { style: { fontSize: '1.3em' } }, '完'), h('h2', { style: { fontFamily: 'var(--serif)' } }, ch.no + ' 끝')));
    if (ch.stage) main.appendChild(app.lifeStrip(ch.stage));
    const qd = window.QUESTS && QUESTS[ch.id];
    if (qd && qd.lessonEnd) main.appendChild(ui.card({ kind: 'note', title: qd.lessonEnd + G.util.josa(qd.lessonEnd, '은') + ' 여기까지', body: '영웅의 일대기 **1~4단계**를 걸었어요. 다음 시간에 타이틀 화면에서 **이어 하기**를 누르면 5장부터 이어져요(같은 기기·같은 브라우저에서).' }));
    const next = STORY[ci + 1];
    if (!next) { await steps().nextButton(ctx, '이야기를 마무리한다 ▶'); if (app._playToken === token) app.result(); return; }
    const go = h('button.btn.primary', { on: { click: () => { document.removeEventListener('keydown', key); G.audio.tap(); app.play(next.id); } } }, next.no + ' 펼치기 ▶');
    const key = (e) => {
      if (!go.isConnected) { document.removeEventListener('keydown', key); return; }
      if (e.key === 'Enter' && steps().enterFree(e, go)) { e.preventDefault(); go.click(); }
    };
    document.addEventListener('keydown', key);
    ctx.tray(h('div.actions', h('button.btn', { on: { click: () => { G.audio.tap(); app.toc(); } } }, '목차'), go));
    setTimeout(() => go.focus({ preventScroll: true }), 30);
  }

  app.chapterEnd = chapterEnd;

  // 일곱 단계 띠(지나온 단계는 채움)
  app.lifeStrip = function (upto) {
    return h('div.life-strip', STAGES.map((s, i) => h('div.ls' + (i + 1 <= upto ? '.on' : '') + (i + 1 === upto ? '.now' : ''), h('span.num', i + 1), h('span.nm', s.short || s.name))));
  };

  // 요전법: 이야기꾼이 대목에서 멈추고 묻는다
  async function stageQuiz(ch, ctx, main) {
    const st = S();
    const n = ch.stage, wid = app.mainWork(n), W = WORKS[wid];
    const say = (t) => steps().line({ who: 'narrator', t }, ctx);
    main.appendChild(say(NOTES.frame.yojeon[n - 1] || NOTES.frame.yojeon[0]));
    main.appendChild(h('div.card.note', h('span.kind', '전기수의 물음'),
      h('h3', T(`방금 {이름:이} 지나온 대목과 같은 단계는 『${W.title}』의 어느 대목일까?`)),
      st.mode === 'basic' ? h('p.small', h('b', `지금 지나온 단계: ${n}단계 「${app.stageOf(n).name}」`), ' — ' + app.stageOf(n).desc) : h('p.small.muted', '단계 이름을 떠올리며 골라 보세요.')));
    // 딸의 길에서는 갈래의 결말(7단계)을 미리 보여 주지 않는다
    const others = Object.keys(W.stages).map(Number).filter((k) => k !== n && W.stages[k] && !(st.path === 'f' && k === 7));
    const nOpt = st.mode === 'deep' ? 3 : 2;
    const picks = shuffle(others).slice(0, nOpt);
    const opts = shuffle([n, ...picks]);
    const list = h('div.options');
    const fb = h('div');
    main.append(list, fb);
    ctx.tray(h('div.tray-hint', '작품 대목 하나를 고르세요'));
    let tries = 0;
    await new Promise((res) => {
      opts.forEach((k) => {
        const b = h('button.opt.passage', { type: 'button' }, h('span.ot', boldNodes(W.stages[k].t)));
        b.addEventListener('click', async () => {
          if (b.disabled) return;
          tries++;
          if (k === n) {
            if (tries === 1) G.save.stat('stage', true);
            G.audio.ok();
            b.classList.add('right');
            list.querySelectorAll('.opt').forEach((x) => { x.disabled = true; });
            feedback(fb, 'ok', tries === 1 ? '맞소! 바로 그 대목이오.' : '그렇지, 바로 그 대목이오.');
            res();
          } else {
            if (tries === 1) { G.save.stat('stage', false); G.save.wrong('stage', `${n}단계 ${app.stageOf(n).name}`); }
            G.audio.no(); ui.shake(b);
            b.disabled = true; b.classList.add('wrong');
            b.appendChild(h('span.od', `→ 이것은 ${k}단계 「${app.stageOf(k).name}」의 대목이에요.`));
            if (tries >= 2) {
              st.helped++; G.save.write();
              list.querySelectorAll('.opt').forEach((x, i) => { if (opts[i] === n) x.classList.add('glow'); });
              feedback(fb, 'warn', `빛나는 대목이 ${n}단계예요. ${app.stageOf(n).name}: ${app.stageOf(n).desc}`);
            } else feedback(fb, 'warn', '다시 골라 보세요. 이 장에서 무슨 일이 있었는지 떠올려 보세요.');
          }
        });
        list.appendChild(b);
      });
    });
    ctx.tray(null);
    app.unlock(wid, n);
    await wait(300);
    main.appendChild(app.workCard(wid, n));
    main.lastChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await steps().nextButton(ctx, '다음 ▶');
  }
  const feedback = (box, k, t) => steps().feedback(box, k, t);

  app.workCard = function (wid, n) {
    const W = WORKS[wid], s = W.stages[n];
    return ui.card({ kind: 'work', seal: W.seal, kindLabel: '실제 작품 · 작품 카드', title: `『${W.title}』 ${n}단계 · ${app.stageOf(n).name}`, body: s.t + (s.q ? '\n' + s.q : '') + (s.note ? '\n**알아 두기** ' + s.note : ''), src: W.src });
  };

  // 낯선 대목(다른 작품): 일곱 단계 중 고르기
  app.pickPassages = function (count, near) {
    const st = S();
    let pool = PASSAGES.filter((p) => (p.group === st.path || p.group === 'any') && (st.path !== 'f' || p.stage < 7));
    const fresh = pool.filter((p) => !(st.flags.seenPassage || {})[p.id]);
    if (fresh.length >= count) pool = fresh;
    if (near) pool = pool.slice().sort((a, b) => Math.abs(a.stage - near) - Math.abs(b.stage - near) || Math.random() - 0.5).slice(0, Math.max(count, 3));
    return shuffle(pool).slice(0, count);
  };
  async function passageQuiz(ctx, main, p, label) {
    if (!p) return;
    const st = S();
    st.flags.seenPassage = st.flags.seenPassage || {};
    st.flags.seenPassage[p.id] = true;
    main.innerHTML = '';
    window.scrollTo({ top: 0 });
    const W = WORKS[p.work];
    main.appendChild(h('div.card.work', h('span.seal-mark.corner', W.seal || '原作'), h('span.kind', label), h('h3', `『${W.title}』의 한 대목`), h('p', boldNodes(p.t))));
    main.appendChild(h('p.center', h('b', '이 대목은 영웅의 일대기 중 몇 단계일까?')));
    const grid = h('div.stage-grid');
    const fb = h('div');
    main.append(grid, fb);
    let tries = 0;
    await new Promise((res) => {
      STAGES.forEach((s, i) => {
        const k = i + 1;
        const b = h('button.stage-btn', { type: 'button' }, h('span.num', k), h('span.nm', s.name), st.mode === 'basic' ? h('span.ds', s.desc) : null);
        b.addEventListener('click', () => {
          if (b.disabled) return;
          tries++;
          if (k === p.stage) {
            if (tries === 1) G.save.stat('passage', true);
            G.audio.ok(); b.classList.add('right');
            grid.querySelectorAll('button').forEach((x) => { x.disabled = true; });
            feedback(fb, 'ok', (p.why ? p.why : `${k}단계 「${s.name}」이에요.`));
            app.unlock(p.work, p.stage);
            res();
          } else {
            if (tries === 1) { G.save.stat('passage', false); G.save.wrong('passage', `『${W.title}』: ${p.t.slice(0, 24)}… → ${p.stage}단계`); }
            G.audio.no(); ui.shake(b); b.disabled = true; b.classList.add('wrong');
            if (tries >= 2) {
              st.helped++; G.save.write();
              grid.querySelectorAll('button')[p.stage - 1].classList.add('glow');
              feedback(fb, 'warn', '빛나는 칸이 정답이에요. ' + (p.hint || ''));
            } else feedback(fb, 'warn', p.hint || '누가, 어떤 처지에 놓였는지 살펴보세요.');
          }
        });
        grid.appendChild(b);
      });
    });
    G.save.write();
    await steps().nextButton(ctx, '다음 ▶');
  }
  app.passageQuiz = passageQuiz;

  // ───────── 목차 ─────────
  app.toc = function () {
    const st = S();
    const ov = overlay('목차', (body) => {
      const list = h('div.toc');
      STORY.forEach((c, i) => {
        const done = st.chDone[c.id];
        const open = st.teacher || i === 0 || st.chDone[STORY[i - 1].id] || c.steps.some((s) => st.done[s.id]);
        const el = h('button.toc-item' + (done ? '.done' : '') + (open ? '' : '.locked'), { type: 'button' },
          h('span.no', c.no), h('span', h('div.tt', T(c.title)), h('div.hm', c.stage ? `일대기 ${c.stage}단계 · ${app.stageOf(c.stage).name}` : '이야기판이 열리다')),
          h('span.st', done ? '끝' : open ? '열림' : '잠김'));
        el.addEventListener('click', () => {
          if (!open) { ui.toast('앞 장을 먼저 끝내야 해요'); return; }
          if (i > 0 && !st.path) { ui.toast('서장에서 주인공을 먼저 정해야 해요'); return; }
          G.audio.tap(); ov.close(); app.play(c.id);
        });
        list.appendChild(el);
      });
      body.append(list, h('div.sp'),
        h('div.row-gap', h('button.btn.small', { on: { click: () => { ov.close(); app.title(); } } }, '타이틀로'),
          st.chDone.ch7 ? h('button.btn.small', { on: { click: () => { ov.close(); app.result(); } } }, '결과 보기') : null),
        h('p.small.muted', '선생님은 설정에서 "선생님용"을 켜면 잠긴 장도 고를 수 있어요.'));
    });
  };

  // ───────── 편람 ─────────
  app.book = function (tab = 'life') {
    const st = S();
    const tabs = [['life', '일대기 7단계'], ['works', '작품 도감'], ['conv', '관습 사전'], ['misc', '헷갈리기 쉬운 것'], ['fic', '실제와 설정']];
    if (st.teacher) tabs.push(['all', '모든 갈래']);
    overlay('편람', (body, bar) => {
      const show = (t) => {
        $$('.tab', bar).forEach((b) => b.classList.toggle('on', b.dataset.t === t));
        body.innerHTML = '';
        body.appendChild(BOOK[t]());
      };
      for (const [k, label] of tabs) bar.appendChild(h('button.tab', { type: 'button', dataset: { t: k }, on: { click: () => { G.audio.tap(); show(k); } } }, label));
      show(tab);
    }, true);
  };
  const BOOK = {
    life() {
      const st = S();
      return h('div',
        h('p.small.muted', '영웅소설은 건국 신화의 주인공처럼 "영웅의 일생"을 따라가요. 이 게임의 일곱 장은 이 일곱 단계를 그대로 따라요.'),
        h('div.dex', STAGES.map((s, i) => h('div.ev' + (st.chDone['ch' + (i + 1)] ? '' : '.dim'),
          h('h4', h('span.num', i + 1), ' ', s.name), h('div.txt', s.desc),
          st.myStage[i + 1] ? h('div.txt.mine', h('b', '나의 길: '), st.myStage[i + 1]) : null))),
        ui.card({ kind: 'note', title: '출처', body: window.STAGES_SRC || '' }));
    },
    works() {
      const st = S();
      const box = h('div.dex');
      let locked = 0;
      for (const wid in WORKS) {
        const W = WORKS[wid];
        if (!app.workVisible(wid)) { locked++; continue; }
        const got = st.works[wid] || {};
        const any = st.teacher || Object.keys(got).length > 0;
        const rows = [];
        for (let n = 1; n <= 7; n++) {
          const s = W.stages[n];
          if (!s) continue;
          const open = st.teacher || got[n];
          rows.push(h('div.wrow' + (open ? '' : '.off'), h('span.num', n), h('span', open ? boldNodes(s.t) : '잠김 — 게임을 진행하면 열려요')));
        }
        box.appendChild(h('div.work-item' + (any ? '' : '.unknown'),
          h('div.wh', h('span.seal-mark', W.seal || '原作'), h('b', `『${W.title}』`), h('span.small.muted', ' ' + W.kind)),
          any ? h('p.small', boldNodes(W.about)) : h('p.small.muted', '아직 이 작품의 카드를 얻지 못했어요.'),
          any ? h('div.wrows', rows) : null,
          any && W.src ? h('p.src', W.src) : null));
      }
      return h('div', h('p.small.muted', '장이 끝날 때 전기수의 물음에 답하거나 낯선 대목의 단계를 찾으면 그 작품의 카드가 열려요. 작품 세부는 이본마다 다를 수 있으니 교과서와 대조해 보세요.'),
        box, locked ? h('div.card.note', h('span.kind', '잠긴 칸'), h('h3', `잠긴 작품 ${locked}개`), h('p', '다른 길(다른 성별, 다른 갈래)에서 만나는 작품이에요. 다시 하기로 가 보거나, 친구에게 "너는 어느 길로 갔어?" 하고 물어보세요.')) : null);
    },
    conv() {
      const st = S();
      return h('div', h('p.small.muted', '영웅소설에 되풀이해 나오는 관습이에요. 게임에서 만난 것은 진하게 보여요.'),
        h('div.dex', Object.keys(NOTES.conv).map((k) => { const c = NOTES.conv[k]; return h('div.ev' + (st.conv[k] ? '' : '.dim'), h('h4', c.title), h('div.txt', boldNodes(c.body)), c.real ? h('div.txt.small', boldNodes(c.real)) : null); })));
    },
    misc() {
      const st = S();
      const list = NOTES.misc.filter((m) => st.teacher || steps().ok(m.when));
      return h('div', h('p.small.muted', '영웅소설을 배울 때 자주 헷갈리는 것들이에요.'),
        h('div.dex', list.map((m) => h('div.ev', h('h4', '✕ ' + m.q), h('div.txt', boldNodes('→ ' + m.a))))));
    },
    fic() {
      return h('div',
        h('div.card.note', h('h3', '이 게임의 표시'),
          h('p', h('span.seal-mark', '原作'), ' 실제 작품. 작품 카드와 갈래 끝의 낙관(이 길은 이 작품이 간 길).'),
          h('p', ui.tag('conv'), ' 여러 영웅소설에 되풀이해 나오는 관습.'),
          h('p', ui.tag('fiction'), ' 게임을 위해 지어낸 것(虛): 전기수의 이야기판, 능력치, 전투 규칙, 의심 게이지, 게임 속 인물 이름.'),
          h('p', ui.tag('interp'), ' 여러 해석이 있는 판단. 정답이 아니에요.')),
        ...Object.values(NOTES.fiction).map((f) => ui.card(Object.assign({ kind: 'fiction' }, f))));
    },
    all() {
      return h('div', h('p.small.muted', '선생님용: 모든 길과 갈래를 한눈에 봐요(학생 화면에서는 걸은 길만 보여요).'),
        ...NOTES.branches.map((b) => ui.card({ kind: 'note', title: b.title, body: b.body })));
    },
  };

  function overlay(title, build, withTabs) {
    const bar = h('div.tabs');
    const body = h('div.inner');
    const el = h('div.overlay',
      h('div.topbar', h('div.where', h('strong', title)), h('button.icon-btn', { type: 'button', 'aria-label': '닫기', on: { click: () => { G.audio.tap(); close(); } } }, '✕')),
      withTabs ? bar : null,
      h('div.body', body));
    document.body.appendChild(el);
    const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.sheet-back')) close(); };
    document.addEventListener('keydown', onKey);
    function close() { el.remove(); document.removeEventListener('keydown', onKey); G.ui.unpop(); }
    build(body, bar);
    return { close };
  }

  // ───────── 설정 ─────────
  app.settings = async function () {
    const st = S();
    const seg = (label, key, opts) => h('div', { style: { margin: '10px 0' } }, h('div.small', { style: { fontWeight: 700 } }, label),
      h('div.row-gap', opts.map(([v, t]) => {
        const b = h('button.btn.small' + (st[key] === v ? '.primary' : ''), { type: 'button' }, t);
        b.addEventListener('click', () => {
          G.audio.tap(); st[key] = v; G.save.write(); app.applySettings();
          if (key === 'music') G.audio.music(st.music);
          $$('.btn', b.parentNode).forEach((x) => x.classList.toggle('primary', x === b));
        });
        return b;
      })));
    const res = await ui.sheet([
      h('h3', '설정'),
      seg('방식', 'mode', [['basic', '처음 배우기'], ['deep', '깊이 읽기']]),
      seg('글자 크기', 'font', [[1, '보통'], [1.12, '크게'], [1.25, '아주 크게']]),
      seg('효과음', 'sound', [[true, '켜기'], [false, '끄기']]),
      seg('배경음', 'music', [[true, '켜기'], [false, '끄기']]),
      seg('선생님용', 'teacher', [[false, '끄기'], [true, '모든 장·갈래 열기 + 전투 건너뛰기']]),
      h('p.small.muted', '반을 나눠 진행할 때: 주소 끝에 ?path=m(아들의 길) 또는 ?path=f(딸의 길)를 붙여 나눠 주면 서장에서 성별을 고르지 않고 그 길로 시작해요.'),
      h('p.small.muted', '진행 상황은 이 브라우저에만 저장돼요(서버로 보내지 않아요).'),
      h('p.small.muted', '만든이 박준일(온양여자고등학교 국어 교사)'),
    ], [{ label: '처음부터 새로', value: 'reset' }, { label: '타이틀로', value: 'title' }, { label: '닫기', value: true, cls: 'primary' }]);
    if (res === 'reset') app.newGame(true);
    if (res === 'title') app.title();
  };

  // ───────── 결과: 나의 ○○전 ─────────
  app.result = async function () {
    G.ui.unpop();
    leavePlay();
    G.audio.play('victory');
    const st = S();
    if (!st.path) { app.title(); return; }
    const r = root(); r.innerHTML = '';
    const main = h('div.main-inner');
    r.append(h('div.topbar', iconBtn('toc', '목차', () => app.toc()), h('div.where', h('small', '이야기를 마치며'), h('strong', T('나의 「{전}」'))), iconBtn('book', '편람', () => app.book('works'))),
      h('div.stage', h('div.main', main)));
    const tray = h('div.tray.hide'); r.appendChild(tray);
    const ctx = mkCtx(main, tray);
    const token = (app._playToken = {});
    const say = (t) => steps().line({ who: 'narrator', t }, ctx);

    // 1) 목차 엮기(처음 한 번)
    if (!st.flags.ordered) {
      NOTES.frame.outro.forEach((t) => main.appendChild(say(t)));
      await steps().nextButton(ctx, '목차를 엮는다 ▶');
      if (app._playToken !== token) return;
      await orderActivity(ctx, main);
      if (app._playToken !== token) return;
      // 2) 낯선 대목 셋
      const ps = app.pickPassages(3);
      for (let i = 0; i < ps.length; i++) {
        await passageQuiz(ctx, main, ps[i], `마지막 시험 ${i + 1} / ${ps.length} · 낯선 대목`);
        if (app._playToken !== token) return;
      }
      st.flags.ordered = true;
      if (!st.finishedAt) st.finishedAt = Date.now();
      G.save.write();
    }
    main.innerHTML = '';
    window.scrollTo({ top: 0 });
    ctx.tray(null);
    G.audio.fanfare();
    main.appendChild(say(NOTES.frame.cover));

    // 3) 표지 + 목차
    const nameIn = h('input.name-input.wide', { type: 'text', placeholder: '반 번호 이름 (예: 2-3 12 김지은)', value: st.name || '', maxlength: 24, 'aria-label': '내 이름' });
    nameIn.addEventListener('input', () => { st.name = nameIn.value; G.save.write(); coverWho.textContent = st.name || ''; });
    const coverWho = h('span', st.name || '');
    main.append(h('div.cover-wrap',
      h('div.bookcover', h('div.holes', [0, 1, 2, 3, 4].map(() => h('i'))), h('div.slip', T('{전}')), h('div.cw', coverWho)),
      h('div.toc-page', h('div.tp-h', '목 차'), STAGES.map((s, i) => h('div.tp-row', h('span.num', i + 1), h('b', s.name), h('span', st.myStage[i + 1] || '—'))))),
      h('div.row-gap.center', nameIn));

    // 4) 기록
    const pct = (k) => { const s = st.score[k]; return s && s[1] ? `${s[0]} / ${s[1]}` : '—'; };
    main.appendChild(h('div.ledger',
      h('div.lh', '전기수의 셈', ui.tag('fiction')),
      h('div.stats',
        h('div.stat', h('b', pct('stage')), h('span', '장 끝 단계 판정(첫 시도)')),
        h('div.stat', h('b', pct('passage')), h('span', '낯선 대목 단계 찾기(첫 시도)')),
        h('div.stat', h('b', pct('order')), h('span', '목차 엮기(첫 시도)')),
        h('div.stat', h('b', st.heaven + '번'), h('span', '천우신조로 이어 감')),
        st.path === 'f' && st.branch !== 'c' ? h('div.stat', h('b', st.doubtMax + ' / 100'), h('span', `가장 높았던 의심 · 탄로 위기 ${st.crises}번`)) : null,
        h('div.stat', h('b', st.helped + '번'), h('span', '도움(정답 보기)'))),
      h('p.small.muted', (st.mode === 'deep' ? '깊이 읽기' : '처음 배우기') + ` · 능력치 武${st.abil.mu} 兵${st.abil.byeong} 術${st.abil.sul}` + (st.relic ? ` · 신물 ${BATTLE.relics[st.relic].name}` : ''))));

    // 5) 갈래 지도
    main.appendChild(app.branchMap());

    // 6) 디브리핑 한 줄 답
    const qs = app.debriefQs();
    const qBox = h('div.card.interp', h('span.kind', '생각 나누기 · 한 줄 답'), h('h3', '친구와 이야기하기 전에 한 줄씩 적어 보세요'));
    qs.forEach((q) => {
      const ta = h('textarea.reflect', { rows: 2, maxlength: 120, placeholder: '한 줄로 적어 보세요', 'aria-label': q.q }, st.reflect[q.id] || '');
      ta.addEventListener('input', () => { st.reflect[q.id] = ta.value; G.save.write(); });
      qBox.append(h('p', h('b', q.q)), ta);
    });
    qBox.appendChild(h('p.small.muted', '정답이 없는 질문이에요. 의의와 한계를 함께 생각해 보세요.'));
    main.appendChild(qBox);
    main.appendChild(h('div.card.interp', h('span.kind', '더 생각해 보기'), h('h3', '말로 나눌 질문'), ...NOTES.debrief.talk.filter((q) => steps().ok(q.when)).map((q) => h('p', '· ' + T(q.q)))));

    // 7) 저장
    main.appendChild(h('div.card.note', h('h3', '결과 제출하기'),
      h('p.small', '이름을 적고 "이미지로 저장"을 누르세요. 저장이 안 되면 화면을 캡처해 제출하세요. 윈도: Win + Shift + S · 크롬북: Ctrl + 창 전환 키 · 아이폰·아이패드: 전원 + 볼륨 올리기 · 안드로이드: 전원 + 볼륨 내리기'),
      h('div.row-gap', h('button.btn.primary', { on: { click: () => app.saveImage() } }, '「나의 영웅전」 이미지로 저장'),
        h('button.btn', { on: { click: () => app.newGame(true) } }, '다른 길로 다시 하기'),
        h('button.btn', { on: { click: () => app.title() } }, '타이틀로'))));
  };

  app.debriefQs = function () {
    const st = S();
    return NOTES.debrief.write.filter((q) => steps().ok(q.when)).slice(0, 2);
  };

  // 목차 엮기: 내가 걸은 일곱 대목을 일대기 순서로
  async function orderActivity(ctx, main) {
    const st = S();
    main.innerHTML = '';
    window.scrollTo({ top: 0 });
    const items = STAGES.map((s, i) => ({ n: i + 1, t: st.myStage[i + 1] || s.desc }));
    const cards = shuffle(items);
    main.appendChild(h('div.card.note', h('span.kind', '목차 엮기'), h('h3', T('「{전}」의 목차를 엮어 보세요')), h('p.small', '내가 걸어온 일곱 대목이 뒤섞였어요. 영웅의 일대기 순서(1→7)대로 차례차례 누르세요. 놓은 카드를 다시 누르면 빠져요.')));
    const slots = h('div.slots');
    const pool = h('div.pool');
    const fb = h('div');
    main.append(slots, pool, fb);
    const placed = [];
    let tries = 0;
    const draw = () => {
      slots.innerHTML = '';
      for (let i = 0; i < 7; i++) {
        const it = placed[i];
        const el = h('button.slot' + (it ? '.full' : ''), { type: 'button' }, h('span.num', i + 1), h('span', it ? it.t : STAGES[i].name));
        if (it) el.addEventListener('click', () => { placed.splice(i, 1); G.audio.tap(); draw(); });
        slots.appendChild(el);
      }
      pool.innerHTML = '';
      for (const c of cards) {
        if (placed.includes(c)) continue;
        const el = h('button.pcard', { type: 'button' }, c.t);
        el.addEventListener('click', () => { if (placed.length < 7) { placed.push(c); G.audio.pick(); draw(); } });
        pool.appendChild(el);
      }
      check.disabled = placed.length < 7;
    };
    const check = h('button.btn.seal', { type: 'button' }, '맞추어 보기');
    const reveal = h('button.btn.small.ghost', { type: 'button' }, '정답 보기');
    await new Promise((res) => {
      check.addEventListener('click', () => {
        tries++;
        const wrongAt = placed.map((c, i) => (c.n === i + 1 ? -1 : i)).filter((i) => i >= 0);
        if (!wrongAt.length) {
          if (tries === 1) G.save.stat('order', true);
          G.audio.ok(); ui.stamp('完');
          feedback(fb, 'ok', '일대기의 일곱 걸음이 차례대로 엮였어요!');
          res();
          return;
        }
        if (tries === 1) G.save.stat('order', false);
        G.audio.no();
        $$('.slot', slots).forEach((el, i) => el.classList.toggle('bad', wrongAt.includes(i)));
        feedback(fb, 'warn', `${7 - wrongAt.length}개가 제자리에 있어요. 빗금 친 칸을 다시 생각해 보세요.` + (tries >= 2 ? ' 막히면 "정답 보기"를 눌러도 돼요.' : ''));
        if (tries >= 2) ctx.tray(h('div.actions', reveal, check));
      });
      reveal.addEventListener('click', () => {
        st.helped++; G.save.write();
        placed.length = 0; items.forEach((c) => placed.push(cards.find((x) => x.n === c.n)));
        draw(); res();
      });
      if (st.teacher) ctx.tray(h('div.actions', h('button.btn.small.ghost', { type: 'button', on: { click: () => { placed.length = 0; items.forEach((c) => placed.push(cards.find((x) => x.n === c.n))); draw(); res(); } } }, '정답 채우기(선생님용)'), check));
      else ctx.tray(h('div.actions', check));
      draw();
    });
    ctx.tray(null);
    await steps().nextButton(ctx, '다음 ▶');
  }

  // 갈래 지도: 내가 걸은 길만 펼치고, 나머지는 잠긴 칸으로 개수만
  app.branchMap = function () {
    const st = S();
    const B = NOTES.branchInfo;
    const box = h('div.branchmap', h('div.lh', '이 이야기의 갈래'));
    const pathBox = (key, label, list) => {
      const mine = st.path === key;
      const col = h('div.bpath' + (mine ? '.mine' : ''), h('div.bp-h', label));
      list.forEach((b) => {
        const walked = mine && (key === 'm' || st.branch === b.id);
        const open = walked || st.teacher;
        col.appendChild(h('div.bnode' + (walked ? '.walked' : open ? '' : '.locked'),
          open ? h('b', b.title) : h('b', '？ 잠긴 길'),
          open ? h('span.small', b.work ? `『${WORKS[b.work] ? WORKS[b.work].title : b.work}』이 간 길` : '') : h('span.small', '다른 길을 걸은 친구에게 물어보세요'),
          walked ? h('span.seal-mark', '我') : null));
      });
      return col;
    };
    box.append(h('div.bgrid', pathBox('m', '아들의 길', B.m), pathBox('f', '딸의 길', B.f)));
    const total = B.m.length + B.f.length;
    box.appendChild(h('p.small', `이 이야기에는 ${total}개의 길이 있었어요. 당신은 그중 하나를 걸었어요.`));
    return box;
  };

  // ───────── 이미지 저장: 방각본 표지 + 목차 + 셈 + 한 줄 답 ─────────
  app.saveImage = function () {
    const st = S();
    const W = 1000, H = 1500, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const serif = getComputedStyle(document.documentElement).getPropertyValue('--serif');
    g.fillStyle = '#efe2c3'; g.fillRect(0, 0, W, H);
    // 표지(왼쪽): 누런 표지 + 다섯 구멍 실매기 + 제첨(제목 쪽지)
    const bx = 50, by = 50, bw = 400, bh = 600;
    g.fillStyle = '#c9a25a'; g.fillRect(bx, by, bw, bh);
    g.strokeStyle = 'rgba(90,60,20,.18)'; g.lineWidth = 1;
    for (let y = by + 20; y < by + bh; y += 40) for (let x = bx + 20; x < bx + bw; x += 40) { g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x, y - 10); g.lineTo(x + 10, y); g.lineTo(x, y + 10); g.closePath(); g.stroke(); }
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 3; g.strokeRect(bx, by, bw, bh);
    // 실매기(오른쪽 가장자리)
    g.fillStyle = '#2a2119';
    const holes = [0.08, 0.3, 0.5, 0.7, 0.92].map((k) => by + bh * k);
    holes.forEach((y) => { g.beginPath(); g.arc(bx + bw - 22, y, 4, 0, Math.PI * 2); g.fill(); });
    g.strokeStyle = '#b3342a'; g.lineWidth = 3; g.beginPath(); g.moveTo(bx + bw - 22, holes[0]); g.lineTo(bx + bw - 22, holes[4]); g.stroke();
    holes.forEach((y) => { g.beginPath(); g.moveTo(bx + bw - 22, y); g.lineTo(bx + bw, y); g.stroke(); });
    // 제첨(왼쪽 위 세로 쪽지)
    const sx = bx + 34, sy = by + 34, sw = 86, sh = 360;
    g.fillStyle = '#f7efdc'; g.fillRect(sx, sy, sw, sh);
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 2; g.strokeRect(sx + 6, sy + 6, sw - 12, sh - 12);
    const title = T('{전}');
    const fs = Math.min(56, Math.floor((sh - 40) / (title.length * 1.08)));
    g.font = `700 ${fs}px ${serif}`; g.fillStyle = '#2a2119'; g.textAlign = 'center'; g.textBaseline = 'middle';
    [...title].forEach((ch, i) => g.fillText(ch, sx + sw / 2, sy + 30 + fs / 2 + i * fs * 1.08));
    g.font = `26px ${serif}`; g.fillStyle = '#2a2119'; g.textAlign = 'left';
    g.fillText(st.name || '', bx + 24, by + bh - 30);
    // 목차(오른쪽)
    const tx = 490, ty = 50, tw = 460;
    // 먼저 줄 수를 재어 칸 높이를 정한다
    g.font = `17px ${serif}`;
    let th = 104 + 30;
    STAGES.forEach((s, i) => { th = wrap(g, st.myStage[i + 1] || '—', 0, th + 24, tw - 96, 21, 3, true) + 14; });
    th = Math.max(600, th);
    g.fillStyle = '#f7efdc'; g.fillRect(tx, ty, tw, th);
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 4; g.strokeRect(tx + 12, ty + 12, tw - 24, th - 24);
    g.textAlign = 'center'; g.font = `700 34px ${serif}`; g.fillStyle = '#2a2119'; g.fillText('목 차', tx + tw / 2, ty + 60);
    g.textAlign = 'left';
    let y0 = ty + 104;
    STAGES.forEach((s, i) => {
      g.fillStyle = '#b3342a'; g.font = `700 24px ${serif}`; g.fillText(String(i + 1), tx + 34, y0);
      g.fillStyle = '#2a2119'; g.font = `700 21px ${serif}`; g.fillText(s.name, tx + 62, y0);
      g.fillStyle = '#5a4a3a'; g.font = `17px ${serif}`;
      y0 = wrap(g, st.myStage[i + 1] || '—', tx + 62, y0 + 24, tw - 96, 21, 3) + 14;
    });
    // 전기수의 셈
    const ly = ty + th + 40;
    g.fillStyle = '#fffaf0'; g.fillRect(50, ly, 900, 300);
    g.strokeStyle = 'rgba(42,33,25,.3)'; g.lineWidth = 1.5; g.strokeRect(50, ly, 900, 300);
    g.fillStyle = '#1f7474'; g.font = `700 26px ${serif}`; g.fillText('전기수의 셈 (게임 설정)', 80, ly + 45);
    const pct = (k) => { const s = st.score[k]; return s && s[1] ? `${s[0]} / ${s[1]}` : '—'; };
    const branch = st.path === 'm' ? '아들의 길' : '딸의 길 · ' + ((NOTES.branchInfo.f.find((b) => b.id === st.branch) || {}).title || '');
    const rows = [['걸은 길', branch], ['장 끝 단계 판정 첫 시도', pct('stage')], ['낯선 대목 단계 찾기 첫 시도', pct('passage')], ['목차 엮기 첫 시도', pct('order')], ['천우신조 · 도움', `${st.heaven}번 · ${st.helped}번`]];
    if (st.path === 'f' && st.branch !== 'c') rows.push(['가장 높았던 의심', `${st.doubtMax} / 100`]);
    g.font = `23px ${serif}`;
    rows.forEach(([k, v], i) => { g.fillStyle = '#5a4a3a'; g.textAlign = 'left'; g.fillText(k, 80, ly + 90 + i * 36); g.fillStyle = '#2a2119'; g.textAlign = 'right'; g.fillText(v, 920, ly + 90 + i * 36); });
    // 한 줄 답
    const qy = ly + 330;
    g.textAlign = 'left';
    g.fillStyle = '#36548f'; g.font = `700 26px ${serif}`; g.fillText('생각 나누기 · 한 줄 답', 50, qy);
    let y = qy + 44;
    for (const q of app.debriefQs()) {
      g.fillStyle = '#2a2119'; g.font = `700 21px ${serif}`;
      y = wrap(g, 'Q. ' + T(q.q), 50, y, 900, 28, 2) + 6;
      g.fillStyle = '#5a4a3a'; g.font = `21px ${serif}`;
      y = wrap(g, 'A. ' + (st.reflect[q.id] || ''), 50, y, 900, 28, 3) + 24;
    }
    g.fillStyle = '#8b7a64'; g.font = `18px ${serif}`; g.fillText('영웅의 길 — 영웅소설 서사 RPG · ' + new Date(st.finishedAt || Date.now()).toLocaleDateString('ko-KR'), 50, H - 30);
    c.toBlob((blob) => {
      if (!blob) { ui.toast('이 기기에서는 저장이 안 돼요. 화면을 캡처해 주세요.'); return; }
      const a = h('a', { href: URL.createObjectURL(blob), download: '영웅의길_' + T('{전}') + '_' + (st.name || '이름') + '.png' });
      document.body.appendChild(a); a.click(); a.remove();
    }, 'image/png');
  };
  // 캔버스 줄바꿈(글자 단위). 다음 줄의 y를 돌려준다. dry면 그리지 않고 재기만 한다
  function wrap(g, text, x, y, maxW, lh, maxLines, dry) {
    const put = (t, yy) => { if (!dry) g.fillText(t, x, yy); };
    let line = '', n = 0;
    for (const ch of String(text)) {
      if (g.measureText(line + ch).width > maxW) {
        n++;
        if (n >= maxLines) { put(line.slice(0, -1) + '…', y); return y + lh; }
        put(line, y); y += lh; line = ch;
      } else line += ch;
    }
    if (line) put(line, y);
    return y + lh;
  }
})();
