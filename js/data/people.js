'use strict';
// 인물(선생님이 고쳐도 되는 파일). name의 {부} 같은 자리는 학생이 지은 성으로 채워진다.
// 게임 속 인물 이름(조무린·윤 처사·윤선·윤 소저·철목달)은 여러 영웅소설의 관습을 모아 새로 지은 게임 설정이다.
window.PEOPLE = {
  narrator: { name: '전기수', pt: 'pt_narrator', color: '#1f7474', role: '이야기책을 읽어 주는 이야기꾼(게임 속 안내자)' },
  father: { name: '{부}', pt: 'pt_father', color: '#b3342a', role: '주인공의 아버지. 바른말을 하는 충신' },
  mother: { name: '어머니', pt: 'pt_mother', color: '#6d8a5a', role: '주인공의 어머니' },
  villain: { name: '조무린', pt: 'pt_villain', color: '#6b3f8c', role: '간신. 주인공의 가문을 모함한다' },
  emperor: { name: '천자', pt: 'pt_emperor', color: '#b8892e', role: '나라의 임금(황제)' },
  rescuer: { name: '윤 처사', pt: 'pt_rescuer', color: '#7a5a1f', role: '벼슬을 버리고 숨어 사는 선비. 주인공을 구해 기른다' },
  master: { name: '도사', pt: 'pt_master', color: '#4a6a6a', role: '산속의 도사. 주인공에게 무예·병법·도술을 가르친다' },
  yunseon: { name: '윤선', pt: 'pt_yunseon', color: '#36548f', role: '윤 처사의 아들. 딸의 길에서 함께 자라고 함께 배운다' },
  yunsojeo: { name: '윤 소저', pt: 'pt_yunsojeo', color: '#c0607a', role: '윤 처사의 딸. 아들의 길에서 주인공과 혼인을 약속한다' },
  enemy: { name: '철목달', pt: 'pt_enemy', color: '#5a4a3a', role: '북쪽 호국의 장수' },
  phantom: { name: '허깨비 장수', pt: 'pt_phantom', color: '#6d6a70', role: '도사가 만든 대련 상대' },
  hero: { name: '{호}', pt: '', color: '#2a2119', role: '주인공' },
};
