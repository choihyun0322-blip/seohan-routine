/* ============================================================
   🏡 우리집 살림 관제소  —  1-core.js
   Firebase RTDB 실시간 동기화 + localStorage 백업 (한도 0%) · 공용 유틸
   ============================================================ */
'use strict';

/* ---------------- Firebase ---------------- */
const FB = {
  apiKey: "AIzaSyDjfzhfe9MKAj_CTKbm4Zq50TEMnpl1tns",
  authDomain: "seohan-routine-sync.firebaseapp.com",
  databaseURL: "https://seohan-routine-sync-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "seohan-routine-sync",
  storageBucket: "seohan-routine-sync.firebasestorage.app",
  messagingSenderId: "381955483059",
  appId: "1:381955483059:web:41db087996d3392a3917c6"
};
const DBURL = FB.databaseURL;
const DEFAULT_ROOM = 'choi-home-2026';
const LISTS = ['routines', 'care', 'shopping', 'pantry', 'stock', 'recipes'];
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const STATE_VERSION = 4;

/* ---------------- utils ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const pad = n => String(n).padStart(2, '0');
const uid = p => p + Math.random().toString(36).slice(2, 8);

function todayISO() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function parseISO(iso) { const [y, m, d] = String(iso).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); }
function addDays(iso, n) { const dt = parseISO(iso); dt.setDate(dt.getDate() + n); return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()); }
function diffDays(a, b) { // b - a (일)
  const A = parseISO(a), B = parseISO(b);
  return Math.round((B.setHours(12, 0, 0, 0) - A.setHours(12, 0, 0, 0)) / 86400000);
}
function md(iso) { if (!iso) return ''; const d = parseISO(iso); return (d.getMonth() + 1) + '/' + d.getDate(); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function norm(s) { return String(s || '').replace(/[\s·,\-()]/g, '').toLowerCase(); }
function toast(msg) {
  const t = $('#toast'); t.textContent = msg;
  t.classList.toggle('high', !$('#overlay').hidden);
  t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2100);
}
function haptic() { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) { } }
/* ============================================================
   🏡 우리집 살림 관제소  —  1-data.js
   시드 데이터 · 보관구역 · 레시피 39종(초보용 상세 조리법) · 이모지 사전
   ============================================================ */

/* ---------------- 보관 구역 ---------------- */
const ZONES = [
  { k: 'fridge', label: '냉장', em: '❄️' },
  { k: 'freezer', label: '냉동', em: '🧊' },
  { k: 'room', label: '실온', em: '🌡️' },
  { k: 'seasoning', label: '조미료·양념', em: '🧂' }
];
const ZONE_MAP = { fridge: ZONES[0], freezer: ZONES[1], room: ZONES[2], seasoning: ZONES[3] };
function zoneLabel(z) { const m = ZONE_MAP[z] || ZONE_MAP.fridge; return m.em + ' ' + m.label; }

/* ---------------- 냉장·냉동 안쪽 소분류 ----------------
   화면에는 육류 → 야채 → 과일 → 밀키트·반찬 → 유제품·기타 순서로 묶는다.
   품목에는 아무것도 쓰지 않고 이름으로만 추론한다(기존 방 데이터를 건드리지 않음).
   사용자가 직접 고른 값(p.sub)이 있으면 그것이 우선.                          */
const SUBS = [
  { k: 'meat', label: '육류', em: '🥩' },
  { k: 'veg', label: '야채', em: '🥬' },
  { k: 'fruit', label: '과일', em: '🍎' },
  { k: 'meal', label: '밀키트·반찬', em: '🍱' },
  { k: 'etc', label: '유제품·기타', em: '🥛' }
];
const SUB_MAP = {};
SUBS.forEach(s => { SUB_MAP[s.k] = s; });

/* 판정 순서: 간편식 → 유제품·음료·빵·면 → 육류·수산 → 과일 → 야채 (남는 건 기타) */
const SUB_KW = {
  meal: ['해물파전', '김치전', '부추전', '감자전', '동그랑땡', '치즈스틱', '새우튀김', '볶음밥', '떡볶이', '떡갈비', '즉석밥', '햄버그', '커틀릿', '미트볼', '밀키트', '간편식', '도시락', '컵밥', '떡국', '갈비탕', '삼계탕', '육개장', '감자탕', '돈까스', '돈가스', '함박', '덮밥', '반찬', '순대', '족발', '보쌈', '만두', '너겟', '핫도그', '찜닭', '짜장', '라구', '스프', '피자', '튀김', '어묵', '김치', '까스', '파전', '밥'],
  etc: ['크림치즈', '요구르트', '스파게티', '토르티야', '베이글', '생크림', '마가린', '요거트', '파스타', '계란', '달걀', '순두부', '사이다', '식혜', '두유', '국수', '우유', '치즈', '버터', '두부', '주스', '쥬스', '음료', '탄산', '콜라', '생수', '커피', '식빵', '빵', '면', '당면'],
  meat: ['돼지고기', '소고기', '쇠고기', '부채살', '삼겹살', '앞다리', '다짐육', '닭다리', '닭가슴', '닭볶음', '닭갈비', '목살', '안심', '등심', '갈비', '차돌', '고등어', '참돔', '생선', '새우', '오징어', '멸치', '전복', '꽃게', '대게', '홍합', '베이컨', '소시지', '비엔나', '스팸', '연어', '갈치', '조개', '닭', '오리', '햄', '굴'],
  fruit: ['샤인머스캣', '파인애플', '블루베리', '한라봉', '복숭아', '오렌지', '바나나', '무화과', '감귤', '자몽', '레몬', '라임', '수박', '참외', '멜론', '자두', '키위', '망고', '체리', '석류', '딸기', '포도', '단감', '사과', '감', '귤', '배'],
  veg: ['아스파라거스', '양배추', '브로콜리', '파프리카', '콩나물', '시금치', '샐러드', '양상추', '애호박', '고구마', '당근', '대파', '쪽파', '부추', '무우', '양파', '감자', '마늘', '생강', '버섯', '팽이', '표고', '오이', '호박', '배추', '상추', '깻잎', '토마토', '숙주', '피망', '가지', '청양', '고추', '옥수수', '셀러리', '케일', '비트', '연근', '우엉', '무']
};
const SUB_ORDER = ['meal', 'etc', 'meat', 'fruit', 'veg'];
const SUB_KEYS = {};
SUB_ORDER.forEach(k => { SUB_KEYS[k] = SUB_KW[k].slice().sort((a, b) => b.length - a.length); });
function subHit(n, keys) {
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (k.length <= 1) { if (n === k) return true; }          // '배'·'무' 같은 한 글자는 이름이 정확히 같을 때만
    else if (n.indexOf(k) >= 0) return true;
  }
  return false;
}
function inferSub(name) {
  const n = norm(name);
  for (let i = 0; i < SUB_ORDER.length; i++) { if (subHit(n, SUB_KEYS[SUB_ORDER[i]])) return SUB_ORDER[i]; }
  return 'etc';
}
function subOf(p) {
  if (!p) return 'etc';
  return (p.sub && SUB_MAP[p.sub]) ? p.sub : inferSub(p.name);
}
function subLabel(k) { const m = SUB_MAP[k] || SUB_MAP.etc; return m.em + ' ' + m.label; }

/* 이름 기반 자동 분류 — 위에서부터 먼저 걸리는 구역이 이김 */
const FREEZER_KW = ['냉동', '만두', '돈까스', '돈가스', '핫도그', '피자', '아이스', '빙과', '감자튀김', '치즈스틱', '너겟', '떡갈비', '냉면', '새우튀김', '가라아게', '볶음밥', '와플'];
const SEASON_KW = ['간장', '소금', '참기름', '들기름', '된장', '고추장', '쌈장', '춘장', '카레', '후추', '설탕', '알룰로스', '식초', '매실', '올리고당', '물엿', '꿀', '마요', '케찹', '케첩', '굴소스', '쯔유', '다시다', '미원', '참깨', '깨소금', '고춧가루', '청양', '고추가루', '액젓', '젓갈', '허브', '바질', '오레가노', '파슬리', '시나몬', '계피', '소스', '드레싱', '겨자', '와사비', '파프리카장', '육수', '맛술', '미림', '청주', '조미료', '양념'];
const FRIDGE_KW = ['김치', '밥', '두부', '계란', '달걀', '우유', '채소', '야채', '버섯', '상추', '대파', '쪽파', '부추', '오이', '애호박', '당근', '배추', '양배추', '브로콜리', '토마토', '시금치', '콩나물', '숙주', '샐러드', '파프리카', '피망', '요거트', '요구르트', '치즈', '생크림', '버터', '햄', '소시지', '베이컨', '닭', '소고기', '돼지고기', '고기', '생선', '새우', '오징어', '조개', '순두부', '떡', '어묵', '무 ', '무우', '가지'];
const ROOM_KW = ['양파', '감자', '고구마', '마늘', '생강', '사과', '바나나', '귤', '오렌지', '쌀', '현미', '잡곡', '라면', '당면', '부침가루', '밀가루', '튀김가루', '통조림', '참치캔', '김', '미역', '다시마', '견과', '호두', '아몬드', '땅콩', '단호박'];
function inferZone(name) {
  const n = String(name || '');
  if (FREEZER_KW.some(k => n.includes(k))) return 'freezer';
  if (SEASON_KW.some(k => n.includes(k))) return 'seasoning';
  if (FRIDGE_KW.some(k => n.includes(k))) return 'fridge';
  if (ROOM_KW.some(k => n.includes(k))) return 'room';
  return 'fridge';
}

/* ---------------- 이모지 사전 (100+ 키워드 부분 매칭) ---------------- */
const EMOJI_MAP = {
  /* 채소 */
  '배추': '🥬', '양배추': '🥬', '상추': '🥬', '시금치': '🥬', '깻잎': '🌿', '대파': '🌿', '쪽파': '🌿', '부추': '🌿',
  '파프리카': '🫑', '피망': '🫑', '브로콜리': '🥦', '오이': '🥒', '애호박': '🥒', '호박': '🎃', '단호박': '🎃',
  '가지': '🍆', '토마토': '🍅', '방울토마토': '🍅', '당근': '🥕', '무우': '🥬', '무': '🥬',
  '양파': '🧅', '감자': '🥔', '고구마': '🍠', '마늘': '🧄', '생강': '🫚', '버섯': '🍄', '팽이': '🍄', '표고': '🍄',
  '콩나물': '🌱', '숙주': '🌱', '옥수수': '🌽', '고추': '🌶️', '청양': '🌶️', '아스파라거스': '🥬', '셀러리': '🥬', '샐러드': '🥗',
  /* 과일 */
  '사과': '🍎', '바나나': '🍌', '딸기': '🍓', '포도': '🍇', '오렌지': '🍊', '귤': '🍊', '한라봉': '🍊', '레몬': '🍋',
  '수박': '🍉', '참외': '🍈', '멜론': '🍈', '복숭아': '🍑', '자두': '🍑', '배': '🍐', '키위': '🥝', '블루베리': '🫐', '단감': '🍊', '감': '🍊', '곶감': '🍊',
  '체리': '🍒', '망고': '🥭', '파인애플': '🍍',
  /* 육류 · 가공육 */
  '소고기': '🥩', '쇠고기': '🥩', '돼지고기': '🥩', '목살': '🥩', '앞다리': '🥩', '다짐육': '🥩', '안심': '🥩', '등심': '🥩',
  '삼겹살': '🥓', '베이컨': '🥓', '닭': '🍗', '오리': '🦆', '갈비': '🍖', '햄': '🍖', '소시지': '🌭', '비엔나': '🌭',
  '스팸': '🥫', '어묵': '🍢', '맛살': '🦀', '핫도그': '🌭', '너겟': '🍗', '치킨': '🍗', '돈까스': '🍱',
  /* 해산물 */
  '생선': '🐟', '고등어': '🐟', '갈치': '🐟', '연어': '🍣', '참치': '🐟', '멸치': '🐟', '새우': '🦐', '오징어': '🦑',
  '조개': '🦪', '홍합': '🦪', '굴': '🦪', '게': '🦀', '돔': '🐟', '미역': '🌊', '다시마': '🌊', '김': '🌊', '전복': '🦪',
  /* 유제품 · 달걀 · 두부 */
  '계란': '🥚', '달걀': '🥚', '우유': '🥛', '치즈': '🧀', '버터': '🧈', '생크림': '🥛', '요거트': '🥛', '요구르트': '🥛',
  '두부': '🧈', '순두부': '🧈', '마가린': '🧈',
  /* 면 · 빵 · 곡물 */
  '라면': '🍜', '우동': '🍜', '국수': '🍜', '당면': '🍜', '소면': '🍜', '칼국수': '🍜', '파스타': '🍝', '스파게티': '🍝',
  '빵': '🍞', '식빵': '🍞', '베이글': '🥯', '밥': '🍚', '쌀': '🌾', '찹쌀': '🌾', '현미': '🌾', '잡곡': '🌾',
  '떡': '🍡', '만두': '🥟', '부침가루': '🌾', '밀가루': '🌾', '튀김가루': '🌾', '시리얼': '🥣', '오트밀': '🥣', '김치': '🥬', '짜장': '🍜', '쥬스': '🧃', '주스': '🧃', '스프': '🥣', '생수': '💧', '물': '💧',
  '통조림': '🥫', '캔': '🥫',
  /* 조미료 · 양념 */
  '소금': '🧂', '간장': '🍾', '국간장': '🍾', '진간장': '🍾', '식초': '🍾', '쯔유': '🍾', '굴소스': '🍾', '액젓': '🍾',
  '참기름': '🫗', '들기름': '🫗', '식용유': '🫗', '올리브유': '🫗', '된장': '🥫', '고추장': '🥫', '쌈장': '🥫', '춘장': '🥫',
  '설탕': '🍬', '알룰로스': '🍯', '올리고당': '🍯', '물엿': '🍯', '꿀': '🍯', '마요': '🥫', '케첩': '🍅', '케찹': '🍅',
  '카레': '🍛', '후추': '🧂', '고춧가루': '🌶️', '참깨': '🌰', '깨소금': '🌰', '견과': '🌰', '땅콩': '🥜', '호두': '🌰',
  '아몬드': '🌰', '드레싱': '🥫', '소스': '🥫', '허브': '🌿', '바질': '🌿', '파슬리': '🌿', '육수': '🧂', '다시다': '🧂',
  '맛술': '🍾', '미림': '🍾', '청주': '🍾', '겨자': '🌭', '와사비': '🌭',
  /* 생필품 · 생활 */
  '휴지': '🧻', '화장지': '🧻', '물티슈': '🧻', '키친타올': '🧻', '행주': '🧻', '세제': '🧴', '세탁세제': '🧴', '섬유유연제': '🧴',
  '주방세제': '🧴', '샴푸': '🧴', '린스': '🧴', '컨디셔너': '🧴', '바디워시': '🧴', '로션': '🧴', '크림': '🧴', '핸드크림': '🧴',
  '비누': '🧼', '핸드워시': '🧼', '치약': '🪥', '칫솔': '🪥', '가글': '🪥', '스펀지': '🧽', '수세미': '🧽', '필터': '🧽',
  '봉지': '🛍️', '비닐': '🛍️', '쓰레기': '🗑️', '건전지': '🔋', '전구': '💡', '마스크': '😷', '손소독': '🧴', '분유': '🍼',
  '기저귀': '🧷', '얼음': '🧊', '장갑': '🧤', '양말': '🧦'
};
const EMOJI_KEYS = Object.keys(EMOJI_MAP).sort((a, b) => b.length - a.length);
function guessEmoji(name) {
  const n = String(name || '');
  for (let i = 0; i < EMOJI_KEYS.length; i++) { if (n.includes(EMOJI_KEYS[i])) return EMOJI_MAP[EMOJI_KEYS[i]]; }
  return '🧴';
}

/* ---------------- 요일 리듬 ---------------- */
const RHYTHM = {
  1: { em: '몰아하기', sub: '청소·빨래 4개', hot: true, tasks: ['장난감 정리', '청소기 돌리기', '세탁기 돌리기', '빨래 개기'] },
  2: { em: '매일 루틴만', sub: '무리 안 하기', tasks: [] },
  3: { em: '빨래통 내놓기', sub: '설거지 패스 OK', hot2: true, tasks: ['빨래통 내놓기', '설거지 패스 (청연 대비 가능)'] },
  4: { em: '청연 방문', sub: '청소의 날', tasks: ['청연 방문 — 청소의 날'] },
  5: { em: '가볍게!', sub: '주말 전 정리', tasks: ['가볍게 정리 · 주말 준비'] },
  6: { em: '가족 시간', sub: '아이랑 놀기', tasks: ['가족 시간 푹 누리기'] },
  0: { em: '주간 정리', sub: '다음 주 준비', tasks: ['주간 정리 · 냉장고 비우기'] }
};

const DEFAULT_SETTINGS = { trash: { on: false, trashDay: 4, recyDay: 5 } };

function seedState() {
  const t = todayISO();
  const mk = (slot, time, text, sub, cond, days, key) => ({ id: uid('r'), slot, time: time || '', text, sub: sub || '', cond: cond || 'all', days: days || [], key: !!key, ord: 0 });
  const am = [
    mk('am', '', '기상 · 세수 · 양치'),
    mk('am', '', '화장 · 옷입기', '', 'office'),
    mk('am', '07:20', '서한이 깨우며 아침 차려주기'),
    mk('am', '', '서한이 준비물 챙기기', '물통 · 젓가락'),
    mk('am', '08:00', '서한이 세수 · 양치'),
    mk('am', '08:10', '서한이 옷입기'),
    mk('am', '08:15', '출발 🚗')
  ];
  const pm = [
    mk('pm', '18:00', '집 도착', '~18:30'),
    mk('pm', '', '샤워 · 저녁', '순서는 그날그날'),
    mk('pm', '', '설거지'),
    mk('pm', '', '서한이 공부 봐주기'),
    mk('pm', '', '정리 · 내일 준비'),
    mk('pm', '', '서한이 샤워'),
    mk('pm', '', '🧴 로션 꼭 바르기!', '', 'all', [], true),
    mk('pm', '', '양치'),
    mk('pm', '', '책 읽기'),
    mk('pm', '', '취침 🌜')
  ];
  const routines = [...am, ...pm].map((r, i) => Object.assign(r, { ord: i }));

  const C = (emoji, name, days, ago, ord, stock) => ({ id: uid('c'), emoji, name, days, last: addDays(t, -ago), ord, stock: stock || '' });
  const care = [
    C('🪥', '서한이 칫솔', 30, 32, 0, '서한이 칫솔'),
    C('🧵', '베개 · 매트리스 커버', 10, 4, 1),
    C('💧', '가습기 살균 · 물통 세척', 4, 3, 2),
    C('☕', '커피머신 세척', 14, 12, 3),
    C('🛏️', '이불 빨래', 10, 12, 4),
    C('🚿', '배수구 트랩 세척', 14, 9, 5),
    C('♨️', '건조기 열풍 내부 살균', 21, 13, 6),
    C('🧺', '세탁기 무세제 통세척', 30, 18, 7),
    C('🧹', '청소기 먼지통 · 필터', 21, 8, 8),
    C('🍽️', '식세기 무세제 통세척', 30, 15, 9),
    C('🌬️', '공기청정기 필터', 30, 14, 10),
    C('🧊', '냉장고 유통기한 비우기', 30, 21, 11),
    C('🪥', '어른 칫솔', 90, 40, 12, '어른 칫솔'),
    C('🪟', '방충망 · 창틀 닦기', 90, 66, 13)
  ];

  const shopping = [
    { id: uid('s'), name: '계란', cat: 'food', done: false, ord: 0 },
    { id: uid('s'), name: '대파', cat: 'food', done: false, ord: 1 },
    { id: uid('s'), name: '두부', cat: 'food', done: false, ord: 2 },
    { id: uid('s'), name: '물티슈', cat: 'living', done: false, ord: 3 },
    { id: uid('s'), name: '키친타올', cat: 'living', done: false, ord: 4 }
  ];

  const P = (name, zone, expDays, ord) => ({ id: uid('p'), name, emoji: guessEmoji(name), zone: zone || inferZone(name), exp: addDays(t, expDays), ord });
  const pantry = [
    P('밥', 'fridge', 1, 0),
    P('김치', 'fridge', 10, 1),
    P('계란', 'fridge', 12, 2),
    P('두부', 'fridge', 1, 3),
    P('대파', 'fridge', 4, 4),
    P('당근', 'fridge', 8, 6),
    P('애호박', 'fridge', 3, 7),
    P('우유', 'fridge', 2, 8),
    P('양파', 'room', 20, 5),
    P('감자', 'room', 15, 9),
    P('간장', 'seasoning', 300, 10),
    P('참기름', 'seasoning', 200, 11),
    P('소금', 'seasoning', 400, 12),
    P('냉동만두', 'freezer', 40, 13)
  ];

  const K = (name, level, ord, count, max) => ({ id: uid('k'), name, emoji: guessEmoji(name), level, ord, useCount: count != null, count: count == null ? undefined : count, max: max || 10 });
  const stock = [
    K('물티슈', 'none', 0, 1, 10),
    K('키친타올', 'none', 1),
    K('휴지', 'low', 2, 4, 10),
    K('세탁세제', 'low', 3),
    K('주방세제', 'enough', 4),
    K('샴푸', 'enough', 5),
    K('치약', 'enough', 6),
    K('비누', 'enough', 7),
    K('봉지', 'low', 8),
    K('서한이 칫솔', 'enough', 9, 3, 5),
    K('어른 칫솔', 'enough', 10, 2, 5)
  ];

  return {
    v: 4, mode: 'home', day: t, checks: {}, memo: {}, routines, care, shopping, pantry, stock,
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
  };
}

/* ---------------- 레시피 : 단계 번호 자동 매기기 ---------------- */
const STEP = function () {
  const lines = Array.prototype.slice.call(arguments);
  return lines.map((t, i) => (i + 1) + '. ' + t).join('\n');
};

/* ---------------- 내 레시피 9종 (제미나이) ---------------- */
const GEMINI_RECIPES = [
  ['지도리 우동', '🍲', '내 레시피', '15분', ['닭다리살', '대파', '우동면', '쯔유', '간장'],
    STEP('대파 1대를 3~4cm 토막으로 썰고, 팬에 식용유 1큰술을 둔 뒤 중불에서 2~3분 노릇하게 구워 따로 덜어두세요(파기름).',
      '닭다리살 150g은 키친타올로 물기를 꼭 닦고, 같은 팬에 껍질 쪽부터 중불 3분 → 뒤집어 3분 바삭하게 구워요.',
      '구운 닭고기는 한입 크기로 썰어둡니다.',
      '냄비에 물 400ml + 쯔유 4큰술(60ml) + 진간장 1큰술(15ml)을 넣고 센 불에서 끓어오르면, 우동면 1인분(200g)을 넣고 중불로 줄여 2~3분 끓여요.',
      '면을 그릇에 담고 국물을 반쯤 부은 뒤 닭고기·대파를 올려요. 어른 몫만 후추 톡, 서한이 몫은 국물 2큰술을 덜어 싱겁게 내요.')],
  ['크림스파게티', '🍝', '내 레시피', '18분', ['스파게티면', '베이컨', '양파', '마늘', '생크림', '우유', '파마산치즈'],
    STEP('냄비에 물 1.5L + 소금 1큰술을 넣고 센 불에서 끓으면 스파게티면 100g을 넣어 포장 시간보다 1분 덜 삶아요(면수 1컵은 꼭 남겨두기).',
      '그 사이 마늘 2쪽은 편썰기, 양파 1/4개는 채썰기, 베이컨 3장은 2cm 폭으로 썰어요.',
      '약불로 달군 팬에 올리브유 1큰술 + 마늘을 넣고 30초(향이 올라올 때까지) 볶다가 베이컨·양파를 넣고 중불에서 3분 볶아요.',
      '생크림 100ml + 우유 100ml를 부어 약불에서 1~2분 데워요(가장자리가 보글거릴 정도, 끓여 넘치지 않게).',
      '삶은 면과 면수 3큰술을 넣고 중불에서 1분 비벼 농도를 맞춘 뒤 파마산치즈 2큰술 + 소금 1꼬집으로 간해요.',
      '서한이 몫을 먼저 덜어내고, 어른 그릇에만 통후추를 갈아요.')],
  ['소시지 오므라이스', '🍳', '내 레시피', '7분', ['밥', '버터', '소시지', '하이라이스소스', '계란'],
    STEP('밥 130g(한 공기)에 버터 10g, 잘게 썬 소시지 50g, 하이라이스(또는 짜장)소스 1큰술을 넣고 고루 섞어 전자레인지용 그릇에 담아요.',
      '계란 1개를 풀어 체에 한 번 걸러요(계란이 고르게 익어요).',
      '계란물을 밥 위에 고르게 붓고 랩을 살짝 덮어 전자레인지 600W에서 3분 돌려요.',
      '꺼내서 1분 두면 잔열로 계란이 마저 익어요. 서한이 몫은 소시지를 잘게 다져 넣어요.')],
  ['삼색소보로덮밥', '🍱', '내 레시피', '15분', ['밥', '다짐육', '계란', '오이', '간장', '알룰로스', '버터'],
    STEP('다짐육 100g을 중불 팬에 넣고 주걱으로 눌러 펴 2분, 뒤집어 2분 볶아요.',
      '간장 1큰술 + 알룰로스 1큰술 + 물 2큰술을 넣고 약불에서 1분 졸여요.',
      '계란 2개를 풀어 약불 팬에 부어 30초 저어 스크램블해요(부드럽게).',
      '오이 1/2개는 얇게 슬라이스해요.',
      '밥 200g 위에 소고기·계란·오이를 삼색으로 올리고 참기름 1/2작은술을 둘러요. 서한이 몫은 소고기 양념을 물 2큰술로 묽게 덜어내요.')],
  ['꿍팟퐁커리', '🍛', '내 레시피', '15분', ['새우', '대파', '양파', '계란', '우유', '카레가루', '버터'],
    STEP('새우 50g은 물기를 닦고, 버터 1큰술을 두른 중불 팬에 1분 30초 볶아 덜어 한입 크기로 잘라요.',
      '같은 팬에 대파 1/2대(송송)와 양파 1/2개(채썰기)를 넣고 중불 2분 볶아요.',
      '카레가루 1큰술을 넣고 30초만 볶아 향을 내요(불을 약하게, 타면 써요).',
      '우유 100ml를 부어 약불에서 1분 끓인 뒤, 계란 1개를 푼 물을 천천히 풀어 10초만 익히고 불을 꺼요.',
      '밥 위에 붓고 어른 몫만 후추. 서한이 몫은 카레 1/2작은술만 사용해요.')],
  ['생크림김치밥', '🍚', '내 레시피', '12분', ['밥', '김치', '우유', '생크림', '모짜렐라치즈', '버터'],
    STEP('김치 1큰술을 잘게 썰어 김치국물 1작은술, 버터 10g과 함께 밥 130g에 섞어 그릇에 담아요.',
      '냄비에 우유 50ml + 생크림 50ml를 넣고 약불에서 1분 데워요.',
      '모짜렐라치즈 50g을 넣고 약불에서 1~2분 녹여요.',
      '크림소스를 밥 위에 붓고 김가루를 뿌려요. 서한이 몫은 김치를 1작은술만 넣어 맵지 않게 해요.')],
  ['오야꼬돈', '🍗', '내 레시피', '15분', ['밥', '닭다리살', '양파', '계란', '간장', '마늘', '알룰로스'],
    STEP('닭다리살 150g은 껍질 쪽부터 중불 팬에 3분, 뒤집어 3분 구운 뒤 한입 크기로 썰어요.',
      '같은 팬에 양파 1/2개(채썰기)를 넣고 중불 2분 볶아요.',
      '물 100ml + 가루육수 1/2작은술 + 간장 1큰술 + 알룰로스 1큰술 + 다진마늘 1/2작은술을 넣고 1분 끓여요.',
      '닭고기를 다시 넣고 계란 2개를 푼 물을 둘레에 둘러 뚜껑을 덮어 약불 2분(반숙) 익혀요.',
      '밥 위에 국물째 올리고 대파를 뿌려요. 서한이 몫은 국물을 1큰술만 올려요.')],
  ['간장 닭고기 고구마·양배추 찜닭', '🍲', '내 레시피', '25분', ['닭다리살', '고구마', '양배추', '양파', '당근', '팽이버섯', '간장', '마늘'],
    STEP('고구마 1개는 2cm 두께, 양배추 2장은 한입 크기, 양파 1/2개·당근 1/3개는 큼직하게 썰어요.',
      '닭다리살 300g은 한입 크기로 썰어 냄비 바닥에 깔고 채소를 위에 올려요.',
      '물 200ml + 간장 3큰술 + 맛술 2큰술 + 다진마늘 1큰술 + 알룰로스 1큰술을 부어요.',
      '센 불에서 5분 끓인 뒤 뚜껑을 덮고 중불에서 12~15분 익혀요(중간에 한 번 뒤집기).',
      '팽이버섯 1봉을 흩어 넣고 약불에서 1분만 더 익혀요.',
      '국물이 3큰술쯤 남으면 불을 꺼요. 서한이 몫을 덜고 어른 몫만 고춧가루 1/2작은술을 넣어요.')],
  ['닭고기 양배추·채소 볶음덮밥', '🥘', '내 레시피', '15분', ['닭다리살', '양배추', '애호박', '양파', '당근', '팽이버섯', '밥'],
    STEP('닭다리살 200g은 한입 크기로, 당근 1/3개·양파 1/2개는 채썰기, 양배추 2장·애호박 1/3개는 얇게 썰어요.',
      '팬을 센 불로 충분히 달군 뒤 중불로 줄이고 닭고기를 3분 볶아 겉면을 익혀요.',
      '당근·양파를 넣고 2분, 양배추·애호박을 넣고 2분 더 볶아요.',
      '간장 1큰술 + 굴소스 1/2큰술 + 후추 조금으로 간해요.',
      '팽이버섯을 넣고 30초만 볶아 불을 꺼요.',
      '밥 위에 올려요. 서한이 몫을 먼저 덜고 어른 몫만 간장 1/2작은술을 더해요.')]
].map((r, i) => ({ id: 'my' + (i + 1), name: r[0], emoji: r[1], kind: r[2], time: r[3], ings: r[4], steps: r[5] }));

/* ---------------- 기본 레시피 30종 ---------------- */
const RECIPES = GEMINI_RECIPES.concat([
  ['김치볶음밥', '🍚', '집밥', '10분', ['밥', '김치', '계란', '대파', '참기름'],
    STEP('김치 1/2컵(100g)을 잘게 썰고 김치국물 2큰술을 따로 준비해요.',
      '센 불로 달군 팬에 식용유 1큰술, 대파 1/2대(송송)를 넣고 30초 볶아 파기름을 내요.',
      '김치를 넣고 중불에서 2분 볶아 신맛을 날려요.',
      '밥 200g을 넣고 주걱으로 눌러 펴가며 2분 볶고 김치국물 1큰술로 간을 맞춰요.',
      '불을 끄고 참기름 1/2큰술을 섞어요.',
      '계란 프라이는 약불에서 노른자를 반숙으로 부쳐 위에 올려요. 서한이 몫은 김치를 1큰술만.')],
  ['계란말이', '🍳', '집밥', '8분', ['계란', '대파', '당근', '소금'],
    STEP('계란 3개에 소금 1꼬집, 물 1큰술을 넣고 잘 풀어 체에 거르세요.',
      '당근 1/4개와 대파 1/2대를 아주 잘게 다져 계란물에 섞어요.',
      '약불로 달군 팬에 기름을 얇게 두르고 계란물 1/3을 부어 반쯤 익으면 한쪽으로 1/3 접어요.',
      '남은 계란물을 2~3번 나눠 부으며 접은 부분부터 돌돌 말아요(약불 유지).',
      '김발로 한 번 감아 모양을 잡고 2cm 폭으로 썰어요.')],
  ['계란찜', '🥚', '집밥', '15분', ['계란', '대파', '새우젓', '물'],
    STEP('계란 3개에 물 150ml(계란 무게의 1.2배), 새우젓 1/2작은술을 넣고 풀어요.',
      '체에 두 번 걸러 거품과 알끈을 없애요(부드러워져요).',
      '뚝배기에 담아 약불에 올리고 뚜껑을 덮어 12분 익혀요(중간에 한 번 저어 바닥 눌음을 방지).',
      '대파를 송송 뿌리고 참기름 1/2작은술을 둘러요.')],
  ['두부김치', '⬜', '집밥', '12분', ['두부', '김치', '대파', '참기름'],
    STEP('두부 1/2모를 1.5cm 두께로 썰어 소금물에 5분 담갔다가 키친타올로 물기를 닦아요.',
      '중불 팬에 기름 1큰술을 두르고 두부를 앞뒤 2분씩 노릇하게 구워요.',
      '같은 팬에 김치 1컵 + 김치국물 2큰술 + 설탕 1/2작은술을 넣고 중불에서 3분 볶아요.',
      '대파를 넣고 30초, 참기름 1/2작은술을 둘러 두부 위에 올려요.')],
  ['된장찌개', '🍲', '집밥', '20분', ['된장', '두부', '애호박', '감자', '양파', '대파', '멸치', '다시마'],
    STEP('냄비에 물 700ml, 멸치 5마리, 다시마 5cm를 넣고 센 불에 올려요.',
      '끓기 직전 다시마를 건지고 중불에서 10분 더 끓여 육수를 내요.',
      '된장 1.5큰술을 국물에 풀고 감자 1개(깍둑)를 넣어 5분 끓여요.',
      '애호박 1/3개, 양파 1/2개, 두부 1/2모(깍둑)를 넣고 3분 더 끓여요.',
      '다진마늘 1/2작은술, 대파, 고춧가루 1/2작은술을 넣고 1분 끓여 마무리해요.')],
  ['김치찌개', '🍲', '집밥', '25분', ['김치', '돼지고기', '두부', '대파'],
    STEP('김치 2컵을 3cm 폭으로 썰고 김치국물 1/2컵을 준비해요. 돼지고기 200g은 한입 크기로 썰어요.',
      '중불 팬에 기름 1큰술, 돼지고기를 넣고 3분 볶아 겉면을 익혀요.',
      '김치를 넣고 5분 볶아 투명해지고 감칠맛이 올라오게 해요.',
      '물 500ml + 김치국물을 부어 센 불에서 끓인 뒤 중불에서 10분 끓여요.',
      '두부 1/2모를 넣고 3분, 대파와 고춧가루 1/2작은술로 마무리해요.')],
  ['미역국', '🥣', '집밥', '20분', ['미역', '소고기', '국간장', '참기름'],
    STEP('건미역 10g을 물에 10분 불려 2~3cm로 썰고 물기를 살짝 짜요.',
      '냄비에 참기름 1큰술을 두르고 미역을 중불에서 3분 볶아요.',
      '소고기 100g을 넣고 2분 볶다가 물 700ml를 붓고 센 불에서 끓여요.',
      '끓어오르면 중불로 줄여 10분 끓여요.',
      '국간장 2큰술 + 다진마늘 1/2작은술을 넣고 5분 더 끓여요.')],
  ['콩나물국', '🥣', '집밥', '12분', ['콩나물', '대파', '마늘', '소금'],
    STEP('콩나물 200g을 씻어 냄비에 담고 물 700ml를 부어요.',
      '센 불에 올려 끓어오르면 뚜껑을 덮고 중불에서 8분 끓여요(뚜껑을 자주 열면 비린내가 나요).',
      '소금 1/2큰술, 다진마늘 1/2작은술, 대파를 넣고 30초 끓여 마무리해요.',
      '서한이 몫은 소금을 1/3큰술로 줄여 덜어요.')],
  ['애호박전', '🥒', '집밥', '15분', ['애호박', '계란', '부침가루', '소금'],
    STEP('애호박 1개를 0.5cm 두께 반달 모양으로 썰어 소금 1꼬집을 뿌리고 5분 두었다가 물기를 닦아요.',
      '부침가루 1/2컵을 얇게 묻히고 계란 2개를 푼 물에 담갔다 빼요.',
      '중불 팬에 기름 2큰술을 두르고 앞뒤 1분 30초씩 노릇하게 부쳐요.',
      '키친타올에 올려 기름을 빼고 초간장(간장 1큰술+식초 1/2큰술)과 함께 내요.')],
  ['감자조림', '🥔', '집밥', '18분', ['감자', '간장', '설탕', '마늘'],
    STEP('감자 3개를 한입 크기로 썰어 물에 5분 담가 전분을 빼요.',
      '중불 팬에 기름 1큰술을 두르고 감자를 3분 볶아 겉면을 익혀요.',
      '간장 2큰술 + 설탕 1큰술 + 물 150ml + 다진마늘 1/2작은술을 넣고 중불에서 10분 조려요.',
      '국물이 남으면 센 불로 2분 졸이고 통깨를 뿌려요.')],
  ['어묵볶음', '🍢', '집밥', '10분', ['어묵', '양파', '간장', '고추장'],
    STEP('어묵 3장을 삼각 또는 채 모양으로 썰어 끓는 물에 30초 데쳐 기름을 빼요.',
      '중불 팬에 기름 1큰술, 양파 1/2개(채썰기)를 넣고 1분 볶아요.',
      '어묵을 넣고 간장 1큰술 + 고추장 1/2큰술 + 물 2큰술 + 알룰로스 1/2큰술로 3분 볶아요.',
      '참기름 1/2작은술과 통깨를 넣어 마무리해요.')],
  ['멸치볶음', '🐟', '집밥', '10분', ['멸치', '견과', '간장', '설탕', '올리고당'],
    STEP('잔멸치 50g을 마른 팬에 넣고 중불에서 2분 볶아 비린내를 날려요.',
      '불을 약불로 줄이고 간장 1큰술 + 설탕 1/2큰술 + 올리고당 1큰술을 넣고 1분 볶아요.',
      '견과 2큰술을 넣고 30초 볶은 뒤 불을 꺼요(겉만 코팅, 눅눅해지지 않게).',
      '넓은 접시에 펼쳐 식혀요.')],
  ['소시지야채볶음', '🌭', '집밥', '10분', ['소시지', '양파', '피망', '케첩'],
    STEP('소시지 5개에 칼집을 내고 중불 팬에 2분 볶아요.',
      '양파 1/2개, 피망 1/2개를 채썰어 넣고 2분 볶아요.',
      '케첩 2큰술 + 간장 1/2큰술 + 물 1큰술을 넣고 1분 볶아 마무리해요.')],
  ['카레라이스', '🍛', '집밥', '25분', ['카레가루', '감자', '당근', '양파', '밥'],
    STEP('감자 1개·당근 1/2개·양파 1개를 깍둑썰기하고 고기 150g을 한입 크기로 썰어요.',
      '중불 팬에 기름 2큰술, 고기를 넣고 3분 볶다가 채소를 넣고 3분 더 볶아요.',
      '물 600ml를 부어 센 불에서 끓인 뒤 중불에서 10분 끓여요.',
      '불을 끄고 카레가루 3큰술을 풀어 넣은 뒤 약불에서 5분 끓여요(바닥이 눌지 않게 저어요).',
      '밥 위에 부어요. 서한이 몫은 카레 2큰술로 줄여 덜어요.')],
  ['짜장밥', '🍜', '집밥', '10분', ['짜장소스', '밥', '양파', '계란'],
    STEP('양파 1개를 깍둑썰기해 중불 팬에 3분 볶아 투명해지게 해요.',
      '짜장소스(또는 짜장가루 2큰술 + 물 100ml)를 넣고 2분 끓여요.',
      '밥 200g 위에 붓고 계란 프라이를 올려요.')],
  ['토마토달걀볶음', '🍅', '집밥', '10분', ['토마토', '계란', '대파', '소금'],
    STEP('계란 2개에 소금 1꼬집을 넣고 풀어요. 센 불 팬에 부어 30초만 저어 스크램블한 뒤 덜어내요.',
      '같은 팬에 토마토 1개(웨지컷)를 넣고 중불에서 1분 30초 볶아요.',
      '계란을 다시 넣고 설탕 1/2작은술, 대파를 넣어 30초 볶아 마무리해요.')],
  ['참치마요덮밥', '🍱', '집밥', '5분', ['참치캔', '밥', '마요네즈', '김', '간장'],
    STEP('참치캔 1개를 체에 밭쳐 기름을 빼요.',
      '팬에 간장 1큰술 + 설탕 1/2작은술을 넣고 약불에서 참치를 1분 볶아요.',
      '밥 200g 위에 참치를 올리고 마요네즈 1.5큰술, 김가루를 뿌려요.',
      '서한이 몫은 마요네즈 1작은술로 줄여요.')],
  ['김치전', '🥞', '집밥', '12분', ['김치', '부침가루', '김치국물'],
    STEP('김치 1컵을 송송 썰어요.',
      '부침가루 1컵 + 김치국물 4큰술 + 물 1/2컵을 넣어 되직하게 반죽해요.',
      '중불 팬에 기름 3큰술을 두르고 반죽을 펴 넣어 1분 30초 부쳐요.',
      '뒤집어 주걱으로 눌러가며 1분 30초 더 노릇하게 부쳐요.')],
  ['부대찌개', '🍲', '집밥', '25분', ['소시지', '김치', '라면사리', '두부', '고추장', '햄'],
    STEP('냄비에 고추장 1큰술 + 고춧가루 1큰술 + 간장 1큰술 + 다진마늘 1큰술 + 물 700ml를 넣고 풀어요.',
      '김치 1컵, 소시지 5개, 햄, 두부 1/2모를 넣고 센 불에서 끓여요.',
      '끓어오르면 중불로 줄여 10분 끓여 국물을 우려내요.',
      '라면사리 1개를 넣고 3분 더 끓여요(불기 전에 먹어야 쫄깃해요).',
      '대파를 올려 마무리해요.')],
  ['잡채', '🍜', '집밥', '30분', ['당면', '시금치', '당근', '양파', '간장', '참기름'],
    STEP('당면 100g을 끓는 물에 6분 삶아 찬물에 헹구고 간장 2큰술 + 참기름 1큰술 + 알룰로스 1큰술로 버무려요.',
      '시금치 1줌을 끓는 물에 30초 데쳐 찬물에 헹구고 물기를 짜 참기름·소금으로 무쳐요.',
      '당근 1/2개·양파 1개를 채썰어 각각 중불에서 2분씩 볶아요.',
      '모두 한 그릇에 합쳐 1분 볶으며 간을 맞추고 통깨를 뿌려요.')],
  ['오므라이스', '🍳', '집밥', '15분', ['밥', '계란', '양파', '당근', '케첩'],
    STEP('양파 1/2개·당근 1/3개·햄을 잘게 다져요.',
      '중불 팬에 기름 1큰술, 채소를 넣고 2분 볶다가 밥 200g + 케첩 3큰술을 넣고 2분 볶아요.',
      '계란 2개에 소금 1꼬집을 넣고 풀어 약불 팬에 1분 부쳐 반숙으로 익혀요.',
      '밥을 계란 위에 올리고 양쪽을 접어 감싼 뒤 뒤집어 담고 케첩을 뿌려요.')],
  ['순두부찌개', '🍲', '집밥', '15분', ['순두부', '계란', '대파', '고춧가루', '양파'],
    STEP('약불 팬에 기름 1큰술 + 고춧가루 1큰술을 넣고 30초 볶아 고추기름을 내요.',
      '물 400ml를 붓고 순두부 1봉을 숟가락으로 떠 넣어 중불에서 5분 끓여요.',
      '양파 1/2개, 대파를 넣고 1분 더 끓여요.',
      '계란 1개를 풀어 넣고 30초만 익혀 불을 꺼요.')],
  ['닭볶음탕', '🍗', '집밥', '35분', ['닭', '감자', '당근', '양파', '고추장', '간장'],
    STEP('닭 700g을 끓는 물에 2분 데쳐 씻어요(잡내 제거).',
      '냄비에 닭 + 물 500ml + 고추장 2큰술 + 간장 3큰술 + 설탕 1큰술 + 다진마늘 1큰술을 넣고 센 불에 올려요.',
      '끓어오르면 중불로 줄여 15분 끓여요.',
      '감자 2개·당근 1개·양파 1개를 큼직하게 썰어 넣고 10분 더 끓여요.',
      '센 불로 3분 졸여 국물을 농축하고 대파를 올려요.')],
  ['고등어조림', '🐟', '집밥', '25분', ['고등어', '무', '대파', '간장', '고춧가루'],
    STEP('무 1/4개를 1cm 두께로 썰어 냄비 바닥에 깔아요.',
      '손질한 고등어 2토막을 무 위에 올려요.',
      '간장 3큰술 + 고춧가루 2큰술 + 설탕 1큰술 + 다진마늘 1큰술 + 물 200ml를 섞어 붓고 중약불에서 15분 조려요.',
      '국물을 3번 끼얹어 위쪽까지 익히고 대파를 올려 마무리해요.')],
  ['감자수제비', '🥣', '집밥', '25분', ['감자', '밀가루', '애호박', '대파'],
    STEP('감자 2개를 삶아(약 15분) 뜨거울 때 으깨고 밀가루 1컵 + 소금 1꼬집과 섞어 반죽해요(치대지 않기).',
      '멸치육수 700ml(멸치 5마리 + 다시마 5cm, 10분)를 준비해 센 불에 올려요.',
      '반죽을 손가락으로 떼어 넣고 5분 끓여요.',
      '애호박 1/3개와 대파를 넣고 2분 더 끓여 국간장 1큰술로 간해요.')],
  ['소고기무국', '🍲', '집밥', '25분', ['소고기', '무', '대파', '국간장'],
    STEP('소고기 200g을 한입 크기로 썰고 참기름 1큰술과 함께 중불에서 3분 볶아요.',
      '무 1/4개를 나박썰기해 넣고 3분 볶아요.',
      '물 800ml를 부어 센 불에서 끓인 뒤 중불에서 15분 끓여요.',
      '국간장 2큰술 + 다진마늘 1/2작은술 + 대파를 넣고 2분 끓여 마무리해요.')],
  ['야채죽', '🍚', '유아식', '15분', ['밥', '당근', '애호박', '계란', '참기름'],
    STEP('밥 100g + 물 600ml를 센 불에 올려 끓어오르면 중불에서 8분 저어가며 끓여요.',
      '당근 1/4개·애호박 1/3개를 아주 잘게 다져 넣고 3분 더 끓여요.',
      '계란을 풀어 넣고 30초 저어 익혀요.',
      '참기름 1/2작은술, 소금 1꼬집으로 간해요.')],
  ['두부조림', '⬜', '유아식', '12분', ['두부', '간장', '대파', '마늘'],
    STEP('두부 1모를 1.2cm 두께로 썰어 키친타올로 5분 눌러 물기를 빼요.',
      '중불 팬에 기름 2큰술, 두부를 앞뒤 2분씩 지져요.',
      '간장 2큰술 + 물 3큰술 + 다진마늘 1/2작은술 + 대파 + 고춧가루 1/2작은술을 섞어 붓고 약불에서 3분 조려요.',
      '국물을 끼얹어 마무리하고 통깨를 뿌려요.')],
  ['소고기애호박볶음', '🥒', '유아식', '12분', ['소고기', '애호박', '양파', '간장'],
    STEP('다진 소고기 100g을 중불 팬에 넣고 2분 볶아요.',
      '애호박 1/2개, 양파 1/2개를 잘게 썰어 넣고 2분 볶아요.',
      '간장 1/2큰술 + 참기름 1/2작은술로 간해요(아이 몫은 싱겁게).')],
  ['감자당근볶음', '🥕', '유아식', '15분', ['감자', '당근', '양파', '참기름'],
    STEP('감자 2개·당근 1개를 채썰어 물에 5분 담갔다 건져요.',
      '중불 팬에 기름 1큰술, 감자·당근을 넣고 3분 볶아요.',
      '물 3큰술을 넣고 뚜껑을 덮어 약불에서 5분 푹 익혀요.',
      '참기름 1/2큰술, 소금 1꼬집으로 마무리해요.')]
].map((r, i) => ({ id: 'rc' + (i + 1), name: r[0], emoji: r[1], kind: r[2], time: r[3], ings: r[4], steps: r[5] })));

/* ---------------- 자주 사는 것 ---------------- */
const FREQ = [
  ['우유', 'food'], ['계란', 'food'], ['김치', 'food'], ['두부', 'food'], ['대파', 'food'],
  ['양파', 'food'], ['당근', 'food'], ['감자', 'food'], ['사과', 'food'], ['바나나', 'food'],
  ['물티슈', 'living'], ['키친타올', 'living'], ['휴지', 'living'], ['세탁세제', 'living'],
  ['주방세제', 'living'], ['봉지', 'living'], ['샴푸', 'living'], ['치약', 'living']
];

/* ---------------- 재료 이름 매칭 (부분 일치) ---------------- */
const SYN_PAIRS = [
  ['닭', '닭고기'], ['닭고기', '닭다리살'], ['닭고기', '닭가슴살'], ['닭', '닭다리살'], ['닭', '닭정육'],
  ['소고기', '쇠고기'], ['소고기', '다짐육'], ['돼지고기', '다짐육'], ['돼지고기', '목살'],
  ['돼지고기', '앞다리살'], ['돼지고기', '삼겹살'], ['돼지고기', '돈육'],
  ['김', '김가루'], ['김', '김자반'], ['밥', '공기밥'], ['밥', '쌀밥'],
  ['면', '우동면'], ['면', '스파게티면'], ['파스타', '스파게티면'], ['파스타', '스파게티'],
  ['우유', '생크림'], ['치즈', '모짜렐라치즈'], ['치즈', '파마산치즈'], ['두부', '순두부'],
  ['멸치', '잔멸치'], ['카레', '카레가루'], ['김치', '김치국물'], ['고추장', '쌈장'], ['간장', '국간장'], ['간장', '진간장'],
  ['무', '무우'], ['계란', '달걀'], ['파', '대파'], ['버섯', '팽이버섯'], ['버섯', '표고버섯'], ['고추', '청양고추'], ['양념', '소스']
];
const MATCH_GROUP = (function () {
  const parent = {};
  const find = a => { while (parent[a] && parent[a] !== a) a = parent[a]; return a; };
  SYN_PAIRS.forEach(([a, b]) => {
    const na = norm(a), nb = norm(b);
    parent[na] = parent[na] || na; parent[nb] = parent[nb] || nb;
    const ra = find(na), rb = find(nb);
    if (ra !== rb) parent[rb] = ra;
  });
  const out = {};
  Object.keys(parent).forEach(k => { out[k] = find(k); });
  return out;
})();
function canonOf(s) { const n = norm(s); return MATCH_GROUP[n] || n; }
function keyOf(name) {
  const parts = String(name || '').toLowerCase().split(/[\s\-_·,()[\]\/]+/).filter(Boolean);
  return parts[0] || '';
}
/* ---------------- 재료 이름 매칭 (구분자 단위 · 완제품 분리) ----------------
   ① 같은 이름 · 동의어(SYN_PAIRS)  — 순두부 ↔ 두부
   ② 구분자(-, 공백, 괄호) 단위 조각 일치 — 돼지고기-목살 ↔ 돼지고기, 소고기(국거리) ↔ 소고기
   ③ 수식어만 다른 이름 — 냉동만두 ↔ 만두, 다진마늘 ↔ 마늘
   ④ 앞뒤로만 늘어난 이름 — 소고기국거리 ↔ 소고기, 포기김치 ↔ 김치
   ⑤ 완제품·밀키트는 통째로 한 품목이라 그 안의 원재료로 치지 않는다
      (냉동김치전 ≠ 김치, 고구마스프 ≠ 고구마). 레시피가 그 완제품 이름 자체를 원할 때만 매칭.
   ------------------------------------------------------------------ */
const MATCH_MODS = ['냉동','냉장','국산','국내산','수입','미국산','호주산','캐나다산','한우','한돈','다진','손질','자연산','친환경','유기농','무항생제','1등급','가공','슬라이스','훈제','완제품','즉석'];
/* 이름 어디에 있어도 완제품으로 보는 말 */
const DISH_SUB = ['볶음밥','떡볶이','김치전','부추전','감자전','해물파전','파전','부침개','전골','볶음','무침','조림','구이','찜닭','찜','짜장','찌개','덮밥','김밥','떡국','갈비탕','삼계탕','육개장','감자탕','탕수육','돈까스','돈가스','까스','튀김','핫도그','너겟','피자','함박','커틀릿','미트볼','그라탕','스테이크','샐러드','순대','족발','보쌈','밀키트','간편식','반찬','도시락','장조림','강정','스프','소스','만두','어묵','와플','쥬스','주스','음료','젓'];
/* 이름 끝에 오면 완제품으로 보는 말 (전·국·탕처럼 짧아서 아무 데나 걸면 안 되는 것) */
const DISH_TAIL = ['전','국','탕','죽','찌개','볶음','무침','조림','구이','찜','덮밥','떡국'];
/* 완제품 자체가 레시피 재료일 때(만두·소스·어묵)는 그 완제품을 그대로 봐준다 */
const DISH_OWN = ['만두','어묵','소스','스프','핫도그','너겟','떡','떡볶이','김밥','피자','돈까스','돈가스','짜장','탕','국','밥','쥬스','주스','음료','볶음','무침','조림','찜','와플','샐러드','순대','족발','보쌈','김치전','부추전','파전','해물파전','감자전'];
/* 한 글자 재료라도 이름 끝에 붙으면 재료로 봐주는 말 — 소면·즉석밥·찹쌀 */
const ONE_TAIL_OK = ['밥','면','닭','햄','김','쌀','콩','팥','떡','밤'];
function stripMods(n) {
  let s = n;
  for (let g = 0; g < 4; g++) {
    let cut = false;
    for (let i = 0; i < MATCH_MODS.length; i++) {
      const m = MATCH_MODS[i];
      if (s.length > m.length && s.indexOf(m) === 0) { s = s.slice(m.length); cut = true; break; }
    }
    if (!cut) break;
  }
  return s;
}
function modsOnly(s) { return !!s && stripMods(s) === ''; }
function isDishName(name) {
  const n = stripMods(norm(name));
  if (!n) return false;
  for (let i = 0; i < DISH_TAIL.length; i++) { const t = DISH_TAIL[i]; if (n.length > t.length && n.slice(-t.length) === t) return true; }
  for (let i = 0; i < DISH_SUB.length; i++) if (n.indexOf(DISH_SUB[i]) >= 0) return true;
  return false;
}
function tokensOf(name) {
  return String(name || '').toLowerCase().split(/[\s\-_·,()[\]\/]+/).map(s => norm(s)).filter(Boolean);
}
function candsOf(name) {
  const out = [];
  const push = v => { if (v && out.indexOf(v) < 0) out.push(v); };
  push(norm(name));
  tokensOf(name).forEach(t => { push(t); push(stripMods(t)); });
  push(stripMods(norm(name)));
  return out;
}
/* ing 가 cand 의 앞이나 뒤에만 붙은 경우 — 완제품 통짜면 원재료로 치지 않는다 */
function containHit(ing, cand) {
  const a = norm(ing), b = norm(cand);
  if (!a || !b) return false;
  if (a === b) return true;
  const atStart = b.length > a.length && b.indexOf(a) === 0;
  const atEnd = b.length > a.length && b.slice(-a.length) === a;
  /* 한 글자 재료(밥·면·김)는 이름 끝에 붙는 몇 가지 경우만 — 김치 안의 '김', 콩나물 안의 '물' 같은 오매칭을 막는다 */
  if (a.length < 2) {
    if (!atEnd || ONE_TAIL_OK.indexOf(a) < 0) return false;
  } else if (!atStart && !atEnd) return false;
  if (!isDishName(b)) return true;                                    // 소고기국거리 · 포기김치
  const rest = atStart ? b.slice(a.length) : b.slice(0, b.length - a.length);
  if (modsOnly(rest)) return true;                                    // 냉동만두 · 즉석밥
  if (atEnd && DISH_OWN.indexOf(a) >= 0 && !isDishName(rest)) return true;   // 김치만두 · 라구소스 · 치킨너겟
  return false;                                                       // 냉동김치전 ≠ 김치
}
function ownedKeys(items) {
  return (items || []).map(it => {
    const n = norm(it.name), k = norm(keyOf(it.name));
    return { name: it.name, n, k, c: canonOf(it.name), kc: canonOf(keyOf(it.name)), toks: tokensOf(it.name), cands: candsOf(it.name) };
  });
}
function nameMatches(ingName, owned) {
  const inN = norm(ingName);
  if (!inN) return false;
  const inC = canonOf(ingName), inToks = tokensOf(ingName), inCands = candsOf(ingName);
  for (let i = 0; i < owned.length; i++) {
    const o = owned[i];
    /* ① 같은 이름 · 동의어 */
    if (o.n === inN || o.c === inC) return true;
    /* ② 구분자 조각 일치 */
    if (o.toks.indexOf(inN) >= 0 || inToks.indexOf(o.n) >= 0) return true;
    if (o.toks.some(t => canonOf(t) === inC) || inToks.some(t => canonOf(t) === o.c)) return true;
    /* ③ 수식어만 다른 이름 */
    if (o.cands.indexOf(inN) >= 0 || inCands.indexOf(o.n) >= 0) return true;
    /* ④ 앞뒤로만 늘어난 이름 (완제품은 통째로) */
    for (let j = 0; j < o.cands.length; j++) if (containHit(inN, o.cands[j])) return true;
    for (let j = 0; j < inCands.length; j++) if (containHit(o.n, inCands[j])) return true;
  }
  return false;
}
/* ============================================================
   🏡 우리집 살림 관제소  —  3-app.js
   상태 · 마이그레이션 · 동기화 · 화면 · 동작
   ============================================================ */

/* ---------------- state ---------------- */
let ROOM = (function () {
  let r = new URLSearchParams(location.search).get('room');
  if (!r || !/^[A-Za-z0-9_-]{6,64}$/.test(r)) r = DEFAULT_ROOM;
  return r;
})();
const LSKEY = 'seohan-home-v3:' + ROOM;   // 기존 기기 데이터를 그대로 살리기 위해 키는 유지
let state = null;
let ui = { tab: 'today', filter: 'all', showAllRec: false, recQ: '', recKind: 'all', pantryQ: '', receipt: null };
let migrated = false;

function allRecipes() {
  return (state && Array.isArray(state.recipes) ? state.recipes : []).concat(RECIPES);
}

/* ---------------- 재고 수량 모델 ---------------- */
function isNum(it) { return !!(it && it.useCount); }
function stockCount(it) { const c = Number(it && it.count); return Number.isFinite(c) ? Math.max(0, Math.round(c)) : 0; }
function stockMax(it) { const m = Number(it && it.max); return Number.isFinite(m) && m > 0 ? Math.round(m) : 10; }
function levelFromCount(c) { return c <= 0 ? 'none' : (c <= 5 ? 'low' : 'enough'); }
function stockLevel(it) { if (!it) return 'enough'; return isNum(it) ? levelFromCount(stockCount(it)) : (it.level || 'enough'); }
function countFromLevel(l) { return l === 'none' ? 0 : (l === 'low' ? 2 : 6); }

/* ---------------- migration (이름 기반 자동 분류 · 칫솔 2종 · 수량 관리) ---------------- */
function migrate(st) {
  let ch = false;
  // 1) 주기 케어 칫솔 2종
  const old = st.care.find(c => norm(c.name) === norm('아이 칫솔') || norm(c.name) === norm('아이칫솔'));
  if (old) { old.name = '서한이 칫솔'; old.days = 30; old.stock = '서한이 칫솔'; ch = true; }
  [['서한이 칫솔', 30], ['어른 칫솔', 90]].forEach(function (pair) {
    const nm = pair[0], days = pair[1];
    const hit = st.care.find(c => norm(c.name) === norm(nm));
    if (!hit) {
      st.care.push({ id: uid('c'), emoji: '🪥', name: nm, days: days, last: todayISO(), ord: 30 + st.care.length, stock: nm });
      ch = true;
    } else if (!hit.stock) { hit.stock = nm; ch = true; }
  });
  // 2) 칫솔 재고(수량) — 주기 케어 완료 시 -1 차감
  [['서한이 칫솔', 3], ['어른 칫솔', 2]].forEach(function (pair) {
    const nm = pair[0], n = pair[1];
    const hit = st.stock.find(x => norm(x.name) === norm(nm));
    if (!hit) {
      st.stock.push({ id: uid('k'), emoji: '🪥', name: nm, level: levelFromCount(n), ord: 90 + st.stock.length, useCount: true, count: n, max: 5 });
      ch = true;
    } else if (!isNum(hit)) {
      hit.useCount = true; hit.count = n; hit.max = 5; hit.level = levelFromCount(n); ch = true;
    }
  });
  // 3) 대량 소모품은 숫자 카운터로
  st.stock.forEach(s => {
    if (!isNum(s) && /(휴지|물티슈|키친타올|봉지|마스크|기저귀|칫솔)/.test(String(s.name))) {
      s.useCount = true; s.max = Math.max(1, Number(s.max) || 10);
      s.count = countFromLevel(s.level || 'enough'); ch = true;
    }
  });
  // 4) 예전 기본 이모지(🧴)로 굳은 품목을 이름에 맞는 이모지로 교체
  st.pantry.concat(st.stock).forEach(it => {
    if (!it.emoji) { it.emoji = guessEmoji(it.name); ch = true; }
    else if (it.emoji === '🧴') {
      const g = guessEmoji(it.name);
      if (g !== '🧴') { it.emoji = g; ch = true; }
    }
  });
  st.v = STATE_VERSION;
  return ch;
}

function normalize(st, skipMigrate) {
  if (!st || typeof st !== 'object') return null;
  st.settings = Object.assign({}, DEFAULT_SETTINGS, st.settings || {});
  st.settings.trash = Object.assign({}, DEFAULT_SETTINGS.trash, st.settings.trash || {});
  st.mode = st.mode === 'office' ? 'office' : 'home';
  if (!st.checks || typeof st.checks !== 'object') st.checks = {};
  LISTS.forEach(k => {
    if (!Array.isArray(st[k])) st[k] = [];
    st[k] = st[k].filter(x => x && typeof x === 'object' && x.id);
    st[k].sort((a, b) => (a.ord == null ? 0 : a.ord) - (b.ord == null ? 0 : b.ord));
  });
  st.pantry.forEach(p => {
    if (!p.zone || !ZONE_MAP[p.zone]) p.zone = inferZone(p.name);
    if (!p.emoji) p.emoji = guessEmoji(p.name);
    if (p.sub && !SUB_MAP[p.sub]) delete p.sub;
  });
  if (!st.memo || typeof st.memo !== 'object' || Array.isArray(st.memo)) st.memo = {};
  st.stock.forEach(s => {
    if (!s.emoji) s.emoji = guessEmoji(s.name);
    if (!s.level) s.level = 'enough';
    if (isNum(s) && !Number.isFinite(Number(s.count))) s.count = countFromLevel(s.level);
  });
  if (!skipMigrate && migrate(st)) migrated = true;
  if (st.day !== todayISO()) { st.day = todayISO(); st.checks = {}; }
  return st;
}
function loadLocal() {
  try {
    const raw = localStorage.getItem(LSKEY);
    if (raw) { const s = normalize(JSON.parse(raw)); if (s) return s; }
  } catch (e) { }
  return null;
}
function saveLocal() { try { localStorage.setItem(LSKEY, JSON.stringify(state)); } catch (e) { } }

/* ---------------- sync (Firebase RTDB REST + 실시간 스트림) ----------------
   - 로컬 변경 → 0.45초 뒤 PATCH (바뀐 잎사귀만)
   - 남의 변경 → 스트림 이벤트를 받고 전체 문서를 다시 읽어 통째로 반영
   ------------------------------------------------------------------ */
const SPATH = '/rooms/' + encodeURIComponent(ROOM) + '/state';
let remoteDoc = null, baseRemote = null, es = null, lastPush = null;
let dirty = false, pushTimer = null, refetchTimer = null, needRefetch = false, syncState = 'off';
const DBG = [];
function dbg(tag, v) { DBG.push([new Date().toISOString().slice(11, 23), tag, v]); if (DBG.length > 200) DBG.shift(); }

function copy(v) { return JSON.parse(JSON.stringify(v)); }
function remoteShape(st) {
  const o = { mode: st.mode, day: st.day, checks: copy(st.checks || {}), settings: copy(st.settings || {}), memo: copy(st.memo || {}) };
  LISTS.forEach(k => { const m = {}; (st[k] || []).forEach(it => { m[it.id] = copy(it); }); o[k] = m; });
  return o;
}
function localShape(r) {
  if (!r || typeof r !== 'object') return null;
  const st = { mode: r.mode, day: r.day, checks: r.checks || {}, settings: r.settings || {}, memo: (r.memo && typeof r.memo === 'object' && !Array.isArray(r.memo)) ? r.memo : {} };
  LISTS.forEach(k => {
    const v = r[k];
    let arr = [];
    if (Array.isArray(v)) arr = v.slice();
    else if (v && typeof v === 'object') arr = Object.keys(v).map(x => v[x]);
    st[k] = arr.filter(x => x && typeof x === 'object');
  });
  return st;
}
function flatten(o, p, out) {
  out = out || {}; p = p || '';
  if (o === null || typeof o !== 'object') { if (p) out[p] = o; return out; }
  Object.keys(o).forEach(k => {
    const v = o[k], q = p ? p + '/' + k : k;
    if (v !== null && typeof v === 'object') flatten(v, q, out); else out[q] = v;
  });
  return out;
}
function applyLeaves(base, patch) {
  const b = copy(base || {});
  Object.keys(patch).forEach(p => {
    const parts = p.split('/');
    let c = b;
    for (let i = 0; i < parts.length - 1; i++) {
      const s = parts[i];
      if (!c[s] || typeof c[s] !== 'object' || Array.isArray(c[s])) c[s] = {};
      c = c[s];
    }
    const last = parts[parts.length - 1];
    if (patch[p] === null) delete c[last]; else c[last] = patch[p];
  });
  return b;
}
function hasDiff() { return Object.keys(buildPatch()).length > 0; }
function buildPatch() {
  const cur = flatten(remoteShape(state));
  const base = flatten(baseRemote || {});
  const patch = {};
  Object.keys(cur).forEach(k => { if (JSON.stringify(cur[k]) !== JSON.stringify(base[k])) patch[k] = cur[k]; });
  Object.keys(base).forEach(k => { if (!(k in cur)) patch[k] = null; });
  return patch;
}
function docIsEmpty(d) { return !d || typeof d !== 'object' || !Object.keys(d).length; }
function setSync(s, msg) {
  syncState = s;
  const dot = $('#syncDot'), txt = $('#syncTxt'), foot = $('#footSync'), fdot = $('#footDot');
  const cls = s === 'ok' ? '' : (s === 'busy' ? 'warn' : 'off');
  const label = s === 'ok' ? '🔄 남편과 동기화' : (s === 'busy' ? '저장 중…' : '오프라인 저장');
  const footTxt = s === 'ok' ? '바꾸면 남편 화면에도 바로 반영' : (s === 'busy' ? '남편 화면으로 보내는 중…' : '이 기기에만 저장 중 (연결되면 자동 반영)');
  if (dot) dot.className = 'sdot ' + cls;
  if (fdot) fdot.className = 'sdot ' + cls;
  if (txt) txt.textContent = label;
  if (foot) foot.textContent = msg || footTxt;
}
function schedulePush() {
  dirty = true; setSync('busy');
  try { localStorage.setItem(LSKEY + ':pending', '1'); } catch (e) { }
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, 450);
}
async function push() {
  // 방을 아직 한 번도 못 읽었으면(방이 비었는지 모르면) 밀지 않는다 — 남의 데이터를 덮을 수 있다
  if (baseRemote === null) { scheduleRefetch(200); return; }
  const patch = buildPatch();
  lastPush = { keys: Object.keys(patch), status: null };
  dbg('push', Object.keys(patch).length + ' keys');
  if (!Object.keys(patch).length) { dirty = false; setSync('ok'); return; }
  try {
    const r = await fetch(DBURL + SPATH + '.json', {
      // RTDB REST PATCH는 중첩 객체를 통째로 교체하므로, 'a/b/c' 형태의 다중 경로 키로 보낸다
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    lastPush.status = r.status;
    baseRemote = applyLeaves(baseRemote, patch);
    dirty = hasDiff();
    try { localStorage.removeItem(LSKEY + ':pending'); } catch (e) { }
    setSync(dirty ? 'busy' : 'ok');
    if (dirty) schedulePush();
    if (needRefetch) { needRefetch = false; scheduleRefetch(80); }
  } catch (e) {
    setSync('off');
    dirty = true;
    clearTimeout(pushTimer); pushTimer = setTimeout(push, 4000);
  }
}
function scheduleRefetch(delay) {
  clearTimeout(refetchTimer);
  refetchTimer = setTimeout(fetchState, delay == null ? 120 : delay);
}
async function fetchState() {
  try {
    const r = await fetch(DBURL + SPATH + '.json', { cache: 'no-store' });
    if (!r.ok) { setSync('off'); return; }
    const doc = await r.json();
    if (docIsEmpty(doc)) {
      remoteDoc = null; baseRemote = {};
      if (state && (state.routines || []).length) { schedulePush(); }
      setSync(dirty ? 'busy' : 'ok');
      return;
    }
    if (dirty) { needRefetch = true; setSync('busy'); return; }
    remoteDoc = doc;
    applyRemote(doc);
    setSync('ok');
  } catch (e) { setSync('off'); }
}
function applyRemote(doc) {
  const raw = localShape(doc);
  if (!raw) return;
  baseRemote = remoteShape(localShape(copy(doc)));   // 서버에 실제로 있는 그대로가 기준선(마이그레이션 전)
  migrated = false;
  const st = normalize(raw);
  const same = JSON.stringify(st) === JSON.stringify(state);
  dbg('apply', 'r' + st.routines.length + ' p' + st.pantry.length + ' k' + st.stock.length);
  state = st; saveLocal();
  if (!same) render();
  if (hasDiff()) schedulePush();   // 구역·칫솔·수량 등 새 구조를 남편 폰에도 반영
}
function openStream() {
  if (!('EventSource' in window)) { scheduleRefetch(3000); return; }
  try {
    if (es) es.close();
    es = new EventSource(DBURL + SPATH + '.json');
    ['put', 'patch'].forEach(t => es.addEventListener(t, e => onStream(t)));
    es.onopen = () => { setSync(dirty ? 'busy' : 'ok'); };
    es.onerror = () => { setSync('off'); scheduleRefetch(4000); };
  } catch (e) { setSync('off'); scheduleRefetch(4000); }
}
function onStream(type) {
  if (dirty) { needRefetch = true; return; }
  scheduleRefetch(120);
}
async function initSync() {
  await fetchState();               // 먼저 방을 읽는다 (읽기 전에는 아무것도 밀지 않는다)
  if (dirty) schedulePush();
  try { if (!dirty) localStorage.removeItem(LSKEY + ':pending'); } catch (e) { }
  openStream();
  window.addEventListener('online', () => { if (dirty) push(); else scheduleRefetch(300); openStream(); });
  window.addEventListener('offline', () => setSync('off'));
}

/* ---------------- mutate ---------------- */
function mutate(fn, opts) {
  fn(state);
  saveLocal();
  render();
  if (!(opts && opts.quiet)) schedulePush();
}
function shareLink() { return location.origin + location.pathname + '?room=' + encodeURIComponent(ROOM); }
function copyText(txt) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(txt).catch(() => fallbackCopy(txt));
  }
  return Promise.resolve(fallbackCopy(txt));
}
function fallbackCopy(txt) {
  try {
    const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  } catch (e) { }
}

/* ---------------- care helpers ---------------- */
function careDue(it) {
  const last = it.last || addDays(todayISO(), -it.days);
  const next = addDays(last, Number(it.days) || 1);
  return { last, next, d: diffDays(todayISO(), next) };
}
function dueLabel(d) { return d < 0 ? 'D+' + (-d) : (d === 0 ? 'D-DAY' : 'D-' + d); }
function dueCls(d) { return d < 0 ? 'bad' : (d <= 2 ? 'mid' : 'ok'); }

/* ---------------- 장보기 완료 → 냉장고 · 재고로 ---------------- */
function putPantryFromShopping(s, name) {
  const exist = s.pantry.find(p => norm(p.name) === norm(name));
  if (exist) { exist.zone = exist.zone || inferZone(exist.name); return { msg: '이미 냉장고에 있어요', zone: exist.zone }; }
  const zone = inferZone(name);
  s.pantry.push({ id: uid('p'), name: name, emoji: guessEmoji(name), zone: zone, exp: '', ord: Date.now() % 100000 });
  return { msg: zoneLabel(zone) + '에 넣었어요', zone: zone };
}
function putBackStock(s, name) {
  const it = s.stock.find(x => norm(x.name) === norm(name));
  if (it) {
    if (isNum(it)) { it.count = stockMax(it); it.level = levelFromCount(it.count); return { msg: it.name + ' ' + it.count + '개로 채웠어요' }; }
    it.level = 'enough';
    return { msg: it.name + ' 재고를 충분으로 바꿨어요' };
  }
  const level = 'enough';
  s.stock.push({ id: uid('k'), emoji: guessEmoji(name), name: name, level: level, ord: Date.now() % 100000 });
  return { msg: name + ' 재고에 새로 넣었어요' };
}
/* 주기 케어 완료 → 연결된 재고 -1 */
function useLinkedStock(s, careItem) {
  if (!careItem || !careItem.stock) return null;
  const it = s.stock.find(x => norm(x.name) === norm(careItem.stock));
  if (!it) return null;
  if (isNum(it)) {
    it.count = Math.max(0, stockCount(it) - 1);
    it.level = levelFromCount(it.count);
    return { name: it.name, left: it.count };
  }
  it.level = it.level === 'enough' ? 'low' : 'none';
  return { name: it.name, left: null };
}

/* ---------------- render : header ---------------- */
function curWd() { return new Date().getDay(); }

function renderHeader() {
  const d = new Date(), wd = d.getDay(), rh = RHYTHM[wd];
  $('#dateLine').innerHTML = d.getMonth() + 1 + '월 ' + d.getDate() + '일 ' + WD[wd] + '요일 <span class="tagday">' + esc(rh.em) + ' · ' + esc(rh.sub) + '</span>';
  $$('#modeSwitch .seg').forEach(b => {
    const on = b.dataset.mode === state.mode;
    b.classList.toggle('on', on);
    b.classList.toggle('office', on && b.dataset.mode === 'office');
  });
}

/* ---------------- render : alerts ---------------- */
function renderAlerts() {
  const box = $('#alerts');
  const out = [];
  const none = state.stock.filter(s => stockLevel(s) === 'none');
  const lowNum = state.stock.filter(s => isNum(s) && stockCount(s) > 0 && stockCount(s) <= 1);
  if (none.length) {
    out.push({
      cls: '', ic: '🔴', title: '다 떨어진 생필품 ' + none.length + '개',
      sub: none.slice(0, 3).map(s => s.name).join(' · ') + (none.length > 3 ? ' 외' : '') +
        (lowNum.length ? ' · 곧: ' + lowNum.slice(0, 2).map(s => s.name + ' ' + stockCount(s) + '개').join(' · ') : ''),
      btn: { label: '구매리스트 →', act: 'alertstock' }
    });
  } else if (lowNum.length) {
    out.push({
      cls: 'warm', ic: '⚠️', title: '곧 떨어져요',
      sub: lowNum.slice(0, 3).map(s => s.name + ' ' + stockCount(s) + '개').join(' · '),
      btn: { label: '구매리스트 →', act: 'alertstock' }
    });
  }
  const tr = state.settings.trash || {};
  const trashAlerts = [];
  if (tr.on) {
    if (Number(tr.trashDay) === curWd()) trashAlerts.push({ cls: 'warm', ic: '🗑️', title: '오늘 쓰레기 내놓는 날', sub: '설정에서 켜 둔 요일 알림', btn: null });
    if (Number(tr.recyDay) === curWd()) trashAlerts.push({ cls: 'warm', ic: '♻️', title: '오늘 재활용 내놓는 날', sub: '헹궈서 분리수거', btn: null });
  }
  const dues = state.care.map(c => Object.assign({ c }, careDue(c))).filter(x => x.d <= 2).sort((a, b) => a.d - b.d);
  dues.slice(0, trashAlerts.length ? 1 : 2).forEach(x => {
    out.push({
      cls: x.d < 0 ? '' : 'warm', ic: x.c.emoji,
      title: x.c.name + ' ' + (x.d < 0 ? 'D+' + (-x.d) + ' 지남!' : (x.d === 0 ? '오늘까지!' : 'D-' + x.d)),
      sub: x.c.days + '일 주기 · ' + md(x.next) + (x.d < 0 ? ' 예정' : ' 까지'),
      btn: { label: x.d < 0 ? '교체 완료 ✅' : '완료 ✅', act: 'carecomplete', id: x.c.id }
    });
  });
  trashAlerts.forEach(a => out.push(a));
  if (!out.length) {
    out.push({ cls: 'calm', ic: '✅', title: '오늘은 긴급한 게 없어요', sub: '생필품 · 주기 케어 모두 여유', btn: null });
  }
  box.innerHTML = out.slice(0, 3).map(a =>
    '<div class="alert ' + a.cls + '"><div class="aic">' + a.ic + '</div>' +
    '<div class="atxt"><b>' + esc(a.title) + '</b><small>' + esc(a.sub) + '</small></div>' +
    (a.btn ? '<button class="abtn" data-act="' + a.btn.act + '"' + (a.btn.id ? ' data-id="' + a.btn.id + '"' : '') + '>' + esc(a.btn.label) + '</button>' : '') +
    '</div>'
  ).join('');
}

/* ---------------- render : today ---------------- */
function visibleSteps(slot) {
  const wd = curWd();
  return state.routines
    .filter(r => r.slot === slot)
    .sort((a, b) => (a.ord || 0) - (b.ord || 0))
    .filter(r => {
      const c = r.cond || 'all';
      if (c === 'home') return state.mode === 'home';
      if (c === 'office') return state.mode === 'office';
      if (c === 'day') return (r.days || []).map(Number).indexOf(wd) >= 0;
      return true;
    });
}
function stepHTML(r) {
  const done = !!state.checks[r.id];
  const only = r.cond === 'office' ? '출근일만' : (r.cond === 'home' ? '재택일만' : (r.cond === 'day' ? (r.days || []).map(d => WD[Number(d)]).join('·') : ''));
  return '<li class="step ' + (done ? 'done ' : '') + (r.key ? 'key' : '') + '" data-act="toggle" data-id="' + r.id + '">' +
    '<span class="tm">' + esc(r.time || '') + '</span><span class="dot"></span>' +
    '<span class="body"><span class="tx">' + esc(r.text) + '</span>' +
    (only ? '<span class="only">' + esc(only) + '</span>' : '') +
    (r.sub ? '<span class="sub">' + esc(r.sub) + '</span>' : '') +
    '</span><span class="tick">' + (done ? '✓' : '') + '</span></li>';
}
function renderToday() {
  const wd = curWd(), rh = RHYTHM[wd];
  const weekend = (wd === 0 || wd === 6);
  const dayHead = $('#todayH');
  if (dayHead) dayHead.textContent = weekend ? '주말 — 집안일은 쉬어요' : '오늘의 집안일';
  $('#todayChip').textContent = WD[wd] + '요일 · ' + (weekend ? '주말' : (state.mode === 'home' ? '재택' : '출근'));

  $('#week').innerHTML = [1, 2, 3, 4, 5, 6, 0].map(d => {
    const r = RHYTHM[d];
    const cls = ['wd', r.hot ? 'hot' : '', r.hot2 ? 'hot2' : '', d === wd ? 'today' : ''].filter(Boolean).join(' ');
    return '<div class="' + cls + '"><div class="d">' + WD[d] + '</div><div class="n"><em>' + esc(r.em) + '</em><br>' + esc(r.sub) + '</div></div>';
  }).join('');

  const tasks = (rh.tasks || []);
  $('#dayTasks').innerHTML = tasks.map((t, i) => {
    const k = 't' + i, done = !!state.checks[k];
    return '<button class="dtask ' + (done ? 'done' : '') + '" data-act="toggle" data-id="' + k + '">' + (done ? '✓ ' : '') + esc(t) + '</button>';
  }).join('');

  /* ---- 토·일 : 평일 루틴을 돌리지 않고 휴식 카드 + 자유 메모로 전환 ---- */
  if (weekend) {
    const memo = (state.memo || {})[todayISO()] || '';
    const tk = $('#talks');
    tk.classList.add('single');
    tk.innerHTML =
      '<div class="tl rest">' +
      '<div class="tl-h"><span class="e">🌿</span><b>주말은 루틴 쉬어가요</b><span class="st done">쉬는 날</span></div>' +
      '<div class="rest-box"><p class="rest-p"><b>토·일</b>에는 평일 아침·저녁 집안일 루틴이 자동으로 멈춰요. <b>월요일</b>에 다시 돌아옵니다.</p>' +
      '<p class="rest-p2">급한 것만 주기 케어에서 챙기고, 오늘은 아이랑 폭 쉬어요 🧸</p></div>' +
      '<div class="memo"><label for="weekendMemo">📝 주말 메모 <span>장 볼 것 · 기억할 일</span></label>' +
      '<textarea id="weekendMemo" rows="3" placeholder="예: 내일 아침 우유 사기 / 서한이 놀이터 데려가기">' + esc(memo) + '</textarea>' +
      '<div class="memo-hint">적는 대로 자동 저장 — 남편 화면에도 같이 보여요</div></div>' +
      '</div>';
    const doneT = tasks.filter((t, i) => state.checks['t' + i]).length;
    $('#todayNum').textContent = '🌿 쉬는 날' + (tasks.length ? ' · 선택 ' + doneT + '/' + tasks.length : '');
    $('#todayBar').style.width = (tasks.length ? Math.round(doneT / tasks.length * 100) : 0) + '%';
    const remCare0 = state.care.filter(c => careDue(c).d <= 2).length;
    $('#footToday').innerHTML = '🌿 주말 — 루틴은 쉽니다 · 주기 케어 <b>' + remCare0 + '개</b>만 챙기면 돼요';
    return;
  }
  $('#talks').classList.remove('single');

  const am = visibleSteps('am'), pm = visibleSteps('pm');
  const amDone = am.filter(r => state.checks[r.id]).length;
  const pmDone = pm.filter(r => state.checks[r.id]).length;

  const hiddenOffice = state.mode === 'home' ? state.routines.filter(r => r.slot === 'am' && r.cond === 'office') : [];
  const hiddenHome = state.mode === 'office' ? state.routines.filter(r => r.slot === 'am' && r.cond === 'home') : [];
  let note = '';
  if (hiddenOffice.length) note = '🏠 재택이라 <b>출근 전용 루틴</b>(' + hiddenOffice.map(r => esc(r.text)).join(' · ') + ')은 건너뛰었어요 — <b>출근</b>으로 바꾸면 자동으로 끼어들어요';
  else if (hiddenHome.length) note = '🏢 출근이라 <b>' + hiddenHome.map(r => esc(r.text)).join(' · ') + '</b>는 숨겼어요 — <b>재택</b>으로 바꾸면 다시 나와요';
  else note = '오늘은 <b>' + esc(rh.em) + '</b> — ' + esc(rh.sub);

  const hr = new Date().getHours();
  const nextTxt = hr < 15 ? '🌙 다음은 저녁 루틴' : '🌙 오늘 저녁 루틴';
  const nextSub = pm.length ? (pm.length - pmDone) + '개 남음 · 18:00 시작' : '저녁 루틴 없음';

  $('#talks').innerHTML =
    '<div class="tl"><div class="tl-h"><span class="e">☀️</span><b>아침 루틴</b><span class="st ' + (am.length && amDone === am.length ? 'done' : '') + '">' + amDone + ' / ' + am.length + ' 완료</span></div>' +
    '<ul class="steps">' + (am.length ? am.map(stepHTML).join('') : '<li class="empty">아침 루틴이 없어요</li>') + '</ul>' +
    '<div class="tlnote">' + note + '</div>' +
    '<div class="nextline"><span class="ne">🌙</span><b>' + nextTxt + '</b><span class="ns">' + esc(nextSub) + '</span></div></div>' +
    '<div class="tl"><div class="tl-h"><span class="e">🌙</span><b>저녁 루틴</b><span class="st ' + (pm.length && pmDone === pm.length ? 'done' : '') + '">' + pmDone + ' / ' + pm.length + ' 완료</span></div>' +
    '<ul class="steps">' + (pm.length ? pm.map(stepHTML).join('') : '<li class="empty">저녁 루틴이 없어요</li>') + '</ul></div>';

  const total = am.length + pm.length + tasks.length;
  const done = amDone + pmDone + tasks.filter((t, i) => state.checks['t' + i]).length;
  $('#todayNum').textContent = done + ' / ' + total;
  $('#todayBar').style.width = (total ? Math.round(done / total * 100) : 0) + '%';

  const remCare = state.care.filter(c => careDue(c).d <= 2).length;
  $('#footToday').innerHTML = '🔔 오늘 남은 것 — <b>루틴 ' + (total - done) + '개</b> · <b>주기 케어 ' + remCare + '개</b>';
}

/* ---------------- render : care ---------------- */
function renderCare() {
  const list = state.care.map(c => Object.assign({ c }, careDue(c))).sort((a, b) => a.d - b.d);
  const urgent = list.filter(x => x.d <= 2);
  $('#careChip').textContent = urgent.length + '개 챙길 때';
  $('#careGrid').innerHTML = urgent.length ? urgent.map(x =>
    '<div class="care urgent">' +
    '<div class="cic">' + x.c.emoji + '</div>' +
    '<div class="ci" data-act="careedit" data-id="' + x.c.id + '"><b>' + esc(x.c.name) + '</b><small>' + x.c.days + '일 주기 · ' + md(x.next) + (x.d < 0 ? ' 지남' : ' 까지') + '</small></div>' +
    '<div class="rt"><span class="dd ' + dueCls(x.d) + '">' + dueLabel(x.d) + '</span>' +
    '<button class="cbtn" data-act="carecomplete" data-id="' + x.c.id + '">완료 ✅</button></div></div>'
  ).join('') : '<div class="empty" style="grid-column:1/-1">지금 챙길 케어는 없어요 — 여유 있어요 ✅</div>';

  const rest = list.filter(x => x.d > 2);
  $('#careChips').innerHTML = rest.map(x =>
    '<div class="chipc"><span class="e">' + x.c.emoji + '</span>' +
    '<div class="cn" data-act="careedit" data-id="' + x.c.id + '"><b>' + esc(x.c.name) + '</b><small>' + x.c.days + '일 주기</small></div>' +
    '<span class="cd ' + (x.d <= 5 ? 'mid' : '') + '">' + dueLabel(x.d) + '</span>' +
    '<button class="mini" data-act="carecomplete" data-id="' + x.c.id + '">✓</button></div>'
  ).join('') || '<div class="empty" style="grid-column:1/-1">등록된 주기 케어가 없어요</div>';
}

/* ---------------- render : shopping ---------------- */
function shopRows() {
  return state.shopping.slice().sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || (a.ord || 0) - (b.ord || 0));
}
function renderShop() {
  const all = shopRows();
  const shown = all.filter(i => ui.filter === 'all' || i.cat === ui.filter);
  $('#shopCount').textContent = '살 것 ' + all.filter(i => !i.done).length + ' · 전체 ' + all.length;
  $$('#filters .fchip').forEach(b => b.classList.toggle('on', b.dataset.f === ui.filter));
  $('#shopList').innerHTML = shown.length ? shown.map(i =>
    '<li class="lrow ' + (i.done ? 'done' : '') + '">' +
    '<button class="ck ' + (i.done ? 'on' : '') + '" data-act="shoptoggle" data-id="' + i.id + '">' + (i.done ? '✓' : '') + '</button>' +
    '<div class="ln"><b>' + esc(i.name) + '</b><small>' + (i.cat === 'food' ? '🥬 식재료 · 체크하면 냉장고로' : '🧻 생필품 · 체크하면 재고로') + '</small></div>' +
    '<button class="del" data-act="shopdel" data-id="' + i.id + '">✕</button></li>'
  ).join('') : '<li class="empty">' + (ui.filter === 'all' ? '구매리스트가 비었어요 — 아래 자주 사는 것에서 눌러 담아 보세요' : '이 분류에는 담긴 게 없어요') + '</li>';
  $('#freq').innerHTML = FREQ.map(f => '<button class="freqchip" data-act="freq" data-name="' + esc(f[0]) + '" data-cat="' + f[1] + '">＋ ' + esc(f[0]) + '</button>').join('');
}

/* ---------------- render : pantry (구역별) + recipes ---------------- */
function ownedItems() {
  return state.pantry.concat(state.shopping.filter(i => i.cat === 'food'));
}
function matchRecipe(r, owned) {
  let have = 0; const miss = [];
  r.ings.forEach(i => { if (nameMatches(i, owned)) have++; else miss.push(i); });
  return { have, total: r.ings.length, miss, pct: r.ings.length ? Math.round(have / r.ings.length * 100) : 0 };
}
function pantryItemsByZone(z) {
  return state.pantry.filter(p => (p.zone || inferZone(p.name)) === z).sort((a, b) => (a.ord || 0) - (b.ord || 0));
}
function pantryChip(p) {
  const d = p.exp ? diffDays(todayISO(), p.exp) : null;
  const dd = d == null ? '' : '<span class="dd2 ' + (d < 0 ? 'bad' : (d <= 2 ? 'mid' : '')) + '">' + (d < 0 ? 'D+' + (-d) : (d === 0 ? 'D-DAY' : 'D-' + d)) + '</span>';
  return '<button class="pchip" data-act="pantryedit" data-id="' + p.id + '">' +
    '<span class="e">' + (p.emoji || guessEmoji(p.name)) + '</span>' + esc(p.name) + dd + '</button>';
}
function renderPantry() {
  const parts = [];
  const q = norm(ui.pantryQ || '');
  const hit = p => !q || norm(p.name).indexOf(q) >= 0;
  let shown = 0;
  ZONES.forEach(z => {
    const items = pantryItemsByZone(z.k).filter(hit);
    shown += items.length;
    if (!items.length) return;
    let inner;
    if (z.k === 'fridge' || z.k === 'freezer') {
      // 냉장·냉동은 안쪽을 육류·야채·과일·밀키트·기타로 묶어 보여준다
      const groups = SUBS.map(sb => ({ sb: sb, items: items.filter(p => subOf(p) === sb.k) })).filter(g => g.items.length);
      inner = groups.map(g =>
        '<div class="sgroup"><div class="sgroup-h"><span>' + g.sb.em + ' ' + esc(g.sb.label) + '</span><span class="pc">' + g.items.length + '</span></div>' +
        '<div class="pantry">' + g.items.map(pantryChip).join('') + '</div></div>'
      ).join('');
    } else {
      inner = '<div class="pantry">' + items.map(pantryChip).join('') + '</div>';
    }
    parts.push(
      '<div class="pgroup">' +
      '<div class="pgroup-h"><span>' + z.em + ' ' + esc(z.label) + '</span><span class="pc">' + items.length + '</span></div>' +
      inner + '</div>'
    );
  });
  const hint = $('#pantryHint');
  if (hint) hint.textContent = q ? '🔍 “' + ui.pantryQ.trim() + '” ' + shown + '개 찾음' : '냉장·냉동은 육류·야채·과일·밀키트로 자동 분류';
  $('#pantry').innerHTML = parts.join('') || '<span class="empty" style="padding:10px;grid-column:1/-1">' + (q ? '검색 결과가 없어요 — 다른 이름으로 찾아보세요' : '식자재를 추가해 보세요') + '</span>';
}
function renderRecipes() {
  const owned = ownedKeys(ownedItems());
  const q = norm(ui.recQ || '');
  const allR = allRecipes();
  let list = allR.map(r => Object.assign({ r }, matchRecipe(r, owned)))
    .sort((a, b) => b.pct - a.pct || a.miss.length - b.miss.length || a.total - b.total);
  const ready = list.filter(x => x.pct === 100).length;
  $('#recChip').textContent = ready + '개 바로 가능';
  $$('#recFilters .fchip').forEach(b => b.classList.toggle('on', b.dataset.rf === ui.recKind));
  list = list.filter(x => {
    if (ui.recKind === 'ready' && x.pct !== 100) return false;
    if (ui.recKind === 'mine' && x.r.kind !== '내 레시피') return false;
    if (q) {
      const hay = norm(x.r.name + ' ' + x.r.kind + ' ' + x.r.ings.join(' '));
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const show = (ui.showAllRec || q || ui.recKind !== 'all') ? list : list.slice(0, 8);
  $('#recList').innerHTML = show.length ? show.map(x => {
    const cls = x.pct === 100 ? 'rc full' : 'rc';
    const pcls = x.pct === 100 ? 'good' : (x.pct >= 50 ? 'mid2' : '');
    const ings = x.r.ings.map(i => nameMatches(i, owned)
      ? '<span class="ing">' + esc(i) + '</span>'
      : '<button class="ing miss" data-act="adding" data-name="' + esc(i) + '">' + esc(i) + ' ＋</button>').join('');
    return '<div class="' + cls + '">' +
      '<div class="rc-h"><span class="e">' + x.r.emoji + '</span>' +
      '<div class="nm"><b>' + esc(x.r.name) + '</b><small>' + esc(x.r.kind) + ' · ' + esc(x.r.time) + '</small></div>' +
      '<span class="rcp ' + pcls + '">' + x.have + '/' + x.total + ' · ' + x.pct + '%</span></div>' +
      '<div class="ings">' + ings + '</div>' +
      '<div style="display:flex;gap:5px;margin-top:8px;flex-wrap:wrap">' +
      (x.miss.length ? '<button class="rcbtn" data-act="fillmiss" data-id="' + x.r.id + '">＋ 없는 재료 ' + x.miss.length + '개 담기</button>' : '') +
      '<button class="rcbtn" data-act="recipeview" data-id="' + x.r.id + '">레시피 보기 →</button></div></div>';
  }).join('') : '<div class="empty" style="grid-column:1/-1;padding:18px">조건에 맞는 레시피가 없어요</div>';
  const tog = $('#recToggle');
  tog.style.display = (q || ui.recKind !== 'all') ? 'none' : '';
  tog.textContent = ui.showAllRec ? '－ 접기' : '＋ 레시피 전체 보기 (' + allR.length + '개)';
}

/* ---------------- render : stock ---------------- */
const LVL = { none: { t: '없음 🔴', cls: 'none', o: 0 }, low: { t: '부족 🟡', cls: 'low', o: 1 }, enough: { t: '충분 🟢', cls: 'enough', o: 2 } };
function renderStock() {
  const list = state.stock.slice().sort((a, b) => (LVL[stockLevel(a)] || LVL.enough).o - (LVL[stockLevel(b)] || LVL.enough).o || (a.ord || 0) - (b.ord || 0));
  const none = list.filter(s => stockLevel(s) === 'none').length;
  $('#stockChip').textContent = none + '개 없음';
  $('#stockList').innerHTML = list.map(s => {
    const lv = stockLevel(s);
    const lvc = LVL[lv] || LVL.enough;
    const inList = state.shopping.some(i => norm(i.name) === norm(s.name) && !i.done);
    const ctr = isNum(s)
      ? '<button class="ctr" data-act="stockdec" data-id="' + s.id + '">－</button><span class="cnt ' + lvc.cls + '">' + stockCount(s) + '</span><button class="ctr" data-act="stockinc" data-id="' + s.id + '">＋</button>'
      : '<button data-act="stockdec" data-id="' + s.id + '">－ 하나 씀</button><button data-act="stockinc" data-id="' + s.id + '">＋ 채움</button>';
    return '<div class="srow ' + (lv === 'none' ? 'none' : lv === 'low' ? 'low' : '') + '">' +
      '<span class="e">' + (s.emoji || guessEmoji(s.name)) + '</span>' +
      '<div class="sn" data-act="stockedit" data-id="' + s.id + '"><b>' + esc(s.name) + '</b>' +
      '<small><span class="lvl ' + lvc.cls + '">' + (isNum(s) ? stockCount(s) + '개' : lvc.t) + '</span> ' + (inList ? '장바구니 ✓' : (isNum(s) ? '수량 관리' : '')) + '</small></div>' +
      '<div class="sbtn">' + ctr +
      (lv !== 'enough' && !inList ? '<button class="send" data-act="stocksend" data-id="' + s.id + '">🛒</button>' : '') +
      (!isNum(s) && lv === 'low' ? '<button data-act="stocknumon" data-id="' + s.id + '">숫자로</button>' : '') +
      '</div></div>';
  }).join('') || '<div class="empty">생필품을 추가해 보세요</div>';
}

/* ---------------- 영수증·장보기 텍스트 → 품목 (붙여넣기 방식 · 한도 0%) ---------------- */
const RECEIPT_STOP = /(합계|총액|총금액|결제|승인|주문|배송|카드|할인|포인트|적립|부가세|과세|상품명|수량|금액|일시|매장|사업자|영수증|거래|잔액|쿠팡|로켓|와우|주소|연락|전화|감사|포장|배달|요청|옵션|무료|출고|도착|구매일|합계액|영수|상품|주문번호)/;
const LIVING_KW = ['휴지', '화장지', '물티슈', '키친타올', '행주', '세제', '세탁', '섬유유연', '주방', '샴푸', '린스', '컨디셔너', '바디워시', '비누', '핸드워시', '치약', '칫솔', '가글', '수세미', '스펀지', '필터', '봉지', '비닐', '쓰레기', '건전지', '전구', '마스크', '소독', '기저귀', '분유', '양말', '장갑', '호일', '랩', '빨대', '이쑤시개'];
function receiptCat(name) {
  const n = String(name || '');
  return LIVING_KW.some(k => n.indexOf(k) >= 0) ? 'living' : 'food';
}
function parseReceiptLines(raw) {
  const out = [], seen = {};
  String(raw || '').split(/\r?\n/).forEach(line => {
    let s = String(line).replace(/[\t|]/g, ' ').replace(/[₩]/g, ' ').trim();
    if (!s) return;
    s = s.replace(/^[\s*·•\-–—>=]+/, '').replace(/^\d+[.)]\s*/, '').trim();
    for (let i = 0; i < 3; i++) {                       // [쿠팡] (주) 같은 앞머리 떼기
      const b = s;
      s = s.replace(/^[\[\(【][^\]\)】]{1,12}[\]\)】]\s*/, '').trim();
      if (s === b) break;
    }
    for (let i = 0; i < 6; i++) {                        // 개수·가격 꼬리 반복 제거
      const before = s;
      s = s.replace(/\s*[x×]\s*\d+\s*$/i, '').trim();
      s = s.replace(/\s+[\d,.]+\s*(원|개|매|입|팩|봉|병|캔|g|kg|ml|L|리터|%|구|단|판|세트|박스|줄|마리|롤|장|포|알|근)?$/i, '').trim();
      if (s === before) break;
    }
    s = s.replace(/^\d+\s*(개|매|입|팩|봉)\s+/, '').replace(/\s{2,}/g, ' ').trim();
    if (s.length < 2 || s.length > 24) return;
    if (/^[\d,.\s]+$/.test(s)) return;
    if (RECEIPT_STOP.test(s)) return;
    if (/[:\/\\]/.test(s)) return;
    const key = norm(s);
    if (!key || seen[key]) return;
    seen[key] = 1;
    const dupList = state.shopping.some(i => norm(i.name) === norm(s) && !i.done);
    const dupPantry = state.pantry.some(p => norm(p.name) === norm(s));
    out.push({ name: s, cat: receiptCat(s), on: !(dupList || dupPantry), dup: !!(dupList || dupPantry) });
  });
  return out.slice(0, 40);
}
function renderReceipt() {
  const box = $('#receiptResult');
  if (!box) return;
  const list = ui.receipt || [];
  if (!list.length) { box.innerHTML = ''; return; }
  box.innerHTML = '<div class="sub-h" style="margin-top:12px"><span class="l">뽑은 품목 ' + list.length + '개 · ' + list.filter(x => x.on).length + '개 선택</span><span class="ln"></span></div>' +
    list.map((it, i) =>
      '<div class="rrow"><input type="checkbox" data-act="receipttoggle" data-i="' + i + '"' + (it.on ? ' checked' : '') + '>' +
      '<span class="rn" data-act="receipttoggle" data-i="' + i + '">' + esc(it.name) + '</span>' +
      '<button class="rchip" data-act="receiptcat" data-i="' + i + '">' + (it.cat === 'food' ? '🥬 식재료' : '🧻 생필품') + '</button>' +
      (it.dup ? '<span class="rdup">이미 있음</span>' : '<span></span>') + '</div>'
    ).join('') +
    '<div style="display:flex;gap:6px;margin-top:9px;flex-wrap:wrap">' +
    '<button class="btn sm" data-act="receiptadd" data-mode="list">🛒 구매리스트에 담기</button>' +
    '<button class="btn ghost" data-act="receiptadd" data-mode="pantry">❄️ 냉장고·재고로 바로 넣기</button></div>';
}

/* ---------------- render ---------------- */
function render() {
  renderHeader();
  renderAlerts();
  renderToday();
  renderCare();
  renderShop();
  renderPantry();
  renderRecipes();
  renderStock();
  renderReceipt();
  $('#panel-today').hidden = ui.tab !== 'today';
  $('#panel-shop').hidden = ui.tab !== 'shop';
  $$('.tabs .tab').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
  const all = shopRows().filter(i => !i.done).length;
  const none = state.stock.filter(s => stockLevel(s) === 'none').length;
  $('#footShop').innerHTML = '🛒 살 것 <b>' + all + '</b> · 없음 <b>' + none + '</b>';
}

/* ---------------- modals ---------------- */
let modalView = null, tmpDays = [];

function openModal(title, body, foot) {
  $('#shTitle').textContent = title;
  $('#shBody').innerHTML = body;
  $('#shFoot').innerHTML = foot || '<button class="btn ghost" data-act="close">닫기</button>';
  $('#overlay').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  $('#overlay').hidden = true;
  document.body.style.overflow = '';
  modalView = null;
}

function condLabel(r) {
  if (r.cond === 'office') return '출근일만';
  if (r.cond === 'home') return '재택일만';
  if (r.cond === 'day') return (r.days || []).map(d => WD[Number(d)]).join('·') + '요일';
  return '매일';
}
function viewRoutines() {
  modalView = { k: 'routines' };
  const rows = (slot) => state.routines.filter(r => r.slot === slot).sort((a, b) => (a.ord || 0) - (b.ord || 0)).map(r =>
    '<div class="editrow"><div class="tx"><b>' + (r.key ? '🧴 ' : '') + esc(r.text) + '</b>' +
    '<small>' + esc([r.time, condLabel(r), (r.sub && r.sub !== condLabel(r)) ? r.sub : ''].filter(Boolean).join(' · ') || '매일') + '</small></div>' +
    '<button class="mini" data-act="routineedit" data-id="' + r.id + '">수정</button>' +
    '<button class="mini danger" data-act="routinedel" data-id="' + r.id + '">삭제</button></div>'
  ).join('') || '<div class="empty">없음</div>';
  openModal('루틴 수정',
    '<div class="sub-h" style="margin-top:0"><span class="l">☀️ 아침</span><span class="ln"></span></div>' + rows('am') +
    '<div class="sub-h"><span class="l">🌙 저녁</span><span class="ln"></span></div>' + rows('pm') +
    '<div class="note" style="margin-top:12px">조건을 <b>출근일만</b>으로 두면 재택인 날은 자동으로 빠지고, <b>요일</b>을 고르면 그 요일에만 나와요.</div>',
    '<button class="btn dashed" data-act="routineadd">＋ 새 루틴 추가</button><button class="btn ghost" data-act="close">닫기</button>');
}
function viewRoutineForm(id) {
  const r = state.routines.find(x => x.id === id);
  modalView = { k: 'routineform', id: id || null };
  tmpDays = r ? (r.days || []).map(Number) : [];
  const v = r || { slot: 'am', time: '', text: '', sub: '', cond: 'all', days: [], key: false };
  openModal(id ? '루틴 수정' : '새 루틴 추가',
    '<div class="field"><label>할 일</label><input id="fText" type="text" value="' + esc(v.text) + '" placeholder="예: 서한이 물통 씻기"></div>' +
    '<div class="row2"><div class="field"><label>구분</label><select id="fSlot"><option value="am"' + (v.slot === 'am' ? ' selected' : '') + '>☀️ 아침</option><option value="pm"' + (v.slot === 'pm' ? ' selected' : '') + '>🌙 저녁</option></select></div>' +
    '<div class="field"><label>시간 (선택)</label><input id="fTime" type="time" value="' + esc(v.time || '') + '"></div></div>' +
    '<div class="field"><label>작은 설명 (선택)</label><input id="fSub" type="text" value="' + esc(v.sub || '') + '" placeholder="예: 물통 · 젓가락"></div>' +
    '<div class="field"><label>언제 보일까요</label><select id="fCond">' +
    ['all', 'home', 'office', 'day'].map(c => '<option value="' + c + '"' + ((v.cond || 'all') === c ? ' selected' : '') + '>' + ({ all: '매일', home: '재택인 날만', office: '출근인 날만', day: '정한 요일만' }[c]) + '</option>').join('') +
    '</select></div>' +
    '<div class="field" id="daysField"' + ((v.cond || 'all') === 'day' ? '' : ' style="display:none"') + '><label>요일</label><div class="days">' +
    [1, 2, 3, 4, 5, 6, 0].map(d => '<button class="daybtn ' + (tmpDays.indexOf(d) >= 0 ? 'on' : '') + '" data-act="daytoggle" data-d="' + d + '">' + WD[d] + '</button>').join('') + '</div></div>' +
    '<div class="toggle" style="border-top:1px dashed var(--line);margin-top:4px"><div class="t"><b>강조해서 보여주기</b><small>로션처럼 꼭 챙겨야 하는 항목</small></div>' +
    '<button class="sw ' + (v.key ? 'on' : '') + '" data-act="keytoggle"><i></i></button></div>',
    '<button class="btn sm" data-act="routinesave" data-id="' + (id || '') + '">저장</button><button class="btn ghost" data-act="routines">취소</button>');
  const sel = $('#fCond'); if (sel) sel.onchange = () => { $('#daysField').style.display = sel.value === 'day' ? '' : 'none'; };
}
function viewCareForm(id) {
  const c = state.care.find(x => x.id === id);
  modalView = { k: 'careform', id: id || null };
  const v = c || { emoji: '🧴', name: '', days: 30, last: todayISO(), stock: '' };
  const stockNames = state.stock.map(s => s.name);
  openModal(id ? '주기 케어 수정' : '주기 케어 추가',
    '<div class="row2"><div class="field" style="flex:0 0 84px"><label>아이콘</label><input id="cEmoji" type="text" value="' + esc(v.emoji) + '" maxlength="4"></div>' +
    '<div class="field"><label>이름</label><input id="cName" type="text" value="' + esc(v.name) + '" placeholder="예: 제빙기 세척"></div></div>' +
    '<div class="row2"><div class="field"><label>주기 (일)</label><input id="cDays" type="number" min="1" max="365" value="' + esc(v.days) + '"></div>' +
    '<div class="field"><label>마지막으로 한 날</label><input id="cLast" type="date" value="' + esc(v.last || todayISO()) + '"></div></div>' +
    '<div class="field"><label>완료하면 재고에서 1개 빼기 (선택)</label><select id="cStock"><option value="">— 연결 안 함 —</option>' +
    stockNames.map(n => '<option value="' + esc(n) + '"' + (v.stock === n ? ' selected' : '') + '>' + esc(n) + '</option>').join('') +
    '</select></div>' +
    '<div class="note">완료를 누르면 오늘 날짜로 리셋되고 다음 D-Day가 자동으로 잡혀요. 재고를 연결하면 완료할 때마다 1개씩 줄고, 1개 이하면 알려드려요.</div>',
    '<button class="btn sm" data-act="caresave" data-id="' + (id || '') + '">저장</button>' +
    (id ? '<button class="btn coral" data-act="caredelete" data-id="' + id + '">삭제</button>' : '<button class="btn ghost" data-act="close">취소</button>'));
}
function viewStockForm(id, draft) {
  const s = state.stock.find(x => x.id === id);
  if (!s) return;
  modalView = { k: 'stockform', id };
  const d = draft || {};
  const useCount = d.useCount != null ? d.useCount : isNum(s);
  const count = d.count != null ? d.count : (isNum(s) ? stockCount(s) : countFromLevel(s.level || 'enough'));
  const max = d.max != null ? d.max : stockMax(s);
  const level = d.level || s.level || 'enough';
  openModal('생필품 수정',
    '<div class="row2"><div class="field"><label>이름</label><input id="sName" type="text" value="' + esc(d.name != null ? d.name : s.name) + '"></div>' +
    '<div class="field"><label>아이콘</label><input id="sEmoji" type="text" maxlength="4" value="' + esc(d.emoji != null ? d.emoji : (s.emoji || '🧴')) + '"></div></div>' +
    (useCount
      ? '<div class="row2"><div class="field"><label>남은 개수</label><input id="sCount" type="number" min="0" max="99" value="' + esc(count) + '"></div>' +
      '<div class="field"><label>가득 채우면 몇 개</label><input id="sMax" type="number" min="1" max="99" value="' + esc(max) + '"></div></div>'
      : '<div class="field"><label>재고 상태</label><select id="sLvl">' +
      ['none', 'low', 'enough'].map(l => '<option value="' + l + '"' + (level === l ? ' selected' : '') + '>' + LVL[l].t + '</option>').join('') +
      '</select></div>') +
    '<div class="toggle" style="border-top:1px dashed var(--line)"><div class="t"><b>개수 관리 사용</b><small>켜면 5·4·3처럼 숫자로 조절해요 (5개 이하 = 부족)</small></div>' +
    '<button class="sw ' + (useCount ? 'on' : '') + '" data-act="stocknumtoggle" data-id="' + id + '"><i></i></button></div>' +
    '<div class="note">' + (useCount ? '숫자가 <b>0</b>이면 없음, <b>5 이하</b>면 부족으로 표시되고 구매리스트에 담을 수 있어요.' : '충분 / 부족 / 없음 3단으로 관리해요. 개수까지 세고 싶은 품목은 위 토글을 켜세요.') + '</div>',
    '<button class="btn sm" data-act="stocksave" data-id="' + id + '">저장</button><button class="btn coral" data-act="stockdelete" data-id="' + id + '">삭제</button>');
}
function viewPantryForm(id) {
  const p = state.pantry.find(x => x.id === id);
  if (!p) return;
  modalView = { k: 'pantryform', id };
  const z = p.zone || inferZone(p.name);
  const inCold = (z === 'fridge' || z === 'freezer');
  const curSub = p.sub || '';
  const em = p.emoji || guessEmoji(p.name);
  openModal(em + ' ' + p.name + ' 수정',
    '<div style="display:grid;grid-template-columns:64px 1fr;gap:8px"><div class="field"><label>아이콘</label><input id="pEmoji" type="text" maxlength="4" value="' + esc(em) + '"></div>' +
    '<div class="field"><label>이름</label><input id="pName" type="text" value="' + esc(p.name) + '" placeholder="예: 돼지고기-목살"></div></div>' +
    '<div class="field"><label>보관 구역</label><select id="pZone">' +
    ZONES.map(x => '<option value="' + x.k + '"' + (z === x.k ? ' selected' : '') + '>' + x.em + ' ' + x.label + '</option>').join('') +
    '</select></div>' +
    '<div class="field" id="pSubField"' + (inCold ? '' : ' style="display:none"') + '><label>소분류 (냉장·냉동 안에서 묶여요)</label><select id="pSub">' +
    '<option value=""' + (curSub ? '' : ' selected') + '>자동 (이름으로 분류 · 지금 ' + subLabel(subOf(p)) + ')</option>' +
    SUBS.map(x => '<option value="' + x.k + '"' + (curSub === x.k ? ' selected' : '') + '>' + x.em + ' ' + x.label + '</option>').join('') +
    '</select></div>' +
    '<div class="field"><label>유통기한 (선택)</label><input id="pExp" type="date" value="' + esc(p.exp || '') + '"></div>' +
    '<div class="note">' + (p.exp ? '지금은 <b>' + md(p.exp) + (diffDays(todayISO(), p.exp) < 0 ? ' (지남)</b>' : ' 까지</b>') : '유통기한을 넣어두면 D-Day가 표시돼요.') +
    ' 이름을 바꿔도 구역·소분류·유통기한·아이콘은 그대로 저장됩니다.</div>',
    '<div style="display:flex;flex-direction:column;gap:7px;width:100%">' +
    '<button class="btn coral" data-act="pantryuse" data-id="' + id + '" style="width:100%;justify-content:center;padding:11px">다 썼어요 + 장보기 담기 🛒</button>' +
    '<div style="display:flex;gap:7px">' +
    '<button class="btn coral" data-act="pantrydel" data-id="' + id + '" style="flex:1;justify-content:center;padding:11px">다 썼어요 🗑️</button>' +
    '<button class="btn sm" data-act="pantrysave" data-id="' + id + '" style="flex:1;justify-content:center;padding:11px">저장</button>' +
    '</div></div>');
  const zsel = $('#pZone');
  if (zsel) zsel.onchange = () => {
    const f = $('#pSubField');
    if (f) f.style.display = (zsel.value === 'fridge' || zsel.value === 'freezer') ? '' : 'none';
  };
}
function viewSettings() {
  modalView = { k: 'settings' };
  const tr = state.settings.trash || {};
  const daySel = (id, val) => '<select id="' + id + '">' + [1, 2, 3, 4, 5, 6, 0].map(d => '<option value="' + d + '"' + (Number(val) === d ? ' selected' : '') + '>' + WD[d] + '요일</option>').join('') + '</select>';
  openModal('설정',
    '<div class="field"><label>공유 링크 (남편과 같은 방)</label><div class="sharebox"><input id="shareInput" type="text" readonly value="' + esc(shareLink()) + '"><button class="mini" data-act="sharecopy">복사</button></div></div>' +
    '<div class="field"><label>방 코드 (같은 코드 = 같은 살림 관제소)</label><div class="sharebox"><input id="roomInput" type="text" value="' + esc(ROOM) + '"><button class="mini" data-act="roomsave">저장</button></div></div>' +
    '<div class="toggle"><div class="t"><b>🗑️ 쓰레기 · ♻️ 재활용 요일 알림</b><small>기본 OFF — 켜면 그날 아침 알림 줄에 떠요</small></div>' +
    '<button class="sw ' + (tr.on ? 'on' : '') + '" data-act="trashtoggle"><i></i></button></div>' +
    (tr.on ? '<div class="row2"><div class="field"><label>쓰레기 내놓는 날</label>' + daySel('trashDay', tr.trashDay) + '</div><div class="field"><label>재활용 내놓는 날</label>' + daySel('recyDay', tr.recyDay) + '</div></div>' : '') +
    '<div class="note" style="margin-top:6px">모든 자료는 이 기기(localStorage)와 <b>Firebase 방 rooms/' + esc(ROOM) + '</b>에 함께 저장돼요. 링크를 열면 남편 폰에서도 같은 목록을 보고 체크할 수 있어요.</div>' +
    '<div style="margin-top:12px"><button class="btn dashed" data-act="resetall" style="width:100%;justify-content:center;padding:11px">이 방 데이터 초기화</button></div>',
    '<button class="btn sm" data-act="settingsave">설정 저장</button><button class="btn ghost" data-act="close">닫기</button>');
}
function viewRecipe(id) {
  const r = allRecipes().find(x => x.id === id);
  if (!r) return;
  const isCustom = (state.recipes || []).some(x => x.id === id);
  const owned = ownedKeys(ownedItems());
  modalView = { k: 'recipe', id };
  const stepLines = String(r.steps || '').split('\n').filter(Boolean);
  openModal(r.emoji + ' ' + r.name,
    '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px"><span class="chip sage">' + esc(r.kind) + '</span><span class="chip line">' + esc(r.time) + '</span><span class="chip line">재료 ' + r.ings.length + '개</span></div>' +
    '<div style="font-size:10.5px;font-weight:800;color:#9C9285;margin-bottom:6px">재료 <span style="font-weight:600;color:#B7AC9C">(계량은 만드는 법에)</span></div>' +
    '<div class="ings">' + r.ings.map(i => nameMatches(i, owned) ? '<span class="ing">' + esc(i) + '</span>' : '<span class="ing miss">' + esc(i) + ' (없음)</span>').join('') + '</div>' +
    '<div style="font-size:10.5px;font-weight:800;color:#9C9285;margin:14px 0 6px">만드는 법</div>' +
    '<div class="stepsview">' + stepLines.map(l => '<p>' + esc(l) + '</p>').join('') + '</div>',
    (isCustom ? '<button class="btn ghost" data-act="recipedel" data-id="' + id + '" style="color:var(--coral)">삭제</button><button class="btn ghost" data-act="recipeedit" data-id="' + id + '">수정</button>' : '') +
    '<button class="btn sm" data-act="fillmiss" data-id="' + id + '">없는 재료 담기</button><button class="btn ghost" data-act="close">닫기</button>');
}
function parseGeminiRecipe(raw) {
  const lines = String(raw || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!lines.length) return null;
  let name = lines[0].replace(/^[#①②③④⑤⑥⑦⑧⑨⑩\d.\-\s]+/, '').replace(/\(.*?\)/g, '').trim();
  let time = (raw.match(/(\d+\s*~\s*\d+분|\d+분)/) || [])[1] || '15분';
  let ings = [];
  lines.forEach(l => {
    if (/^(재료|주재료|양념|소스)\s*[:：]/.test(l)) {
      const part = l.replace(/^[^:：]+[:：]/, '').split(/[,·/]/).map(s => s.replace(/\s*\d+.*$/, '').replace(/[()]/g, '').trim()).filter(s => s && s.length <= 15);
      ings = ings.concat(part);
    }
  });
  return { name, time, ings: Array.from(new Set(ings)).slice(0, 14), steps: lines.slice(1).join('\n') };
}
function viewRecipeForm(id) {
  const r = id ? (state.recipes || []).find(x => x.id === id) : null;
  modalView = { k: 'recipeform', id: id || null };
  openModal(r ? '✏️ 레시피 수정' : '🍲 나만의 레시피 추가',
    '<div class="field"><label>제미나이 등에서 복사한 레시피 통째로 붙여넣기 (선택)</label>' +
    '<textarea id="rfPaste" rows="3" placeholder="예: 지도리 우동 (15분)&#10;재료: 닭다리살, 대파, 우동면, 쯔유&#10;1. 대파 구워서..." style="width:100%;padding:8px 10px;border:1.5px solid var(--line);border-radius:10px;font-size:12px"></textarea>' +
    '<button class="btn ghost" data-act="recipeparse" style="margin-top:4px;font-size:11.5px">✨ 붙여넣은 글 자동 채우기</button></div>' +
    '<div class="row2"><div class="field"><label>요리 이름</label><input id="rfName" value="' + esc(r ? r.name : '') + '" placeholder="예: 닭다리살 간장조림"></div>' +
    '<div class="field"><label>조리 시간</label><input id="rfTime" value="' + esc(r ? r.time : '15분') + '"></div></div>' +
    '<div class="row2"><div class="field"><label>분류</label><select id="rfKind">' +
    ['내 레시피', '유아식', '집밥'].map(k => '<option value="' + k + '"' + ((r ? r.kind : '내 레시피') === k ? ' selected' : '') + '>' + k + '</option>').join('') +
    '</select></div><div class="field"><label>아이콘</label><input id="rfEmoji" value="' + esc(r ? r.emoji : '🍲') + '"></div></div>' +
    '<div class="field"><label>재료 (쉼표로 구분 — 냉장고·장보기랑 자동 연결돼요)</label><input id="rfIngs" value="' + esc(r ? r.ings.join(', ') : '') + '" placeholder="닭다리살, 대파, 양파, 간장"></div>' +
    '<div class="field"><label>만드는 법</label><textarea id="rfSteps" rows="4" style="width:100%;padding:8px 10px;border:1.5px solid var(--line);border-radius:10px;font-size:12px">' + esc(r ? r.steps : '') + '</textarea></div>',
    '<button class="btn sm" data-act="recipesave">저장하기</button><button class="btn ghost" data-act="close">취소</button>');
}

/* ---------------- actions ---------------- */
function addShopping(name, cat) {
  name = String(name || '').trim();
  if (!name) return false;
  if (state.shopping.some(i => norm(i.name) === norm(name) && !i.done)) { toast('이미 리스트에 있어요: ' + name); return false; }
  const doneSame = state.shopping.find(i => norm(i.name) === norm(name) && i.done);
  if (doneSame) { doneSame.done = false; doneSame.cat = cat || doneSame.cat; return true; }
  state.shopping.push({ id: uid('s'), name, cat: cat || 'food', done: false, ord: Date.now() % 100000 });
  return true;
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const a = el.dataset.act, id = el.dataset.id;

  switch (a) {
    case 'mode': {
      const m = el.dataset.mode;
      if (state.mode === m) return;
      mutate(s => { s.mode = m; });
      toast(m === 'home' ? '🏠 재택 모드 — 출근 전용 루틴은 숨겼어요' : '🏢 출근 모드 — 화장·옷입기 루틴이 켜졌어요');
      haptic();
      break;
    }
    case 'reload': {
      const q = new URLSearchParams(location.search);
      q.set('v', String(Date.now()));
      toast('🔄 새로 불러오는 중…');
      location.replace(location.pathname + '?' + q.toString());
      break;
    }
    case 'share': {
      copyText(shareLink()).then(() => toast('🔗 공유 링크 복사했어요 — 남편에게 보내 주세요'));
      break;
    }
    case 'tab': {
      ui.tab = el.dataset.tab; render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      break;
    }
    case 'settings': viewSettings(); break;
    case 'close': closeModal(); break;

    /* --- today --- */
    case 'toggle': {
      const k = id;
      mutate(s => { if (s.checks[k]) delete s.checks[k]; else s.checks[k] = true; });
      haptic();
      break;
    }
    case 'routines': viewRoutines(); break;
    case 'routineadd': viewRoutineForm(null); break;
    case 'routineedit': viewRoutineForm(id); break;
    case 'routinedel': {
      mutate(s => { s.routines = s.routines.filter(r => r.id !== id); delete s.checks[id]; });
      viewRoutines(); toast('루틴을 삭제했어요');
      break;
    }
    case 'daytoggle': {
      const d = Number(el.dataset.d);
      if (tmpDays.indexOf(d) >= 0) tmpDays = tmpDays.filter(x => x !== d); else tmpDays.push(d);
      el.classList.toggle('on');
      break;
    }
    case 'keytoggle': el.classList.toggle('on'); break;
    case 'routinesave': {
      const text = ($('#fText').value || '').trim();
      if (!text) { toast('할 일을 적어 주세요'); return; }
      const cond = $('#fCond').value;
      const sw = $('#shBody .sw');
      const data = {
        text, slot: $('#fSlot').value, time: $('#fTime').value, sub: ($('#fSub').value || '').trim(),
        cond, days: cond === 'day' ? tmpDays.slice().sort() : [], key: !!(sw && sw.classList.contains('on'))
      };
      if (id) mutate(s => { const r = s.routines.find(x => x.id === id); if (r) Object.assign(r, data); });
      else mutate(s => { s.routines.push(Object.assign({ id: uid('r'), ord: Date.now() % 100000 }, data)); });
      viewRoutines(); toast('저장했어요');
      break;
    }
    case 'careadd': viewCareForm(null); break;
    case 'careedit': viewCareForm(id); break;
    case 'carecomplete': {
      const item = state.care.find(c => c.id === id);
      if (!item) return;
      let used = null;
      mutate(s => { const c = s.care.find(x => x.id === id); if (c) { c.last = todayISO(); used = useLinkedStock(s, c); } });
      let msg = '✅ ' + item.name + ' 완료 — 다음은 ' + md(addDays(todayISO(), item.days || 1)) + '이에요';
      if (used) msg += ' · ' + used.name + ' ' + (used.left == null ? '재고 한 단계 줄었어요' : used.left + '개 남음');
      toast(msg);
      if (used && used.left != null && used.left <= 1) {
        setTimeout(() => toast('⚠️ ' + used.name + '이(가) ' + used.left + '개 남았어요 — 미리 사 두세요'), 2200);
      }
      haptic();
      break;
    }
    case 'caresave': {
      const name = ($('#cName').value || '').trim();
      if (!name) { toast('이름을 적어 주세요'); return; }
      const data = { name, emoji: ($('#cEmoji').value || '🧴').trim() || '🧴', days: Math.max(1, Number($('#cDays').value) || 1), last: $('#cLast').value || todayISO(), stock: ($('#cStock') ? $('#cStock').value : '') };
      if (id) mutate(s => { const c = s.care.find(x => x.id === id); if (c) Object.assign(c, data); });
      else mutate(s => { s.care.push(Object.assign({ id: uid('c'), ord: Date.now() % 100000 }, data)); });
      closeModal(); toast('저장했어요');
      break;
    }
    case 'caredelete': {
      mutate(s => { s.care = s.care.filter(c => c.id !== id); });
      closeModal(); toast('삭제했어요');
      break;
    }
    case 'alertstock': {
      ui.tab = 'shop'; render();
      setTimeout(() => {
        const c = $('#card-stock');
        if (c) { c.scrollIntoView({ behavior: 'smooth', block: 'center' }); c.classList.add('flash'); setTimeout(() => c.classList.remove('flash'), 1200); }
      }, 60);
      break;
    }

    /* --- shopping --- */
    case 'filter': ui.filter = el.dataset.f; renderShop(); break;
    case 'shopadd': {
      const inp = $('#shopInput'), cat = $('#shopCat').value;
      if (addShopping(inp.value, cat)) { mutate(s => { }); inp.value = ''; inp.focus(); }
      break;
    }
    case 'freq': {
      if (addShopping(el.dataset.name, el.dataset.cat)) { mutate(s => { }); toast(el.dataset.name + ' 담았어요'); }
      break;
    }
    case 'shoptoggle': {
      const item = state.shopping.find(x => x.id === id);
      let note = '';
      mutate(s => {
        const i = s.shopping.find(x => x.id === id); if (!i) return;
        i.done = !i.done;
        if (i.done) note = i.cat === 'food' ? putPantryFromShopping(s, i.name).msg : putBackStock(s, i.name).msg;
      });
      if (item && item.done && note) toast('✓ ' + item.name + ' — ' + note);
      else haptic();
      break;
    }
    case 'shopdel': mutate(s => { s.shopping = s.shopping.filter(i => i.id !== id); }); break;
    case 'cleardone': {
      const n = state.shopping.filter(i => i.done).length;
      if (!n) { toast('구매 완료한 게 없어요'); break; }
      mutate(s => { s.shopping = s.shopping.filter(i => !i.done); });
      toast(n + '개 정리했어요');
      break;
    }
    case 'adding': {
      if (addShopping(el.dataset.name, 'food')) { mutate(s => { }); toast(el.dataset.name + ' 장바구니에 담았어요'); }
      break;
    }
    case 'fillmiss': {
      const r = allRecipes().find(x => x.id === id);
      if (!r) return;
      const owned = ownedKeys(ownedItems());
      let n = 0;
      r.ings.forEach(i => { if (!nameMatches(i, owned) && addShopping(i, 'food')) n++; });
      mutate(s => { });
      toast(n ? r.name + ' 없는 재료 ' + n + '개를 담았어요' : '이미 재료가 다 있어요');
      break;
    }
    case 'recipeview': viewRecipe(id); break;
    case 'rectoggle': ui.showAllRec = !ui.showAllRec; renderRecipes(); break;
    case 'recfilter': ui.recKind = el.dataset.rf || 'all'; renderRecipes(); break;
    case 'recipeadd': viewRecipeForm(null); break;
    case 'recipeedit': viewRecipeForm(id); break;
    case 'recipeparse': {
      const p = parseGeminiRecipe($('#rfPaste').value);
      if (!p) { toast('붙여넣을 레시피 텍스트를 먼저 입력해 주세요'); break; }
      if (p.name && !$('#rfName').value.trim()) $('#rfName').value = p.name;
      if (p.time) $('#rfTime').value = p.time;
      if (p.ings.length && !$('#rfIngs').value.trim()) $('#rfIngs').value = p.ings.join(', ');
      if (p.steps && !$('#rfSteps').value.trim()) $('#rfSteps').value = p.steps;
      toast('✨ 레시피 내용 채웠어요 — 확인 후 저장해 주세요');
      break;
    }
    case 'recipesave': {
      const name = $('#rfName').value.trim();
      const ings = $('#rfIngs').value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
      if (!name || !ings.length) { toast('요리 이름과 재료는 꼭 적어 주세요'); break; }
      const item = {
        id: (modalView && modalView.id) || uid('cr'),
        name, emoji: $('#rfEmoji').value.trim() || '🍲',
        kind: $('#rfKind').value || '내 레시피',
        time: $('#rfTime').value.trim() || '15분',
        ings, steps: $('#rfSteps').value.trim() || '재료를 손질해 맛있게 조리해요.',
        ord: Date.now() % 100000
      };
      mutate(s => {
        if (!Array.isArray(s.recipes)) s.recipes = [];
        const idx = s.recipes.findIndex(x => x.id === item.id);
        if (idx >= 0) s.recipes[idx] = item; else s.recipes.unshift(item);
      });
      closeModal();
      toast('🍲 ' + name + ' 저장했어요');
      break;
    }
    case 'recipedel': {
      mutate(s => { s.recipes = (s.recipes || []).filter(x => x.id !== id); });
      closeModal();
      toast('레시피를 지웠어요');
      break;
    }

    /* --- 영수증·장보기 등록 --- */
    case 'receiptparse': {
      const raw = $('#receiptRaw') ? $('#receiptRaw').value : '';
      const list = parseReceiptLines(raw);
      ui.receipt = list;
      renderReceipt();
      toast(list.length ? '🔍 품목 ' + list.length + '개를 뽑았어요 — 확인하고 담아 주세요' : '품목을 못 찾았어요 — 한 줄에 하나씩 적어 주세요');
      break;
    }
    case 'receiptclear': {
      ui.receipt = null;
      if ($('#receiptRaw')) $('#receiptRaw').value = '';
      renderReceipt();
      break;
    }
    case 'receipttoggle': {
      const i = Number(el.dataset.i);
      if (ui.receipt && ui.receipt[i]) { ui.receipt[i].on = !ui.receipt[i].on; renderReceipt(); }
      break;
    }
    case 'receiptcat': {
      const i = Number(el.dataset.i);
      if (ui.receipt && ui.receipt[i]) { ui.receipt[i].cat = ui.receipt[i].cat === 'food' ? 'living' : 'food'; renderReceipt(); }
      break;
    }
    case 'receiptadd': {
      const mode = el.dataset.mode || 'list';
      const list = (ui.receipt || []).filter(x => x.on);
      if (!list.length) { toast('담을 품목을 골라 주세요'); break; }
      let n = 0;
      mutate(s => {
        list.forEach(it => {
          if (mode === 'list') { if (addShopping(it.name, it.cat)) n++; return; }
          if (it.cat === 'food') {
            const r = putPantryFromShopping(s, it.name);
            if (!r || String(r.msg).indexOf('이미') !== 0) n++;
          } else { putBackStock(s, it.name); n++; }
        });
      });
      ui.receipt = null;
      if ($('#receiptRaw')) $('#receiptRaw').value = '';
      renderReceipt();
      toast(mode === 'list' ? '🛒 ' + n + '개를 구매리스트에 담았어요' : '❄️ ' + n + '개를 냉장고·재고에 넣었어요');
      break;
    }

    /* --- pantry --- */
    case 'pantryadd': {
      const inp = $('#pantryInput'), exp = $('#pantryExp').value;
      const sel = $('#pantryZone') ? $('#pantryZone').value : 'auto';
      const name = (inp.value || '').trim();
      if (!name) { toast('재료 이름을 적어 주세요'); return; }
      if (state.pantry.some(p => norm(p.name) === norm(name))) { toast('이미 냉장고에 있어요: ' + name); return; }
      const zone = sel && sel !== 'auto' ? sel : inferZone(name);
      mutate(s => { s.pantry.push({ id: uid('p'), name, emoji: guessEmoji(name), zone, exp: exp || '', ord: Date.now() % 100000 }); });
      inp.value = ''; $('#pantryExp').value = '';
      if (sel === 'auto' || !sel) $('#pantryZone').value = 'auto';
      toast(name + ' → ' + zoneLabel(zone));
      break;
    }
    case 'pantryedit': viewPantryForm(id); break;
    case 'pantrysave': {
      const name = ($('#pName') ? $('#pName').value : '').trim();
      const z = $('#pZone').value, exp = $('#pExp').value;
      const subv = $('#pSub') ? $('#pSub').value : '';
      const em = ($('#pEmoji') ? $('#pEmoji').value : '').trim();
      if (!name) { toast('재료 이름을 적어 주세요'); return; }
      if (state.pantry.some(x => x.id !== id && norm(x.name) === norm(name))) { toast('이미 같은 이름이 있어요: ' + name); return; }
      mutate(s => {
        const p = s.pantry.find(x => x.id === id);
        if (p) {
          const oldEm = p.emoji || guessEmoji(p.name);
          const g = guessEmoji(name);
          p.name = name;
          /* 아이콘을 직접 건드리지 않았으면 새 이름에 맞는 아이콘으로 */
          p.emoji = (em && em !== oldEm) ? em : (g !== '🧴' || !oldEm ? g : oldEm);
          p.zone = z; p.exp = exp || '';
          if (subv) p.sub = subv; else delete p.sub;
        }
      });
      closeModal(); toast('저장했어요');
      break;
    }
    case 'pantryuse': {
      const p = state.pantry.find(x => x.id === id);
      if (!p) return;
      const nm = p.name;
      let added = false;
      mutate(s => {
        s.pantry = s.pantry.filter(x => x.id !== id);
        added = addShopping(nm, 'food');
      });
      closeModal();
      toast(added ? nm + ' — 다 썼어요 🗑️ · 장보기에 담았어요 🛒' : nm + ' — 다 썼어요 🗑️ · 이미 장보기에 있어요');
      break;
    }
    case 'pantrydel': {
      const p = state.pantry.find(x => x.id === id);
      mutate(s => { s.pantry = s.pantry.filter(x => x.id !== id); });
      closeModal(); toast((p ? p.name : '재료') + ' — 다 쓰셨네요 🗑️');
      break;
    }

    /* --- stock --- */
    case 'stockadd': {
      const inp = $('#stockInput'), lvl = $('#stockLvl').value;
      const name = (inp.value || '').trim();
      if (!name) { toast('생필품 이름을 적어 주세요'); return; }
      if (state.stock.some(s => norm(s.name) === norm(name))) { toast('이미 있는 품목이에요'); return; }
      mutate(s => { s.stock.push({ id: uid('k'), name, emoji: guessEmoji(name), level: lvl, ord: Date.now() % 100000 }); });
      inp.value = ''; toast(name + ' 추가했어요');
      break;
    }
    case 'stockdec': {
      let out = '';
      mutate(s => {
        const it = s.stock.find(x => x.id === id); if (!it) return;
        if (isNum(it)) { it.count = Math.max(0, stockCount(it) - 1); it.level = levelFromCount(it.count); }
        else { it.level = it.level === 'enough' ? 'low' : 'none'; }
        out = it.name + (isNum(it) ? ' — ' + it.count + '개 남았어요' : ' — ' + (LVL[it.level] || LVL.enough).t);
      });
      toast(out); haptic();
      break;
    }
    case 'stockinc': {
      let out = '';
      mutate(s => {
        const it = s.stock.find(x => x.id === id); if (!it) return;
        if (isNum(it)) { it.count = stockMax(it); it.level = levelFromCount(it.count); out = it.name + ' — ' + it.count + '개로 채웠어요'; }
        else { it.level = 'enough'; out = it.name + ' — 충분 🟢'; }
      });
      toast(out); haptic();
      break;
    }
    case 'stocknumon': {
      mutate(s => {
        const it = s.stock.find(x => x.id === id); if (!it) return;
        it.useCount = true; it.count = countFromLevel(it.level || 'enough'); it.max = stockMax(it); it.level = levelFromCount(it.count);
      });
      toast('숫자로 셀 수 있어요 — －/＋ 로 조절하세요');
      break;
    }
    case 'stocknumtoggle': {
      const it = state.stock.find(x => x.id === id);
      if (!it) return;
      const draft = {
        name: $('#sName') ? $('#sName').value : it.name,
        emoji: $('#sEmoji') ? $('#sEmoji').value : it.emoji,
        level: $('#sLvl') ? $('#sLvl').value : it.level,
        useCount: !isNum(it),
        count: $('#sCount') ? Number($('#sCount').value) : (isNum(it) ? stockCount(it) : countFromLevel(it.level || 'enough')),
        max: $('#sMax') ? Number($('#sMax').value) : stockMax(it)
      };
      mutate(s => {
        const x = s.stock.find(y => y.id === id); if (!x) return;
        x.useCount = draft.useCount;
        if (draft.useCount) { x.count = Number.isFinite(draft.count) ? draft.count : countFromLevel(x.level || 'enough'); x.max = draft.max || 10; x.level = levelFromCount(x.count); }
      }, { quiet: true });
      viewStockForm(id, draft);
      break;
    }
    case 'stocksend': {
      const it = state.stock.find(x => x.id === id);
      if (!it) return;
      if (addShopping(it.name, 'living')) { mutate(s => { }); toast(it.name + ' 구매리스트에 담았어요'); }
      break;
    }
    case 'stockedit': viewStockForm(id); break;
    case 'stocksave': {
      const name = ($('#sName').value || '').trim();
      if (!name) { toast('이름을 적어 주세요'); return; }
      const emoji = ($('#sEmoji').value || '🧴').trim() || '🧴';
      const useCount = !!(isNum(state.stock.find(x => x.id === id)) || $('#sCount'));
      mutate(s => {
        const it = s.stock.find(x => x.id === id); if (!it) return;
        it.name = name; it.emoji = emoji;
        if (useCount) {
          it.useCount = true;
          it.count = Math.max(0, Number($('#sCount') ? $('#sCount').value : stockCount(it)) || 0);
          it.max = Math.max(1, Number($('#sMax') ? $('#sMax').value : stockMax(it)) || 10);
          it.level = levelFromCount(it.count);
        } else {
          it.useCount = false;
          it.level = $('#sLvl') ? $('#sLvl').value : (it.level || 'enough');
          delete it.count;
        }
      });
      closeModal(); toast('저장했어요');
      break;
    }
    case 'stockdelete': {
      mutate(s => { s.stock = s.stock.filter(x => x.id !== id); });
      closeModal(); toast('삭제했어요');
      break;
    }

    /* --- settings --- */
    case 'sharecopy': copyText(shareLink()).then(() => toast('복사했어요')); break;
    case 'roomsave': {
      const v = ($('#roomInput').value || '').trim();
      if (!/^[A-Za-z0-9_-]{6,64}$/.test(v)) { toast('방 코드는 영문·숫자·- _ 로 6자 이상'); return; }
      location.search = '?room=' + encodeURIComponent(v);
      break;
    }
    case 'trashtoggle': {
      mutate(s => { s.settings.trash.on = !s.settings.trash.on; });
      viewSettings();
      break;
    }
    case 'settingsave': {
      const tr = state.settings.trash;
      if ($('#trashDay')) tr.trashDay = Number($('#trashDay').value);
      if ($('#recyDay')) tr.recyDay = Number($('#recyDay').value);
      mutate(s => { s.settings.trash = tr; });
      closeModal(); toast('설정을 저장했어요');
      break;
    }
    case 'resetall': {
      if (!confirm('이 방의 살림 데이터를 모두 초기 상태로 되돌릴까요?\n(남편 화면에도 반영됩니다)')) return;
      state = seedState();
      mutate(s => { });
      closeModal(); toast('초기화했어요');
      break;
    }
    default: break;
  }
});

/* inputs: Enter to add */
document.addEventListener('input', e => {
  if (e.target.id === 'recSearch') { ui.recQ = e.target.value; renderRecipes(); }
  if (e.target.id === 'pantrySearch') { ui.pantryQ = e.target.value; renderPantry(); }
  if (e.target.id === 'weekendMemo') {
    const v = e.target.value;
    if (!state.memo || typeof state.memo !== 'object') state.memo = {};
    if (v.trim()) state.memo[todayISO()] = v; else delete state.memo[todayISO()];
    saveLocal(); schedulePush();      // 글씨는 그대로 두고 저장만 (화면을 다시 그리지 않음)
  }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const id = e.target.id;
  if (id === 'shopInput') { e.preventDefault(); $('#shopInput').blur(); document.querySelector('[data-act="shopadd"]').click(); }
  else if (id === 'pantryInput' || id === 'pantryExp') { e.preventDefault(); document.querySelector('[data-act="pantryadd"]').click(); }
  else if (id === 'stockInput') { e.preventDefault(); document.querySelector('[data-act="stockadd"]').click(); }
});

/* overlay click closes */
$('#overlay').addEventListener('click', e => { if (e.target.id === 'overlay') closeModal(); });

/* ---------------- boot ---------------- */
function boot() {
  migrated = false;
  const local = loadLocal();
  state = local || normalize(seedState());
  state = normalize(state);
  saveLocal();
  render();
  setSync('busy', '남편과 연결하는 중…');
  initSync();
  setInterval(() => {
    if (state.day !== todayISO()) {
      mutate(s => { s.day = todayISO(); s.checks = {}; });
      toast('🌙 날이 바뀌어서 오늘 체크를 새로 시작했어요');
    }
  }, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && dirty) push(); });
}

window.__home = {
  get state() { return state; }, get room() { return ROOM; }, log: DBG,
  get sync() { return { state: syncState, dirty, remoteDoc, lastPush }; },
  render, push, seedState, shareLink,
  zones: ZONES, inferZone, guessEmoji, nameMatches, ownedKeys, stockLevel, stockCount, allRecipes, RECIPES, GEMINI_RECIPES,
  subs: SUBS, subOf, inferSub, parseReceiptLines, isWeekend: () => { const w = curWd(); return w === 0 || w === 6; }
};

document.addEventListener('DOMContentLoaded', boot);
