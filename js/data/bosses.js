'use strict';
// 적장과의 실시간 결전(선생님이 고쳐도 되는 파일) — 게임 설정(虛)
//  - story.js의 전투 단계(enemy: 'phantom' 등)가 맵 위의 보스전으로 펼쳐진다. 이름·천우신조 글은 battle.js의 적 자료를 쓴다.
//  - 적장은 공격 전에 땅에 **붉은 자리**를 먼저 보여 준다. 그 밖으로 피하면 된다.
//    slash 부채꼴 베기 · thrust 세 번 찌르기(곧은 줄) · dash 돌진(곧은 줄) · slam 내려찍기(둥근 자리)
//    hex 요술(여러 곳에 벼락) · summon 부하 부르기 · charge 기 모으기(끊지 못하면 큰 내려찍기)
//  - 기세(poise): 칠 때마다 쌓이고 가득 차면 적장이 비틀거린다(잠시 무방비, 피해 1.5배). 계책은 기세를 크게 깎는다.
//  - hp는 주인공 칼 한 번(능력치에 따라 1~3)을 기준으로 잡았다.
window.BOSSES = {
  phantom: {
    sp: 'sp_phantom_boss', hp: 30, speed: 44, dmg: 2, poise: 9, summon: 'sp_phantom', tutorial: true,
    moves: ['slash', 'dash', 'slash', 'charge', 'summon'],
    tips: {
      slash: '도사: 붉은 부채꼴이 보이면 그 밖으로 비켜라!',
      dash: '도사: 곧은 붉은 줄은 돌진이다. 옆으로 피해라!',
      charge: '도사: 기를 모은다! 몰아쳐 베거나 계책으로 끊어라. 못 끊으면 크게 내려찍는다!',
      summon: '도사: 부하를 부르면 먼저 흩어 놓아라.',
      stagger: '도사: 비틀거린다! 지금이 칠 때다!',
    },
  },
  vanguard: {
    sp: 'sp_barbarian_boss', hp: 44, speed: 52, dmg: 3, poise: 11, summon: 'sp_barbarian',
    moves: ['thrust', 'slash', 'dash', 'summon', 'charge', 'thrust'],
  },
  boss: {
    sp: 'sp_boss', hp: 78, speed: 52, dmg: 4, poise: 15, summon: 'sp_barbarian',
    moves: ['slash', 'dash', 'slam', 'charge', 'thrust'],
    phase2: { at: 0.5, speed: 1.2, quick: 0.85, moves: ['slash', 'hex', 'dash', 'slam', 'summon', 'charge', 'hex'], say: '철목달이 요술을 부리기 시작했다! 하늘에서 벼락이 떨어진다.' },
  },
  boss_c: {
    sp: 'sp_boss', hp: 68, speed: 50, dmg: 4, poise: 14, summon: 'sp_barbarian',
    moves: ['slash', 'dash', 'slam', 'charge', 'thrust'],
    phase2: { at: 0.5, speed: 1.15, quick: 0.9, moves: ['slash', 'hex', 'dash', 'slam', 'summon', 'charge'], say: '철목달이 요술을 부린다! 뜰의 나무들이 흔들린다.' },
  },
};
