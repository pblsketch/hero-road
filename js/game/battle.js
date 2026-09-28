'use strict';
// 카드형 턴제 전투(군담). 반사신경·시간 제한 없음, 게임 오버 없음(천우신조로 이어 감).
// G.battle.run(enemyId, ctx, { tutorial, intro }) → Promise<{ turns, heaven }>
(function () {
  const { h, wait, shuffle, clamp, T } = G.util;
  const ui = G.ui;
  const S = () => G.save.state;
  const B = () => window.BATTLE;
  const bt = (G.battle = {});

  const STAT_HAN = { mu: '武', byeong: '兵', sul: '術' };
  const STAT_KO = { mu: '무예', byeong: '병법', sul: '도술' };
  bt.STAT_HAN = STAT_HAN; bt.STAT_KO = STAT_KO;

  const val = (pair, stat) => Math.round(pair[0] + pair[1] * (S().abil[stat] || 1));
  // 카드 설명 글(능력치를 넣은 실제 수치)
  bt.cardText = function (c) {
    const st = c.stat;
    return T(c.text)
      .replace('{d}', c.dmg ? val(c.dmg, st) : '')
      .replace('{b}', c.block ? val(c.block, st) : '')
      .replace('{h}', c.heal ? val(c.heal, st) : '');
  };
  bt.maxHp = () => { const a = S().abil; return 20 + 2 * a.mu + a.byeong + a.sul; };

  // 능력치에 따라 카드 더미를 만든다(능력치가 높을수록 그 계열 카드가 자주 온다)
  function pool() {
    const a = S().abil, C = B().cards, out = [];
    for (const id in C) {
      const c = C[id];
      if (c.need && (a[c.stat] || 0) < c.need) continue;
      const n = Math.max(1, a[c.stat]);
      for (let i = 0; i < n; i++) out.push(id);
    }
    return out;
  }
  function draw(n) {
    const p = shuffle(pool()), hand = [];
    for (const id of p) { if (!hand.includes(id)) hand.push(id); if (hand.length >= n) break; }
    return hand;
  }

  bt.run = function (enemyId, ctx, opt = {}) {
    return new Promise((resolve) => {
      const E = B().enemies[enemyId];
      const st = S();
      const max = bt.maxHp();
      const hero = { hp: max, max, block: 0, evade: false, hexed: false };
      const foe = { hp: E.hp, max: E.hp, block: 0, weak: false, stunned: false, idx: 0 };
      let relicUsed = false, turns = 0, heavenHere = 0, over = false, tutStep = 0;

      G.audio.play(E.final ? 'final' : 'battle');
      ctx.main.innerHTML = '';
      const field = h('div.battle');
      const bg = opt.bg || E.bg;
      if (bg) field.appendChild(h('div.bbg', { style: { backgroundImage: `url(assets/sc/${bg}.webp)` } }));
      // 적
      const foeHp = h('i'), foeHpTxt = h('span.hpnum');
      const intentEl = h('div.intent');
      const foeBlock = h('span.chip.block.hide');
      const foeBox = h('div.fighter.foe',
        h('div.face', ui.face(enemyId === 'phantom' ? 'phantom' : 'enemy')),
        h('div.info', h('div.nm', E.name), h('div.hp', foeHp), h('div.row', foeHpTxt, foeBlock), intentEl));
      if (E.pt) foeBox.querySelector('img').src = 'assets/pt/' + E.pt + '.webp';
      // 기록
      const log = h('div.blog', { 'aria-live': 'polite' });
      // 주인공
      const heroHp = h('i'), heroHpTxt = h('span.hpnum');
      const heroChips = h('span.row');
      const heroBox = h('div.fighter.hero',
        h('div.face', ui.face('hero')),
        h('div.info', h('div.nm', T('{호}')), h('div.hp', heroHp), h('div.row', heroHpTxt, heroChips),
          h('div.abil', ['mu', 'byeong', 'sul'].map((k) => h('span.ab', h('b', STAT_HAN[k]), ' ', STAT_KO[k], ' ', String(st.abil[k]))))));
      const tip = h('div.btip.hide');
      field.append(foeBox, log, tip, heroBox);
      ctx.main.appendChild(field);
      for (const line of opt.intro || [E.name + G.util.josa(E.name, '이') + ' 앞을 막아섰다!']) addLog(T(line), 'story');

      // 손맛: 맞은 쪽 초상이 하얗게 번쩍이고, 베는 빛·피해 숫자가 뜨고, 잠깐 멈춘다(히트 스톱)
      function hitFx(box, d, kind = 'hit') {
        const face = box.querySelector('.face');
        box.classList.remove('hit'); void box.offsetWidth; box.classList.add('hit');
        if (kind === 'hit') face.appendChild(h('span.slashfx'));
        const pop = h('span.dmgpop.' + kind, (kind === 'heal' ? '+' : '-') + d);
        box.appendChild(pop);
        setTimeout(() => { pop.remove(); const s = face.querySelector('.slashfx'); if (s) s.remove(); }, 850);
        if (d >= 8 || kind === 'hurt') { field.classList.remove('flash', 'red'); void field.offsetWidth; field.classList.add('flash'); if (kind === 'hurt') field.classList.add('red'); }
        return wait(d >= 8 ? 140 : 80);
      }

      function addLog(text, cls = '') {
        const p = h('p' + (cls ? '.' + cls : ''), G.util.boldNodes(text));
        log.appendChild(p);
        while (log.children.length > 5) log.firstChild.remove();
        p.scrollIntoView({ block: 'nearest' });
      }
      function showTip(text) { tip.innerHTML = ''; tip.appendChild(G.util.boldNodes(text)); tip.classList.remove('hide'); }
      function intent() { return E.pattern[foe.idx % E.pattern.length]; }
      function drawBars() {
        foeHp.style.width = (100 * Math.max(0, foe.hp) / foe.max) + '%';
        foeHpTxt.textContent = `기력 ${Math.max(0, foe.hp)} / ${foe.max}`;
        foeBlock.textContent = foe.block ? `막기 ${foe.block}` : '';
        foeBlock.classList.toggle('hide', !foe.block);
        heroHp.style.width = (100 * Math.max(0, hero.hp) / hero.max) + '%';
        heroHp.parentNode.classList.toggle('low', hero.hp <= hero.max * 0.3);
        heroHpTxt.textContent = `기력 ${Math.max(0, hero.hp)} / ${hero.max}`;
        heroChips.innerHTML = '';
        if (hero.block) heroChips.appendChild(h('span.chip.block', `막기 ${hero.block}`));
        if (hero.evade) heroChips.appendChild(h('span.chip.evade', '피함'));
        if (hero.hexed) heroChips.appendChild(h('span.chip.hex', '요술에 걸림(카드 절반)'));
        const [k, n] = intent();
        const I = B().intents[k];
        intentEl.innerHTML = '';
        intentEl.className = 'intent ' + k + (foe.stunned ? ' stun' : '');
        intentEl.append(h('span.ic', I.icon), h('span', foe.stunned ? '어지러워 한 턴 쉼' : I.label + (n ? ' ' + (foe.weak && (k === 'atk' || k === 'heavy') ? Math.ceil(n / 2) + ' (약해짐)' : n) : '')));
      }

      function cardEl(id, isRelic) {
        const c = isRelic ? B().relics[id] : B().cards[id];
        const el = h('button.bcard.' + (isRelic ? 'relic' : c.stat), { type: 'button' },
          h('span.han', c.han), h('span.cn', c.name), h('span.ct', bt.cardText(c)), isRelic ? h('span.once', '신물 · 한 번') : null);
        el.addEventListener('click', () => { if (!over) play(id, isRelic); });
        return el;
      }
      function turnStart() {
        turns++;
        drawBars();
        const hand = draw(3);
        const row = h('div.hand');
        hand.forEach((id) => row.appendChild(cardEl(id, false)));
        // 대련(튜토리얼)에서는 카드 읽는 법을 먼저 익히도록 신물을 셋째 턴부터 준다
        if (st.relic && !relicUsed && !(opt.tutorial && turns < 3)) row.appendChild(cardEl(st.relic, true));
        const acts = [row];
        if (st.teacher) acts.push(h('div.actions', h('button.btn.small.ghost', { type: 'button', on: { click: () => { if (over) return; foe.hp = 0; addLog('(선생님용) 전투를 건너뛰었다.'); finish(); } } }, '바로 이기기(선생님용)')));
        ctx.tray(h('div', acts));
        if (opt.tutorial) tutorial();
      }
      function tutorial() {
        const [k] = intent();
        if (tutStep === 0) { showTip('적 옆의 표시는 적이 **이번 턴에 할 행동**이에요. 카드 한 장을 골라 먼저 움직이세요. 카드의 세기는 **능력치(武·兵·術)**가 높을수록 커져요.'); tutStep = 1; }
        else if (k === 'charge' && tutStep < 2) { showTip('적이 **기를 모으고** 있어요. 다음 턴에 큰 공격(강공)이 와요. **지금** 兵 **계책**을 쓰면 준비를 끊을 수 있어요. **진법**·**둔갑술**은 그 턴에만 효과가 있으니, 다음 턴 **강공**이 보일 때 쓰세요.'); tutStep = 2; }
        else if (k === 'guard' && tutStep < 3) { showTip('적이 **막기**를 해요. 이럴 때는 공격보다 **부적**으로 기력을 채우거나 진을 쳐 두는 것도 방법이에요.'); tutStep = 3; }
        else if (tutStep >= 1 && st.relic && !relicUsed && turns >= 3 && tutStep < 4) { showTip('붉은 테두리 카드는 스승에게 받은 **신물**이에요. 전투마다 한 번 쓸 수 있어요.'); tutStep = 4; }
      }

      async function play(id, isRelic) {
        over = true; // 연출 중 두 번 누르지 않게
        const c = isRelic ? B().relics[id] : B().cards[id];
        if (isRelic) relicUsed = true;
        ctx.tray(null);
        tip.classList.add('hide');
        const lines = B().lines[id] || [];
        if (lines.length) addLog(T(lines[Math.floor(Math.random() * lines.length)]), 'act');
        const [k] = intent();
        let halve = hero.hexed; hero.hexed = false;
        if (c.counter) {
          if (k === 'charge' || k === 'heavy' || k === 'hex') {
            addLog(k === 'charge' ? '적이 모으던 기세가 흩어졌다! 큰 공격은 오지 않는다.' : k === 'hex' ? '적의 요술이 깨졌다!' : '적의 강공이 허물어졌다!', 'good');
            foe.idx += k === 'charge' ? 2 : 1; // 기를 모음이면 뒤따르는 강공까지 건너뛴다
            foe.stunned = true;
          } else addLog('적은 큰 수를 준비하지 않았다. 계책이 크게 먹히지는 않았다.');
        }
        if (c.dmg) {
          let d = val(c.dmg, c.stat);
          if (halve) { d = Math.ceil(d / 2); addLog('요술 기운에 힘이 반으로 줄었다.'); }
          const blocked = Math.min(foe.block, d); foe.block -= blocked; d -= blocked;
          foe.hp -= d;
          c.stat === 'sul' ? G.audio.magic() : G.audio.slash();
          ui.shake(foeBox);
          if (d > 0) await hitFx(foeBox, d);
          addLog(`적에게 피해 **${d}**` + (blocked ? ` (적이 ${blocked} 막음)` : ''), 'hit');
        }
        if (c.block) { const b = val(c.block, c.stat); hero.block += b; G.audio.guard(); addLog(`이번 턴 피해를 **${b}** 막는다.`); }
        if (c.heal) { const v = val(c.heal, c.stat); hero.hp = Math.min(hero.max, hero.hp + v); G.audio.heal(); hitFx(heroBox, v, 'heal'); addLog(`기력 **${v}** 회복.`, 'good'); }
        if (c.weaken) { foe.weak = true; if (!c.dmg) G.audio.magic(); addLog('적의 다음 공격이 반으로 약해진다.'); }
        if (c.evade) { hero.evade = true; if (!c.dmg && !c.heal) G.audio.magic(); addLog('이번 턴 적의 공격을 모두 피한다.'); }
        drawBars();
        await wait(650);
        if (foe.hp <= 0) return finish();
        await foeAct();
        drawBars();
        if (hero.hp <= 0) await heaven();
        over = false;
        turnStart();
      }

      async function foeAct() {
        if (foe.stunned) { foe.stunned = false; addLog('적이 흔들려 이번 턴에는 움직이지 못했다.'); hero.block = 0; hero.evade = false; return; }
        const [k, n] = intent();
        foe.idx++;
        foe.block = 0;
        if (k === 'charge') addLog('적장이 크게 숨을 들이쉬며 기를 모은다…', 'warn');
        else if (k === 'guard') { foe.block = n; G.audio.guard(); addLog(`적이 방패를 세워 피해를 ${n} 막으려 한다.`); }
        else {
          let d = n;
          if (foe.weak && (k === 'atk' || k === 'heavy')) { d = Math.ceil(d / 2); foe.weak = false; }
          if (hero.evade) { addLog('적의 공격이 허공을 갈랐다!', 'good'); d = 0; }
          const blocked = Math.min(hero.block, d); d -= blocked;
          if (d > 0) { hero.hp -= d; G.audio.hurt(); ui.shake(heroBox); await hitFx(heroBox, d, 'hurt'); }
          addLog((k === 'heavy' ? '적의 강공! ' : k === 'hex' ? '적이 요술을 부렸다! ' : '적이 공격했다. ') + `피해 **${d}**` + (blocked ? ` (${blocked} 막음)` : ''), 'bad');
          if (k === 'hex') { hero.hexed = true; addLog('요술 기운 때문에 다음 카드의 힘이 반으로 줄어든다.'); }
        }
        hero.block = 0; hero.evade = false;
        await wait(350);
      }

      async function heaven() {
        st.heaven++; heavenHere++; G.save.write();
        G.audio.heaven();
        hero.hp = Math.ceil(hero.max * 0.6);
        foe.stunned = true;
        const first = !st.seen.heaven;
        st.seen.heaven = true;
        await ui.sheet([
          h('div.center', h('span.seal-mark.big', '天佑神助')),
          h('h3.center', '천우신조(天佑神助) — 하늘이 돕다'),
          h('p', G.util.boldNodes(T(E.heaven))),
          h('p.small', G.util.boldNodes('기력이 다시 차올랐어요. 영웅소설의 영웅은 죽을 고비에서 **하늘이나 조력자의 도움**으로 살아나곤 해요.')),
          first ? ui.card({ kind: 'fiction', title: '이 게임에는 게임 오버가 없어요', body: '기력이 다하면 천우신조로 이야기가 이어지고, 결과 화면에는 "천우신조 몇 번"으로만 적혀요.', real: '천우신조는 실제 영웅소설에 자주 나오는 **관습**이에요. 영웅은 천상계의 보살핌을 받는 존재라서, 위기에 빠지면 하늘이나 신이한 조력자가 돕습니다.' }) : null,
        ], [{ label: '다시 싸운다', value: true, cls: 'primary' }], { dismiss: false });
        if (!st.conv.heaven) { st.conv.heaven = true; G.save.write(); }
        addLog('하늘의 도움으로 다시 일어섰다!', 'good');
      }

      async function finish() {
        over = true;
        drawBars();
        G.audio.win();
        ui.shake(foeBox);
        foeBox.classList.add('down');
        addLog(E.final ? '적이 크게 무너졌다!' : '적을 물리쳤다!', 'good');
        await wait(700);
        ctx.tray(null);
        resolve({ turns, heaven: heavenHere });
      }

      turnStart();
    });
  };
})();
