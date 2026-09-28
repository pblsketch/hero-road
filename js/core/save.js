'use strict';
// 진행 저장: 이 브라우저(localStorage)에만 저장하고 서버로 보내지 않는다
(function () {
  const KEY = 'hero-road-v1';
  const fresh = () => ({
    v: 1,
    mode: 'basic',          // basic: 처음 배우기(고1 공통국어) / deep: 깊이 읽기(고2·3 문학)
    font: 1,                // 글자 크기 배율
    sound: true,
    music: true,
    teacher: false,
    // 주인공
    path: null,             // 'm' 아들의 길 / 'f' 딸의 길
    branch: null,           // 딸의 길 갈래: 'a' 계속 활약 / 'b' 규방으로 / 'c' 남장 없이
    disguised: false,       // 지금 남장 중인가
    revealed: false,        // 정체가 드러났는가
    surname: '',
    given: '',
    alias: '',              // 남장 이름
    look: 'child',          // 주인공 초상: child / youth / general / lady / sage
    abil: { mu: 1, byeong: 1, sul: 1 }, // 무예(武)·병법(兵)·도술(術)
    relic: null,            // 신물: sword / book / armor
    flags: {},              // 고른 것들(가문 내력, 치성 드린 곳, 태몽 …)
    doubt: 0,               // 의심 게이지(딸의 길, 남장 중)
    doubtMax: 0,
    crises: 0,              // 탄로 위기를 넘긴 횟수
    heaven: 0,              // 천우신조로 이어 간 횟수
    // 진행
    seen: {},               // 본 게임 설정·관습 카드
    done: {},               // 끝낸 단계 id
    chDone: {},             // 끝낸 장 id
    works: {},              // 열린 작품 카드: '작품id' → true
    conv: {},               // 만난 관습: id → true
    myStage: {},            // 나의 일대기: 단계 번호 → 내가 걸은 일(결과 화면 목차)
    score: {},              // 영역별 첫 시도: { stage:[맞음,전체], passage:[...], order:[...] }
    wrong: [],              // 헷갈린 것 [{kind, text}]
    helped: 0,              // 도움(정답 보기) 사용 횟수
    reflect: {},            // 디브리핑 한 줄 답
    name: '',               // 결과 화면에 적는 학생 이름(반·번호 포함)
    startedAt: 0,
    finishedAt: 0,
  });
  let S = fresh();
  G.save = {
    get state() { return S; },
    fresh,
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) S = Object.assign(fresh(), JSON.parse(raw));
      } catch (e) { /* 저장소를 못 쓰는 환경: 새로 시작 */ }
      return S;
    },
    write() {
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 무시 */ }
    },
    reset(keepSettings) {
      const keep = keepSettings ? { mode: S.mode, font: S.font, sound: S.sound, music: S.music, teacher: S.teacher, name: S.name } : {};
      S = Object.assign(fresh(), keep);
      this.write();
      return S;
    },
    stat(kind, ok) {
      const s = (S.score[kind] = S.score[kind] || [0, 0]);
      if (ok) s[0]++;
      s[1]++;
    },
    wrong(kind, text) {
      if (!S.wrong.some((w) => w.text === text)) S.wrong.push({ kind, text });
    },
  };
})();
