'use strict';
// 배경음 파일(선생님이 고쳐도 되는 파일)
//  - 곡 이름은 js/core/audio.js의 TRACKS와 같다. 여기 있는 곡은 파일을 틀고, 없거나 못 읽으면 합성음을 튼다.
//  - 음원: 국립국악원 디지털 이음 「국악기 디지털 음원」 악구 — 공공누리 제1유형(출처표시).
//    한 연주를 번호 순서대로 잘게 나눈 악구를 순서대로 이어 붙여 만들었다(tools/make_bgm.py).
//  - gain: 곡마다 소리 크기(1이 기본). 모든 곡을 같은 크기(-17 LUFS)로 맞춰 두었다.
window.BGM = {
  credit: '배경음: 국립국악원 「디지털 이음」 국악기 악구(공공누리 제1유형)를 이어 붙였어요',
  tracks: {
    market: { src: 'assets/bgm/market.mp3', from: '가야금 경기민요 — 천안삼거리·한강수타령·창부타령' },
    child: { src: 'assets/bgm/child.mp3', from: '가야금 경기민요 — 도라지·아리랑' },
    court: { src: 'assets/bgm/court.mp3', from: '거문고 산조 — 중모리' },
    tension: { src: 'assets/bgm/tension.mp3', from: '거문고 산조 — 엇모리' },
    heaven: { src: 'assets/bgm/heaven.mp3', from: '대금 산조 — 진양조' },
    ruin: { src: 'assets/bgm/ruin.mp3', from: '아쟁 산조 — 진양조' },
    scheme: { src: 'assets/bgm/scheme.mp3', from: '아쟁 산조 — 중모리' },
    mountain: { src: 'assets/bgm/mountain.mp3', from: '가야금 산조 — 중중모리' },
    final: { src: 'assets/bgm/final.mp3', from: '가야금 산조 — 휘모리' },
    palace: { src: 'assets/bgm/palace.mp3', from: '소금 연례악 — 수제천' },
    battle: { src: 'assets/bgm/battle.mp3', from: '태평소 시나위 — 자진모리' },
    boudoir: { src: 'assets/bgm/boudoir.mp3', from: '해금 산조 — 진양조' },
    victory: { src: 'assets/bgm/victory.mp3', from: '태평소 행악 — 대취타' },
  },
};
