'use strict';
// 기술(선생님이 고쳐도 되는 파일) — 게임 설정(虛)
//  - 세 갈래(武 무예 · 兵 병법 · 術 도술) × 세 단계. 기술 점수 1점으로 하나를 익힌다.
//  - 2단계는 그 능력치 3 이상, 3단계는 5 이상이어야 하고, 같은 갈래의 앞 단계를 먼저 익혀야 한다.
//    → 1~5장에서 능력치를 어떻게 쌓았느냐에 따라 익힐 수 있는 기술이 달라진다.
//  - 기술 점수: 5장 수련 한 번에 1점(3점), 6장·7장 잡병 싸움을 이기면 1점씩.
//  - kind: active(단추로 쓰는 기술, 단추에는 셋까지) · passive(익히면 늘 효과)
//  - 이름은 군담(軍談)에 자주 나오는 무예·병법·도술에서 따왔다. 효과와 수치는 게임 설정이다.
window.SKILLS = {
  trees: [
    { stat: 'mu', han: '武', name: '무예', ids: ['combo', 'rush', 'whirl'] },
    { stat: 'byeong', han: '兵', name: '병법', ids: ['formation', 'ambush', 'stratagem'] },
    { stat: 'sul', han: '術', name: '도술', ids: ['talisman', 'blink', 'storm'] },
  ],
  need: [1, 3, 5], // 단계별 능력치 조건
  list: {
    combo: { name: '연환검', hanja: '連環劍', kind: 'passive', desc: '베기를 이어 가면 세 번째 칼이 두 배로 세게 들어가고 적을 멀리 밀어낸다.' },
    rush: { name: '돌격', hanja: '突擊', kind: 'active', cd: 5, icon: '突', desc: '바라보는 쪽으로 짧게 내달리며 길목의 적을 벤다. 내달리는 동안은 다치지 않는다.' },
    whirl: { name: '일기당천', hanja: '一騎當千', kind: 'active', cd: 14, icon: '千', desc: '칼을 크게 한 바퀴 휘둘러 둘레의 적을 모두 두 번 벤다. "말 탄 한 사람이 천 명을 당해 낸다."' },
    formation: { name: '진법', hanja: '陣法', kind: 'passive', desc: '진을 쳐서 몸을 지킨다. 기력이 4 늘고, 받는 피해가 1 줄어든다.' },
    ambush: { name: '복병', hanja: '伏兵', kind: 'active', cd: 18, icon: '伏', desc: '숨겨 둔 군사 둘을 불러 10초 동안 함께 싸운다.' },
    stratagem: { name: '계책', hanja: '計策', kind: 'active', cd: 12, icon: '計', desc: '적의 수를 읽어 무너뜨린다. 모든 적이 잠시 멈추고, 적장이 기를 모으는 중이면 크게 흔들려 한참 쓰러진다.' },
    talisman: { name: '부적', hanja: '符籍', kind: 'active', cd: 6, icon: '符', desc: '부적을 날려 둘레의 적을 밀쳐 내며 피해를 준다.' },
    blink: { name: '축지법', hanja: '縮地法', kind: 'active', cd: 3.5, icon: '縮', desc: '땅을 접어 가는 쪽으로 순식간에 옮겨 간다. 적의 공격을 피할 때 좋다.' },
    storm: { name: '호풍환우', hanja: '呼風喚雨', kind: 'active', cd: 16, icon: '風', desc: '바람과 비를 불러 화면 안의 모든 적에게 피해를 주고 한동안 느리게 만든다.' },
  },
};
