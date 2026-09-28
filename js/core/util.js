'use strict';
// 공용 도구: DOM 만들기, 이름 끼워 넣기, 조사 맞추기, 섞기 등
window.G = window.G || {};
(function () {
  const U = (G.util = {});

  // h('div.cls#id', {attrs}, children...) — 간단한 요소 생성기
  U.h = function (sel, attrs, ...kids) {
    const m = sel.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
    const el = document.createElement((m && m[1]) || 'div');
    if (m && m[2]) for (const part of m[2].match(/[.#][\w-]+/g)) {
      if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
    }
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'on') for (const ev in v) el.addEventListener(ev, v[ev]);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    U.append(el, kids);
    return el;
  };
  U.append = function (el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    }
    return el;
  };
  U.$ = (s, r = document) => r.querySelector(s);
  U.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  U.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.shuffle = function (a, seed) {
    a = a.slice();
    let s = seed == null ? Math.random() * 1e9 : seed;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  // 섞되 원래 순서와 같지 않게
  U.shuffleNot = function (a, seed) {
    if (a.length < 2) return a.slice();
    let r, n = 0;
    do { r = U.shuffle(a, seed == null ? null : seed + n); n++; } while (n < 20 && r.every((x, i) => x === a[i]));
    return r;
  };
  U.wait = (ms) => new Promise((r) => setTimeout(r, ms));
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // **굵게** → <b>
  U.bold = (s) => U.esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  U.boldNodes = function (s) {
    const span = document.createElement('span');
    span.innerHTML = U.bold(U.T(s)).replace(/\n/g, '<br>');
    return span;
  };

  // 받침이 있는가(한글이 아니면 null)
  U.jong = function (word) {
    const c = String(word).charCodeAt(String(word).length - 1);
    if (!(c >= 0xac00 && c <= 0xd7a3)) return null;
    return (c - 0xac00) % 28;
  };
  // 낱말 뒤 조사를 받침에 맞춘다: josa('부인', '가 시킨') → '이 시킨'
  //  이/가, 은/는, 을/를, 과/와, 으로/로(ㄹ 받침은 '로'), 아/야, 이여/여, 이라/라, 이다/다(…이었다)만 바꾼다
  U.josa = function (word, rest) {
    rest = rest || '';
    const j = U.jong(word);
    if (j == null) return rest;
    const has = j > 0;
    const m2 = /^(이여|여|이라|라|아|야)(?![가-힣])/.exec(rest);
    if (m2) {
      const pair = { 이여: ['이여', '여'], 여: ['이여', '여'], 이라: ['이라', '라'], 라: ['이라', '라'], 아: ['아', '야'], 야: ['아', '야'] }[m2[1]];
      return pair[has ? 0 : 1] + rest.slice(m2[1].length);
    }
    const m = /^(으로|로|이|가|은|는|을|를|과|와)(?=[\s,.!?…'"」』)]|$)/.exec(rest);
    if (!m) return rest;
    const pairs = { 이: ['이', '가'], 가: ['이', '가'], 은: ['은', '는'], 는: ['은', '는'], 을: ['을', '를'], 를: ['을', '를'], 과: ['과', '와'], 와: ['과', '와'], 으로: ['으로', '로'], 로: ['으로', '로'] };
    const useFirst = m[1] === '으로' || m[1] === '로' ? has && j !== 8 : has;
    return pairs[m[1]][useFirst ? 0 : 1] + rest.slice(m[1].length);
  };

  // 글 속 이름 자리 채우기: {성명} {이름} {성} {호} {공명} {부} {아이} {전}
  //  {이름:아} 처럼 쓰면 받침에 맞춰 조사를 붙인다 → '충렬아' / '소화야', {성명:을} → '유충렬을' / '홍소화를'
  U.names = function () {
    const st = G.save.state;
    const sur = st.surname || '홍', given = st.given || '길동';
    const pub = st.disguised && st.alias ? st.alias : given;
    return {
      성명: sur + given, 이름: given, 성: sur, 호: pub, 공명: sur + pub,
      부: sur + ' 시랑', 아이: st.path === 'f' ? '딸' : '아들', 전: sur + given + '전',
      남장명: sur + (st.alias || given),
    };
  };
  U.T = function (s) {
    if (s == null) return '';
    s = String(s);
    if (s.indexOf('{') < 0) return s;
    const N = U.names();
    return s.replace(/\{(성명|이름|성|호|공명|부|아이|전|남장명)(?::([^}]+))?\}/g, (_, k, j) => N[k] + (j ? U.josa(N[k], j) : ''));
  };

  // 초상 경로. 주인공은 길(아들·딸)과 지금 모습(look)에 따라 바뀐다
  const HERO_PT = {
    m: { child: 'pt_m_child', youth: 'pt_m_scholar', general: 'pt_m_hero', lady: 'pt_m_scholar', sage: 'pt_m_hero' },
    f: { child: 'pt_f_child', youth: 'pt_f_scholar', general: 'pt_f_general', lady: 'pt_f_lady', sage: 'pt_f_sage' },
  };
  U.pt = function (id, look) {
    if (id === 'hero') {
      const st = G.save.state;
      return 'assets/pt/' + HERO_PT[st.path || 'm'][look || st.look || 'child'] + '.webp';
    }
    const p = (window.PEOPLE || {})[id];
    return p ? 'assets/pt/' + p.pt + '.webp' : '';
  };
  U.who = function (id) {
    if (id === 'hero') return U.T('{호}');
    const p = (window.PEOPLE || {})[id];
    return p ? U.T(p.name) : '';
  };
})();
