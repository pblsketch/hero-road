'use strict';
// 장마다 맵 위에서 할 일(선생님이 고쳐도 되는 파일)
//  - 이야기 글은 js/data/story.js에 그대로 있다. 여기서는 "어디서 무엇을 하면 어느 단계가 펼쳐지는지"만 정한다.
//  - beat(목표) 하나 = 화면 위 목표 글 + 할 일 + 펼칠 단계(steps: story.js의 id).
//    할 일: talk:'인물'(말 걸기) · at:'자리'(살피기) · go:'자리'(밟기) · pick:{자리:선택지 번호}(자리를 골라 선택하기)
//           fight:{ waves:[[적…],[적…]] }(잡병과 실시간 싸움) · train(수련) · escape(쫓기며 달아나기) · auto:true(바로 펼침)
//    그 밖: map·spawn(맵 옮기기) · show/hide(인물 나타내기·숨기기) · night · fire · say(먼저 할 말) · sayPre(그 단계의 앞말을 먼저)
//           noCard:true(전투 단계를 적장전 없이 앞뒤 이야기만) · when(길 조건, story.js와 같음)
//           boss:{ from:'인물'(그 자리에서 적장이 나섬) | at:[x,y] } · points:1(이기면 기술 점수) · skillTree:true(기술 익히기 화면)
//  - 적: [스프라이트, x, y]  사람: { sp, x, y, dir, who(people.js 인물) 또는 name, talk, when }
//  - 잡병도 적장도 맵에서 실시간으로 싸운다(적장: js/data/bosses.js, 기술: js/data/skills.js).
(function () {
  const who = (id, sp, x, y, dir, extra) => Object.assign({ sp, x, y, dir, who: id }, extra);
  const B = (x, y) => ['sp_barbarian', x, y];

  window.QUESTS = {
    // ───────── 서장 ─────────
    ch0: {
      map: 'market', avatar: 'sp_listener',
      intro: '화면 왼쪽을 누른 채 끌면 걸어요(PC는 방향키·WASD). 사람 가까이 가면 **말 걸기** 단추가 떠요. 노란 **!** 표시가 다음에 할 일이에요.',
      cast: { market: { narrator: who('narrator', 'sp_narrator', 22, 10.8, 'down') } },
      beats: [
        { id: 'b0-1', goal: '이야기판의 전기수에게 가 보자', talk: 'narrator', steps: ['s0-1', 's0-2', 's0-3'] },
        { id: 'b0-2', goal: '세책점 주인에게 가서 이야기책 표지에 이름을 적자', talk: 'keeper',
          say: [{ who: 'narrator', t: '이름은 저기 **세책점** 주인에게 가서 이야기책 표지에 적어 오시오. 이야기책을 빌려주는 가게 말이오.' }],
          steps: ['s0-4', 's0-5'] },
      ],
    },

    // ───────── 1장 · 고귀한 혈통 ─────────
    ch1: {
      map: 'palace', avatar: 'sp_father',
      intro: '이번 장에서는 주인공의 **아버지**가 되어 걸어요.',
      cast: {
        palace: { emperor: who('emperor', 'sp_emperor', 13.5, 9, 'down'), villain: who('villain', 'sp_villain', 16, 10.4, 'left') },
        hometown: { mother: who('mother', 'sp_mother', 11, 9.2, 'down') },
      },
      beats: [
        { id: 'b1-1', goal: '조회에 나가 천자께 아뢰자', talk: 'emperor', steps: ['c1-1'] },
        { id: 'b1-2', goal: '대궐 문을 나서 집으로 돌아가자', go: 'out' },
        { id: 'b1-3', map: 'hometown', spawn: [17.5, 11.5, 'up'], goal: '사당에 가서 집안의 내력을 돌아보자', at: 'shrine', steps: ['c1-2'] },
        { id: 'b1-4', goal: '안채 앞에 있는 부인에게 가 보자', talk: 'mother', steps: ['c1-3'] },
      ],
    },

    // ───────── 2장 · 비정상적 출생 ─────────
    ch2: {
      map: 'mountain', avatar: 'sp_father',
      intro: '아버지가 되어 자식을 빌 곳을 **직접 찾아가서** 고르세요.',
      cast: {
        mountain: { mother: who('mother', 'sp_mother', 16.3, 20.6, 'up') },
        hometown: { mother: who('mother', 'sp_mother', 11, 9.2, 'down') },
      },
      beats: [
        { id: 'b2-1', goal: '큰 절 · 산신각 · 칠성단 가운데 한 곳에 가서 빌자', pick: { temple: 0, sansin: 1, star: 2 }, steps: ['c2-1'] },
        { id: 'b2-2', map: 'hometown', spawn: [17.5, 11.5, 'up'], night: true, ambient: false, music: 'heaven', goal: '백 일째 되는 밤, 부인에게 가 보자', talk: 'mother', steps: ['c2-2', 'c2-3'] },
      ],
    },

    // ───────── 3장 · 탁월한 능력 ─────────
    ch3: {
      map: 'hometown', spawn: [17.5, 9.5, 'down'],
      intro: '이제부터는 **주인공**이 되어 걸어요.',
      cast: { hometown: { father: who('father', 'sp_father', 16.5, 8.4, 'down', { talk: [['글과 활을 게을리하지 마라.']] }), mother: who('mother', 'sp_mother', 11, 9.2, 'down', { talk: [['너는 하늘이 주신 아이란다.']] }) } },
      beats: [
        { id: 'b3-1', auto: true, steps: ['c3-1'] },
        { id: 'b3-2', goal: '일곱 살 되던 해, 마을 사람들 앞에서 재주를 보이자 — 활터 · 서당 · 뒷동산 가운데 한 곳', pick: { archery: 0, school: 1, hill: 2 }, steps: ['c3-2'] },
        { id: 'b3-3', goal: '대문 밖에 낯선 도사가 서 있다', talk: 'master', show: { master: who('master', 'sp_master', 17.5, 15.4, 'up') }, steps: ['c3-3'], then: { hide: ['master'] } },
      ],
    },

    // ───────── 4장 · 죽을 고비 ─────────
    ch4: {
      map: 'hometown', spawn: [17.5, 9.5, 'down'], lessonEnd: '1차시',
      cast: { hometown: { mother: who('mother', 'sp_mother', 11, 9.2, 'down') } },
      beats: [
        { id: 'b4-1', auto: true, steps: ['c4-1'] },
        { id: 'b4-2', goal: '대문 밖으로 끌려가는 아버지에게 달려가자', talk: 'father',
          show: { father: who('father', 'sp_father', 17.5, 16.2, 'up'), sol1: { sp: 'sp_soldier', x: 16.3, y: 17.2, dir: 'up', name: '의금부 군사' }, sol2: { sp: 'sp_soldier', x: 18.7, y: 17.2, dir: 'up', name: '의금부 군사' } },
          steps: ['c4-2'], then: { hide: ['father', 'sol1', 'sol2'] } },
        { id: 'b4-3', auto: true, night: true, ambient: false, fire: [[15, 6], [17.5, 6], [19.5, 6], [11, 6.5]], music: 'ruin', spawn: [17.5, 9.5, 'down'], steps: ['c4-3'], then: { hide: ['mother'] } },
        { id: 'b4-4', goal: '자객을 피해 달아나자! 강가 갈대숲이나 산길로', music: 'tension',
          escape: { exits: { reeds: 0, mtn: 1 }, foes: [['sp_assassin', 11, 11], ['sp_assassin', 24, 10], ['sp_assassin', 17.5, 17]] },
          steps: ['c4-4'] },
      ],
    },

    // ───────── 5장 · 구출과 수련 ─────────
    ch5: {
      map: 'river', spawn: [7.5, 6, 'down'],
      cast: {
        river: {
          rescuer: who('rescuer', 'sp_rescuer', 9, 7.2, 'left'),
          yunsojeo: who('yunsojeo', 'sp_yunsojeo', 21, 15.4, 'down', { when: { path: 'm' }, talk: [['아버님께서 거두신 분이니, 저도 정성껏 모시겠습니다.']] }),
          yunseon: who('yunseon', 'sp_yunseon', 21, 15.4, 'down', { when: { path: 'f' }, talk: [['또 네가 먼저 외웠어? 이번엔 내가 이길 줄 알았는데!']] }),
        },
        hermitage: {
          master: who('master', 'sp_master', 15.5, 6.3, 'down'),
          yunseon: who('yunseon', 'sp_yunseon', 26, 12.6, 'left', { when: { path: 'f', disguised: true }, talk: [['산속 공부는 고되구나. 그래도 너한테는 질 수 없지!'], ['병서는 여기서 읽으면 돼. 나도 같이 볼게.']] }),
        },
      },
      beats: [
        { id: 'b5-1', auto: true, steps: ['c5-1'], then: { show: { rescuer: who('rescuer', 'sp_rescuer', 17.5, 13.6, 'down') } } },
        { id: 'b5-2', when: { path: 'f' }, goal: '몇 해가 지났다. 윤 처사에게 가 보자', talk: 'rescuer', steps: ['c5-2', 'c5-3', 'c5-4', 'c5-5'] },
        { id: 'b5-3', goal: '사립문 앞에 도사가 찾아왔다', talk: 'master', show: { master: who('master', 'sp_master', 17.5, 11.4, 'down') }, steps: ['c5-6'] },
        { id: 'b5-4', map: 'hermitage', spawn: [14.5, 8, 'up'], goal: '수련', train: { step: 'c5-7', at: { '@dummy': 'mu', books: 'byeong', altar: 'sul' } } },
        { id: 'b5-4k', say: [{ who: 'master', t: '세 해 동안 닦은 것을 이제 몸에 익혀라. 네가 무엇을 닦았느냐에 따라 익힐 수 있는 **기술**이 다르다.' }], skillTree: true },
        { id: 'b5-5', goal: '도사의 거처 옆 함을 열어 신물을 고르자', at: 'chest', steps: ['c5-8'] },
        { id: 'b5-6', say: [{ who: 'master', t: '먼저 내 **허깨비 병사**들과 겨루어 보아라. 칼(⚔)로 베고, 적이 **붉게 번쩍이면** 물러서서 피하여라. 도술(符)이 있으면 둘러싼 적을 한꺼번에 밀어낼 수 있다.' }],
          fight: { foes: [['sp_phantom', 11, 17], ['sp_phantom', 18, 17], ['sp_phantom', 14.5, 20]], text: '허깨비 병사를 물리쳐라', music: 'tension' } },
        { id: 'b5-7', goal: '도사에게 가서 마지막 대련을 청하자', talk: 'master', steps: ['c5-9'], boss: { at: [14.5, 16] } },
      ],
    },

    // ───────── 6장 · 다시 닥친 위기 ─────────
    ch6: {
      map: { c: 'inlaw', _: 'palace' },
      cast: {
        palace: {
          emperor: who('emperor', 'sp_emperor', 13.5, 9, 'down'), villain: who('villain', 'sp_villain', 16, 10.4, 'left'),
          yunseon: who('yunseon', 'sp_yunseon', 11.8, 11.6, 'up', { when: { path: 'f' }, talk: [['이번 과거는 꼭 너를 이기고 말 테다!']] }),
        },
        camp: {
          officer: { sp: 'sp_soldier', x: 22, y: 9.6, dir: 'left', name: '부장' },
          yunseon: who('yunseon', 'sp_yunseon', 14, 8.2, 'down', { when: { path: 'f' }, talk: [['부원수 윤선, 대원수를 따르겠소. …산에서 함께 배운 사이지만 군중에서는 예를 지켜야지.']] }),
        },
        field: { vanguard: { sp: 'sp_enemy_general', x: 28.5, y: 4.6, dir: 'left', name: '호국 선봉장' } },
        inlaw: { yunseon: who('yunseon', 'sp_yunseon', 14.5, 7.4, 'down') },
      },
      beats: [
        { id: 'b6-1', when: { notBranch: 'c' }, goal: '과거 시험장에 나가 글을 지어 올리자', talk: 'emperor', steps: ['c6-1', 'c6-2', 'c6-3'] },
        { id: 'b6-2', when: { notBranch: 'c' }, goal: '대궐 문을 나서 군영으로 가자', go: 'out' },
        { id: 'b6-3', when: { path: 'f', disguised: true }, map: 'camp', spawn: [15.5, 19, 'up'], goal: '장수들이 대원수를 찾는다', talk: 'officer', steps: ['c6-4'] },
        { id: 'b6-4', when: { notBranch: 'c' }, map: 'camp', spawn: [15.5, 8.2, 'down'], goal: '군영을 나서 싸움터로 가자', go: 'out' },
        { id: 'b6-5', when: { notBranch: 'c' }, map: 'field', spawn: [4.5, 18, 'right'],
          fight: { waves: [[B(14, 10), B(16, 14), B(18, 7), B(20, 16)], [B(24, 6), B(26, 12), B(22, 18), B(28, 9), B(25, 15)]], text: '오랑캐 선봉대를 물리쳐라' }, points: 1 },
        { id: 'b6-6', when: { notBranch: 'c' }, goal: '적의 선봉장과 맞서자', talk: 'vanguard', steps: ['c6-5', 'c6-6'], boss: { from: 'vanguard' } },
        // 남장하지 않는 길
        { id: 'b6c-1', when: { branch: 'c' }, auto: true, steps: ['c6c-1'] },
        { id: 'b6c-2', when: { branch: 'c' }, goal: '과거를 보러 떠나는 남편 윤선에게 가 보자', talk: 'yunseon', steps: ['c6c-2'], then: { hide: ['yunseon'] } },
        { id: 'b6c-3', when: { branch: 'c' }, night: true, ambient: false, goal: '밤이 깊었다. 피화당 뜰에서 하늘을 살피자', at: 'sky', steps: ['c6c-3'] },
        { id: 'b6c-4', when: { branch: 'c' }, night: false, sayPre: 'c6c-4',
          fight: { waves: [[B(8, 10), B(14, 10), B(26, 10), B(18, 14)], [B(6, 12), B(27, 13), B(12, 19), B(22, 19)]], text: '뜰에 들어온 오랑캐 군사를 물리쳐라' },
          steps: ['c6c-4'], noCard: true, points: 1 },
      ],
    },

    // ───────── 7장 · 영웅의 승리 ─────────
    ch7: {
      map: { c: 'inlaw', _: 'siege' }, spawn: { c: [21.5, 10, 'down'], _: [15.5, 21, 'up'] },
      cast: {
        siege: { enemy: who('enemy', 'sp_enemy_general', 15.5, 5.3, 'down') },
        palace: { emperor: who('emperor', 'sp_emperor', 13.5, 9, 'down') },
        hometown: { father: who('father', 'sp_father', 16.5, 8.4, 'down'), mother: who('mother', 'sp_mother', 18.5, 8.4, 'down') },
        inlaw: { enemy: who('enemy', 'sp_enemy_general', 15.5, 10.4, 'down') },
      },
      beats: [
        { id: 'b7-1', when: { notBranch: 'c' }, auto: true, steps: ['c7-1'] },
        { id: 'b7-2', when: { notBranch: 'c' },
          fight: { waves: [[B(10, 12), B(15, 13), B(20, 12), B(7, 16), B(24, 16)], [B(12, 8), B(19, 8), B(6, 10), B(26, 10), B(15, 16), B(9, 18)]], text: '성문 앞의 오랑캐를 물리쳐라' }, points: 1 },
        { id: 'b7-3', when: { notBranch: 'c' }, goal: '적장 철목달과 맞서자', talk: 'enemy', steps: ['c7-2'], boss: { from: 'enemy' }, then: { hide: ['enemy'] } },
        { id: 'b7-4', when: { notBranch: 'c' }, map: 'palace', spawn: [13.5, 17, 'up'], goal: '천자를 뵙자', talk: 'emperor', steps: ['c7-3'] },
        { id: 'b7-5', when: { notBranch: 'c' }, goal: '대궐 문을 나서 집으로 가자', go: 'out' },
        { id: 'b7-6', when: { notBranch: 'c' }, map: 'hometown', spawn: [17.5, 16, 'up'], goal: '집에서 기다리는 부모님께 가자', talk: 'father', steps: ['c7-4', 'c7-5'] },
        { id: 'b7-7', when: { path: 'f', disguised: true }, goal: '천자가 보낸 어의가 찾아왔다', talk: 'physician',
          show: { physician: { sp: 'sp_physician', x: 17.5, y: 11.2, dir: 'up', name: '어의' } }, steps: ['c7-6', 'c7-7'], then: { hide: ['physician'] } },
        { id: 'b7-8a', when: { branch: 'a' }, auto: true, steps: ['c7-8a'] },
        { id: 'b7-9a', when: { branch: 'a' }, map: 'field', spawn: [4.5, 18, 'right'],
          fight: { waves: [[B(14, 10), B(18, 14), B(20, 7), B(24, 12)], [B(26, 6), B(28, 14), B(22, 18), B(16, 17)]], text: '다시 쳐들어온 적군을 물리쳐라' },
          steps: ['c7-9a'], noCard: true },
        { id: 'b7-8b', when: { branch: 'b' }, auto: true, steps: ['c7-8b'] },
        // 남장하지 않는 길
        { id: 'b7c-1', when: { branch: 'c' }, auto: true, steps: ['c7c-1'] },
        { id: 'b7c-2', when: { branch: 'c' },
          fight: { waves: [[B(8, 13), B(14, 14), B(20, 13), B(26, 14)], [B(6, 19), B(12, 18), B(18, 19), B(24, 18), B(27, 11)]], text: '뜰에 몰려든 적을 막아라' }, points: 1 },
        { id: 'b7c-3', when: { branch: 'c' }, goal: '적장 철목달과 맞서자', talk: 'enemy', steps: ['c7c-2', 'c7c-3'], boss: { from: 'enemy' } },
      ],
    },
  };
})();
