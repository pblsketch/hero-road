'use strict';
// 시작: 저장 불러오기 → 주소 바로가기(?teacher=1, ?path=m|f, ?ch=ch3, ?result=1) → 타이틀
(function () {
  G.save.load();
  const q = new URLSearchParams(location.search);
  if (q.get('teacher') === '1') { G.save.state.teacher = true; G.save.write(); }
  const p = q.get('path');
  if (p === 'm' || p === 'f') {
    G.app.fixedPath = p;
    // 다른 길로 걷던 저장이 있으면 그 길은 그대로 두고, 새로 시작할 때 이 길로 정한다
  }
  G.app.applySettings();
  const go = () => {
    const ch = q.get('ch');
    const st = G.save.state;
    if (ch && STORY.some((c) => c.id === ch)) {
      if (!st.path) { st.path = G.app.fixedPath || 'm'; st.surname = st.surname || '홍'; st.given = st.given || (st.path === 'f' ? '소화' : '충렬'); G.save.write(); }
      // 바로가기로 뒷장을 열면 그 장에 맞는 모습으로(처음부터 오면 이야기가 알아서 바꾼다)
      const n = STORY.findIndex((c) => c.id === ch);
      if (st.look === 'child' && n >= 6) { st.look = st.branch === 'c' ? 'sage' : n === 6 ? 'youth' : 'general'; G.save.write(); }
      return G.app.play(ch);
    }
    if (q.get('result') === '1' && st.path) return G.app.result();
    G.app.title();
  };
  // 손댈 때마다 소리를 풀어 준다(막혔던 배경음 파일도 이때 다시 튼다)
  document.addEventListener('pointerdown', () => G.audio.unlock(), { passive: true });
  document.addEventListener('keydown', () => G.audio.unlock());
  go();
})();
