'use strict';
// 맵(선생님이 고쳐도 되는 파일)
//  - 땅은 글자 격자로 만든다. 한 칸 = 32px. 글자 뜻은 js/game/tiles.js 맨 위에 있다.
//    '.' 풀 ',' 꽃밭 'm' 짙은 풀 ':' 흙길 '=' 박석 '_' 마루 's' 모래 'e' 싸움터 흙 'p' 밭 'r' 붉은 깔개 'b' 다리
//    막힌 칸: '#' 담장 'f' 울타리 'c' 바위 벼랑 'h' 산울타리 '~' 물 'x' 바깥
//  - props: [그림, 왼쪽 칸 x, 바닥 칸 y, {hit:'표적 이름', walk:true(지나갈 수 있음), flat:true(바닥에 깔림)}]
//  - spots: 살피거나 밟는 자리 { x, y, w, h, name, act(단추 글자), look(살피면 나오는 말), hint(알림) }
//  - npcs: 늘 있는 사람들(목표와 상관없이 말을 걸 수 있다) { sp, x, y, dir, name, talk:[말, 말…], wander(돌아다니는 칸 수), chs:['ch0'](이 장에서만) }
//    talkBy:{ ch3:[말…] }를 주면 그 장에서는 그 말을 한다(이야기 시점에 맞게). 말 하나는 문자열 또는 { when:{path:'m'}, t:'…' }
//    x, y는 칸 번호. 사람의 발은 그 칸 아래쪽 가운데에 선다(13.5처럼 반 칸도 된다).
(function () {
  // 격자 만들기: 채우기 → 사각형 → 점
  function mk(w, hgt, base, ops) {
    const g = Array.from({ length: hgt }, () => Array(w).fill(base));
    const set = (x, y, c) => { if (y >= 0 && y < hgt && x >= 0 && x < w) g[y][x] = c; };
    for (const op of ops) {
      const [k] = op;
      if (k === 'rect') { const [, x, y, rw, rh, c] = op; for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) set(i, j, c); }
      else if (k === 'frame') { const [, x, y, rw, rh, c] = op; for (let i = x; i < x + rw; i++) { set(i, y, c); set(i, y + rh - 1, c); } for (let j = y; j < y + rh; j++) { set(x, j, c); set(x + rw - 1, j, c); } }
      else if (k === 'border') { const [, c] = op; for (let i = 0; i < w; i++) { set(i, 0, c); set(i, hgt - 1, c); } for (let j = 0; j < hgt; j++) { set(0, j, c); set(w - 1, j, c); } }
      else if (k === 'dots') { const [, c, pts] = op; for (const [x, y] of pts) set(x, y, c); }
    }
    return g.map((r) => r.join(''));
  }

  window.MAPS = {
    // ───────── 서장 · 종로 저잣거리 ─────────
    market: {
      name: '종로 저잣거리', music: 'market', spawn: [11.5, 17, 'up'],
      grid: mk(30, 20, '.', [
        ['rect', 0, 0, 30, 6, '.'],
        ['rect', 1, 6, 28, 4, '='],
        ['rect', 17, 10, 11, 5, ':'],
        ['rect', 11, 10, 2, 9, ':'],
        ['rect', 13, 14, 5, 1, ':'],
        ['dots', ',', [[2, 1], [3, 1], [27, 1], [26, 2], [2, 15], [3, 16], [27, 16], [26, 17], [20, 17], [21, 17], [8, 16]]],
        ['border', 'h'],
      ]),
      props: [
        ['pr_house', 1, 5], ['pr_cottage', 8, 5], ['pr_house', 13, 5], ['pr_cottage', 20, 5], ['pr_cottage', 25, 5],
        ['pr_stall', 1.5, 12], ['pr_stall', 5, 12], ['pr_jars', 8.2, 11.6],
        ['pr_lantern', 16.3, 10.5], ['pr_lantern', 27.3, 10.5],
        ['pr_well', 14, 17.2], ['pr_willow', 1, 18.2], ['pr_pine', 25.5, 18.2], ['pr_cart', 21.5, 18], ['pr_bush', 6, 18.4], ['pr_flowers', 8, 17.6, { flat: true }],
      ],
      spots: {
        sign: { x: 9, y: 5, w: 2, h: 1, name: '세책점', act: '살피기', look: ['**세책점(貰冊店)**이라고 쓴 현판이 걸려 있다. 이야기책을 돈을 받고 빌려주는 가게다.'] },
      },
      npcs: {
        vendor: { sp: 'sp_joseon_man', x: 3, y: 9.6, dir: 'down', name: '책장수', talk: [
          ['장터에서 파는 **방각본**이오! 목판에 새겨 찍어 낸 책이라 값이 싸지.', '『유충렬전』, 『조웅전』 같은 영웅 이야기가 제일 잘 팔린다오.'],
          ['글을 못 읽는 사람들은 전기수가 읽어 주는 이야기를 듣고, 글을 읽는 사람들은 책을 빌려 읽는다오.'],
        ] },
        listener1: { sp: 'sp_villager_m', x: 19.5, y: 13, dir: 'up', name: '구경꾼', talk: [
          ['쉿! 전기수가 이제 막 이야기책을 펼쳤소.'],
          ['영웅 이야기는 뻔한 줄 알면서도 자꾸 듣게 된단 말이오. 착한 주인공이 꼭 이기니까!'],
        ] },
        listener2: { sp: 'sp_joseon_woman', x: 22.5, y: 13.2, dir: 'up', name: '아낙', talk: [
          ['저 전기수는 꼭 제일 재미있는 대목에서 딱 멈춘다니까요. 다음이 궁금해서 다들 엽전을 던지고서야 뒷이야기를 들어요.', { card: { kind: 'conv', title: '요전법(邀錢法)', body: '전기수가 이야기의 가장 긴박한 대목에서 입을 다물면, 뒷이야기가 궁금한 청중이 돈을 던졌어요. 이를 **요전법**이라 했다고 조수삼의 『추재기이』에 적혀 있어요.' } }],
        ] },
        listener3: { sp: 'sp_villager_w', x: 25.5, y: 12, dir: 'left', name: '구경꾼', talk: [
          ['주인공이 어려서 부모를 잃는 대목에서는 다들 눈물을 훔친다오.'],
        ] },
        keeper: { sp: 'sp_servant', x: 9.5, y: 6.2, dir: 'down', name: '세책점 주인', talk: [
          ['어서 오시오. 이야기책을 빌려 가시려오? 한 권씩 빌려 읽고 삯을 내면 되오.'],
        ] },
        scholar: { sp: 'sp_courtier', x: 15, y: 7.5, dir: 'left', name: '지나가던 선비', wander: 3, talk: [
          ['(헛기침) 에헴. 소설은 허황된 이야기라고 꾸짖는 선비도 많소. …그래도 재미는 있지.'],
        ] },
      },
    },

    // ───────── 주인공의 집과 마을(1·2·3·4장, 7장 재회) ─────────
    hometown: {
      name: '{부}의 집', music: 'court', spawn: [17.5, 15, 'up'],
      grid: mk(34, 26, '.', [
        ['rect', 0, 0, 8, 1, 'c'], ['rect', 0, 0, 1, 9, 'c'],
        ['rect', 28, 1, 5, 8, 'm'],
        ['frame', 8, 2, 20, 12, '#'],
        ['rect', 9, 3, 18, 10, '='],
        ['rect', 17, 13, 2, 1, ':'],
        ['rect', 17, 14, 2, 11, ':'],
        ['rect', 1, 18, 27, 2, ':'],
        ['rect', 2, 1, 2, 17, ':'],
        ['rect', 27, 20, 6, 1, 's'], ['rect', 27, 21, 2, 4, 's'],
        ['rect', 29, 21, 5, 5, '~'],
        ['rect', 3, 21, 5, 4, 'm'],
        ['dots', ',', [[5, 3], [6, 4], [5, 12], [6, 13], [21, 16], [22, 16], [24, 22], [25, 23], [13, 16], [30, 10], [31, 11]]],
        ['border', 'h'],
        ['rect', 0, 0, 8, 1, 'c'],
      ]),
      props: [
        ['pr_house', 14, 7], ['pr_cottage', 9.3, 7.2], ['pr_shrine', 22.5, 6.6],
        ['pr_plum', 10, 12.3], ['pr_well', 21, 11.8], ['pr_jars', 24, 11.6], ['pr_lantern', 16, 13.8], ['pr_lantern', 19, 13.8],
        ['pr_target', 4, 22.2], ['pr_target', 6.5, 22.2],
        ['pr_cottage', 9, 22.3],
        ['pr_boulder', 30, 5.4], ['pr_pine', 29, 3], ['pr_maple', 4.5, 8.5], ['pr_pine', 5, 16],
        ['pr_willow', 24.5, 25.2], ['pr_reeds', 27.2, 22.2], ['pr_reeds', 28, 24.4], ['pr_reeds', 31.5, 21], ['pr_bamboo', 30.5, 18.8],
        ['pr_bush', 12, 15.8], ['pr_bush', 23, 15.8], ['pr_stump', 1.5, 22],
      ],
      spots: {
        house: { x: 16, y: 7, w: 2, h: 1, name: '사랑채', act: '들어가기' },
        shrine: { x: 23, y: 7, w: 2, h: 1, name: '사당', act: '살피기', mh: 40 },
        archery: { x: 4, y: 23, w: 4, h: 1, name: '활터', act: '활 쏘기', mh: 30 },
        school: { x: 10, y: 23, w: 3, h: 1, name: '서당', act: '병서 읽기', mh: 36 },
        hill: { x: 29, y: 6, w: 3, h: 2, name: '뒷동산', act: '하늘 보기' },
        gate: { x: 17, y: 13, w: 2, h: 2, name: '대문 밖' },
        reeds: { x: 27, y: 21, w: 2, h: 3, name: '강가 갈대숲' },
        mtn: { x: 2, y: 1, w: 2, h: 2, name: '산길' },
        well: { x: 21, y: 12, w: 2, h: 1, look: ['집 우물이다. 물이 맑고 차다.'] },
      },
      npcs: {
        farmer: { sp: 'sp_villager_m', x: 23, y: 18.6, dir: 'left', name: '마을 사람', wander: 2, chs: ['ch1', 'ch2', 'ch3'], talk: [
          ['이 댁 나리는 임금 앞에서도 바른말을 하시는 분이라오. 그 덕에 미움도 많이 받으시지.'],
          ['조정에 조무린이라는 대감이 있는데, 그 사람 눈 밖에 나서 좋을 일이 없다오.'],
        ], talkBy: { ch3: [
          ['이 댁 아이가 보통 아이가 아니라는 소문이 온 마을에 자자하오.'],
          ['나리 내외가 정성껏 치성을 드리고 얻은 아이라지? 역시 하늘이 내린 아이는 다르구먼.'],
        ] } },
        auntie: { sp: 'sp_villager_w', x: 7, y: 17.4, dir: 'right', name: '마을 아낙', chs: ['ch1', 'ch2', 'ch3'], talk: [
          ['마님이 자식이 없어 늘 근심이 크시다오. 명산에 가서 빌어 보시라고 말씀드렸지.'],
        ], talkBy: { ch3: [
          ['아이고, 저 댁 아이 좀 보오. 벌써 글을 줄줄 읽는다지 뭐요.'],
          ['마님이 그토록 바라시던 아이가 태어나 참 다행이오.'],
        ] } },
        servant: { sp: 'sp_servant', x: 12, y: 9.4, dir: 'down', name: '종', chs: ['ch1', 'ch2', 'ch3', 'ch4'], talk: [
          ['나리마님은 사랑채에, 마님은 안채에 계십니다요.'],
        ], talkBy: {
          ch3: [[{ when: { path: 'm' }, t: '도련님, 나리마님께서 글공부도 활쏘기도 게을리하지 말라 하셨어요.' }, { when: { path: 'f' }, t: '아기씨, 나리마님께서 글공부도 활쏘기도 게을리하지 말라 하셨어요.' }]],
          ch4: [['큰일 났어요! 군사들이 나리마님을 대문 밖으로 끌고 가요!']],
        } },
      },
    },

    // ───────── 대궐 ─────────
    palace: {
      name: '대궐', music: 'palace', spawn: [13.5, 19, 'up'],
      grid: mk(28, 22, '=', [
        ['rect', 13, 9, 2, 12, 'r'],
        ['rect', 1, 1, 5, 7, '.'], ['rect', 22, 1, 5, 7, '.'],
        ['dots', ',', [[2, 2], [4, 5], [24, 3], [25, 6]]],
        ['border', '#'],
      ]),
      props: [
        ['pr_palace', 9.5, 8.1],
        ['pr_pine', 1.5, 7.2], ['pr_plum', 23, 7.2], ['pr_bush', 4.5, 5],
        ['pr_lantern', 11, 12.2], ['pr_lantern', 16.3, 12.2], ['pr_lantern', 11, 17.2], ['pr_lantern', 16.3, 17.2],
        ['pr_drum', 2.5, 15.5], ['pr_banner', 12, 20.2, { walk: true }], ['pr_banner', 15, 20.2, { walk: true }], ['pr_jars', 23, 18],
      ],
      spots: {
        out: { x: 12, y: 20, w: 4, h: 1, name: '대궐 문' },
        drum: { x: 2, y: 16, w: 2, h: 1, look: ['커다란 북이다. 나라에 큰일이 생기면 이 북을 울린다고 한다.'] },
      },
      npcs: {
        c1: { sp: 'sp_courtier', x: 10, y: 13.2, dir: 'right', name: '신하', talk: [['조정에는 바른말을 하는 **충신**과 임금의 눈을 가리는 **간신**이 함께 있소. 영웅소설에서는 늘 그렇지.']],
          talkBy: { ch6: [['올해 과거에 뛰어난 인재가 왔다더군. 글씨가 용이 꿈틀대는 듯하다지?']], ch7: [['대원수가 아니었으면 오늘 나라를 잃을 뻔했소.']] } },
        c2: { sp: 'sp_courtier', x: 17, y: 13.2, dir: 'left', name: '신하', talk: [['(소곤소곤) 저 조무린 대감 눈 밖에 나면 무사하지 못한다오.']],
          talkBy: { ch7: [['조무린이 적장과 주고받은 편지가 쏟아져 나왔다지 뭐요. 하늘이 무심치 않소.']] } },
        c3: { sp: 'sp_courtier', x: 10, y: 15.2, dir: 'right', name: '신하', talk: [['폐하께서는 오늘도 조회를 여시오.']],
          talkBy: { ch6: [['과거 시험장이 선비들로 가득하오.']], ch7: [['성문을 몰래 연 자가 누구였는지 이제 다 드러났소.']] } },
        c4: { sp: 'sp_courtier', x: 17, y: 15.2, dir: 'left', name: '신하', talk: [['북쪽 오랑캐가 심상치 않다는 소식이 자꾸 올라오오.']],
          talkBy: { ch6: [['변방이 또 시끄럽다는 소문이오. 이번 장원이 큰일을 맡게 될지도 모르오.']], ch7: [['오랑캐가 물러갔소! 이제야 발 뻗고 자겠구려.']] } },
        lady: { sp: 'sp_court_lady', x: 21, y: 9.4, dir: 'down', name: '궁녀', talk: [['대궐 안에서는 뛰지 마셔요!']] },
        guard1: { sp: 'sp_soldier', x: 11, y: 19.2, dir: 'right', name: '문지기', talk: [['대궐 문을 지키고 있소.']] },
        guard2: { sp: 'sp_soldier', x: 16, y: 19.2, dir: 'left', name: '문지기', talk: [['수상한 자는 들이지 않소.']] },
      },
    },

    // ───────── 2장 · 명산(기자 치성) ─────────
    mountain: {
      name: '명산', music: 'heaven', spawn: [15, 21, 'up'],
      grid: mk(30, 24, 'm', [
        ['rect', 1, 1, 28, 22, '.'],
        ['rect', 14, 4, 2, 19, ':'],
        ['rect', 5, 9, 9, 2, ':'], ['rect', 16, 8, 9, 2, ':'],
        ['rect', 12, 1, 6, 4, 's'],
        ['rect', 9, 12, 2, 12, '~'], ['rect', 9, 9, 2, 1, '~'], ['rect', 9, 10, 2, 1, 'b'], ['rect', 9, 11, 2, 1, '~'],
        ['rect', 1, 1, 3, 5, 'c'], ['rect', 26, 1, 3, 4, 'c'], ['rect', 20, 14, 3, 2, 'c'],
        ['dots', ',', [[17, 13], [18, 12], [6, 15], [5, 17], [24, 19], [25, 20], [19, 3], [11, 3]]],
        ['border', 'c'],
      ]),
      props: [
        ['pr_temple', 1.5, 8.6], ['pr_shrine', 23.5, 7.2], ['pr_altar', 14, 3.4], ['pr_rocks', 12.3, 3.6], ['pr_rocks', 16.5, 3.6],
        ['pr_pine', 5, 5], ['pr_pine', 20, 6], ['pr_maple', 18, 18], ['pr_maple', 3, 21], ['pr_pine', 24.5, 12.5], ['pr_pine', 12, 17.5],
        ['pr_boulder', 22, 21.5], ['pr_bush', 6, 13], ['pr_bamboo', 26, 21], ['pr_lantern', 13, 5.5], ['pr_lantern', 16.3, 5.5],
      ],
      spots: {
        temple: { x: 3.5, y: 9, w: 3, h: 1, name: '큰 절 — 부처님께 빈다', act: '빌기', mh: 40 },
        sansin: { x: 24, y: 8, w: 2, h: 1, name: '산신각 — 산신께 빈다', act: '빌기', mh: 40 },
        star: { x: 14, y: 4, w: 2, h: 1, name: '칠성단 — 북두칠성께 빈다', act: '빌기', mh: 30 },
      },
      npcs: {
        monk: { sp: 'sp_monk', x: 5, y: 11.2, dir: 'down', name: '스님', talk: [['자식을 빌러 오셨구려. 정성이 지극하면 하늘도 움직인다 하였소.']] },
      },
    },

    // ───────── 5장 · 강가 윤 처사의 집 ─────────
    river: {
      name: '강가 윤 처사의 집', music: 'mountain', spawn: [7.5, 6, 'down'],
      grid: mk(30, 22, '.', [
        ['rect', 0, 0, 30, 5, '~'],
        ['rect', 0, 5, 30, 2, 's'],
        ['rect', 7, 7, 2, 5, ':'], ['rect', 7, 11, 11, 2, ':'],
        ['frame', 12, 13, 13, 8, 'f'],
        ['rect', 13, 14, 11, 6, ':'],
        ['rect', 17, 13, 2, 1, ':'], ['rect', 17, 11, 2, 2, ':'],
        ['rect', 1, 14, 9, 7, 'p'],
        ['dots', ',', [[3, 9], [4, 10], [22, 9], [23, 10], [26, 12], [11, 18]]],
        ['border', 'h'],
        ['rect', 0, 0, 30, 1, '~'],
      ]),
      props: [
        ['pr_cottage', 15.5, 17.2], ['pr_jars', 21.5, 19.6], ['pr_well', 13.3, 19.6],
        ['pr_boat', 2, 6.3], ['pr_willow', 22, 8.2], ['pr_willow', 10, 8], ['pr_reeds', 26, 6.2], ['pr_reeds', 1, 7.2], ['pr_reeds', 14.5, 6.4],
        ['pr_bamboo', 25.5, 16.5], ['pr_bamboo', 27, 19], ['pr_plum', 25.5, 11.5], ['pr_stump', 9.5, 13],
      ],
      spots: {
        gate: { x: 17, y: 12, w: 2, h: 2, name: '사립문' },
        field: { x: 3, y: 16, w: 4, h: 2, look: ['윤 처사가 손수 가꾸는 밭이다. 벼슬을 버리고 농사지으며 숨어 사는 선비를 **처사(處士)**라 불렀다.'] },
      },
      npcs: {},
    },

    // ───────── 5장 · 산속 수련장 ─────────
    hermitage: {
      name: '구름 속 수련장', music: 'mountain', spawn: [14.5, 20, 'up'], combat: false,
      grid: mk(30, 24, 'm', [
        ['rect', 1, 1, 28, 22, '.'],
        ['rect', 10, 1, 10, 6, '='],
        ['rect', 2, 8, 7, 6, 'e'],
        ['rect', 21, 8, 7, 6, ':'],
        ['rect', 8, 14, 14, 8, '='],
        ['rect', 14, 7, 2, 7, ':'],
        ['rect', 24, 17, 4, 4, '~'],
        ['rect', 1, 1, 4, 5, 'c'], ['rect', 25, 1, 4, 4, 'c'],
        ['dots', ',', [[5, 16], [4, 18], [23, 15], [3, 20], [26, 22]]],
        ['border', 'c'],
      ]),
      props: [
        ['pr_shrine', 13.5, 4.2], ['pr_altar', 18.3, 5.6], ['pr_chest', 10.5, 5.6],
        ['pr_dummy', 3, 10, { hit: 'dummy' }], ['pr_dummy', 5.5, 11.5, { hit: 'dummy' }], ['pr_dummy', 3.5, 13, { hit: 'dummy' }], ['pr_target', 7, 9.5],
        ['pr_bookshelf', 22, 10], ['pr_table', 24.5, 11.5], ['pr_pine', 25, 9],
        ['pr_pine', 6, 6.5], ['pr_pine', 20.5, 6.8], ['pr_bamboo', 1.5, 20], ['pr_bamboo', 5, 22.5], ['pr_maple', 8.5, 7.5], ['pr_lotus', 24.5, 19.5, { flat: true }], ['pr_lotus', 26, 18, { flat: true }],
        ['pr_rocks', 23, 22.5], ['pr_boulder', 21.5, 15.5],
      ],
      spots: {
        dummies: { x: 2, y: 9, w: 6, h: 5, name: '연무장(무예)', act: '살피기', hint: '공격(⚔ · Space)으로 허수아비를 세 번 베어 보세요' },
        books: { x: 22, y: 12, w: 3, h: 1, name: '병서 서가(병법)', act: '병서 읽기', mh: 40 },
        altar: { x: 18.3, y: 6, w: 2, h: 1, name: '제단(도술)', act: '도술 닦기', mh: 30 },
        chest: { x: 10.5, y: 6, w: 1, h: 1, name: '함', act: '열어 보기', mh: 16 },
      },
      npcs: {},
    },

    // ───────── 6장 · 군영 ─────────
    camp: {
      name: '대원수의 군영', music: 'scheme', spawn: [15.5, 19, 'up'],
      grid: mk(32, 22, '.', [
        ['rect', 2, 3, 24, 16, ':'],
        ['rect', 14, 18, 3, 4, ':'],
        ['rect', 27, 0, 5, 22, '~'], ['rect', 26, 0, 1, 22, 's'],
        ['dots', ',', [[3, 20], [4, 21], [22, 20], [1, 1], [1, 2]]],
        ['border', 'h'],
        ['rect', 27, 0, 5, 22, '~'],
      ]),
      props: [
        ['pr_tent', 13.5, 6.4], ['pr_tent', 4, 8], ['pr_tent', 20, 8], ['pr_tent', 4, 14.5], ['pr_tent', 20, 14.5],
        ['pr_banner', 12, 7.2], ['pr_banner', 18.3, 7.2], ['pr_banner', 2.5, 3], ['pr_banner', 23.5, 3],
        ['pr_bonfire', 10, 11.5], ['pr_bonfire', 19.5, 11.5], ['pr_drum', 16.5, 9.8], ['pr_cart', 8, 17.5], ['pr_jars', 22.5, 17.8], ['pr_chest', 11, 7],
        ['pr_reeds', 25, 4.5], ['pr_reeds', 25.2, 13],
      ],
      spots: {
        tent: { x: 15, y: 6, w: 2, h: 1, name: '대원수 장막', act: '들어가기' },
        stream: { x: 25, y: 9, w: 2, h: 3, name: '강가', act: '가 보기' },
        out: { x: 14, y: 20, w: 3, h: 1, name: '싸움터로' },
      },
      npcs: {
        s1: { sp: 'sp_soldier', x: 9, y: 12.4, dir: 'right', name: '군사', talk: [['대원수께서 나이는 어려도 병법이 귀신같다더군.']] },
        s2: { sp: 'sp_soldier', x: 21, y: 12.4, dir: 'left', name: '군사', talk: [['북쪽 호국 군사들은 말을 잘 타오. 들판에서 조심하시오.']] },
        s3: { sp: 'sp_soldier', x: 13, y: 16.2, dir: 'down', name: '군사', wander: 2, talk: [['창과 칼을 손질해 두었습니다!']] },
        cook: { sp: 'sp_servant', x: 11, y: 12.4, dir: 'down', name: '취사병', talk: [['밥이 다 되었소. 싸움도 배가 불러야 하지.']] },
      },
    },

    // ───────── 6장·7장 · 싸움터 ─────────
    field: {
      name: '북쪽 들판', music: 'battle', spawn: [4.5, 18, 'right'], combat: true,
      grid: mk(34, 22, 'e', [
        ['rect', 0, 0, 34, 3, '.'], ['rect', 0, 19, 34, 3, '.'],
        ['rect', 10, 8, 3, 3, '.'], ['rect', 22, 12, 4, 3, '.'],
        ['border', 'h'],
      ]),
      props: [
        ['pr_banner', 2, 16.5], ['pr_banner', 3, 20.2], ['pr_banner', 29, 3.5], ['pr_banner', 31, 5],
        ['pr_cart', 13, 15], ['pr_cart', 20, 6], ['pr_rocks', 8, 11], ['pr_boulder', 24, 11], ['pr_rocks', 27, 18.5], ['pr_stump', 17, 10],
        ['pr_drum', 2.5, 19], ['pr_bonfire', 30, 7.2], ['pr_pine', 1, 3], ['pr_pine', 31, 21],
      ],
      spots: {},
      npcs: {},
    },

    // ───────── 7장 · 황성 앞 ─────────
    siege: {
      name: '황성 앞', music: 'final', spawn: [15.5, 21, 'up'], combat: true,
      grid: mk(32, 24, 'e', [
        ['rect', 0, 0, 32, 4, '#'],
        ['rect', 14, 3, 4, 1, '='],
        ['rect', 14, 4, 4, 6, '='],
        ['rect', 0, 20, 32, 4, '.'],
        ['border', 'h'],
        ['rect', 0, 0, 32, 3, '#'],
      ]),
      props: [
        ['pr_gate', 14, 3.2],
        ['pr_banner', 12, 5.5], ['pr_banner', 19, 5.5], ['pr_bonfire', 6, 8], ['pr_bonfire', 24, 8],
        ['pr_cart', 4, 13], ['pr_cart', 25, 15.5], ['pr_rocks', 10, 16], ['pr_rocks', 21, 11], ['pr_stump', 28, 18], ['pr_drum', 2, 18.8],
        ['pr_pine', 0.5, 23.2], ['pr_pine', 29.5, 23.2],
      ],
      spots: {},
      npcs: {},
    },

    // ───────── 남장하지 않는 길 · 시댁 뒤뜰과 피화당 ─────────
    inlaw: {
      name: '시댁 뒤뜰', music: 'boudoir', spawn: [21.5, 10, 'down'],
      grid: mk(30, 22, '.', [
        ['rect', 1, 1, 28, 5, '='],
        ['rect', 20, 8, 3, 3, ':'], ['rect', 3, 9, 25, 1, ':'],
        ['rect', 3, 20, 5, 1, ':'],
        ['rect', 3, 16, 4, 3, '~'],
        ['dots', ',', [[9, 12], [13, 14], [17, 16], [21, 12], [25, 14], [11, 18], [23, 18]]],
        ['border', '#'],
      ]),
      props: [
        ['pr_house', 4, 5.4], ['pr_house', 12, 5.4], ['pr_cottage', 20, 7.6],
        ['pr_plum', 8, 12.5], ['pr_maple', 12, 12.5], ['pr_pine', 16, 12.5], ['pr_plum', 24, 12.5],
        ['pr_bamboo', 9, 16], ['pr_maple', 13, 16.5], ['pr_bamboo', 18, 16], ['pr_pine', 22, 16.5], ['pr_plum', 26, 16.5],
        ['pr_maple', 10, 20.4], ['pr_pine', 15, 20.4], ['pr_bamboo', 20.5, 20.4], ['pr_maple', 24, 20.4],
        ['pr_lotus', 3.5, 18, { flat: true }], ['pr_jars', 25.5, 4.6], ['pr_lantern', 19, 9.3], ['pr_lantern', 27, 9.3], ['pr_flowers', 26, 8.6, { flat: true }],
      ],
      spots: {
        sky: { x: 24, y: 9, w: 3, h: 1, name: '피화당 뜰', act: '하늘 살피기' },
        pond: { x: 3, y: 15, w: 4, h: 1, look: ['연못에 연잎이 떠 있다. 뜰의 나무들은 **{이름}**이 몰래 쳐 둔 진(陣)이다.'] },
      },
      npcs: {
        maid: { sp: 'sp_court_lady', x: 10, y: 7.2, dir: 'down', name: '시댁 몸종', talk: [['(소곤소곤) 새아씨가 도술을 닦았다는 소문 때문에 어르신들이 가까이하지 않으셔요.']],
          talkBy: { ch7: [['새아씨, 이 뜰 안은 안전하다고 하셨지요? 저는 새아씨만 믿어요!']] } },
      },
    },
  };
})();
