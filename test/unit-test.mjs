// ============================================================
// 🗣️ 따라 말하기 카드 — 단위 테스트 (모듈만 최소 화면에 붙여서)
//   실행: node test/unit-test.mjs
// ============================================================
import { loadJsdom, jsdomModule, installStubs, makeRunner, readPatchFile, sleep } from './helpers.mjs';

const JSDOM = loadJsdom();
const t = makeRunner('unit-test · 말하기 카드 모듈 단위');

const SIGHT_FIXTURE = {
  title: 'test',
  words: [
    {
      w: 'even', ko: '~조차', st: 'weak', note: '',
      pics: [['flat', '🛣️']],
      ex: [
        ['The box is even and flat.', 'box', '📦'],
        ['I can run even faster now.', 'run', '🏃']
      ]
    },
    {
      w: 'put', ko: '놓다', st: 'known', note: '',
      ex: [['I put the cap on.', 'cap', '🧢'], ['Ben put the jam on the bun.', 'jam', '🍓']]
    },
    {
      w: 'why', ko: '왜', st: 'weak', note: '',
      ex: [['Why did he shut the box?', 'box', '📦']]
    },
    {
      w: 'yellow', ko: '노란', st: 'known', note: '',
      ex: [['The sun is yellow.', 'sun', '☀️']]
    },
    { w: 'nosentence', ko: '문장없음', st: 'known', note: '', ex: [] }
  ]
};

function pageHtml(lang) {
  return '<!DOCTYPE html><html lang="' + lang + '"><head><meta charset="utf-8"></head><body>' +
    '<div class="panel panel-sight" id="panelSight">' +
      '<section class="card card-sight-hero" id="sightHero">' +
        '<p class="sight-queue" id="sightQueue"></p>' +
      '</section>' +
    '</div>' +
    '<button id="modeFill" data-mode="fill"></button>' +
    '<script>window.SIGHT_DATA = ' + JSON.stringify(SIGHT_FIXTURE) + ';</script>' +
    '<script>window.__seohanTest = { sight: { list: function () { return [' +
      '{w:"even",st:"weak"},{w:"put",st:"known"},{w:"why",st:"weak"},{w:"yellow",st:"known"}]; } } };</script>' +
    '<script>document.getElementById("modeFill").addEventListener("click", function(){' +
      'window.__modeFillClicked = (window.__modeFillClicked || 0) + 1;});</script>' +
    '<script>' + readPatchFile('speaking.data.js') + '</script>' +
    '<script>' + readPatchFile('speaking.js') + '</script>' +
    '</body></html>';
}

async function makeDom(lang = 'ko', stubs = {}) {
  const dom = new JSDOM(pageHtml(lang), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://seohan.test/seohan-routine/',
    virtualConsole: new (jsdomModule().VirtualConsole)().sendTo(console, { omitJSDOMErrors: true }),
    beforeParse(window) { installStubs(window, stubs); }
  });
  await sleep(150);
  // 테스트용 빠른 설정 (실제 기본값은 speaking.data.js: 쉼 2초 · 자동 넘김 650ms)
  dom.window.SPEAKING_DATA.options.echoPauseMs = 40;
  dom.window.SPEAKING_DATA.options.autoAdvanceMs = 200;
  return dom;
}

const spoken = (win) => (win.__spokenLog || []);

const dom = await makeDom('ko');
const w = dom.window;
const d = w.document;
const SP = w.SEOHAN_SPEAKING;
const $ = sel => d.querySelector(sel);

/* ------------------------------------------------------------
   1. 붙었는지 · 버튼 · 바로 열기 칩
------------------------------------------------------------ */
t.ok('모듈이 window.SEOHAN_SPEAKING 으로 붙음 (v0.2.0)', !!SP && SP.version === '0.2.0');
t.ok('Sight Words 히어로 카드에 [따라 말하기] 버튼 생성', !!$('#spOpenBtn'));
t.ok('버튼은 카드 안(.sight-queue 앞)에 들어감',
  $('#spOpenBtn').closest('.card-sight-hero') === $('#sightHero'));
t.ok('버튼 문구가 한국어(html lang=ko)', $('#spOpenBtn').textContent.indexOf('따라 말하기') >= 0, $('#spOpenBtn').textContent);
t.ok('세트 장수 pill 표시', $('#spOpenBtn').textContent.indexOf('5장') >= 0);
t.ok('카드 아래 [❄️ 12월 겨울 Q&A] 바로 열기 칩', !!$('#spQuick [data-sp-set="winter"]'));
t.ok('카드 아래 [🔤 겨울 단어] 바로 열기 칩', !!$('#spQuick [data-sp-set="phonics"]'));
t.ok('바로 열기 칩 문구', $('#spQuick [data-sp-set="winter"]').textContent.indexOf('12월 겨울 Q&A') >= 0,
  $('#spQuick [data-sp-set="winter"]').textContent);

/* ------------------------------------------------------------
   2. 사이트워드 세트 (기존 그대로)
------------------------------------------------------------ */
const pool = SP.wordPool();
t.eq('문장이 있는 단어만 카드 후보', pool.map(p => p.word).sort(), ['even', 'put', 'why', 'yellow']);
const set5 = SP.buildSet(5, 12345);
t.eq('후보가 4개면 세트도 4장', set5.length, 4);
t.ok('카드마다 문장·그림·힌트가 있음', set5.every(c => c.sentence && c.pic && c.hint));
t.eq('같은 seed → 같은 세트(하루 동안 같은 카드)', SP.buildSet(5, 12345), set5);
t.eq('setSize 3 이면 3장', SP.buildSet(3, 7).length, 3);
const weakFirst = SP.buildSet(4, 4242);
t.ok('아직 어려운(weak) 단어가 세트 앞쪽',
  weakFirst.slice(0, 2).every(c => ['even', 'why'].indexOf(c.word) >= 0),
  weakFirst.map(c => c.word).join(','));

const box = { word: 'even', sentence: 'The box is even and flat.', hint: 'box', pic: '📦' };
t.eq('핵심 단어 후보 = 보조 단어 + 그 단어(문장에 있는 것만)', SP.keywordsOf(box), ['box', 'even']);
t.eq('빈칸 문장', SP.blank('The box is even and flat.', 'even'), 'The box is _____ and flat.');
t.eq('내용 단어 추출(불용어 제외)', SP.contentWords('The box is even and flat.'), ['box', 'even', 'flat']);
t.ok('핵심 단어만 말해도 통과("box")', SP.matchCard('box', box).pass);
t.ok('전혀 다른 말은 통과 아님("banana")', !SP.matchCard('banana', box).pass);

/* ------------------------------------------------------------
   3. ❄️ 12월 겨울 Q&A — 교재 10문항 그대로
------------------------------------------------------------ */
const ITEMS = SP.winterItems();
t.eq('겨울 Q&A = 10문항', ITEMS.length, 10);
t.eq('질문 문구가 교재 그대로', ITEMS.map(x => x.q), [
  'Is it cold today?',
  'Do you like cold weather?',
  'Do you like winter?',
  'What can you see in winter?',
  'What do you like to do in winter?',
  'What do you like to eat in winter?',
  'What do you wear in winter?',
  'Do you like Christmas?',
  'What do you do on Christmas?',
  'What did you get for Christmas?'
]);
t.eq('1번 대답 보기', ITEMS[0].answers, ['Yes, it is very cold.', 'Yes, it is a little cold.', 'No, it is not cold.']);
t.eq('2번 대답 보기', ITEMS[1].answers, ['Yes, I like cold weather.', "No, I don't like cold weather."]);
t.eq('3번 대답 보기', ITEMS[2].answers, ['Yes, I like winter.', 'No, I do not like winter.']);
t.eq('4번 문장 틀', ITEMS[3].fill.tmpl, 'I can see ______.');
t.eq('4번 보기', ITEMS[3].fill.options, ['Christmas trees', 'snow', 'Santa Claus']);
t.eq('5번 문장 틀', ITEMS[4].fill.tmpl, 'I like to ______ in winter.');
t.eq('5번 보기', ITEMS[4].fill.options, ['have snowball fights', 'build snowmen', 'ice skate']);
t.eq('6번 문장 틀', ITEMS[5].fill.tmpl, 'I like to eat ______ in winter.');
t.eq('6번 보기', ITEMS[5].fill.options, ['oranges', 'soup', 'cookies']);
t.eq('7번 문장 틀', ITEMS[6].fill.tmpl, 'I wear ______ in winter.');
t.eq('7번 보기', ITEMS[6].fill.options, ['jackets', 'mittens', 'boots']);
t.eq('8번 대답 보기', ITEMS[7].answers, ['Yes, I like Christmas.', 'No, I do not like Christmas.']);
t.eq('9번 문장 틀', ITEMS[8].fill.tmpl, 'On Christmas I ______.');
t.eq('9번 보기 — open gits 오타를 open gifts 로', ITEMS[8].fill.options, ['open gifts', 'eat cake', 'sleep']);
t.ok('원본 오타(open gits)는 남아 있지 않음', JSON.stringify(ITEMS).indexOf('open gits') < 0);
t.eq('10번 문장 틀', ITEMS[9].fill.tmpl, 'I got ______ for Christmas!');
t.eq('10번 보기', ITEMS[9].fill.options, ['doll', 'toy', 'robot', 'gift']);
t.ok('모든 문항에 그림 이모지', ITEMS.every(x => x.pic && x.pic.length > 0));

const wcards = SP.winterCards();
t.eq('겨울 카드 10장', wcards.length, 10);
t.eq('카드 열쇠는 q01~q10', wcards.map(c => c.word), ['q01', 'q02', 'q03', 'q04', 'q05', 'q06', 'q07', 'q08', 'q09', 'q10']);
t.ok('카드마다 질문·대답·그림', wcards.every(c => c.qa && c.q && c.answers.length && c.pic));
t.eq('1번 카드의 문장은 첫 대답', wcards[0].sentence, 'Yes, it is very cold.');
t.eq('4번 빈칸 채우기', SP.fillSentence(wcards[3], 'snow'), 'I can see snow.');
t.eq('5번 빈칸 채우기(여러 낱말 보기)', SP.fillSentence(wcards[4], 'build snowmen'), 'I like to build snowmen in winter.');
t.eq('10번 빈칸 채우기', SP.fillSentence(wcards[9], 'robot'), 'I got robot for Christmas!');

/* ------------------------------------------------------------
   4. 🔤 파닉스 — 보기 단어·핵심 겨울 단어
------------------------------------------------------------ */
const CORE = ['snow', 'cookies', 'oranges', 'soup', 'jackets', 'mittens', 'boots',
  'doll', 'toy', 'robot', 'gift', 'cake', 'sleep', 'christmas', 'santa'];
t.eq('파닉스 단어에 핵심 겨울 단어 15개가 모두 있음',
  CORE.filter(x => SP.chunks(x).length > 0), CORE);
t.eq('snow 분절', SP.chunks('snow'), ['s', 'n', 'ow']);
t.eq('mittens 분절', SP.chunks('mittens'), ['m', 'i', 'tt', 'e', 'n', 's']);
t.eq('화면 힌트 모양 s · n · ow', SP.chunkText('snow'), 's · n · ow');
t.eq('화면 힌트 모양 m · i · tt · e · n · s → mittens', SP.chunkText('mittens'), 'm · i · tt · e · n · s');

const PH = SP.phonicsWords();
t.ok('파닉스 단어 카드 20개 이상', PH.length >= 20, String(PH.length));
const missing = [];
for (const it of ITEMS) {
  for (const opt of (it.fill.options || [])) {
    for (const tok of String(opt).split(/\s+/)) {
      if (!SP.chunks(tok).length) missing.push(tok);
    }
  }
}
t.eq('4~10번 보기 단어가 모두 파닉스 표에 있음', missing, []);
t.eq('파닉스 카드에 snow 가 있음', PH.indexOf('snow') >= 0, true);
t.eq('파닉스 카드에 christmas 가 있음', PH.indexOf('christmas') >= 0, true);
const phCards = SP.phonicsCards();
t.eq('파닉스 카드 = 파닉스 단어 수', phCards.length, PH.length);
t.ok('파닉스 카드마다 그림·분절', phCards.every(c => c.type === 'word' && c.pic && SP.chunks(c.word).length));

/* ------------------------------------------------------------
   5. 세트 바꾸기
------------------------------------------------------------ */
SP.setSet('winter');
t.eq('❄️ 세트로 바꾸면 카드 10장', SP.cards().length, 10);
t.eq('세트 이름이 남음', SP.set(), 'winter');
const wn = SP.winterCards().length;
SP.setSet('phonics');
t.eq('🔤 세트로 바꾸면 단어 카드', SP.cards().length, wn > 0 ? SP.phonicsWords().length : 0);
t.eq('🔤 세트는 단계가 word', SP.stage(), 'word');
t.eq('🔤 세트에서는 단계 바꾸기 거부', SP.setStage('fill'), false);
SP.setSet('sight');
t.eq('📚 세트로 돌아오면 단계는 echo', SP.stage(), 'echo');
t.eq('📚 세트 카드 5장 이하', SP.cards().length <= 5, true);

/* ------------------------------------------------------------
   6. ❄️ 겨울 Q&A 화면 흐름 (1단계 → 2단계 → 3단계 → 🔤)
------------------------------------------------------------ */
SP.open('winter');
t.ok('겨울 세트로 모달이 열림', SP.isOpen() && !$('#spModal').hidden);
t.eq('세트 칩 3개', d.querySelectorAll('#spSets .sp-set').length, 3);
t.ok('겨울 칩이 켜져 있음', d.querySelector('#spSets [data-sp-set="winter"]').classList.contains('is-on'));
t.eq('1단계부터', SP.stage(), 'echo');
const q1 = SP.card();
t.ok('질문이 화면에 보임', !$('#spQ').hidden && $('#spQ').textContent.indexOf('Is it cold today?') >= 0, $('#spQ').textContent);
t.eq('1단계는 첫 대답 문장이 보임', $('#spSent').textContent, 'Yes, it is very cold.');
await sleep(30);
const saidQ = spoken(w).map(x => x.text);
t.ok('질문을 먼저 들려줌', saidQ.indexOf('Is it cold today?') >= 0, JSON.stringify(saidQ));
t.ok('이어서 대답 문장', saidQ.indexOf('Yes, it is very cold.') >= 0, JSON.stringify(saidQ));
t.ok('질문 → 대답 순서', saidQ.indexOf('Is it cold today?') < saidQ.indexOf('Yes, it is very cold.'));
t.ok('❓ 질문만 듣기 버튼이 보임', !$('#spQPlay').hidden);
t.eq('대답 보기 칩 수(1번)', d.querySelectorAll('#spChoices .sp-choice').length, 3);

await sleep(120);
t.ok('쉼 뒤 "이제 따라 말해 봐!"', SP.pauseDone() && !$('#spTurn').hidden);
t.ok('1단계 프롬프트가 겨울용', $('#spTurnText').textContent.indexOf('따라 말해') >= 0, $('#spTurnText').textContent);

/* ❓ 질문만 듣기 */
const beforeQ = spoken(w).length;
$('#spQPlay').click();
await sleep(20);
t.eq('❓ → 질문만 읽어 줌', spoken(w).slice(-1)[0].text, 'Is it cold today?');
t.ok('❓ → 새로 읽음', spoken(w).length > beforeQ);

/* 대답 보기를 누르면 완성 문장을 읽어 줘요 */
const beforeChip = spoken(w).length;
d.querySelectorAll('#spChoices .sp-choice-main')[2].click();
await sleep(40);
t.eq('대답 보기(3번)를 누르면 완성 문장을 읽어 줌',
  spoken(w).slice(-1)[0].text, 'No, it is not cold.');
t.ok('누른 보기가 화면에 표시', $('#spSent').textContent.indexOf('No, it is not cold.') >= 0, $('#spSent').textContent);
t.ok('대답 보기 줄이 켜짐', d.querySelectorAll('#spChoices .sp-choice')[2].classList.contains('is-on'));

/* 2단계 */
SP.setStage('card');
await sleep(40);
t.eq('2단계로 전환', SP.stage(), 'card');
t.ok('2단계는 대답을 고르기 전 비워 둠', $('#spSent').textContent.indexOf('골라') >= 0, $('#spSent').textContent);
t.eq('2단계 대답 보기 수(1번)', d.querySelectorAll('#spChoices .sp-choice').length, 3);
const c2 = SP.card();
const before2 = spoken(w).length;
d.querySelectorAll('#spChoices .sp-choice-main')[0].click();
await sleep(40);
t.eq('2단계 — 고른 대답을 완성 문장으로 읽어 줌', spoken(w).slice(-1)[0].text, 'Yes, it is very cold.');
t.ok('2단계 — 고른 문장이 보임', $('#spSent').textContent.indexOf('Yes, it is very cold.') >= 0);
t.ok('2단계 — 말해보기 버튼 보임', !$('#spMic').hidden);
$('#spMic').click();
await sleep(30);
w.__rec.say('yes it is very cold');
await sleep(400);
t.ok('2단계 — 대답을 말하면 자동 통과', SP.stars() > 0, 'stars=' + SP.stars());

/* 3단계 — 빈칸 보기 + 🔤 파닉스 */
SP.setStage('fill');
await sleep(40);
t.eq('3단계로 전환', SP.stage(), 'fill');
const c3 = SP.card();
t.eq('3단계 — 빈칸 문장 틀', $('#spSent').textContent, c3.tmpl);
t.eq('3단계 — 빈칸 보기 수(1번)', d.querySelectorAll('#spChoices .sp-choice').length, 2);
t.ok('3단계 — 보기마다 🔤 버튼', d.querySelectorAll('#spChoices .sp-choice-ph').length === 2);
const beforePick = spoken(w).length;
d.querySelectorAll('#spChoices .sp-choice-main')[0].click();
await sleep(50);
t.eq('3단계 — 보기를 누르면 빈칸이 채워진 문장을 읽어 줌', spoken(w).slice(-1)[0].text, 'Yes, it is very cold.');
t.eq('3단계 — 화면 문장도 채워짐', $('#spSent').textContent, 'Yes, it is very cold.');

const phBtn = d.querySelectorAll('#spChoices .sp-choice-ph')[0];
t.ok('🔤 버튼이 보기 단어를 들고 있음', !!phBtn.getAttribute('data-sp-phonics'), phBtn.getAttribute('data-sp-phonics'));
const beforePh = spoken(w).length;
phBtn.click();
await sleep(700);   /* 천천히 → 글자 → 다시 (묶음 사이 240ms 쉼) */
const phSaid = spoken(w).slice(beforePh).map(x => x.text.toLowerCase());
t.ok('🔤 → 단어를 천천히 읽어 줌', phSaid.indexOf('cold') >= 0, JSON.stringify(phSaid));
t.ok('🔤 → 글자 하나씩 읽어 줌', phSaid.some(x => x.indexOf('c. o. l. d') >= 0), JSON.stringify(phSaid));
t.ok('🔤 → 화면에 분절 힌트 표시', !$('#spPh').hidden && $('#spPh').textContent.indexOf('c · o · l · d') >= 0, $('#spPh').textContent);

/* 4번(보기 여러 낱말) 카드의 파닉스 */
SP.go(3);
await sleep(40);
t.ok('4번 카드 질문', $('#spQ').textContent.indexOf('What can you see in winter?') >= 0);
t.eq('4번 빈칸 문장', $('#spSent').textContent, 'I can see ______.');
t.eq('4번 보기 3개', d.querySelectorAll('#spChoices .sp-choice').length, 3);
d.querySelectorAll('#spChoices .sp-choice-main')[0].click();
await sleep(50);
t.eq('4번 "Christmas trees" 를 넣으면', $('#spSent').textContent, 'I can see Christmas trees.');
t.eq('4번 — 완성 문장을 읽어 줌', spoken(w).slice(-1)[0].text, 'I can see Christmas trees.');
const ph2 = d.querySelectorAll('#spChoices .sp-choice-ph')[0];
const beforePh2 = spoken(w).length;
ph2.click();
await sleep(1800);  /* Christmas · trees 두 낱말 × 3번 읽기 */
const ph2said = spoken(w).slice(beforePh2).map(x => x.text.toLowerCase());
t.ok('4번 🔤 → Christmas 와 trees 를 차례로', ph2said.indexOf('christmas') >= 0 && ph2said.indexOf('trees') >= 0, JSON.stringify(ph2said));
t.ok('4번 🔤 → 화면 힌트에 두 낱말', $('#spPh').textContent.indexOf('ch · r · i · s · t · m · a · s') >= 0, $('#spPh').textContent);

/* ✓ → 별 · 완료 기록 */
const starsBefore = SP.stars();
$('#spOk').click();
await sleep(30);
t.ok('✓ → 별 +1', SP.stars() >= starsBefore + 1, 'stars=' + SP.stars());
t.ok('✓ → 완료 열쇠에 세트·단계·문항', Object.keys(SP.done()).some(k => /^winter\|fill\|q\d\d$/.test(k)), JSON.stringify(SP.done()));

/* ------------------------------------------------------------
   7. 🔤 겨울 단어 카드 화면
------------------------------------------------------------ */
SP.setSet('phonics');
await sleep(60);
t.eq('단어 카드 세트', SP.set(), 'phonics');
t.ok('단계 탭은 숨김', $('#spSteps').hidden === true);
t.eq('단어가 크게 보임', $('#spSent').classList.contains('is-word'), true);
const wc = SP.card();
t.eq('카드 단어 표시', $('#spSent').textContent, wc.word);
t.ok('파닉스 힌트가 늘 보임', !$('#spPh').hidden && $('#spPh').textContent.indexOf('🔤') >= 0, $('#spPh').textContent);
t.ok('말해보기 버튼 보임', !$('#spMic').hidden);
const beforeW = spoken(w).length;
$('#spPlay').click();
await sleep(800);
const wSaid = spoken(w).slice(beforeW).map(x => x.text.toLowerCase());
t.ok('🔊 → 단어를 천천히', wSaid.indexOf(wc.word) >= 0, JSON.stringify(wSaid));
t.ok('🔊 → 글자 하나씩', wSaid.some(x => /^\w(\. \w)+\.$/.test(x)), JSON.stringify(wSaid));
t.ok('🔊 → 단어를 한 번 더 (3번 읽기)', wSaid.filter(x => x === wc.word).length >= 2, JSON.stringify(wSaid));

$('#spMic').click();
await sleep(30);
w.__rec.say(wc.word);
await sleep(400);
t.ok('단어를 말하면 자동 통과', SP.doneCount() >= 1, 'done=' + SP.doneCount());

/* ------------------------------------------------------------
   8. 저장 · 닫기 · 중복 주입 · 영어 화면
------------------------------------------------------------ */
const saved = SP.storage();
t.ok('localStorage 에 오늘 날짜·seed·세트 저장',
  !!saved && !!saved.date && typeof saved.seed === 'number' && !!saved.set, JSON.stringify(saved));
SP.close();
t.ok('닫으면 모달 숨김', $('#spModal').hidden && !SP.isOpen());
t.eq('중복 주입 방지 — 버튼 1개', d.querySelectorAll('#spOpenBtn').length, 1);

$('#spQuick [data-sp-set="winter"]').click();
await sleep(60);
t.ok('카드의 바로 열기 칩으로 겨울 세트가 열림', SP.isOpen() && SP.set() === 'winter');
SP.close();

const domEn = await makeDom('en', { speechRecognition: false });
const SPen = domEn.window.SEOHAN_SPEAKING;
const dEn = domEn.window.document;
t.ok('영어 화면이면 버튼도 영어', dEn.querySelector('#spOpenBtn').textContent.indexOf('Say It') >= 0,
  dEn.querySelector('#spOpenBtn').textContent);
SPen.open('winter');
await domEn.window.eval('new Promise(r=>setTimeout(r,80))');
const noteEn = dEn.querySelector('#spAsrNote');
t.ok('음성인식 미지원 → "자동 확인이 안 돼요" 안내', !noteEn.hidden && /Auto-check is not available/.test(noteEn.textContent), noteEn.textContent);
t.ok('영어 화면 겨울 안내문', dEn.querySelector('#spQ').textContent.indexOf('Is it cold today?') >= 0);
t.ok('그래도 엄마 ✓ / 🔁 는 그대로', !dEn.querySelector('#spOk').hidden && !dEn.querySelector('#spAgain').hidden);

const pass = t.report();
process.exit(pass ? 0 : 1);
