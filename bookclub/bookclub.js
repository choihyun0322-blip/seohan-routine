/* ============================================================
   📖 서한이 루틴 · 북클럽 책 읽기 — 독립 패치 (bookclub.js)
   ------------------------------------------------------------
   · 기존 index.html 을 고치지 않고 <script> 한 줄로 붙는 독립 패치입니다.
   · 하는 일
       1) '📚 방과 후 숙제' 카드 머리에 [📖 책 3권] 버튼을 만들어요.
       2) 버튼을 누르면 책별 영어 질문 + 한국어 힌트/답 보기 모달이 열려요.
       3) 영어 문장을 누르면 읽어 줘요. (audio/*.mp3 가 있으면 그 목소리,
          없으면 기기 음성 speechSynthesis — 아이폰 Safari 호환 처리 포함)
       4) [다 읽었어요] 를 누르면 기존 '북클럽 책 읽기' 숙제를 대신 체크해요.
   · 책 데이터는 bookclub.data.js 만 고치면 됩니다.
   · 두 번 넣어도 한 번만 동작해요. (중복 실행 방지)
   ============================================================ */
(function () {
  'use strict';

  var VERSION = '1.0.1';
  var BUILD = '2026-11-26';   /* 1.0.1: 앱이 언어를 정하기 전에 버튼이 만들어져 라벨이 영어로 굳던 문제 — 언어 확정 뒤/바뀔 때 라벨 갱신 */

  if (window.SEOHAN_BOOKCLUB && window.SEOHAN_BOOKCLUB.version) return;   /* 중복 주입 방지 */

  var STORE_KEY = 'seohan-bookclub-ui-v1';

  /* ============================================================
     작은 도우미
  ============================================================ */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function txt(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    n.textContent = text == null ? '' : String(text);
    return n;
  }
  function once(fn) {
    var used = false;
    return function () { if (used) return; used = true; if (fn) fn.apply(null, arguments); };
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function koMode() { return String(document.documentElement.lang || '').indexOf('ko') === 0; }
  function pick(o) { if (!o) return ''; return koMode() ? (o.ko || o.en || '') : (o.en || o.ko || ''); }
  function storeRead() {
    try {
      var raw = window.localStorage && window.localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function storeWrite(v) {
    try { if (window.localStorage) window.localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch (e) { /* 무시 */ }
  }

  /* ISO 주차 "YYYY-Www" */
  function isoWeekKey(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    var y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var week = Math.ceil((((d - y0) / 86400000) + 1) / 7);
    return d.getUTCFullYear() + '-W' + pad2(week);
  }

  /* ============================================================
     주차 · 책 고르기
  ============================================================ */
  function weekTable() {
    var t = window.BOOKCLUB_WEEKS;
    return (t && typeof t === 'object') ? t : {};
  }
  function weekEntries() {
    var t = weekTable(), out = [], k;
    for (k in t) {
      if (!Object.prototype.hasOwnProperty.call(t, k)) continue;
      if (k.charAt(0) === '_') continue;            /* __options__ 등 */
      if (!t[k] || !t[k].books || !t[k].books.length) continue;
      out.push({ key: k, week: t[k], from: String(t[k].from || '') });
    }
    out.sort(function (a, b) { return a.from < b.from ? -1 : (a.from > b.from ? 1 : 0); });
    return out;
  }
  function currentWeek(now) {
    var t = weekTable();
    var opts = t.__options__ || {};
    var when = now || new Date();
    var today = ymd(when);
    var pin = String(opts.pinKey || '');
    if (pin && t[pin] && t[pin].books && t[pin].books.length) return { key: pin, week: t[pin] };

    var isoKey = isoWeekKey(when);
    if (t[isoKey] && t[isoKey].books && t[isoKey].books.length) return { key: isoKey, week: t[isoKey] };

    var list = weekEntries(), i, past = null;
    for (i = 0; i < list.length; i++) {
      var w = list[i].week;
      var from = String(w.from || ''), to = String(w.to || '');
      if (from && to && today >= from && today <= to) return { key: list[i].key, week: w };
    }
    for (i = 0; i < list.length; i++) {
      if (list[i].from && list[i].from <= today) past = list[i];
    }
    if (past) return { key: past.key, week: past.week };
    if (list.length) return { key: list[0].key, week: list[0].week };
    return null;
  }
  function options() { return weekTable().__options__ || {}; }
  function countQuestions(week) {
    var n = 0, books = (week && week.books) || [];
    for (var i = 0; i < books.length; i++) n += (books[i].questions || []).length;
    return n;
  }

  /* ============================================================
     상태
  ============================================================ */
  var UI = {
    open: false,
    week: null,          /* { key, week } */
    book: 0,
    revealed: {},        /* bi + ':' + qi → 1 */
    picked: {},          /* bi + ':' + qi + ':' + k → 1 */
    lastFocus: null
  };
  var modal = null;
  var noteTimer = null;

  /* ============================================================
     목소리 — ① 사람 목소리 mp3(있으면) ② speechSynthesis
  ============================================================ */
  var VOICE = { live: null, audio: null, seq: 0, bound: false, voices: [] };

  function voiceList() {
    try {
      return (window.speechSynthesis && window.speechSynthesis.getVoices) ? (window.speechSynthesis.getVoices() || []) : [];
    } catch (e) { return []; }
  }
  function refreshVoices() { VOICE.voices = voiceList(); }
  function bindVoices() {
    if (VOICE.bound || !window.speechSynthesis) return;
    VOICE.bound = true;
    try {
      if (typeof window.speechSynthesis.addEventListener === 'function') {
        window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
      }
    } catch (e) { /* 무시 */ }
    refreshVoices();
  }
  function scoreVoice(v, lang) {
    var name = String((v && v.name) || '');
    var sc = 0;
    if (/enhanced|premium|natural|neural|siri/i.test(name)) sc += 40;
    if (/google/i.test(name)) sc += 24;
    if (v && v.localService === false) sc += 10;
    if (lang === 'ko') {
      if (/^ko/i.test(v.lang || '')) sc += 12;
      if (/yuna|sora|sunhi|유나|소라/i.test(name)) sc += 30;
      if (/injoon|인준|male/i.test(name)) sc -= 25;
    } else {
      if (/^en[-_]US/i.test(v.lang || '')) sc += 12;
      else if (/^en[-_]GB/i.test(v.lang || '')) sc += 6;
      else if (/^en/i.test(v.lang || '')) sc += 3;
      if (/ana|samantha|jenny|karen|moira|aria/i.test(name)) sc += 28;
      if (/male|daniel|alex|fred/i.test(name)) sc -= 12;
    }
    return sc;
  }
  function bestVoice(lang) {
    var list = VOICE.voices.length ? VOICE.voices : voiceList();
    var best = null, bestSc = -1;
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      if (!v || !v.lang) continue;
      var ok = lang === 'ko' ? /^ko/i.test(v.lang) : /^en/i.test(v.lang);
      if (!ok) continue;
      var sc = scoreVoice(v, lang);
      if (sc > bestSc) { bestSc = sc; best = v; }
    }
    return best;
  }
  /* 사람 목소리 mp3 가 있으면 그걸로 (없거나 실패하면 tts() 로 넘겨요) */
  function playMp3(text, role, fallback, done) {
    var map = window.VOICE_AUDIO;
    if (!map || typeof map !== 'object' || !window.Audio) return false;
    if (!/^https?:$/.test(String(window.location.protocol || ''))) return false;   /* file:// 사본은 기기 음성 */
    var k = role + '|' + String(text).toLowerCase().replace(/\s+/g, ' ').trim();
    var file = map[k];
    if (!file) return false;
    var moved = false, a;
    try {
      if (VOICE.audio && VOICE.audio.pause) { try { VOICE.audio.pause(); } catch (e) { /* 무시 */ } }
      a = new window.Audio('./audio/' + file + '.mp3');
      a.preload = 'auto';
    } catch (e) { return false; }
    var watchdog = setTimeout(function () { if (moved) return; moved = true; fallback(); }, 900);
    a.addEventListener('playing', function () { try { clearTimeout(watchdog); } catch (e) { /* 무시 */ } });
    a.addEventListener('ended', function () { try { clearTimeout(watchdog); } catch (e) { /* 무시 */ } if (VOICE.audio === a) VOICE.audio = null; if (done) done(); });
    a.addEventListener('error', function () {
      if (moved) return;
      moved = true;
      try { clearTimeout(watchdog); } catch (e) { /* 무시 */ }
      fallback();
    });
    try {
      var p = a.play();
      if (p && p.catch) p.catch(function () { if (moved) return; moved = true; try { clearTimeout(watchdog); } catch (e) { /* 무시 */ } fallback(); });
    } catch (e) {
      if (moved) return;
      moved = true;
      try { clearTimeout(watchdog); } catch (e2) { /* 무시 */ }
      return false;
    }
    VOICE.audio = a;
    return true;
  }
  function say(text, lang, done) {
    var t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    var finish = once(done);
    if (!t) { finish(); return false; }
    var lg = (lang === 'ko') ? 'ko' : 'en';
    var started = false;
    function tts() {
      if (started) return;
      started = true;
      if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance === 'undefined') {
        bark(koMode() ? '이 기기에서는 읽어주기가 안 돼요' : 'This device cannot speak');
        finish();
        return;
      }
      bindVoices();
      var synth = window.speechSynthesis;
      try {
        var u = new window.SpeechSynthesisUtterance(t);
        u.lang = (lg === 'ko') ? 'ko-KR' : 'en-US';
        u.rate = (lg === 'ko') ? 0.98 : 0.85;
        u.pitch = 1.05;
        u.volume = 1;
        var v = bestVoice(lg);
        if (v) { try { u.voice = v; } catch (e) { /* 무시 */ } }
        VOICE.live = u;                                  /* GC 로 발화가 끊기지 않게 붙잡아 둬요 */
        var mark = { started: false };
        u.onstart = function () { mark.started = true; };
        u.onend = function () { if (VOICE.live === u) VOICE.live = null; finish(); };
        u.onerror = function () { if (VOICE.live === u) VOICE.live = null; finish(); };
        /* iOS Safari: 큐가 빈 상태에서 cancel() 하면 다음 speak() 가 씹히곤 해요.
           읽는 중일 때만 cancel() 하고, 말하기는 같은 tick 에 바로 걸어요. */
        if (synth.speaking || synth.pending) { try { synth.cancel(); } catch (e) { /* 무시 */ } }
        if (synth.paused && synth.resume) { try { synth.resume(); } catch (e) { /* 무시 */ } }
        synth.speak(u);
        /* Safari 가 말없이 삼킨 경우 0.7초 뒤 한 번만 다시 (앱 본체와 같은 방식) */
        setTimeout(function () {
          if (mark.started || VOICE.live !== u) return;
          if (synth.speaking || synth.pending) return;
          try { synth.speak(u); } catch (e) { /* 무시 */ }
        }, 700);
      } catch (e) { finish(); }
    }
    if (playMp3(t, (lg === 'ko') ? 'ko' : 'mom', tts, finish)) return true;
    tts();
    return true;
  }
  function stopVoice() {
    VOICE.seq++;
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* 무시 */ }
    if (VOICE.audio && VOICE.audio.pause) { try { VOICE.audio.pause(); } catch (e) { /* 무시 */ } }
    VOICE.audio = null;
    VOICE.live = null;
  }

  /* ============================================================
     모달 — 껍데기
  ============================================================ */
  function buildModal() {
    if (modal) return modal;
    var m = el('div', 'modal bc-modal');
    m.id = 'bcModal';
    m.hidden = true;
    m.innerHTML =
      '<div class="modal-backdrop" data-bc-close="1"></div>' +
      '<div class="modal-panel bc-panel" role="dialog" aria-modal="true" aria-labelledby="bcTitle">' +
        '<header class="modal-head bc-head">' +
          '<h2 id="bcTitle"><span class="bc-title-ic" aria-hidden="true">📖</span> ' +
            '<span id="bcTitleText">Book Club</span> ' +
            '<span class="bc-week-pill" id="bcWeekPill"></span>' +
          '</h2>' +
          '<button class="bc-x" type="button" data-bc-close="1" aria-label="닫기 Close">✕</button>' +
        '</header>' +
        '<div class="modal-body bc-body">' +
          '<div class="bc-books" id="bcBooks" role="tablist" aria-label="이번 주 책"></div>' +
          '<div class="bc-book-box" id="bcBookBox" role="tabpanel"></div>' +
        '</div>' +
        '<footer class="modal-foot bc-foot">' +
          '<button class="ghost-btn" type="button" data-bc-close="1">닫기 Close</button>' +
          '<button class="primary-btn bc-done" type="button" id="bcDoneBtn">다 읽었어요 🎉</button>' +
        '</footer>' +
      '</div>';
    document.body.appendChild(m);

    m.addEventListener('click', onModalClick);
    document.addEventListener('keydown', function (e) {
      if (!UI.open) return;
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
    }, true);

    modal = m;
    return m;
  }

  function bark(msg) {
    if (!modal) return;
    var n = modal.querySelector('.bc-note');
    if (!n) {
      n = el('p', 'bc-note');
      n.setAttribute('role', 'status');
      var body = modal.querySelector('.bc-body');
      if (body) body.insertBefore(n, body.firstChild);
    }
    n.textContent = msg || '';
    n.classList.add('on');
    if (noteTimer) clearTimeout(noteTimer);
    noteTimer = setTimeout(function () { if (n) n.classList.remove('on'); }, 2600);
  }

  /* ============================================================
     모달 — 내용
  ============================================================ */
  function renderTabs() {
    var box = modal.querySelector('#bcBooks');
    box.innerHTML = '';
    var books = (UI.week && UI.week.week.books) || [];
    for (var i = 0; i < books.length; i++) {
      var b = books[i];
      var btn = el('button', 'bc-tab');
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('data-bc-tab', String(i));
      btn.setAttribute('aria-selected', i === UI.book ? 'true' : 'false');
      btn.setAttribute('aria-controls', 'bcBookBox');
      if (i === UI.book) btn.className += ' on';
      btn.style.setProperty('--bc-c', b.color || '#8b5cf6');
      btn.appendChild(txt('span', 'bc-tab-emoji', b.emoji || '📗'));
      var tx = el('span', 'bc-tab-tx');
      tx.appendChild(txt('span', 'bc-tab-title', b.title || ''));
      tx.appendChild(txt('span', 'bc-tab-tag', pick(b.tag)));
      btn.appendChild(tx);
      box.appendChild(btn);
    }
  }

  function answerBlock(q) {
    var wrap = el('div', 'bc-ans-row');
    var b = el('button', 'bc-ans');
    b.type = 'button';
    b.setAttribute('data-bc-saytext', q.answerEn);
    b.appendChild(txt('span', 'bc-ans-en', q.answerEn));
    if (q.answerKo) b.appendChild(txt('span', 'bc-ans-ko', q.answerKo));
    b.appendChild(txt('span', 'bc-ans-sp', '🔊'));
    wrap.appendChild(b);
    return wrap;
  }

  function choicesBlock(q, k) {
    var wrap = el('div', 'bc-chips');
    for (var i = 0; i < q.choices.length; i++) {
      var c = q.choices[i];
      var b = el('button', 'bc-chip');
      b.type = 'button';
      b.setAttribute('data-bc-chip', String(i));
      b.setAttribute('data-bc-saytext', c);
      b.textContent = c;
      if (UI.picked[k + ':' + i]) b.className += ' on';
      wrap.appendChild(b);
    }
    return wrap;
  }

  function questionEl(q, bi, qi) {
    var k = bi + ':' + qi;
    var li = el('li', 'bc-q');
    li.setAttribute('data-bc-q', k);

    var line = el('button', 'bc-line');
    line.type = 'button';
    line.setAttribute('data-bc-saytext', q.en);
    line.setAttribute('aria-label', q.en + (q.ko ? ' — ' + q.ko : ''));
    line.appendChild(txt('span', 'bc-en', q.en));
    line.appendChild(txt('span', 'bc-sp', '🔊'));
    li.appendChild(line);

    var tools = el('div', 'bc-tools');
    var hintBtn = el('button', 'bc-hint-btn');
    hintBtn.type = 'button';
    hintBtn.setAttribute('data-bc-hint', k);
    hintBtn.setAttribute('aria-expanded', 'false');
    hintBtn.textContent = koMode() ? '💡 힌트 보기' : '💡 Hint';
    tools.appendChild(hintBtn);
    li.appendChild(tools);

    var hint = el('div', 'bc-hint');
    hint.hidden = true;
    var kline = el('div', 'bc-ko-line');
    kline.appendChild(txt('p', 'bc-ko', q.ko || ''));
    if (q.ko) {
      var ks = el('button', 'bc-mini-say');
      ks.type = 'button';
      ks.setAttribute('data-bc-saytext', q.ko);
      ks.setAttribute('data-bc-lang', 'ko');
      ks.setAttribute('aria-label', '한국어로 듣기');
      ks.textContent = '🔊';
      kline.appendChild(ks);
    }
    hint.appendChild(kline);
    if (q.answerEn) hint.appendChild(answerBlock(q));
    if (q.choices && q.choices.length) hint.appendChild(choicesBlock(q, k));
    li.appendChild(hint);
    return li;
  }

  function renderBook() {
    var box = modal.querySelector('#bcBookBox');
    box.innerHTML = '';
    var books = (UI.week && UI.week.week.books) || [];
    var b = books[UI.book];
    if (!b) return;

    var head = el('div', 'bc-book-head');
    head.style.setProperty('--bc-c', b.color || '#8b5cf6');
    head.appendChild(txt('span', 'bc-book-emoji', b.emoji || '📗'));
    var titles = el('div', 'bc-book-titles');
    titles.appendChild(txt('p', 'bc-book-title', b.title || ''));
    titles.appendChild(txt('p', 'bc-book-tag', pick(b.tag)));
    head.appendChild(titles);
    var playAll = el('button', 'bc-playall');
    playAll.type = 'button';
    playAll.setAttribute('data-bc-playall', String(UI.book));
    playAll.textContent = koMode() ? '▶ 전체 듣기' : '▶ Play all';
    head.appendChild(playAll);
    box.appendChild(head);

    var list = el('ol', 'bc-qs');
    var qs = b.questions || [];
    for (var i = 0; i < qs.length; i++) list.appendChild(questionEl(qs[i], UI.book, i));
    box.appendChild(list);

    /* 이전에 펼쳐 둔 힌트는 그대로 펼쳐요 */
    for (var j = 0; j < qs.length; j++) {
      if (UI.revealed[UI.book + ':' + j]) setHint(UI.book + ':' + j, true);
    }

    var pager = el('div', 'bc-pager');
    var prev = el('button', 'bc-page');
    prev.type = 'button';
    prev.setAttribute('data-bc-tab', String((UI.book - 1 + books.length) % books.length));
    prev.textContent = '‹ ' + pick({ ko: '이전 책', en: 'Prev' });
    var next = el('button', 'bc-page');
    next.type = 'button';
    next.setAttribute('data-bc-tab', String((UI.book + 1) % books.length));
    next.textContent = pick({ ko: '다음 책', en: 'Next' }) + ' ›';
    pager.appendChild(prev);
    pager.appendChild(txt('span', 'bc-page-n', (UI.book + 1) + ' / ' + books.length));
    pager.appendChild(next);
    box.appendChild(pager);
  }

  function setHint(k, on) {
    if (!modal) return;
    var q = modal.querySelector('[data-bc-q="' + k + '"]');
    if (!q) return;
    var hint = q.querySelector('.bc-hint');
    var btn = q.querySelector('.bc-hint-btn');
    if (hint) hint.hidden = !on;
    if (btn) btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (btn) btn.textContent = on
      ? (koMode() ? '🙈 힌트 접기' : '🙈 Hide hint')
      : (koMode() ? '💡 힌트 보기' : '💡 Hint');
    if (on) UI.revealed[k] = 1; else delete UI.revealed[k];
  }

  function showBook(i, noScroll) {
    var books = (UI.week && UI.week.week.books) || [];
    if (!books.length) return;
    UI.book = ((i % books.length) + books.length) % books.length;
    renderTabs();
    renderBook();
    if (!noScroll) {
      var body = modal.querySelector('.bc-body');
      if (body) body.scrollTop = 0;
    }
    storeWrite({ week: UI.week && UI.week.key, book: UI.book, revealed: UI.revealed });
  }

  /* ============================================================
     모달 — 열기 / 닫기
  ============================================================ */
  function open() {
    buildModal();
    UI.week = currentWeek(new Date());
    if (!UI.week) {
      /* 책 데이터가 없어도 빈손으로 닫지 않고, 무엇이 빠졌는지 모달 안에서 알려 줘요 */
      if (!UI.open) UI.lastFocus = document.activeElement;
      UI.open = true;
      modal.hidden = false;
      document.documentElement.classList.add('modal-open');
      var tt = modal.querySelector('#bcTitleText');
      if (tt) tt.textContent = options().title || '📖 Book Club';
      var pp = modal.querySelector('#bcWeekPill');
      if (pp) pp.textContent = '';
      modal.querySelector('#bcBooks').innerHTML = '';
      modal.querySelector('#bcBookBox').innerHTML = '';
      bark('이번 주 책 데이터가 아직 없어요 (bookclub.data.js)');
      return;
    }
    if (!UI.open) {
      UI.lastFocus = document.activeElement;
      UI.book = 0;
      UI.revealed = {};
      var saved = storeRead();
      if (saved && saved.week === UI.week.key) {
        if (typeof saved.book === 'number') UI.book = saved.book;
        if (saved.revealed && typeof saved.revealed === 'object') UI.revealed = saved.revealed;
      }
    }
    UI.open = true;
    modal.hidden = false;
    document.documentElement.classList.add('modal-open');

    var t = modal.querySelector('#bcTitleText');
    if (t) t.textContent = options().title || '📖 Book Club';
    var pill = modal.querySelector('#bcWeekPill');
    if (pill) {
      var lab = pick(UI.week.week.label) || UI.week.key;
      pill.textContent = lab;
    }
    modal.querySelector('.modal-panel').style.setProperty('--bc-accent', '#8b5cf6');
    showBook(UI.book, true);

    var focusTarget = modal.querySelector('.bc-line') || modal.querySelector('[data-bc-close]');
    if (focusTarget && focusTarget.focus) { try { focusTarget.focus({ preventScroll: true }); } catch (e) { focusTarget.focus(); } }
    /* 1.0.1: 힌트를 펼쳐 둔 채 다시 열면 포커스 때문에 본문이 살짝 스크롤돼
       책 탭 줄이 반쯤 가려지던 문제 — 열 때는 탭이 보이게 맨 위로 */
    var bd = modal.querySelector('.bc-body');
    if (bd) bd.scrollTop = 0;
  }

  function close() {
    if (!modal || !UI.open) return;
    UI.open = false;
    modal.hidden = true;
    document.documentElement.classList.remove('modal-open');
    stopVoice();
    storeWrite({ week: UI.week && UI.week.key, book: UI.book, revealed: UI.revealed });
    if (UI.lastFocus && UI.lastFocus.focus) { try { UI.lastFocus.focus({ preventScroll: true }); } catch (e) { /* 무시 */ } }
    UI.lastFocus = null;
  }

  /* ============================================================
     모달 — 클릭 처리
  ============================================================ */
  function onModalClick(e) {
    var t = e.target;
    if (!t || !t.closest) return;

    if (t.closest('[data-bc-close]')) { close(); return; }

    var tab = t.closest('[data-bc-tab]');
    if (tab) { stopVoice(); showBook(Number(tab.getAttribute('data-bc-tab')) || 0); return; }

    var playAll = t.closest('[data-bc-playall]');
    if (playAll) { playBook(UI.book); return; }

    var hintBtn = t.closest('[data-bc-hint]');
    if (hintBtn) {
      var hk = hintBtn.getAttribute('data-bc-hint');
      setHint(hk, !!hintBtn.closest('.bc-q').querySelector('.bc-hint[hidden]'));
      storeWrite({ week: UI.week && UI.week.key, book: UI.book, revealed: UI.revealed });
      return;
    }

    var sayBtn = t.closest('[data-bc-saytext]');
    if (sayBtn) {
      var text = sayBtn.getAttribute('data-bc-saytext') || '';
      var lang = sayBtn.getAttribute('data-bc-lang') === 'ko' ? 'ko' : 'en';
      say(text, lang);
      var chip = sayBtn.closest('.bc-chip');
      if (chip) {
        var all = chip.parentNode.querySelectorAll('.bc-chip');
        for (var i = 0; i < all.length; i++) all[i].classList.remove('on');
        chip.classList.add('on');
        var qbox = chip.closest('[data-bc-q]');
        if (qbox) {
          var kk = qbox.getAttribute('data-bc-q');
          UI.picked[kk + ':' + chip.getAttribute('data-bc-chip')] = 1;
        }
      }
      return;
    }
  }

  /* ============================================================
     전체 듣기
  ============================================================ */
  function playBook(bi) {
    var books = (UI.week && UI.week.week.books) || [];
    var b = books[bi];
    if (!b) return;
    var qs = b.questions || [];
    var btn = modal.querySelector('[data-bc-playall="' + bi + '"]');
    var token = ++VOICE.seq;
    var i = 0;
    function mark(on) {
      if (!btn) return;
      btn.textContent = on ? (koMode() ? '■ 멈추기' : '■ Stop') : (koMode() ? '▶ 전체 듣기' : '▶ Play all');
      btn.classList.toggle('on', !!on);
    }
    if (btn && btn.classList.contains('on')) { stopVoice(); mark(false); return; }
    function step() {
      if (token !== VOICE.seq) { mark(false); return; }
      if (i >= qs.length) { mark(false); return; }
      var q = qs[i++];
      say(q.en, 'en', function () {
        if (token !== VOICE.seq) return;
        setTimeout(function () { if (token !== VOICE.seq) return; step(); }, 240);
      });
    }
    mark(true);
    step();
  }

  /* ============================================================
     숙제 카드에 [📖 책 3권] 버튼 달기
  ============================================================ */
  function homeworkCard() {
    var card = document.querySelector('.card-homework');
    if (card) return card;
    var title = document.getElementById('homeworkTitle');
    if (title && title.closest) return title.closest('.card');
    return null;
  }
  /* 버튼 라벨 — 이 시점의 앱 언어(documentElement.lang)로 만들어요 */
  function openLabelText() {
    var wk = currentWeek(new Date());
    var n = (wk && wk.week.books) ? wk.week.books.length : 0;
    return koMode() ? ('책 ' + n + '권') : (n + ' books');
  }
  /* 앱이 언어를 정한 뒤 · 앱 안에서 언어를 바꾼 뒤 라벨을 다시 맞춰요 */
  function refreshOpenLabel() {
    var b = document.getElementById('bcOpenBtn');
    if (!b) return;
    var tx = b.querySelector('.bc-open-tx');
    if (tx && tx.textContent !== openLabelText()) tx.textContent = openLabelText();
  }

  function ensureOpenButton() {
    var btn = document.getElementById('bcOpenBtn');
    if (btn) return btn;
    var card = homeworkCard();
    if (!card) return null;
    var n = (currentWeek(new Date()) || { week: { books: [] } }).week.books.length;

    btn = el('button', 'bc-open');
    btn.id = 'bcOpenBtn';
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-controls', 'bcModal');
    btn.setAttribute('title', '이번 주 북클럽 책 보기');
    btn.innerHTML = '<span class="bc-open-ic" aria-hidden="true">📖</span>' +
      '<span class="bc-open-tx"></span>';
    btn.querySelector('.bc-open-tx').textContent = openLabelText();
    btn.setAttribute('data-bc-books', String(n));
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      open();
    });

    var head = card.querySelector('.card-head');
    if (head) head.appendChild(btn);
    else card.appendChild(btn);
    return btn;
  }

  function watchCard() {
    if (!window.MutationObserver) return;
    var card = homeworkCard();
    if (!card) {
      /* 카드가 아직/다시 안 보이면 잠깐 지켜보다가 붙여요 (다른 작업으로 DOM 이 바뀔 때 대비) */
      try {
        var ob = new window.MutationObserver(function () {
          if (ensureOpenButton()) { try { ob.disconnect(); } catch (e) { /* 무시 */ } watchCard(); }
        });
        ob.observe(document.body, { childList: true, subtree: true });
        setTimeout(function () { try { ob.disconnect(); } catch (e) { /* 무시 */ } }, 10000);
      } catch (e) { /* 무시 */ }
      return;
    }
    try {
      var obs = new window.MutationObserver(function () {
        if (!document.getElementById('bcOpenBtn')) ensureOpenButton();
      });
      obs.observe(card, { childList: true });
    } catch (e) { /* 무시 */ }
  }

  /* ============================================================
     [다 읽었어요] → 숙제 체크
  ============================================================ */
  function bookClubRow() {
    var list = document.getElementById('homeworkList');
    if (!list) return null;
    var rows = list.querySelectorAll('.check-row');
    for (var i = 0; i < rows.length; i++) {
      var label = rows[i].querySelector('.label');
      var t = String(label ? label.textContent : '').toLowerCase();
      if (t.indexOf('북클럽') >= 0 || t.indexOf('book') >= 0) return rows[i];
    }
    return null;
  }
  function markHomeworkDone() {
    if (options().autoCheckHomework === false) return 'off';
    var row = bookClubRow();
    if (!row) return 'no-row';
    if (String(row.getAttribute('aria-pressed')) === 'true' || row.classList.contains('done')) return 'already';
    try { row.click(); } catch (e) { return 'error'; }
    return 'checked';
  }

  /* ============================================================
     시작
  ============================================================ */
  function start() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
      return;
    }
    ensureOpenButton();
    watchCard();
    buildModal();
    bindVoices();
    /* 이 스크립트는 defer 라 앱(init)보다 먼저 돌 수 있어요 → 앱이 언어를 정한 뒤 라벨을 한 번 더 맞춥니다 */
    refreshOpenLabel();
    if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', refreshOpenLabel);
    try {
      new window.MutationObserver(refreshOpenLabel).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    } catch (e) { /* 무시 */ }
    var done = document.getElementById('bcDoneBtn');
    if (done && !done.getAttribute('data-bc-bound')) {
      done.setAttribute('data-bc-bound', '1');
      done.addEventListener('click', function () {
        var r = markHomeworkDone();
        if (r === 'already') bark(koMode() ? '이미 체크했어요 👍' : 'Already checked');
        else if (r === 'no-row') bark(koMode() ? '숙제 목록에서 북클럽 칸을 못 찾았어요' : 'Book Club item not found');
        else if (r === 'off') bark(koMode() ? '숙제 칸을 직접 눌러 주세요' : 'Tap the homework row yourself');
        else if (r === 'checked') bark(koMode() ? '북클럽 숙제도 체크했어요 👍' : 'Book Club checked!');
        setTimeout(close, r === 'checked' ? 550 : 260);
      });
    }
  }

  window.SEOHAN_BOOKCLUB = {
    version: VERSION,
    build: BUILD,
    open: open,
    close: close,
    isOpen: function () { return UI.open; },
    week: function () { return UI.week; },
    weekKey: function (d) { return isoWeekKey(d || new Date()); },
    currentWeek: currentWeek,
    data: function () { return weekTable(); },
    countQuestions: countQuestions,
    say: say,
    stop: stopVoice,
    markHomeworkDone: markHomeworkDone,
    button: function () { return document.getElementById('bcOpenBtn'); },
    modal: function () { return modal; }
  };

  start();
})();
