/* ============================================================
   🏡 우리집 살림 관제소  —  app.js
   Firebase RTDB 실시간 동기화 + localStorage 백업 (한도 0%)
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
const LISTS = ['routines', 'care', 'shopping', 'pantry', 'stock'];
const WD = ['일', '월', '화', '수', '목', '금', '토'];

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
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 1900);
}
function haptic() { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) { } }

/* ---------------- seed data ---------------- */
const RHYTHM = {
  1: { em: '몰아하기', sub: '청소·빨래 4개', hot: true, tasks: ['장난감 정리', '청소기 돌리기', '세탁기 돌리기', '빨래 개기'] },
  2: { em: '매일 루틴만', sub: '무리 안 하기', tasks: [] },
  3: { em: '빨래통 내놓기', sub: '설거지 패스 OK', hot2: true, tasks: ['빨래통 내놓기', '설거지 패스 (청연 대비 가능)'] },
  4: { em: '청연 방문', sub: '청소의 날', tasks: ['청연 방문 — 청소의 날'] },
  5: { em: '가볍게!', sub: '주말 전 정리', tasks: ['가볍게 정리 · 주말 준비'] },
  6: { em: '가족 시간', sub: '아이랑 놀기', tasks: [] },
  0: { em: '주간 정리', sub: '다음 주 준비', tasks: ['주간 정리 · 냉장고 비우기'] }
};

const DEFAULT_SETTINGS = { trash: { on: false, trashDay: 4, recyDay: 5 } };

function seedState() {
  const t = todayISO();
  const R = (slot, time, text, sub, cond, days, key) => ({ id: uid('r'), slot, time: time || '', text, sub: sub || '', cond: cond || 'all', days: days || [], key: !!key, ord: 0 });
  const am = [
    R('am', '', '기상 · 세수 · 양치'),
    R('am', '', '화장 · 옷입기', '', 'office'),
    R('am', '07:20', '서한이 깨우며 아침 차려주기'),
    R('am', '', '서한이 준비물 챙기기', '물통 · 젓가락'),
    R('am', '08:00', '서한이 세수 · 양치'),
    R('am', '08:10', '서한이 옷입기'),
    R('am', '08:15', '출발 🚗')
  ];
  const pm = [
    R('pm', '18:00', '집 도착', '~18:30'),
    R('pm', '', '샤워 · 저녁', '순서는 그날그날'),
    R('pm', '', '설거지'),
    R('pm', '', '서한이 공부 봐주기'),
    R('pm', '', '정리 · 내일 준비'),
    R('pm', '', '서한이 샤워'),
    R('pm', '', '🧴 로션 꼭 바르기!', '', 'all', [], true),
    R('pm', '', '양치'),
    R('pm', '', '책 읽기'),
    R('pm', '', '취침 🌜')
  ];
  const routines = [...am, ...pm].map((r, i) => ({ ...r, ord: i }));

  const C = (emoji, name, days, ago, ord) => ({ id: uid('c'), emoji, name, days, last: addDays(t, -ago), ord });
  const care = [
    C('🪥', '아이 칫솔', 30, 32, 0),
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
    C('🪟', '방충망 · 창틀 닦기', 90, 66, 12)
  ];

  const shopping = [
    { id: uid('s'), name: '계란', cat: 'food', done: false, ord: 0 },
    { id: uid('s'), name: '대파', cat: 'food', done: false, ord: 1 },
    { id: uid('s'), name: '두부', cat: 'food', done: false, ord: 2 },
    { id: uid('s'), name: '물티슈', cat: 'living', done: false, ord: 3 },
    { id: uid('s'), name: '키친타올', cat: 'living', done: false, ord: 4 }
  ];

  const P = (name, emoji, expDays, ord) => ({ id: uid('p'), name, emoji, exp: addDays(t, expDays), ord });
  const pantry = [
    P('밥', '🍚', 1, 0),
    P('김치', '🥬', 10, 1),
    P('계란', '🥚', 12, 2),
    P('두부', '🧈', 1, 3),
    P('대파', '🌿', 4, 4),
    P('양파', '🧅', 20, 5),
    P('감자', '🥔', 15, 6),
    P('당근', '🥕', 8, 7),
    P('애호박', '🥒', 3, 8),
    P('우유', '🥛', 2, 9)
  ];

  const S = (name, emoji, level, ord) => ({ id: uid('k'), name, emoji, level, ord });
  const stock = [
    S('물티슈', '🧻', 'none', 0),
    S('키친타올', '🧻', 'none', 1),
    S('휴지', '🧻', 'low', 2),
    S('세탁세제', '🧴', 'low', 3),
    S('주방세제', '🧴', 'enough', 4),
    S('샴푸', '🧴', 'enough', 5),
    S('치약', '🪥', 'enough', 6),
    S('비누', '🧼', 'enough', 7),
    S('봉지', '🛍️', 'low', 8)
  ];

  return {
    v: 3, mode: 'home', day: t, checks: {},
    routines, care, shopping, pantry, stock,
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
  };
}

/* ---------------- recipes (30) ---------------- */
const RECIPES = [
  ['김치볶음밥', '🍚', '집밥', '10분', ['밥', '김치', '계란', '대파', '참기름'], '김치를 잘게 썰어 볶다가 밥·참기름 넣고 비벼요. 계란 프라이는 따로 올려요.'],
  ['계란말이', '🍳', '집밥', '8분', ['계란', '대파', '당근', '소금'], '계란 3개 풀어 다진 채소 넣고 얇게 부쳐 돌돌 말아요.'],
  ['계란찜', '🥚', '집밥', '15분', ['계란', '대파', '새우젓', '물'], '계란에 물 1/2컵 넣고 체에 걸러 뚜껑 덮고 약불 12분 쪄요.'],
  ['두부김치', '⬜', '집밥', '12분', ['두부', '김치', '대파', '참기름'], '두부 노릇하게 굽고 김치 볶아 위에 올려요.'],
  ['된장찌개', '🍲', '집밥', '20분', ['된장', '두부', '애호박', '감자', '양파', '대파'], '멸치육수에 된장 풀고 감자→애호박→두부 순으로 넣어 끓여요.'],
  ['김치찌개', '🍲', '집밥', '25분', ['김치', '돼지고기', '두부', '대파'], '김치 먼저 볶아 감칠맛 내고 물 붓고 돼지고기·두부 넣어 끓여요.'],
  ['미역국', '🥣', '집밥', '20분', ['미역', '소고기', '국간장', '참기름'], '불린 미역과 소고기 볶다 물 붓고 국간장으로 간해요.'],
  ['콩나물국', '🥣', '집밥', '12분', ['콩나물', '대파', '마늘', '소금'], '콩나물 뚜껑 덮고 8분 끓인 뒤 대파·마늘·소금으로 마무리.'],
  ['애호박전', '🥒', '집밥', '15분', ['애호박', '계란', '부침가루', '소금'], '애호박 반달썰기→부침가루→계란물 순으로 묻혀 노릇하게 부쳐요.'],
  ['감자조림', '🥔', '집밥', '18분', ['감자', '간장', '설탕', '마늘'], '감자 한번 데쳐 기름에 볶다 간장·설탕·물 넣고 졸여요.'],
  ['어묵볶음', '🍢', '집밥', '10분', ['어묵', '양파', '간장', '고추장'], '어묵·양파 볶다 간장:고추장 2:1 양념 넣고 물 졸여요.'],
  ['멸치볶음', '🐟', '집밥', '10분', ['멸치', '견과', '간장', '설탕', '올리고당'], '마른 팬에 멸치 볶아 비린내 날리고 양념 넣고 견과 섞어요.'],
  ['소시지야채볶음', '🌭', '집밥', '10분', ['소시지', '양파', '피망', '케첩'], '소시지 칼집내 볶다 채소 넣고 케첩·간장 조금으로 간해요.'],
  ['카레라이스', '🍛', '집밥', '25분', ['카레가루', '감자', '당근', '양파', '밥'], '고기·채소 볶다 물 붓고 카레 풀어 15분 끓여 밥 위에.'],
  ['짜장밥', '🍜', '집밥', '10분', ['짜장소스', '밥', '양파', '계란'], '양파 볶아 짜장소스 넣고 물 조금, 밥 위에 계란 프라이.'],
  ['토마토달걀볶음', '🍅', '집밥', '10분', ['토마토', '계란', '대파', '소금'], '계란 먼저 스크램블→토마토 볶다 합쳐 소금간.'],
  ['참치마요덮밥', '🍱', '집밥', '5분', ['참치캔', '밥', '마요네즈', '김', '간장'], '참치 기름 빼고 간장 조금에 볶아 밥 위에 마요와 함께.'],
  ['김치전', '🥞', '집밥', '12분', ['김치', '부침가루', '김치국물'], '김치 썰어 부침가루+김치국물 반죽해 앞뒤 노릇하게.'],
  ['부대찌개', '🍲', '집밥', '25분', ['소시지', '김치', '라면사리', '두부', '고추장'], '모든 재료 한 냄비에 담고 육수 부어 끓이다 라면사리 마지막에.'],
  ['잡채', '🍜', '집밥', '30분', ['당면', '시금치', '당근', '양파', '간장', '참기름'], '당면 삶아 양념 비비고 채소 각각 볶아 합쳐요.'],
  ['오므라이스', '🍳', '집밥', '15분', ['밥', '계란', '양파', '당근', '케첩'], '케첩 볶음밥 만들고 계란 얇게 부쳐 감싸요.'],
  ['순두부찌개', '🍲', '집밥', '15분', ['순두부', '계란', '대파', '고춧가루', '양파'], '고춧가루 기름에 볶아 물 붓고 순두부 넣어 끓이다 계란 풀기.'],
  ['닭볶음탕', '🍗', '집밥', '35분', ['닭', '감자', '당근', '양파', '고추장', '간장'], '닭 데쳐 잡내 빼고 양념 넣어 20분 끓인 뒤 채소 넣고 더 끓여요.'],
  ['고등어조림', '🐟', '집밥', '25분', ['고등어', '무', '대파', '간장', '고춧가루'], '무 깔고 고등어 올려 양념물 붓고 중약불 15분.'],
  ['감자수제비', '🥣', '집밥', '25분', ['감자', '밀가루', '애호박', '대파'], '감자 삶아 으깨 밀가루 반죽→육수에 떼어 넣고 채소 넣어 끓여요.'],
  ['소고기무국', '🍲', '집밥', '25분', ['소고기', '무', '대파', '국간장'], '소고기 볶다 무 넣고 물 부어 15분, 국간장·대파로 마무리.'],
  ['야채죽', '🍚', '유아식', '15분', ['밥', '당근', '애호박', '계란', '참기름'], '밥에 물 넉넉히 붓고 다진 채소 넣어 퍼지게 끓인 뒤 계란 풀기.'],
  ['두부조림', '⬜', '유아식', '12분', ['두부', '간장', '대파', '마늘'], '두부 지져 간장·마늘 양념물 붓고 졸여요.'],
  ['소고기애호박볶음', '🥒', '유아식', '12분', ['소고기', '애호박', '양파', '간장'], '다진 소고기 볶다 애호박·양파 넣고 간장 조금.'],
  ['감자당근볶음', '🥕', '유아식', '15분', ['감자', '당근', '양파', '참기름'], '채 썬 감자·당근 푹 익도록 볶아 참기름·소금으로 마무리.']
].map((r, i) => ({ id: 'rc' + (i + 1), name: r[0], emoji: r[1], kind: r[2], time: r[3], ings: r[4], steps: r[5] }));

const FREQ = [
  ['우유', 'food'], ['계란', 'food'], ['김치', 'food'], ['두부', 'food'], ['대파', 'food'],
  ['양파', 'food'], ['당근', 'food'], ['감자', 'food'], ['사과', 'food'], ['바나나', 'food'],
  ['물티슈', 'living'], ['키친타올', 'living'], ['휴지', 'living'], ['세탁세제', 'living'],
  ['주방세제', 'living'], ['봉지', 'living'], ['샴푸', 'living'], ['치약', 'living']
];

/* ---------------- state ---------------- */
let ROOM = (function () {
  let r = new URLSearchParams(location.search).get('room');
  if (!r || !/^[A-Za-z0-9_-]{6,64}$/.test(r)) r = DEFAULT_ROOM;
  return r;
})();
const LSKEY = 'seohan-home-v3:' + ROOM;
let state = null;
let ui = { tab: 'today', filter: 'all', showAllRec: false };

function normalize(st) {
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
     (부분 패치를 직접 합치다 생기는 어긋남을 없애는 가장 안전한 방식)
   ------------------------------------------------------------------ */
const SPATH = '/rooms/' + encodeURIComponent(ROOM) + '/state';
let remoteDoc = null, baseRemote = null, es = null;
let dirty = false, pushTimer = null, refetchTimer = null, needRefetch = false, syncState = 'off';
const DBG = [];
function dbg(tag, v) { DBG.push([new Date().toISOString().slice(11, 23), tag, v]); if (DBG.length > 200) DBG.shift(); }

function copy(v) { return JSON.parse(JSON.stringify(v)); }
function remoteShape(st) {
  // base 비교용이므로 반드시 깊은 복사 (state 객체를 그대로 참조하면 변경 감지가 안 됨)
  const o = { mode: st.mode, day: st.day, checks: copy(st.checks || {}), settings: copy(st.settings || {}) };
  LISTS.forEach(k => { const m = {}; (st[k] || []).forEach(it => { m[it.id] = copy(it); }); o[k] = m; });
  return o;
}
function localShape(r) {
  if (!r || typeof r !== 'object') return null;
  const st = { mode: r.mode, day: r.day, checks: r.checks || {}, settings: r.settings || {} };
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
function nest(patch) {
  const o = {};
  Object.keys(patch).forEach(p => {
    const parts = p.split('/'); let c = o;
    parts.forEach((s, i) => { if (i === parts.length - 1) c[s] = patch[p]; else { c[s] = c[s] || {}; c = c[s]; } });
  });
  return o;
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
  const patch = buildPatch();
  dbg('push', Object.keys(patch).length + ' keys; trashon=' + state.settings.trash.on + ' base=' + JSON.stringify((baseRemote || {}).settings) + ' patch=' + Object.keys(patch).filter(k => k.indexOf('settings') === 0).join('|'));
  if (!Object.keys(patch).length) { dirty = false; setSync('ok'); return; }
  try {
    const r = await fetch(DBURL + SPATH + '.json', {
      // RTDB REST PATCH는 중첩 객체를 통째로 교체하므로, 'a/b/c' 형태의 다중 경로 키로 보낸다
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    // 서버에 실제로 들어간 잎사귀만 base에 반영한다 (그 사이 바뀐 로컬 값까지 반영하면 다음 diff가 사라짐)
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
    dbg('fetch', (docIsEmpty(doc) ? 'EMPTY' : 'trash=' + JSON.stringify((doc.settings || {}).trash)) + ' ' + (docIsEmpty(doc) ? '' : '') + (docIsEmpty(doc) ? '' : Object.keys(doc).map(k => k + ':' + (doc[k] && typeof doc[k] === 'object' ? Object.keys(doc[k]).length : String(doc[k]))).join(',')));
    if (docIsEmpty(doc)) {
      // 방이 비어 있음 — 이 기기에 살림 데이터가 있으면 올린다 (덮어쓰지 않는다)
      remoteDoc = null; baseRemote = {};
      if (state && (state.routines || []).length) { schedulePush(); }
      setSync(dirty ? 'busy' : 'ok');
      return;
    }
    if (dirty) { needRefetch = true; setSync('busy'); return; }  // 아직 안 올린 내 변경이 있으면 덮어쓰지 않는다
    remoteDoc = doc;
    applyRemote(doc);
    setSync('ok');
  } catch (e) { setSync('off'); }
}
function applyRemote(doc) {
  const raw = localShape(doc);
  if (!raw) return;
  const st = normalize(raw);
  baseRemote = remoteShape(st);
  const same = JSON.stringify(st) === JSON.stringify(state);
  dbg('apply', 'r' + st.routines.length + ' s' + st.shopping.length + ' c' + st.care.length + ' k' + st.stock.length);
  state = st; saveLocal();
  if (!same) render();
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
  let pend = false;
  try { pend = localStorage.getItem(LSKEY + ':pending') === '1'; } catch (e) { }
  if (pend) { await push(); }
  await fetchState();
  openStream();
  window.addEventListener('online', () => { setSync(dirty ? 'busy' : 'ok'); push(); openStream(); });
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
  const none = state.stock.filter(s => s.level === 'none');
  if (none.length) {
    out.push({
      cls: '', ic: '🔴', title: '다 떨어진 생필품 ' + none.length + '개',
      sub: none.slice(0, 3).map(s => s.name).join(' · ') + (none.length > 3 ? ' 외' : ''),
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
  $('#todayChip').textContent = WD[wd] + '요일 · ' + (state.mode === 'home' ? '재택' : '출근');

  // week rhythm
  $('#week').innerHTML = [1, 2, 3, 4, 5, 6, 0].map(d => {
    const r = RHYTHM[d];
    const cls = ['wd', r.hot ? 'hot' : '', r.hot2 ? 'hot2' : '', d === wd ? 'today' : ''].filter(Boolean).join(' ');
    return '<div class="' + cls + '"><div class="d">' + WD[d] + '</div><div class="n"><em>' + esc(r.em) + '</em><br>' + esc(r.sub) + '</div></div>';
  }).join('');

  // day tasks
  const tasks = (rh.tasks || []);
  $('#dayTasks').innerHTML = tasks.map((t, i) => {
    const k = 't' + i, done = !!state.checks[k];
    return '<button class="dtask ' + (done ? 'done' : '') + '" data-act="toggle" data-id="' + k + '">' + (done ? '✓ ' : '') + esc(t) + '</button>';
  }).join('');

  // timelines
  const am = visibleSteps('am'), pm = visibleSteps('pm');
  const amDone = am.filter(r => state.checks[r.id]).length;
  const pmDone = pm.filter(r => state.checks[r.id]).length;

  const hiddenOffice = state.mode === 'home' ? state.routines.filter(r => r.slot === 'am' && r.cond === 'office') : [];
  const hiddenHome = state.mode === 'office' ? state.routines.filter(r => r.slot === 'am' && r.cond === 'home') : [];
  let note = '';
  if (hiddenOffice.length) note = '🏠 재택이라 <b>' + hiddenOffice.map(r => esc(r.text.split(' · ')[0])).join(' · ') + '</b>를 건너뛰었어요 — <b>출근</b>으로 바꾸면 자동으로 끼어들어요';
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

  // progress
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
    '<div class="ln"><b>' + esc(i.name) + '</b><small>' + (i.cat === 'food' ? '🥬 식재료' : '🧻 생필품') + '</small></div>' +
    '<button class="del" data-act="shopdel" data-id="' + i.id + '">✕</button></li>'
  ).join('') : '<li class="empty">' + (ui.filter === 'all' ? '구매리스트가 비었어요 — 아래 자주 사는 것에서 눌러 담아 보세요' : '이 분류에는 담긴 게 없어요') + '</li>';
  $('#freq').innerHTML = FREQ.map(f => '<button class="freqchip" data-act="freq" data-name="' + esc(f[0]) + '" data-cat="' + f[1] + '">＋ ' + esc(f[0]) + '</button>').join('');
}

/* ---------------- render : pantry + recipes ---------------- */
function ownedSet() {
  const s = new Set();
  state.pantry.forEach(p => s.add(norm(p.name)));
  state.shopping.filter(i => i.cat === 'food').forEach(i => s.add(norm(i.name)));
  return s;
}
function matchRecipe(r, owned) {
  let have = 0; const miss = [];
  r.ings.forEach(i => { if (owned.has(norm(i))) have++; else miss.push(i); });
  return { have, total: r.ings.length, miss, pct: Math.round(have / r.ings.length * 100) };
}
function renderPantry() {
  const list = state.pantry.slice().sort((a, b) => (a.ord || 0) - (b.ord || 0));
  $('#pantry').innerHTML = list.map(p => {
    const d = p.exp ? diffDays(todayISO(), p.exp) : null;
    const dd = d == null ? '' : '<span class="dd2 ' + (d < 0 ? 'bad' : (d <= 2 ? 'mid' : '')) + '">' + (d < 0 ? 'D+' + (-d) : (d === 0 ? 'D-DAY' : 'D-' + d)) + '</span>';
    return '<span class="pchip"><span class="e">' + p.emoji + '</span>' + esc(p.name) + dd +
      '<button class="x" data-act="pantrydel" data-id="' + p.id + '">✕</button></span>';
  }).join('') || '<span class="empty" style="padding:10px">냉장고 재료를 추가해 보세요</span>';
}
function renderRecipes() {
  const owned = ownedSet();
  const list = RECIPES.map(r => Object.assign({ r }, matchRecipe(r, owned)))
    .sort((a, b) => b.pct - a.pct || a.miss.length - b.miss.length || a.total - b.total);
  const ready = list.filter(x => x.pct === 100).length;
  $('#recChip').textContent = ready + '개 바로 가능';
  const show = ui.showAllRec ? list : list.slice(0, 6);
  $('#recList').innerHTML = show.map(x => {
    const cls = x.pct === 100 ? 'rc full' : 'rc';
    const pcls = x.pct === 100 ? 'good' : (x.pct >= 50 ? 'mid2' : '');
    const ings = x.r.ings.map(i => owned.has(norm(i))
      ? '<span class="ing">' + esc(i) + '</span>'
      : '<button class="ing miss" data-act="adding" data-name="' + esc(i) + '">' + esc(i) + ' ＋</button>').join('');
    return '<div class="' + cls + '">' +
      '<div class="rc-h"><span class="e">' + x.r.emoji + '</span>' +
      '<div class="nm"><b>' + esc(x.r.name) + '</b><small>' + x.r.kind + ' · ' + x.r.time + '</small></div>' +
      '<span class="rcp ' + pcls + '">' + x.have + '/' + x.total + ' · ' + x.pct + '%</span></div>' +
      '<div class="ings">' + ings + '</div>' +
      '<div style="display:flex;gap:5px;margin-top:8px;flex-wrap:wrap">' +
      (x.miss.length ? '<button class="rcbtn" data-act="fillmiss" data-id="' + x.r.id + '">＋ 없는 재료 ' + x.miss.length + '개 담기</button>' : '') +
      '<button class="rcbtn" data-act="recipeview" data-id="' + x.r.id + '">레시피 보기</button></div></div>';
  }).join('');
  $('#recToggle').textContent = ui.showAllRec ? '－ 접기' : '＋ 레시피 전체 보기 (' + RECIPES.length + '개)';
}

/* ---------------- render : stock ---------------- */
const LVL = { none: { t: '없음 🔴', cls: 'none', o: 0 }, low: { t: '부족 🟡', cls: 'low', o: 1 }, enough: { t: '충분 🟢', cls: 'enough', o: 2 } };
function renderStock() {
  const list = state.stock.slice().sort((a, b) => (LVL[a.level] || LVL.enough).o - (LVL[b.level] || LVL.enough).o || (a.ord || 0) - (b.ord || 0));
  const none = list.filter(s => s.level === 'none').length;
  $('#stockChip').textContent = none + '개 없음';
  $('#stockList').innerHTML = list.map(s => {
    const lv = LVL[s.level] || LVL.enough;
    const inList = state.shopping.some(i => norm(i.name) === norm(s.name) && !i.done);
    return '<div class="srow ' + (s.level === 'none' ? 'none' : s.level === 'low' ? 'low' : '') + '">' +
      '<span class="e">' + (s.emoji || '🧴') + '</span>' +
      '<div class="sn" data-act="stockedit" data-id="' + s.id + '"><b>' + esc(s.name) + '</b>' +
      '<small><span class="lvl ' + lv.cls + '">' + lv.t + '</span> ' + (inList ? '장바구니에 담김 ✓' : '') + '</small></div>' +
      '<div class="sbtn">' +
      '<button data-act="stockdec" data-id="' + s.id + '">－ 하나 씀</button>' +
      '<button data-act="stockinc" data-id="' + s.id + '">＋ 채움</button>' +
      (s.level !== 'enough' && !inList ? '<button class="send" data-act="stocksend" data-id="' + s.id + '">🛒</button>' : '') +
      '</div></div>';
  }).join('') || '<div class="empty">생필품을 추가해 보세요</div>';
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
  $('#panel-today').hidden = ui.tab !== 'today';
  $('#panel-shop').hidden = ui.tab !== 'shop';
  $$('.tabs .tab').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
  const all = shopRows().filter(i => !i.done).length;
  const none = state.stock.filter(s => s.level === 'none').length;
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
  const v = c || { emoji: '🧴', name: '', days: 30, last: todayISO() };
  openModal(id ? '주기 케어 수정' : '주기 케어 추가',
    '<div class="row2"><div class="field" style="flex:0 0 84px"><label>아이콘</label><input id="cEmoji" type="text" value="' + esc(v.emoji) + '" maxlength="4"></div>' +
    '<div class="field"><label>이름</label><input id="cName" type="text" value="' + esc(v.name) + '" placeholder="예: 제빙기 세척"></div></div>' +
    '<div class="row2"><div class="field"><label>주기 (일)</label><input id="cDays" type="number" min="1" max="365" value="' + esc(v.days) + '"></div>' +
    '<div class="field"><label>마지막으로 한 날</label><input id="cLast" type="date" value="' + esc(v.last || todayISO()) + '"></div></div>' +
    '<div class="note">완료를 누르면 오늘 날짜로 리셋되고 다음 D-Day가 자동으로 잡혀요.</div>',
    '<button class="btn sm" data-act="caresave" data-id="' + (id || '') + '">저장</button>' +
    (id ? '<button class="btn coral" data-act="caredelete" data-id="' + id + '">삭제</button>' : '<button class="btn ghost" data-act="close">취소</button>'));
}
function viewStockForm(id) {
  const s = state.stock.find(x => x.id === id);
  if (!s) return;
  modalView = { k: 'stockform', id };
  openModal('생필품 수정',
    '<div class="row2"><div class="field"><label>이름</label><input id="sName" type="text" value="' + esc(s.name) + '"></div>' +
    '<div class="field"><label>아이콘</label><input id="sEmoji" type="text" maxlength="4" value="' + esc(s.emoji || '🧴') + '"></div></div>' +
    '<div class="field"><label>재고 상태</label><select id="sLvl">' +
    ['none', 'low', 'enough'].map(l => '<option value="' + l + '"' + (s.level === l ? ' selected' : '') + '>' + LVL[l].t + '</option>').join('') +
    '</select></div>',
    '<button class="btn sm" data-act="stocksave" data-id="' + id + '">저장</button><button class="btn coral" data-act="stockdelete" data-id="' + id + '">삭제</button>');
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
  const r = RECIPES.find(x => x.id === id);
  if (!r) return;
  const owned = ownedSet();
  modalView = { k: 'recipe', id };
  openModal(r.emoji + ' ' + r.name,
    '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px"><span class="chip sage">' + r.kind + '</span><span class="chip line">' + r.time + '</span><span class="chip line">재료 ' + r.ings.length + '개</span></div>' +
    '<div style="font-size:10.5px;font-weight:800;color:#9C9285;margin-bottom:6px">재료</div>' +
    '<div class="ings">' + r.ings.map(i => owned.has(norm(i)) ? '<span class="ing">' + esc(i) + '</span>' : '<span class="ing miss">' + esc(i) + ' (없음)</span>').join('') + '</div>' +
    '<div style="font-size:10.5px;font-weight:800;color:#9C9285;margin:14px 0 6px">만드는 법</div>' +
    '<div style="font-size:12.5px;line-height:1.65;font-weight:600;color:var(--ink2)">' + esc(r.steps) + '</div>',
    '<button class="btn sm" data-act="fillmiss" data-id="' + id + '">없는 재료 담기</button><button class="btn ghost" data-act="close">닫기</button>');
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
  const stop = () => { e.preventDefault(); e.stopPropagation(); };

  switch (a) {
    case 'mode': {
      const m = el.dataset.mode;
      if (state.mode === m) return;
      mutate(s => { s.mode = m; });
      toast(m === 'home' ? '🏠 재택 모드 — 출근 전용 루틴은 숨겼어요' : '🏢 출근 모드 — 화장·옷입기 루틴이 켜졌어요');
      haptic();
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
      mutate(s => { const c = s.care.find(x => x.id === id); c.last = todayISO(); });
      toast('✅ ' + item.name + ' 완료 — 다음은 ' + md(addDays(todayISO(), item.days)) + '이에요');
      haptic();
      break;
    }
    case 'caresave': {
      const name = ($('#cName').value || '').trim();
      if (!name) { toast('이름을 적어 주세요'); return; }
      const data = { name, emoji: ($('#cEmoji').value || '🧴').trim() || '🧴', days: Math.max(1, Number($('#cDays').value) || 1), last: $('#cLast').value || todayISO() };
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
    case 'shoptoggle': mutate(s => { const i = s.shopping.find(x => x.id === id); if (i) i.done = !i.done; }); haptic(); break;
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
      const r = RECIPES.find(x => x.id === id);
      if (!r) return;
      const owned = ownedSet();
      let n = 0;
      r.ings.forEach(i => { if (!owned.has(norm(i)) && addShopping(i, 'food')) n++; });
      mutate(s => { });
      toast(n ? r.name + ' 없는 재료 ' + n + '개를 담았어요' : '이미 재료가 다 있어요');
      break;
    }
    case 'recipeview': viewRecipe(id); break;
    case 'rectoggle': ui.showAllRec = !ui.showAllRec; renderRecipes(); break;

    /* --- pantry --- */
    case 'pantryadd': {
      const inp = $('#pantryInput'), exp = $('#pantryExp').value;
      const name = (inp.value || '').trim();
      if (!name) { toast('재료 이름을 적어 주세요'); return; }
      mutate(s => { s.pantry.push({ id: uid('p'), name, emoji: guessEmoji(name), exp: exp || '', ord: Date.now() % 100000 }); });
      inp.value = ''; $('#pantryExp').value = '';
      toast(name + ' 넣었어요');
      break;
    }
    case 'pantrydel': mutate(s => { s.pantry = s.pantry.filter(p => p.id !== id); }); break;

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
      mutate(s => {
        const it = s.stock.find(x => x.id === id); if (!it) return;
        it.level = it.level === 'enough' ? 'low' : (it.level === 'low' ? 'none' : 'none');
      });
      const it = state.stock.find(x => x.id === id);
      if (it && it.level === 'none') toast(it.name + ' — 다 떨어졌어요 🔴');
      else haptic();
      break;
    }
    case 'stockinc': {
      mutate(s => {
        const it = s.stock.find(x => x.id === id); if (!it) return;
        it.level = 'enough';
      });
      haptic();
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
      const emoji = ($('#sEmoji').value || '🧴').trim() || '🧴', lvl = $('#sLvl').value;
      mutate(s => { const it = s.stock.find(x => x.id === id); if (it) { it.name = name; it.emoji = emoji; it.level = lvl; } });
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

function guessEmoji(name) {
  const map = { '물티슈': '🧻', '키친타올': '🧻', '휴지': '🧻', '세제': '🧴', '세탁세제': '🧴', '주방세제': '🧴', '샴푸': '🧴', '치약': '🪥', '칫솔': '🪥', '비누': '🧼', '봉지': '🛍️', '우유': '🥛', '계란': '🥚', '김치': '🥬', '두부': '🧈', '대파': '🌿', '양파': '🧅', '감자': '🥔', '당근': '🥕', '애호박': '🥒', '밥': '🍚', '사과': '🍎', '바나나': '🍌', '쌀': '🌾', '고기': '🥩', '닭': '🍗', '생선': '🐟' };
  return map[name] || '🧴';
}

/* inputs: Enter to add */
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
  state = loadLocal() || seedState();
  state = normalize(state);
  saveLocal();
  render();
  setSync('busy', '남편과 연결하는 중…');
  initSync();
  // 자정 지나면 오늘 체크 자동 리셋
  setInterval(() => {
    if (state.day !== todayISO()) {
      mutate(s => { s.day = todayISO(); s.checks = {}; });
      toast('🌙 날이 바뀌어서 오늘 체크를 새로 시작했어요');
    }
  }, 20000);
  // 화면 되살아날 때 동기화 상태 갱신
  document.addEventListener('visibilitychange', () => { if (!document.hidden && dirty) push(); });
}

window.__home = {
  get state() { return state; }, get room() { return ROOM; }, log: DBG,
  get sync() { return { state: syncState, dirty, remoteDoc }; },
  render, push, seedState, shareLink
};

document.addEventListener('DOMContentLoaded', boot);
