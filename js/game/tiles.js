'use strict';
// 땅 타일: 코드로 그린 도트 타일(PPU 32). 이어 붙여도 이음새가 보이지 않게 칸마다 같은 씨앗의 잡음을 쓴다.
//  맵 글자 → 타일: '.' 풀 ',' 꽃밭 ':' 흙길 '=' 박석 '_' 마루 '~' 물 's' 모래 'm' 짙은 풀 'e' 싸움터 흙 'p' 밭 'r' 붉은 깔개 'b' 다리
//                  '#' 담장 'f' 울타리 'c' 바위 절벽 'h' 산울타리 'x' 바깥(검정)  ← 막힘
(function () {
  const T = 32;
  const TL = (G.tiles = { T });
  TL.SOLID = new Set(['#', 'f', 'c', 'h', 'x', '~']);
  TL.WATER = new Set(['~']);

  // 결정적 잡음(같은 칸은 늘 같은 무늬)
  const rnd = (x, y, k) => { let n = (x * 374761393 + y * 668265263 + k * 1442695041) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const px = (g, x, y, c, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

  function speckle(g, ox, oy, tx, ty, base, dots, n, k) {
    px(g, ox, oy, base, T, T);
    for (let i = 0; i < n; i++) {
      const r1 = rnd(tx, ty, k + i * 3), r2 = rnd(tx, ty, k + i * 3 + 1), r3 = rnd(tx, ty, k + i * 3 + 2);
      px(g, ox + Math.floor(r1 * T), oy + Math.floor(r2 * T), dots[Math.floor(r3 * dots.length)], r3 > 0.8 ? 2 : 1, 1);
    }
  }
  const DRAW = {
    '.': (g, x, y, tx, ty) => { speckle(g, x, y, tx, ty, '#6f9f48', ['#5f8c3c', '#86b457', '#7aa94f', '#58843a'], 26, 1); if (rnd(tx, ty, 9) > 0.8) { const a = x + 4 + Math.floor(rnd(tx, ty, 10) * 22), b = y + 6 + Math.floor(rnd(tx, ty, 11) * 20); px(g, a, b, '#4f7a33', 1, 3); px(g, a + 2, b + 1, '#4f7a33', 1, 2); } },
    ',': (g, x, y, tx, ty) => { DRAW['.'](g, x, y, tx, ty); for (let i = 0; i < 4; i++) { const a = x + 3 + Math.floor(rnd(tx, ty, 20 + i) * 26), b = y + 3 + Math.floor(rnd(tx, ty, 30 + i) * 26); const c = ['#e8d34f', '#e57c7c', '#f2f2f2', '#c98ae0'][Math.floor(rnd(tx, ty, 40 + i) * 4)]; px(g, a, b, c, 2, 2); px(g, a + 1, b + 2, '#4f7a33', 1, 1); } },
    'm': (g, x, y, tx, ty) => speckle(g, x, y, tx, ty, '#4e7a36', ['#43692e', '#5c8a40', '#3a5e28'], 30, 2),
    ':': (g, x, y, tx, ty) => { speckle(g, x, y, tx, ty, '#b8925f', ['#a47f50', '#c9a672', '#9a7548', '#d2b27e'], 22, 3); },
    'e': (g, x, y, tx, ty) => { speckle(g, x, y, tx, ty, '#9c8058', ['#87704c', '#b19368', '#6f8a45', '#7d6a48'], 34, 4); },
    's': (g, x, y, tx, ty) => speckle(g, x, y, tx, ty, '#d8c28c', ['#c9b17a', '#e6d3a2', '#bfa56c'], 20, 5),
    'p': (g, x, y, tx, ty) => { px(g, x, y, '#8d6a3f', T, T); for (let r = 0; r < 4; r++) { px(g, x, y + r * 8 + 2, '#7a5a33', T, 2); px(g, x, y + r * 8 + 5, '#6f9f48', T, 1); } },
    '=': (g, x, y, tx, ty) => {
      // 박석: 크기가 제각각인 돌판. 이음매가 칸 경계와 겹치지 않게 칸마다 다른 자리에 긋는다
      px(g, x, y, '#aba699', T, T);
      for (let i = 0; i < 10; i++) px(g, x + Math.floor(rnd(tx, ty, 60 + i) * T), y + Math.floor(rnd(tx, ty, 70 + i) * T), rnd(tx, ty, 80 + i) > 0.5 ? '#a19c8f' : '#b3aea1', 2, 1);
      const cy = 6 + Math.floor(rnd(tx, ty, 51) * 20), cx = 4 + Math.floor(rnd(tx, ty, 50) * 24), cx2 = 4 + Math.floor(rnd(tx, ty, 52) * 24);
      px(g, x, y + cy, '#958f82', T, 1); px(g, x, y + cy + 1, '#b9b4a8', T, 1);
      px(g, x + cx, y, '#958f82', 1, cy); px(g, x + cx + 1, y, '#b9b4a8', 1, cy);
      px(g, x + cx2, y + cy + 2, '#958f82', 1, T - cy - 2); px(g, x + cx2 + 1, y + cy + 2, '#b9b4a8', 1, T - cy - 2);
    },
    '_': (g, x, y, tx, ty) => { px(g, x, y, '#a0703f', T, T); for (let r = 0; r < 4; r++) { px(g, x, y + r * 8, '#8a5d33', T, 1); px(g, x + ((r * 13 + tx * 7) % T), y + r * 8, '#7a502b', 1, 8); } px(g, x, y + 1, '#b5824c', T, 1); },
    'r': (g, x, y) => { px(g, x, y, '#9e2b25', T, T); px(g, x, y, '#c9a13b', T, 2); px(g, x, y + T - 2, '#c9a13b', T, 2); for (let i = 4; i < T; i += 8) px(g, x + i, y + 12, '#b8453d', 3, 3); },
    'b': (g, x, y) => { px(g, x, y, '#3d6fb0', T, T); px(g, x, y + 2, '#8a5d33', T, T - 4); for (let i = 0; i < T; i += 6) px(g, x + i, y + 2, '#6e4726', 1, T - 4); px(g, x, y + 2, '#5c3b20', T, 2); px(g, x, y + T - 4, '#5c3b20', T, 2); },
    '~': (g, x, y, tx, ty, f) => { px(g, x, y, '#3d6fb0', T, T); for (let i = 0; i < 5; i++) { const a = Math.floor(rnd(tx, ty, 80 + i) * 24), b = Math.floor(rnd(tx, ty, 90 + i) * 30); px(g, x + ((a + (f || 0) * 3) % 26), y + b, '#6f9fd6', 5, 1); } },
    '#': (g, x, y, tx, ty, f, grid) => {
      const below = grid && grid[ty + 1] ? grid[ty + 1][tx] : '#';
      if (below === '#') {
        // 담장 윗면(위에서 본 기와 등마루): 세로로 이어진 담은 이렇게 보인다
        px(g, x, y, '#3b3e43', T, T);
        for (let i = 2; i < T; i += 5) px(g, x + i, y, '#4d5157', 3, T);
        px(g, x + 13, y, '#26282b', 6, T); px(g, x + 14, y, '#5c6167', 1, T);
        return;
      }
      // 담장 앞면: 위는 검은 기와, 아래는 돌 쌓기
      px(g, x, y, '#8a8580', T, T);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { const bx = x + c * 11 - (r % 2 ? 5 : 0), by = y + 12 + r * 7; px(g, Math.max(x, bx), by, '#9d9892', Math.min(10, bx + 10 - x), 6); px(g, Math.max(x, bx), by + 6, '#6d6863', Math.min(11, bx + 11 - x), 1); }
      px(g, x, y, '#3b3e43', T, 10); for (let i = 0; i < T; i += 4) px(g, x + i, y + 2, '#55595f', 2, 6); px(g, x, y + 10, '#26282b', T, 2);
    },
    'f': (g, x, y, tx, ty, f, grid) => {
      DRAW['.'](g, x, y, tx, ty);
      const at = (a, b) => (grid && grid[b] ? grid[b][a] : '');
      const v = at(tx, ty - 1) === 'f' || at(tx, ty + 1) === 'f', hz = at(tx - 1, ty) === 'f' || at(tx + 1, ty) === 'f' || !v;
      if (hz) { px(g, x, y + 12, '#8a5d33', T, 3); px(g, x, y + 21, '#8a5d33', T, 3); px(g, x, y + 12, '#a0703f', T, 1); }
      if (v) { px(g, x + 12, y, '#8a5d33', 3, T); px(g, x + 19, y, '#8a5d33', 3, T); px(g, x + 12, y, '#a0703f', 1, T); }
      px(g, x + 13, y + 6, '#6e4726', 6, 22); px(g, x + 13, y + 6, '#a0703f', 1, 22); px(g, x + 13, y + 26, '#4a2f18', 6, 2);
    },
    'h': (g, x, y, tx, ty) => { px(g, x, y, '#355e2a', T, T); for (let i = 0; i < 14; i++) px(g, x + Math.floor(rnd(tx, ty, 100 + i) * 28), y + Math.floor(rnd(tx, ty, 120 + i) * 28), rnd(tx, ty, 140 + i) > 0.5 ? '#4b7a37' : '#274a1f', 4, 3); },
    'c': (g, x, y, tx, ty) => { px(g, x, y, '#7c7163', T, T); for (let i = 0; i < 6; i++) { const a = Math.floor(rnd(tx, ty, 150 + i) * 24), b = Math.floor(rnd(tx, ty, 160 + i) * 24); px(g, x + a, y + b, '#968a7a', 8, 5); px(g, x + a, y + b + 5, '#5a5046', 8, 1); } },
    'x': (g, x, y) => px(g, x, y, '#1b1a17', T, T),
  };
  TL.draw = function (g, ch, x, y, tx, ty, frame, grid) { (DRAW[ch] || DRAW['.'])(g, x, y, tx, ty, frame, grid); };

  // 가장자리 그늘: 담장 아래, 물가 거품, 풀과 흙의 경계
  TL.edges = function (g, grid, tx, ty, x, y) {
    const at = (a, b) => (grid[b] && grid[b][a]) || 'x';
    const c = at(tx, ty);
    if (TL.SOLID.has(c) && c !== '~') return;
    if (at(tx, ty - 1) === '#' || at(tx, ty - 1) === 'c') { g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x, y, T, 5); }
    if (c === '~') return;
    const water = (a, b) => at(a, b) === '~';
    g.fillStyle = '#e8eef5';
    if (water(tx, ty - 1)) g.fillRect(x, y, T, 2);
    if (water(tx, ty + 1)) g.fillRect(x, y + T - 2, T, 2);
    if (water(tx - 1, ty)) g.fillRect(x, y, 2, T);
    if (water(tx + 1, ty)) g.fillRect(x + T - 2, y, 2, T);
    const soft = (k) => k === '.' || k === ',' || k === 'm';
    if ((c === ':' || c === 'e' || c === 's') ) {
      g.fillStyle = 'rgba(80,120,50,.55)';
      if (soft(at(tx, ty - 1))) for (let i = 0; i < T; i += 3) g.fillRect(x + i, y, 2, 1 + ((i * 7 + tx) % 3));
      if (soft(at(tx, ty + 1))) for (let i = 0; i < T; i += 3) g.fillRect(x + i, y + T - 1 - ((i * 5 + ty) % 3), 2, 1 + ((i * 5 + ty) % 3));
      if (soft(at(tx - 1, ty))) for (let i = 0; i < T; i += 3) g.fillRect(x, y + i, 1 + ((i * 3 + ty) % 3), 2);
      if (soft(at(tx + 1, ty))) for (let i = 0; i < T; i += 3) g.fillRect(x + T - 1 - ((i * 3 + tx) % 3), y + i, 1 + ((i * 3 + tx) % 3), 2);
    }
  };

  // 맵 전체의 땅을 한 장의 캔버스로 미리 그린다(물은 매 프레임 따로 움직인다)
  TL.render = function (grid) {
    const h = grid.length, w = grid[0].length;
    const c = document.createElement('canvas');
    c.width = w * T; c.height = h * T;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const water = [];
    for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
      const ch = grid[ty][tx];
      TL.draw(g, ch, tx * T, ty * T, tx, ty, 0, grid);
      if (ch === '~') water.push([tx, ty]);
    }
    for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) TL.edges(g, grid, tx, ty, tx * T, ty * T);
    return { canvas: c, water };
  };
})();
