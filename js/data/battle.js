'use strict';
// 전투 데이터(선생님이 고쳐도 되는 파일)
//  - 전투는 영웅소설의 '군담(軍談)'을 게임으로 옮긴 것이다. 규칙과 수치는 게임 설정이다.
//  - 능력치: mu 무예(武) · byeong 병법(兵) · sul 도술(術). 카드의 세기 = 기본값 + 능력치 × 배율(반올림)
//  - 한 턴에 카드 한 장. 손에는 능력치에 따라 뽑힌 카드 3장 + 아직 안 쓴 신물 카드가 들어온다.
//  - 게임 오버는 없다. 기력이 다하면 '천우신조(天佑神助)'로 하늘이 돕고 이야기가 이어진다.
window.BATTLE = {
  cards: {
    strike: { name: '칼 휘두르기', han: '武', stat: 'mu', dmg: [2, 1.5], text: '적에게 피해 {d}' },
    charge: { name: '일기당천', han: '武', stat: 'mu', need: 3, dmg: [2, 2], text: '홀로 적진을 휩쓸어 피해 {d}', tip: '일기당천(一騎當千): 말 탄 한 사람이 천 명을 당해 낸다는 뜻. 군담에서 영웅의 무예를 그리는 말.' },
    formation: { name: '진법', han: '兵', stat: 'byeong', block: [3, 1.6], text: '진을 쳐서 이번 턴 피해를 {b} 막음', tip: '진법(陣法): 군사를 벌여 세우는 법. 군담의 영웅은 병서를 익혀 진을 친다.' },
    stratagem: { name: '계책', han: '兵', stat: 'byeong', dmg: [1, 1.5], counter: true, text: '적이 준비한 큰 공격·요술을 무너뜨리고 피해 {d}' },
    talisman: { name: '부적', han: '術', stat: 'sul', heal: [2, 1.5], text: '기력 {h} 회복' },
    windcloud: { name: '풍운조화', han: '術', stat: 'sul', dmg: [2, 1.5], weaken: true, text: '바람과 구름을 부려 피해 {d}, 적의 다음 공격을 반으로', tip: '풍운조화(風雲造化): 바람과 구름을 마음대로 부리는 도술.' },
    transform: { name: '둔갑술', han: '術', stat: 'sul', need: 3, evade: true, text: '몸을 바꾸어 이번 턴 공격을 모두 피함', tip: '둔갑술(遁甲術): 몸을 감추거나 다른 모습으로 바꾸는 도술.' },
  },
  // 신물(神物): 5장에서 스승에게 하나를 받는다. 전투마다 한 번 쓸 수 있다
  relics: {
    sword: { name: '신검', han: '劍', stat: 'mu', dmg: [6, 2], text: '하늘이 내린 칼로 큰 피해 {d}(전투마다 한 번)', desc: '천상에서 내려온 보검. 칼을 뽑으면 칼빛이 하늘에 뻗친다.' },
    book: { name: '천서', han: '書', stat: 'byeong', dmg: [4, 2], counter: true, text: '하늘의 병서로 적의 수를 꿰뚫어 큰 공격·요술을 무너뜨리고 피해 {d}(전투마다 한 번)', desc: '하늘의 뜻이 적힌 병서. 적의 꾀를 미리 알게 해 준다.' },
    armor: { name: '신갑', han: '甲', stat: 'sul', heal: [3, 1], evade: true, text: '하늘이 내린 갑옷이 이번 턴 공격을 모두 막고 기력 {h} 회복(전투마다 한 번)', desc: '칼과 화살이 뚫지 못하는 갑옷과 투구.' },
  },
  // 적의 행동(머리 위에 미리 보인다)
  //  atk 공격 n · heavy 강공 n(앞 턴에 charge로 기를 모음) · charge 기를 모음 · hex 요술(피해 n + 다음 내 카드 절반) · guard 막기 n
  intents: {
    atk: { label: '공격', icon: '⚔' },
    heavy: { label: '강공', icon: '💥' },
    charge: { label: '기를 모음', icon: '…' },
    hex: { label: '요술', icon: '☁' },
    guard: { label: '막기', icon: '▣' },
  },
  enemies: {
    phantom: {
      name: '허깨비 장수', pt: 'pt_phantom', hp: 20, bg: 'sc_training',
      pattern: [['atk', 3], ['atk', 4], ['charge'], ['heavy', 9], ['guard', 4], ['atk', 4]],
      heaven: '도사가 소매를 한 번 떨치자 허깨비가 멈추어 섰다. "서두르지 마라. 한 수씩 보아라."',
    },
    vanguard: {
      name: '호국 선봉장', pt: 'pt_enemy', hp: 26, bg: 'sc_march',
      pattern: [['atk', 5], ['guard', 5], ['charge'], ['heavy', 12], ['hex', 3], ['atk', 6]],
      heaven: '갑자기 하늘에서 오색 구름이 내려와 {호}의 몸을 감쌌다. 적의 칼끝이 빗나갔다.',
    },
    raiders: {
      name: '오랑캐 군사들', pt: 'pt_enemy', hp: 22, bg: 'sc_pihwadang',
      pattern: [['atk', 4], ['atk', 5], ['charge'], ['heavy', 10], ['guard', 4]],
      heaven: '뜰의 나무들이 저절로 움직여 길을 막았다. 스승의 가르침이 떠올랐다.',
    },
    boss: {
      name: '적장 철목달', pt: 'pt_enemy', hp: 36, bg: 'sc_siege', final: true,
      pattern: [['atk', 6], ['hex', 4], ['charge'], ['heavy', 14], ['guard', 7], ['atk', 7]],
      heaven: '천둥소리와 함께 하늘에서 한 줄기 빛이 내리꽂혔다. 천상에서 {호:를} 지켜보던 선관이 도운 것이다.',
    },
    boss_c: {
      name: '적장 철목달', pt: 'pt_enemy', hp: 32, bg: 'sc_pihwadang', final: true,
      pattern: [['atk', 6], ['hex', 4], ['charge'], ['heavy', 13], ['guard', 6], ['atk', 6]],
      heaven: '뜰 안에 갑자기 불길과 회오리바람이 일어 적장이 물러섰다. 하늘이 이 뜰을 지키고 있었다.',
    },
    second: {
      name: '다시 쳐들어온 적군', pt: 'pt_enemy', hp: 22, bg: 'sc_general_f',
      pattern: [['atk', 5], ['charge'], ['heavy', 11], ['atk', 5]],
      heaven: '중군의 윤선이 앞으로 뛰어들어 대원수를 지켰다.',
    },
  },
  // 군담 문장(카드를 쓸 때 전투 기록에 한 줄씩)
  lines: {
    strike: ['{호}의 칼빛이 번개 같았다.', '한칼에 적의 창을 꺾었다.', '말을 달려 적진 한가운데로 들어갔다.'],
    charge: ['{호:가} 홀로 적진을 휘젓자 적병이 추풍낙엽처럼 쓰러졌다.', '좌충우돌, 가는 곳마다 적이 흩어졌다.'],
    formation: ['군사를 벌여 진을 치니 적이 틈을 찾지 못했다.', '진문을 굳게 닫고 적을 맞았다.'],
    stratagem: ['적의 꾀를 미리 알아채고 길목에 군사를 숨겼다.', '거짓으로 물러나는 척하다가 적을 에워쌌다.'],
    talisman: ['부적을 사르자 몸에 기운이 돌아왔다.'],
    windcloud: ['주문을 외자 모래바람이 일어 적의 눈을 가렸다.', '검은 구름이 적진을 덮고 비바람이 몰아쳤다.'],
    transform: ['몸을 흔들어 둔갑하니 적의 칼이 허공을 갈랐다.'],
    sword: ['신검을 뽑자 칼빛이 하늘까지 뻗쳤다.'],
    book: ['천서를 펼치니 적의 계책이 손바닥 보듯 훤했다.'],
    armor: ['신갑이 빛나며 적의 화살과 칼을 모두 튕겨 냈다.'],
  },
};
