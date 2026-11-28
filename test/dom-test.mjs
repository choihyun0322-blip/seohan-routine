// ============================================================
// 🗣️ 따라 말하기 카드 — DOM 통합 테스트 (진짜 index.html)
//   · 저장소의 index.html 을 jsdom 에서 그대로 띄웁니다.
//   · 기존 기능(탭·Sight Words·북클럽)이 그대로인지 + 새 세트(겨울 Q&A·파닉스) 확인
//   실행: node test/dom-test.mjs
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import {
  inlineForJsdom, assertIncludes, installStubs, makeRunner, loadJsdom, jsdomModule,
  repoDir, sleep
} from './helpers.mjs';

const JSDOM = loadJsdom();
const t = makeRunner('dom-test · 실제 index.html + 따라 말하기 v0.2');

const HTML = fs.readFileSync(path.join(repoDir(), 'index.html'), 'utf8');

/* ------------------------------------------------------------
   1. 배선 — index.html 에 speaking 3줄 + 버전
------------------------------------------------------------ */
t.ok('index.html 에 speaking 3줄이 있음', (() => { try { assertIncludes(HTML); return true; } catch (e) { return false; } })());
const iCss = HTML.indexOf('./speaking/speaking.css');
const iData = HTML.indexOf('./speaking/speaking.data.js');
const iJs = HTML.indexOf('./speaking/speaking.js');
t.ok('순서 css → data → js', iCss > 0 && iCss < iData && iData < iJs);
t.ok('</body> 바로 앞에 들어감(맨 끝)', HTML.lastIndexOf('</body>') - iJs < 300, 'gap=' + (HTML.lastIndexOf('</body>') - iJs));
t.ok('앱 버전 v5.7.0', HTML.indexOf("APP_VERSION = '5.7.0'") >= 0);
t.ok('모듈 버전 0.2.0', HTML.indexOf("VERSION = '0.2.0'") < 0, '모듈은 파일 분리');

/* ------------------------------------------------------------
   2. jsdom 에서 앱 띄우기
------------------------------------------------------------ */
const html = inlineForJsdom(HTML);
const errors = [];
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://seohan.test/seohan-routine/index.html',
  virtualConsole: new (jsdomModule().VirtualConsole)().sendTo(console, { omitJSDOMErrors: true }),
  beforeParse(window) {
    installStubs(window);
    window.addEventListener('error', ev => errors.push(ev && ev.message ? ev.message : 'error'));
  }
});
const w = dom.window;
const d = w.document;
await new Promise(res => {
  if (d.readyState === 'complete') res();
  else w.addEventListener('load', res);
  setTimeout(res, 8000);
});
await sleep(600);

const $ = sel => d.querySelector(sel);
const APP = w.__seohanTest;
const SP = w.SEOHAN_SPEAKING;
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

/* ------------------------------------------------------------
   3. 기존 기능이 그대로인지
------------------------------------------------------------ */
t.ok('앱이 그대로 뜸(v5.7.0)', !!APP && APP.version === '5.7.0', APP && APP.version);
t.ok('기존 탭 3개 그대로', d.querySelectorAll('#weekdayTabbar .tab-btn').length === 3);
t.ok('Sight Words 단어 목록 그대로(15단어)', APP.sight.list().length >= 15, String(APP.sight.list().length));
t.ok('단어 놀이 판이 그대로 그려짐', d.querySelectorAll('#sightOptions .opt-btn').length === 4);
t.ok('📖 북클럽 패치 3줄도 그대로', HTML.includes('./bookclub/bookclub.js'));
t.ok('모달은 처음에 닫혀 있음', $('#spModal').hidden === true);
t.eq('JS 오류 0', errors.length, 0, errors.join(' | '));

/* 기존 놀이 동작 */
APP.sight.setMode('listen');
APP.sight.next();
const q0 = APP.sight.question();
APP.sight.answer(q0.key);
t.ok('기존 [듣고 단어 콕] 정답 처리 그대로', APP.sight.question().answered === true);
APP.sight.next();
t.ok('기존 [다음 문제] 그대로', APP.sight.question().answered === false);

/* 문장 빈칸 놀이 — 문장 전체를 들려주는지 */
APP.sight.setMode('fill');
await sleep(80);
const qf = APP.sight.question();
const before = w.__spokenLog.length;
$('#sightAsk').click();
await sleep(200);
const said = w.__spokenLog.slice(before).map(x => x.text);
t.ok('빈칸 놀이에서 소리가 남', said.length > 0, JSON.stringify(said));
t.eq('★ 들려준 문장 = 문장 전체(정답 단어 빠지지 않음)', norm(said[said.length - 1] || ''), norm(qf.sentence));

/* ------------------------------------------------------------
   4. 따라 말하기 — 사이트워드 세트 (기존 흐름)
------------------------------------------------------------ */
t.ok('Sight Words 히어로 카드에 [따라 말하기] 버튼', !!$('#spOpenBtn') && $('#spOpenBtn').closest('.card-sight-hero') !== null);
t.ok('버튼은 기존 모드 전환 아래·놀이 안내 위', (() => {
  const hero = $('#spOpenBtn').closest('.card-sight-hero');
  const mode = hero.querySelector('#sightModeSwitch');
  const q = hero.querySelector('.sight-queue');
  return mode && q && mode.compareDocumentPosition($('#spOpenBtn')) & 4 &&
    $('#spOpenBtn').compareDocumentPosition(q) & 4;
})());
t.ok('히어로 카드에 [❄️ 12월 겨울 Q&A] 바로 열기 칩', !!$('#spQuick [data-sp-set="winter"]'));
t.ok('히어로 카드에 [🔤 겨울 단어] 바로 열기 칩', !!$('#spQuick [data-sp-set="phonics"]'));

t.eq('한 세트 5장(단어 후보가 넉넉하면)', SP.cards().length, 5);
t.ok('카드는 앱의 문장(ex)에서 만들어짐', SP.cards().every(c => c.sentence && c.pic));

$('#spOpenBtn').click();
await sleep(250);
t.ok('버튼을 누르면 모달이 열림', !$('#spModal').hidden && SP.isOpen());
t.eq('1단계(듣고 따라 말하기)부터 시작', SP.stage(), 'echo');
t.eq('세트 칩 3개', d.querySelectorAll('#spSets .sp-set').length, 3);
const c1 = SP.card();
t.eq('1단계 카드에 문장 전체가 보임', $('#spSent').textContent, c1.sentence);
const said2 = w.__spokenLog.slice(-1)[0] || {};
t.eq('1단계 — 문장 전체를 들려줌', norm(said2.text), norm(c1.sentence));
t.ok('처음엔 "따라 말해 봐" 숨김(2초 쉼 중)', SP.pauseDone() === false);
await sleep(2300);
t.ok('2초 쉼 뒤 "이제 따라 말해 봐!"', SP.pauseDone() === true && !$('#spTurn').hidden);

const s0 = SP.stars();
$('#spOk').click();
await sleep(50);
t.eq('✓ → 별 +1', SP.stars(), s0 + 1);
await sleep(900);
t.ok('✓ → 다음 카드', SP.card().word !== c1.word, SP.card().word);

/* 2단계: 카드 보고 말하기 + 자동 확인 */
$('#spNextStage').click();
await sleep(120);
t.eq('2단계로 이동', SP.stage(), 'card');
t.ok('2단계는 가림 문장', $('#spSent').textContent.indexOf('▢') >= 0, $('#spSent').textContent);
const c2 = SP.card();
$('#spMic').click();
await sleep(60);
w.__rec.say(c2.hint);
await sleep(900);
t.ok('핵심 단어를 말하면 자동 통과 → 별 +1', SP.stars() === s0 + 2, 'stars=' + SP.stars());

/* 3단계 → 앱의 빈칸 놀이로 */
$('#spNextStage').click();
await sleep(150);
t.eq('3단계로 이동', SP.stage(), 'fill');
t.ok('3단계는 빈칸 문장', $('#spSent').textContent.indexOf('_____') >= 0);
$('#spNextStage').click();
await sleep(200);
t.ok('3단계 마지막 버튼 → 모달 닫힘', !SP.isOpen() && $('#spModal').hidden);
t.eq('★ 앱이 [문장 빈칸 놀이] 모드로 바뀜', APP.sight.mode(), 'fill');

/* ------------------------------------------------------------
   5. ❄️ 12월 겨울 Q&A (실제 앱 화면)
------------------------------------------------------------ */
$('#spQuick [data-sp-set="winter"]').click();
await sleep(250);
t.ok('히어로 카드의 칩으로 겨울 세트가 열림', SP.isOpen() && SP.set() === 'winter');
t.eq('겨울 카드 10장', SP.cards().length, 10);
t.ok('겨울 칩이 켜짐', d.querySelector('#spSets [data-sp-set="winter"]').classList.contains('is-on'));
const q1 = SP.card();
t.ok('4번째 카드 질문이 교재 그대로', (() => { SP.go(3); return $('#spQ').textContent.indexOf('What can you see in winter?') >= 0; })());
t.ok('4번 카드 빈칸 틀', $('#spSent').textContent === 'I can see ______.', $('#spSent').textContent);
t.eq('4번 보기 칩 3개', d.querySelectorAll('#spChoices .sp-choice').length, 3);
t.eq('4번 보기 첫 칩 글자', d.querySelectorAll('#spChoices .sp-choice-main')[0].textContent.trim(), 'Christmas trees');
t.ok('4번 보기마다 🔤', d.querySelectorAll('#spChoices .sp-choice-ph').length === 3);

const beforePick = w.__spokenLog.length;
d.querySelectorAll('#spChoices .sp-choice-main')[2].click();
await sleep(120);
const pickSaid = w.__spokenLog.slice(beforePick).map(x => x.text);
t.ok('보기를 누르면 질문 → 완성 문장 순서로 읽어 줌',
  pickSaid.indexOf('What can you see in winter?') >= 0 && pickSaid.indexOf('I can see Santa Claus.') >= 0,
  JSON.stringify(pickSaid));
t.eq('화면 문장도 완성됨', $('#spSent').textContent, 'I can see Santa Claus.');

const beforePh = w.__spokenLog.length;
d.querySelectorAll('#spChoices .sp-choice-ph')[1].click();
await sleep(700);
const phSaid = w.__spokenLog.slice(beforePh).map(x => x.text.toLowerCase());
t.ok('🔤 snow — 천천히·글자·다시', phSaid.indexOf('snow') >= 0 && phSaid.some(x => x.indexOf('s. n. o. w') >= 0), JSON.stringify(phSaid));
t.ok('🔤 분절 힌트가 화면에', $('#spPh').textContent.indexOf('s · n · ow') >= 0, $('#spPh').textContent);

/* 2단계 — 대답 보기 → 완성 문장 */
SP.setStage('card');
await sleep(120);
t.eq('겨울 2단계', SP.stage(), 'card');
SP.go(3);                                   /* 4번 문항 카드로 */
await sleep(120);
t.eq('2단계 대답 보기 칩(4번 = 3개)', d.querySelectorAll('#spChoices .sp-choice').length, 3);
const beforeA = w.__spokenLog.length;
d.querySelectorAll('#spChoices .sp-choice-main')[0].click();
await sleep(120);
t.ok('2단계 — 고른 대답 문장을 읽어 줌',
  w.__spokenLog.slice(beforeA).map(x => x.text).indexOf('I can see Christmas trees.') >= 0,
  JSON.stringify(w.__spokenLog.slice(beforeA).map(x => x.text)));

/* ✓ → winter 완료 열쇠 */
const s1 = SP.stars();
$('#spOk').click();
await sleep(400);
t.ok('겨울 카드 ✓ → 별 +1', SP.stars() >= s1 + 1, 'stars=' + SP.stars());
t.ok('완료 열쇠에 winter 세트', Object.keys(SP.done()).some(k => /^winter\|card\|q\d\d$/.test(k)), JSON.stringify(SP.done()));

/* 마지막 단계 버튼 → 🔤 겨울 단어 세트 */
SP.setStage('fill');
await sleep(120);
$('#spNextStage').click();
await sleep(200);
t.eq('겨울 3단계 마지막 버튼 → 🔤 단어 세트', SP.set(), 'phonics');
t.ok('단어 카드가 보임', $('#spSent').classList.contains('is-word') && $('#spSent').textContent.length > 0);
t.ok('단계 탭 숨김', $('#spSteps').hidden === true);

const beforeWord = w.__spokenLog.length;
$('#spPlay').click();
await sleep(800);
const wordSaid = w.__spokenLog.slice(beforeWord).map(x => x.text.toLowerCase());
t.ok('단어 카드 🔊 → 파닉스 3단계로 읽음', wordSaid.length >= 3, JSON.stringify(wordSaid));
t.ok('분절 힌트가 늘 보임', !$('#spPh').hidden && $('#spPh').textContent.indexOf('🔤') >= 0, $('#spPh').textContent);

SP.close();
t.ok('닫기', !SP.isOpen() && $('#spModal').hidden);

/* ------------------------------------------------------------
   6. 앱을 건드리지 않았는지 (탭 전환 후에도 버튼 유지)
------------------------------------------------------------ */
APP.setTab('evening');
await sleep(150);
APP.setTab('sight');
await sleep(250);
t.ok('탭을 오가도 버튼이 살아 있음', !!$('#spOpenBtn'));
t.eq('탭을 오가도 버튼은 1개', d.querySelectorAll('#spOpenBtn').length, 1);
APP.setTab('morning');
await sleep(120);

t.eq('마지막까지 JS 오류 0', errors.length, 0, errors.join(' | '));

const pass = t.report();
process.exit(pass ? 0 : 1);
