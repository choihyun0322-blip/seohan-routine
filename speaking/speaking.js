/* ============================================================
   🗣️ 서한이 루틴 · 따라 말하기 카드 v0.2 (speaking.js)
   ------------------------------------------------------------
   · 서한이 루틴(index.html)을 고치지 않고 <script> 한 줄로 붙는 독립 모듈이에요.
   · 세 가지 세트를 모달 위 칩으로 골라요.
       📚 사이트워드      문장이 있는 Sight Word 5장 (11월 교재)
       ❄️ 12월 겨울 Q&A   EOS Speaking List 12월 (All about Winter!) 10문항
       🔤 겨울 단어 파닉스  보기 단어를 첫소리·분절로 익히는 단어 카드
   · 하는 일 (말하기 3단계)
       1단계  전체 문장을 듣고 → 2초 쉼 → 그대로 따라 말하기 (Echo)
       2단계  그림 카드를 보고 말하기 → 핵심 단어만 맞으면 통과
              (SpeechRecognition 이 되는 기기에서만 자동 확인,
               안 되면 곧바로 엄마 ✓ / 🔁 로 넘어가요)
       3단계  문장 전체를 듣고 빈칸 한 단어 채우기 (= Fill the Sentence)
     겨울 Q&A 는 질문을 먼저 듣고, 대답 보기(Yes/No · 보기 단어)를 누르면
     완성된 문장 전체를 읽어 줘요. 보기 단어 옆 🔤 를 누르면 파닉스로 읽어요.
   · 판정(O/X)은 하지 않아요. 통과는 언제나 엄마의 ✓ / 🔁 이고,
     자동 확인은 '맞았을 때 칭찬'만 하고 틀렸을 때는 "다시 해볼까?"만 띄워요.
   · 문장·그림은 앱의 window.SIGHT_DATA(ex) 를 그대로 써서 새 단어도 자동 반영.
   · 두 번 넣어도 한 번만 동작해요. (중복 주입 방지)
   ============================================================ */
(function () {
  'use strict';

  var VERSION = '0.2.0';
  var BUILD = '2026-11-28';

  if (window.SEOHAN_SPEAKING && window.SEOHAN_SPEAKING.version) return;   /* 중복 주입 방지 */

  var STORE_KEY = 'seohan-speaking-v1';
  var MOUNT_TRIES = 0;

  /* ============================================================
     아주 작은 도우미
  ============================================================ */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function $(id) { return document.getElementById(id); }
  function data() {
    return (window.SPEAKING_DATA && typeof window.SPEAKING_DATA === 'object') ? window.SPEAKING_DATA : {};
  }
  function opt(name, dflt) {
    var o = data().options || {};
    var v = o[name];
    return (v === undefined || v === null || v === '') ? dflt : v;
  }
  function koMode() { return String(document.documentElement.lang || '').indexOf('ko') === 0; }
  function T(ko, en) { return koMode() ? ko : en; }
  function once(fn) {
    var used = false;
    return function () { if (used) return; used = true; if (fn) fn.apply(null, arguments); };
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function todayKey() { return ymd(new Date()); }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function pickOne(list) {
    if (!list || !list.length) return '';
    return list[Math.floor(Math.random() * list.length)];
  }
  function storeRead() {
    try {
      var raw = window.localStorage && window.localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function storeWrite(v) {
    try { if (window.localStorage) window.localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch (e) { /* 무시 */ }
  }

  /* 시드 고정 난수 — 같은 날에는 같은 세트가 나오게 */
  function makeRng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffleWith(list, rnd) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = list[i]; list[i] = list[j]; list[j] = t;
    }
    return list;
  }

  /* ============================================================
     단어·문장 고르기 (앱의 SIGHT_DATA 를 그대로 읽어요)
  ============================================================ */
  function sightStats() {
    var map = {}, t = window.__seohanTest;
    try {
      var list = (t && t.sight && typeof t.sight.list === 'function') ? t.sight.list() : null;
      for (var i = 0; list && i < list.length; i++) map[normWord(list[i].w)] = list[i];
    } catch (e) { /* 무시 — 통계 없이도 동작해요 */ }
    return map;
  }
  function wordPool() {
    var src = (window.SIGHT_DATA && window.SIGHT_DATA.words) || [];
    var stats = sightStats(), out = [];
    for (var i = 0; i < src.length; i++) {
      var w = src[i];
      if (!w || !w.w) continue;
      var exs = [];
      for (var j = 0; j < (w.ex || []).length; j++) {
        var ex = w.ex[j];
        if (ex && ex[0]) exs.push({ sentence: String(ex[0]), hint: String(ex[1] || ''), pic: String(ex[2] || '') });
      }
      if (!exs.length) continue;                       /* 문장이 없는 단어는 카드로 못 만들어요 */
      var st = stats[normWord(w.w)];
      out.push({
        word: String(w.w), ko: w.ko || '', ex: exs,
        weak: !st || st.st !== 'known'
      });
    }
    return out;
  }
  function buildSet(size, seed) {
    var n = clamp(Math.round(Number(size) || 5), 1, 20);
    var rnd = makeRng(seed);
    var pool = wordPool();
    if (!pool.length) return [];
    shuffleWith(pool, rnd);
    /* 아직 익숙하지 않은(weak) 단어를 앞으로 — 같은 seed 면 순서가 늘 같아요 */
    pool.sort(function (a, b) { return a.weak === b.weak ? 0 : (a.weak ? -1 : 1); });
    var picked = pool.slice(0, Math.min(n, pool.length));
    var cards = [];
    for (var i = 0; i < picked.length; i++) {
      var w = picked[i];
      var ex = w.ex[Math.floor(rnd() * w.ex.length) % w.ex.length];
      cards.push({
        word: w.word, ko: w.ko,
        sentence: ex.sentence, hint: ex.hint, pic: ex.pic
      });
    }
    return cards;
  }

  /* ============================================================
     세트 고르기 (📚 사이트워드 · ❄️ 12월 겨울 Q&A · 🔤 겨울 단어)
  ============================================================ */
  var SET_IDS = ['sight', 'winter', 'phonics'];

  function setIds() { return SET_IDS.slice(); }
  function setDef(id) { return ((data().sets || {})[id]) || {}; }
  function setLabel(id) {
    var d = setDef(id);
    return (koMode() ? d.ko : d.en) || d.ko || id;
  }
  function setEmoji(id) { return setDef(id).emoji || '🗣️'; }

  /* ❄️ 12월 겨울 Q&A — 교재 10문항을 카드로 */
  function winterItems() {
    var w = data().winter;
    return (w && w.items) ? w.items : [];
  }
  function winterCards() {
    var items = winterItems(), out = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i] || {};
      if (!it.q) continue;
      var n = Number(it.n) || (i + 1);
      var fill = it.fill || {};
      var answers = (it.answers || []).slice();
      out.push({
        set: 'winter', qa: true, n: n,
        word: 'q' + (n < 10 ? '0' + n : n),        /* 완료 표시용 열쇠 */
        q: String(it.q), pic: String(it.pic || '❄️'),
        kind: String(it.kind || 'blank'),
        answers: answers, sentence: answers[0] || '', hint: '', ko: '',
        tmpl: String(fill.tmpl || ''),
        answer: String(fill.answer || ''),
        options: (fill.options || []).slice()
      });
    }
    return out;
  }

  /* 🔤 겨울 단어 파닉스 — 보기 단어 + 핵심 겨울 단어 카드 */
  function phonicsDict() {
    return (window.SPEAKING_DATA && window.SPEAKING_DATA.phonics) || {};
  }
  function chunksOf(word) {
    var e = phonicsDict()[normWord(word)];
    return (e && e.chunks && e.chunks.length) ? e.chunks.slice() : [];
  }
  /* 보기 단어 뭉치에서 낱말만 (파닉스 표에 있는 것만) */
  function phonicsWords() {
    var dict = phonicsDict(), items = winterItems(), seen = {}, out = [];
    function add(tok) {
      var k = normWord(tok);
      if (!k || !dict[k] || seen[k]) return;
      seen[k] = 1;
      out.push(k);
    }
    for (var i = 0; i < items.length; i++) {
      var opts = ((items[i] || {}).fill || {}).options || [];
      for (var j = 0; j < opts.length; j++) {
        var parts = String(opts[j]).split(/\s+/);
        for (var p = 0; p < parts.length; p++) add(parts[p]);
      }
    }
    return out;
  }
  function phonicsCards() {
    var list = phonicsWords(), dict = phonicsDict(), out = [];
    for (var i = 0; i < list.length; i++) {
      var w = list[i], e = dict[w] || {};
      out.push({
        set: 'phonics', type: 'word', word: w, ko: '',
        pic: String(e.pic || '🔤'), sentence: w, hint: '',
        chunks: (e.chunks || []).slice()
      });
    }
    return out;
  }
  function cardsForSet(set, seed) {
    if (set === 'winter') return winterCards();
    if (set === 'phonics') return phonicsCards();
    return buildSet(opt('setSize', 5), seed);
  }

  /* ============================================================
     문장 가공 (화면용)
  ============================================================ */
  function normWord(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9']+/g, '').trim();
  }
  function normText(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  var STOP = {
    the: 1, a: 1, an: 1, is: 1, are: 1, was: 1, were: 1, i: 1, you: 1, it: 1, its: 1,
    to: 1, in: 1, on: 1, of: 1, and: 1, my: 1, we: 1, he: 1, she: 1, they: 1,
    can: 1, do: 1, does: 1, did: 1, this: 1, that: 1, at: 1, for: 1, with: 1, be: 1,
    has: 1, have: 1, his: 1, her: 1, me: 1, so: 1, not: 1, by: 1, as: 1, if: 1
  };
  /* 핵심 단어 후보 — 문장 안에 실제로 들어 있는 보조 단어(ex[1]) + 그 단어 */
  function keywordsOf(card) {
    var out = [];
    if (!card) return out;
    var s = ' ' + normText(card.sentence) + ' ';
    var extra = (data().keywords || {})[card.word] || [];
    var cands = [card.hint, card.word].concat(extra);
    for (var i = 0; i < cands.length; i++) {
      var k = normWord(cands[i]);
      if (!k || k.length < 2) continue;
      if (s.indexOf(' ' + k + ' ') < 0) continue;      /* 문장에 없는 단어는 통과 기준으로 못 써요 */
      if (out.indexOf(k) < 0) out.push(k);
    }
    if (!out.length) {
      var w = normWord(card.word);
      if (w) out.push(w);
    }
    return out;
  }
  function contentWords(sentence) {
    var parts = normText(sentence).split(' '), out = [];
    for (var i = 0; i < parts.length; i++) {
      var w = parts[i];
      if (!w || w.length < 3 || STOP[w]) continue;
      if (out.indexOf(w) < 0) out.push(w);
    }
    return out;
  }
  /* 아이가 한 말 → 통과? (핵심 단어만 맞으면 통과 · 문장을 거의 다 말해도 통과) */
  function matchTranscript(text, card) {
    var res = { pass: false, hit: '', coverage: 0, words: [], heard: String(text || '').trim() };
    if (!card) return res;
    var base = normText(text);
    if (!base) return res;
    var tr = ' ' + base + ' ';
    var kws = keywordsOf(card), i;
    for (i = 0; i < kws.length; i++) {
      if (tr.indexOf(' ' + kws[i] + ' ') >= 0) {
        res.pass = true; res.hit = kws[i]; res.coverage = 1;
        return res;
      }
    }
    /* 5살 발음은 흔들려요 — 앞부분이 거의 맞으면 인정 (칭찬만 하는 판정이라 관대하게) */
    for (i = 0; i < kws.length; i++) {
      var kw = kws[i];
      if (kw.length < 4) continue;
      var stem = kw.slice(0, Math.max(3, Math.ceil(kw.length * 0.7)));
      if (tr.indexOf(stem) >= 0) {
        res.pass = true; res.hit = kw + '~'; res.coverage = 0.9;
        return res;
      }
    }
    var words = contentWords(card.sentence), hit = 0;
    for (i = 0; i < words.length; i++) if (tr.indexOf(' ' + words[i] + ' ') >= 0) hit++;
    res.words = words;
    res.coverage = words.length ? (hit / words.length) : 0;
    if (words.length >= 2 && res.coverage >= 0.6) {
      res.pass = true; res.hit = hit + '/' + words.length;
    }
    return res;
  }
  /* 카드 종류에 맞춰 통과 확인 — 사이트워드 · 겨울 Q&A · 단어 카드 */
  function matchCard(text, card) {
    if (!card) return matchTranscript(text, card);
    if (isWord(card)) {
      var res = { pass: false, hit: '', coverage: 0, words: [], heard: String(text || '').trim() };
      var w = normWord(card.word);
      if (!w) return res;
      var tr = ' ' + normText(text) + ' ';
      if (tr.indexOf(' ' + w + ' ') >= 0) { res.pass = true; res.hit = w; res.coverage = 1; return res; }
      if (w.length >= 4) {
        var stem = w.slice(0, Math.max(3, Math.ceil(w.length * 0.7)));
        if (tr.indexOf(stem) >= 0) { res.pass = true; res.hit = w + '~'; res.coverage = 0.9; }
      }
      return res;
    }
    if (isQA(card)) {
      var cands = (card.answers || []).slice();
      if (SP.stage === 'fill' && SP.pickOpt) cands = [fillSentence(card, SP.pickOpt)];
      var best = null, i;
      for (i = 0; i < cands.length; i++) {
        var words = contentWords(cands[i]);
        var hint = words.length ? words[words.length - 1] : '';
        var r = matchTranscript(text, { word: hint, hint: hint, sentence: cands[i] });
        if (r.pass) return r;
        if (!best || r.coverage > best.coverage) best = r;
      }
      return best || { pass: false, hit: '', coverage: 0, words: [], heard: String(text || '').trim() };
    }
    return matchTranscript(text, card);
  }

  /* 빈칸 문장 — 정답 단어 자리에 밑줄 (앱의 Fill the Sentence 와 같은 모양) */
  function blankSentence(sentence, word) {
    var src = String(sentence == null ? '' : sentence);
    var w = String(word == null ? '' : word);
    if (!w) return src;
    var i = src.toLowerCase().indexOf(w.toLowerCase());
    if (i < 0) return src;
    return src.slice(0, i) + '_____' + src.slice(i + w.length);
  }
  /* 2단계 카드 — 핵심 단어만 보이고 나머지는 점으로 가려요 */
  function maskSentence(sentence, word) {
    var src = String(sentence == null ? '' : sentence);
    var keep = normWord(word);
    var parts = src.split(/(\s+)/);
    var out = '';
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (!p) continue;
      if (/^\s+$/.test(p)) { out += p; continue; }
      var lead = (p.match(/^[^A-Za-z0-9']+/) || [''])[0];
      var tail = (p.match(/[^A-Za-z0-9']+$/) || [''])[0];
      var core = p.slice(lead.length, p.length - tail.length);
      if (!core) { out += p; continue; }                       /* 마침표·쉼표만 있는 토큰 */
      if (normWord(core) === keep) { out += p; continue; }
      out += lead + new Array(Math.min(8, Math.max(3, core.length)) + 1).join('▢') + tail;
    }
    return out;
  }

  /* ============================================================
     ❄️ 겨울 Q&A 카드 도우미
  ============================================================ */
  function isQA(card) { return !!(card && card.qa); }
  function isWord(card) { return !!(card && card.type === 'word'); }

  /* 빈칸 문장에 고른 보기를 넣어요 */
  function fillSentence(card, pick) {
    if (!card) return '';
    var tmpl = String(card.tmpl || card.sentence || '');
    var word = String(pick == null ? '' : pick).trim();
    if (!word) return tmpl;
    if (tmpl.indexOf('______') >= 0) return tmpl.replace('______', word);
    return tmpl;
  }
  /* 2·3단계에서 지금 보여 줄/들려 줄 문장 */
  function qaSentence(card) {
    if (!card) return '';
    if (SP.stage === 'fill') {
      if (SP.pickOpt) return fillSentence(card, SP.pickOpt);
      /* 아직 보기를 고르지 않았으면 빈칸 대신 첫 대답을 들려줘요 */
      return String(card.answers[0] || card.tmpl || card.sentence || '');
    }
    if (SP.stage === 'card' && SP.pickAns >= 0 && card.answers[SP.pickAns]) return card.answers[SP.pickAns];
    return String(card.sentence || '');
  }
  /* 대답 보기 칩 — 1·2단계는 완성 문장, 3단계는 빈칸 보기 단어 */
  function qaChoices(card) {
    if (!card) return [];
    if (SP.stage === 'fill') return (card.options || []).slice();
    return (card.answers || []).slice();
  }
  /* 파닉스 표시 — s · n · ow */
  function chunkText(word) {
    var ch = chunksOf(word);
    return ch.length ? ch.join(' · ') : String(word || '');
  }
  /* 같은 대답인지 (공백·대소문자·기호 무시) */
  function sameText(a, b) {
    return normText(a) === normText(b);
  }

  /* ============================================================
     목소리 — ① 앱의 사람 목소리 mp3(있으면) ② 기기 음성
  ============================================================ */
  var VOICE = { live: null, audio: null, bound: false, voices: [] };

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
    var name = String((v && v.name) || ''), sc = 0;
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
      if (lang === 'ko' ? !/^ko/i.test(v.lang) : !/^en/i.test(v.lang)) continue;
      var sc = scoreVoice(v, lang);
      if (sc > bestSc) { bestSc = sc; best = v; }
    }
    return best;
  }
  /* 앱이 이미 받아 둔 사람 목소리 mp3 (window.VOICE_AUDIO) 가 있으면 그걸 먼저 */
  function playMp3(text, role, fallback, done, onStart) {
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
    a.addEventListener('playing', function () {
      try { clearTimeout(watchdog); } catch (e) { /* 무시 */ }
      if (onStart) { try { onStart(); } catch (e) { /* 무시 */ } }
    });
    a.addEventListener('ended', function () {
      try { clearTimeout(watchdog); } catch (e) { /* 무시 */ }
      if (VOICE.audio === a) VOICE.audio = null;
      if (done) done();
    });
    a.addEventListener('error', function () {
      if (moved) return;
      moved = true;
      try { clearTimeout(watchdog); } catch (e) { /* 무시 */ }
      fallback();
    });
    try {
      var p = a.play();
      if (p && p.catch) p.catch(function () {
        if (moved) return;
        moved = true;
        try { clearTimeout(watchdog); } catch (e) { /* 무시 */ }
        fallback();
      });
    } catch (e) {
      if (moved) return;
      moved = true;
      try { clearTimeout(watchdog); } catch (e2) { /* 무시 */ }
      return false;
    }
    VOICE.audio = a;
    return true;
  }
  function say(text, lang, done, onStart) {
    return sayWith(text, lang, 0, done, onStart);
  }
  /* rate 를 직접 주고 싶을 때 (0 이면 기본 속도) — mp3 는 속도를 못 바꾸니 기기 음성으로 */
  function sayWith(text, lang, rate, done, onStart) {
    var t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    var finish = once(done);
    if (!t) { finish(); return false; }
    var lg = (lang === 'ko') ? 'ko' : 'en';
    var started = false;
    function tts() {
      if (started) return;
      started = true;
      if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance === 'undefined') { finish(); return; }
      bindVoices();
      var synth = window.speechSynthesis;
      try {
        var u = new window.SpeechSynthesisUtterance(t);
        u.lang = (lg === 'ko') ? 'ko-KR' : 'en-US';
        var r = Number(rate) || 0;
        u.rate = r ? clamp(r, 0.3, 2) : ((lg === 'ko') ? 0.98 : Number(opt('rate', 0.9)) || 0.9);
        u.pitch = 1.05;
        u.volume = 1;
        var v = bestVoice(lg);
        if (v) { try { u.voice = v; } catch (e) { /* 무시 */ } }
        VOICE.live = u;                                  /* GC 로 끊기지 않게 붙잡아 둬요 */
        var mark = { started: false };
        u.onstart = function () { mark.started = true; if (onStart) { try { onStart(); } catch (e) { /* 무시 */ } } };
        u.onend = function () { if (VOICE.live === u) VOICE.live = null; finish(); };
        u.onerror = function () { if (VOICE.live === u) VOICE.live = null; finish(); };
        /* iOS Safari: 큐가 빈 상태에서 cancel() 하면 다음 speak() 가 씹혀요 */
        if (synth.speaking || synth.pending) { try { synth.cancel(); } catch (e) { /* 무시 */ } }
        if (synth.paused && synth.resume) { try { synth.resume(); } catch (e) { /* 무시 */ } }
        synth.speak(u);
        setTimeout(function () {
          if (mark.started || VOICE.live !== u) return;
          if (synth.speaking || synth.pending) return;
          try { synth.speak(u); } catch (e) { /* 무시 */ }
        }, 700);
      } catch (e) { finish(); }
    }
    /* 속도를 바꾸는 발화는 mp3 를 건너뛰고 기기 음성으로 읽어요 */
    if (!Number(rate) && playMp3(t, (lg === 'ko') ? 'ko' : 'mom', tts, finish, onStart)) return true;
    tts();
    return true;
  }
  /* 여러 마디를 이어서 읽기 — { text, lang, rate, pauseMs } 또는 [text, lang] */
  function saySequence(items, done, onStart) {
    var list = [];
    for (var i = 0; i < (items || []).length; i++) {
      var it = items[i];
      if (typeof it === 'string') it = { text: it };
      else if (Object.prototype.toString.call(it) === '[object Array]') it = { text: it[0], lang: it[1], rate: it[2], pauseMs: it[3] };
      if (it && String(it.text || '').trim()) list.push(it);
    }
    var finish = once(done);
    if (!list.length) { finish(); return false; }
    var at = 0;
    function next() {
      if (at >= list.length) { finish(); return; }
      var cur = list[at++];
      var first = at === 1;
      sayWith(String(cur.text), cur.lang || 'en', Number(cur.rate) || 0, function () {
        var wait = Number(cur.pauseMs) || 0;
        if (wait > 0) setTimeout(next, wait);
        else next();
      }, first ? onStart : null);
    }
    next();
    return true;
  }
  /* 🔤 단어 파닉스 — 천천히 → 글자 하나씩 → 다시 */
  function speakPhonics(word, done, onStart) {
    var w = normWord(word);
    if (!w) { if (done) done(); return false; }
    var slow = clamp(Number(opt('phonicsRate', 0.55)) || 0.55, 0.3, 1);
    var pause = clamp(Number(opt('phonicsPauseMs', 240)) || 0, 0, 2000);
    var letters = w.toUpperCase().split('').join('. ') + '.';
    return saySequence([
      { text: w, lang: 'en', rate: slow, pauseMs: pause },
      { text: letters, lang: 'en', rate: 0.75, pauseMs: pause },
      { text: w, lang: 'en', rate: Number(opt('rate', 0.9)) || 0.9 }
    ], done, onStart);
  }
  function stopVoice() {
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* 무시 */ }
    if (VOICE.audio && VOICE.audio.pause) {
      try { VOICE.audio.pause(); } catch (e) { /* 무시 */ }
      VOICE.audio = null;
    }
    VOICE.live = null;
  }
  /* 짧은 효과음 — 통과/대기 신호 (소리가 안 나도 그냥 넘어가요) */
  function chime(kind) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!chime.ctx) chime.ctx = new AC();
      var ctx = chime.ctx;
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      var notes = kind === 'ok' ? [660, 880] : [520];
      for (var i = 0; i < notes.length; i++) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = notes[i];
        g.gain.value = 0.06;
        o.connect(g); g.connect(ctx.destination);
        var at = ctx.currentTime + i * 0.12;
        o.start(at); o.stop(at + 0.12);
      }
    } catch (e) { /* 소리 실패는 무시 */ }
  }

  /* ============================================================
     음성 인식 (SpeechRecognition) — 되면 자동 확인, 안 되면 엄마 체크
  ============================================================ */
  var ASR = { state: 'idle', rec: null, lastError: '', tried: false };

  function asrCtor() {
    try { return window.SpeechRecognition || window.webkitSpeechRecognition || null; } catch (e) { return null; }
  }
  function asrSupported() { return !!asrCtor(); }
  function asrStop() {
    if (ASR.rec) {
      try { ASR.rec.abort(); } catch (e) { /* 무시 */ }
    }
    ASR.rec = null;
    if (ASR.state === 'listening') ASR.state = 'idle';
  }
  function asrListen(cb) {
    cb = once(cb);
    var C = asrCtor();
    if (!C) { cb({ ok: false, reason: 'unsupported' }); return false; }
    if (ASR.state === 'listening') { asrStop(); ASR.state = 'idle'; }
    stopVoice();
    recStop(true);                                    /* 마이크는 한 번에 하나만 */
    var r;
    try { r = new C(); } catch (e) { cb({ ok: false, reason: 'unsupported' }); return false; }
    var texts = [], settled = false;
    function finish(res) {
      if (settled) return;
      settled = true;
      if (ASR.timer) { clearTimeout(ASR.timer); ASR.timer = null; }
      ASR.rec = null;
      ASR.state = 'idle';
      cb(res);
    }
    try {
      r.lang = 'en-US';
      r.interimResults = false;
      r.continuous = false;
      r.maxAlternatives = 3;
    } catch (e) { /* 무시 */ }
    r.onresult = function (ev) {
      try {
        for (var i = 0; i < ev.results.length; i++) {
          var res = ev.results[i];
          for (var j = 0; j < res.length; j++) {
            var t = res[j] && res[j].transcript;
            if (t) texts.push(String(t));
          }
        }
      } catch (e) { /* 무시 */ }
    };
    r.onerror = function (ev) {
      var err = (ev && ev.error) || 'error';
      ASR.lastError = err;
      /* 권한 거부·미지원·네트워크 → 다시 시도하지 않고 엄마 체크로 넘어가요 */
      if (/not-allowed|service-not-allowed|audio-capture|language-not-supported/i.test(err)) ASR.state = 'off';
      finish({ ok: false, reason: err, text: texts.join(' ') });
    };
    r.onend = function () { finish({ ok: true, text: texts.join(' ').trim() }); };
    try {
      r.start();
    } catch (e) {
      ASR.state = 'off';
      finish({ ok: false, reason: 'start-failed' });
      return false;
    }
    ASR.rec = r;
    ASR.state = 'listening';
    ASR.tried = true;
    ASR.timer = setTimeout(function () {
      if (settled) return;
      try { r.stop(); } catch (e) { /* 무시 */ }
      setTimeout(function () { finish({ ok: true, text: texts.join(' ').trim() }); }, 300);
    }, clamp(Number(opt('asrTimeoutMs', 8000)) || 8000, 2000, 20000));
    return true;
  }

  /* ============================================================
     아이 말하기 녹음 (선택) — 기기 안에서만, 저장하지 않아요
  ============================================================ */
  var REC = { on: false, stream: null, mr: null, chunks: [], url: '', err: '' };

  function recSupported() {
    return !!(window.MediaRecorder && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');
  }
  function recMime() {
    var list = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    for (var i = 0; i < list.length; i++) {
      try { if (!window.MediaRecorder.isTypeSupported || window.MediaRecorder.isTypeSupported(list[i])) return list[i]; } catch (e) { /* 무시 */ }
    }
    return '';
  }
  function recClear() {
    if (REC.url) { try { URL.revokeObjectURL(REC.url); } catch (e) { /* 무시 */ } }
    REC.url = '';
    REC.chunks = [];
  }
  function recStop(silent) {
    asrStop();
    if (REC.mr && REC.mr.state !== 'inactive') { try { REC.mr.stop(); } catch (e) { /* 무시 */ } }
    REC.mr = null;
    REC.on = false;
    if (REC.stream) {
      try { REC.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* 무시 */ }
      REC.stream = null;
    }
    if (!silent) renderRec();
  }
  function recStart(cb) {
    cb = cb || function () {};
    if (!recSupported()) { REC.err = 'unsupported'; cb(false); return; }
    if (REC.on) { recStop(); cb(false); return; }
    asrStop();
    stopVoice();
    REC.err = '';
    recClear();
    var got = function (stream) {
      REC.stream = stream;
      var mime = recMime();
      var mr;
      try { mr = mime ? new window.MediaRecorder(stream, { mimeType: mime }) : new window.MediaRecorder(stream); } catch (e) {
        try { mr = new window.MediaRecorder(stream); } catch (e2) { REC.err = 'recorder'; cb(false); return; }
      }
      REC.mr = mr;
      REC.chunks = [];
      mr.ondataavailable = function (ev) { if (ev && ev.data && ev.data.size) REC.chunks.push(ev.data); };
      mr.onstop = function () {
        try {
          var blob = new Blob(REC.chunks, { type: mime || 'audio/mp4' });
          if (REC.url) { try { URL.revokeObjectURL(REC.url); } catch (e) { /* 무시 */ } }
          REC.url = URL.createObjectURL(blob);
        } catch (e) { REC.err = 'blob'; }
        REC.on = false;
        renderRec();
        cb(true);
      };
      try { mr.start(); REC.on = true; } catch (e) { REC.err = 'start'; cb(false); return; }
      renderRec();
      cb(true);
    };
    try {
      var p = navigator.mediaDevices.getUserMedia({ audio: true });
      if (p && p.then) p.then(got).catch(function () { REC.err = 'permission'; renderRec(); cb(false); });
      else got(p);
    } catch (e) { REC.err = 'permission'; renderRec(); cb(false); }
  }
  function recPlay() {
    if (!REC.url || !window.Audio) return;
    try {
      stopVoice();
      var a = new window.Audio(REC.url);
      a.play();
      VOICE.audio = a;
      a.onended = function () { if (VOICE.audio === a) VOICE.audio = null; };
    } catch (e) { /* 무시 */ }
  }

  /* ============================================================
     상태
  ============================================================ */
  var STAGES = [
    { id: 'echo', emoji: '1️⃣', ko: '듣고 따라 말하기', en: 'Listen & Repeat', shortKo: '따라 말하기', shortEn: 'Repeat' },
    { id: 'card', emoji: '2️⃣', ko: '카드 보고 말하기', en: 'Say It', shortKo: '카드 보고', shortEn: 'Say it' },
    { id: 'fill', emoji: '3️⃣', ko: '빈칸 채우기', en: 'Fill the Blank', shortKo: '빈칸', shortEn: 'Blank' }
  ];
  /* 🔤 단어 카드는 단계 없이 한 장씩 (파닉스 → 따라 말하기) */
  var WORD_STAGE = { id: 'word', emoji: '🔤', ko: '파닉스 단어', en: 'Phonics Word', shortKo: '단어', shortEn: 'Word' };
  function stageDef(id) {
    if (id === 'word') return WORD_STAGE;
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) return STAGES[i];
    return STAGES[0];
  }
  function stageIndex(id) {
    if (id === 'word') return 0;
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) return i;
    return 0;
  }

  var SP = {
    open: false,
    set: 'sight',
    stage: 'echo',
    i: 0,
    cards: [],
    done: {},
    stars: 0,
    date: '',
    seed: 0,
    timer: null,
    waitTimer: null,
    guard: null,
    startGuard: null,
    pauseDone: false,
    revealed: false,
    pickAns: -1,
    pickOpt: '',
    phText: '',
    heard: '',
    match: null,
    lastFocus: null
  };

  function save() {
    storeWrite({
      date: SP.date, seed: SP.seed, set: SP.set,
      stars: SP.stars, done: SP.done,
      stage: SP.stage
    });
  }
  function loadSet(force) {
    var today = todayKey(), saved = force ? null : storeRead();
    var sameDay = !!(saved && saved.date === today && typeof saved.seed === 'number');
    if (sameDay) {
      SP.seed = saved.seed;
      SP.done = saved.done && typeof saved.done === 'object' ? saved.done : {};
      SP.stars = Number(saved.stars) || 0;
      if (saved.set && SET_IDS.indexOf(saved.set) >= 0) SP.set = saved.set;
      if (saved.stage === 'word' || saved.stage === 'echo' || saved.stage === 'card' || saved.stage === 'fill') SP.stage = saved.stage;
    } else {
      SP.seed = ((Date.now() & 0xffffffff) ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
      SP.done = {};
      SP.stars = 0;
    }
    if (SP.set === 'phonics') SP.stage = 'word';
    else if (SP.stage === 'word') SP.stage = 'echo';
    SP.date = today;
    SP.cards = cardsForSet(SP.set, SP.seed);
    if (!sameDay) save();
    return SP.cards.length;
  }
  function newSet() {
    var seed = ((Date.now() & 0xffffffff) ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    while (seed === SP.seed) seed = (seed + 7919) >>> 0;   /* 같은 세트가 또 나오지 않게 */
    SP.seed = seed;
    SP.date = todayKey();
    SP.done = {};
    SP.cards = cardsForSet(SP.set, seed);
    SP.i = 0;
    save();
    render();
    enterCard(true);
    return SP.cards.length;
  }
  /* 세트 바꾸기 — 📚 사이트워드 / ❄️ 12월 겨울 Q&A / 🔤 겨울 단어 파닉스 */
  function setSet(id) {
    if (SET_IDS.indexOf(id) < 0) return false;
    var changed = SP.set !== id;
    SP.set = id;
    if (id === 'phonics') SP.stage = 'word';
    else if (SP.stage === 'word') SP.stage = 'echo';
    if (changed) {
      SP.cards = cardsForSet(id, SP.seed || 1);
      SP.pickAns = -1;
      SP.pickOpt = '';
      SP.phText = '';
    }
    SP.i = firstUndone(SP.stage);
    save();
    if (SP.open) { render(); enterCard(true); }
    return true;
  }
  function cardKey(i, stage) {
    var c = SP.cards[i];
    return (SP.set || 'sight') + '|' + (stage || SP.stage) + '|' + (c ? c.word : String(i));
  }
  function isDone(i, stage) { return !!SP.done[cardKey(i, stage)]; }
  function doneCount(stage) {
    var n = 0;
    for (var i = 0; i < SP.cards.length; i++) if (isDone(i, stage)) n++;
    return n;
  }
  function firstUndone(stage) {
    for (var i = 0; i < SP.cards.length; i++) if (!isDone(i, stage)) return i;
    return 0;
  }
  function cur() { return SP.cards[SP.i] || null; }

  /* ============================================================
     화면 만들기
  ============================================================ */
  var modal = null;

  function buildEntry() {
    if ($('spOpenBtn')) return;
    var hero = document.querySelector('#panelSight .card-sight-hero');
    if (!hero) {
      var alt = document.querySelector('.card-sight-hero');
      if (!alt) return;
      hero = alt;
    }
    var box = el('div', 'sp-entry');
    box.innerHTML =
      '<button class="sp-open" id="spOpenBtn" type="button">' +
        '<span class="sp-open-emoji" aria-hidden="true">🗣️</span>' +
        '<span class="sp-open-text"></span>' +
        '<span class="sp-open-sub"></span>' +
      '</button>' +
      '<div class="sp-quick" id="spQuick" role="group">' +
        '<button class="sp-quick-chip" type="button" data-sp-set="winter"></button>' +
        '<button class="sp-quick-chip" type="button" data-sp-set="phonics"></button>' +
      '</div>';
    var q = hero.querySelector('.sight-queue');
    if (q && q.parentNode === hero) hero.insertBefore(box, q);
    else hero.appendChild(box);
    paintEntry();
  }
  function paintEntry() {
    var b = $('spOpenBtn');
    if (!b) return;
    var t = b.querySelector('.sp-open-text'), s = b.querySelector('.sp-open-sub');
    if (t) t.textContent = T('따라 말하기 1·2·3', 'Say It 1·2·3');
    if (s) s.textContent = T(opt('setSize', 5) + '장 1세트', opt('setSize', 5) + ' cards');
    b.setAttribute('aria-label', T('따라 말하기 카드를 열어요 — 듣고 따라 말하기, 카드 보고 말하기, 빈칸 채우기',
      'Open the Say It cards — listen and repeat, say it, fill the blank'));
    var q = $('spQuick');
    if (q) {
      var w = q.querySelector('[data-sp-set="winter"]');
      var p = q.querySelector('[data-sp-set="phonics"]');
      if (w) { w.textContent = '❄️ ' + setLabel('winter'); w.setAttribute('aria-label', T('12월 겨울 Q&A 10문항을 열어요', 'Open the December winter Q&A cards')); }
      if (p) { p.textContent = '🔤 ' + T('겨울 단어', 'Winter words'); p.setAttribute('aria-label', T('겨울 단어 파닉스를 열어요', 'Open winter word phonics')); }
    }
  }

  function buildModal() {
    if (modal) return modal;
    var m = el('div', 'modal sp-modal');
    m.id = 'spModal';
    m.hidden = true;
    m.innerHTML =
      '<div class="modal-backdrop" data-sp-close="1"></div>' +
      '<div class="modal-panel sp-panel" role="dialog" aria-modal="true" aria-labelledby="spTitle">' +
        '<header class="modal-head sp-head">' +
          '<h2 id="spTitle"><span aria-hidden="true">🗣️</span> <span id="spTitleText"></span> ' +
            '<span class="sp-stagepill" id="spStagePill"></span></h2>' +
          '<div class="sp-headright">' +
            '<span class="sp-stars" id="spStars" aria-live="polite">⭐ 0</span>' +
            '<button class="sp-x" type="button" data-sp-close="1" aria-label="close">✕</button>' +
          '</div>' +
        '</header>' +
        '<div class="sp-sets" id="spSets" role="group"></div>' +
        '<div class="sp-steps" id="spSteps" role="tablist"></div>' +
        '<div class="modal-body sp-body">' +
          '<p class="sp-guide" id="spGuide"></p>' +
          '<div class="sp-card" id="spCard">' +
            '<p class="sp-q" id="spQ" hidden></p>' +
            '<p class="sp-pic" id="spPic" aria-hidden="true"></p>' +
            '<p class="sp-sent" id="spSent"></p>' +
            '<p class="sp-hint" id="spHint" hidden></p>' +
            '<p class="sp-ph" id="spPh" hidden></p>' +
            '<p class="sp-word" id="spWord" hidden></p>' +
          '</div>' +
          '<div class="sp-choices" id="spChoices" hidden></div>' +
          '<div class="sp-turn" id="spTurn" hidden>' +
            '<span class="sp-turn-ico" aria-hidden="true">🎤</span>' +
            '<span id="spTurnText" aria-live="polite"></span>' +
          '</div>' +
          '<div class="sp-wait" id="spWait" hidden><span class="sp-wait-bar" id="spWaitBar"></span></div>' +
          '<div class="sp-actions">' +
            '<button class="sp-big sp-qplay" id="spQPlay" type="button" hidden><span aria-hidden="true">❓</span> <span id="spQPlayText"></span></button>' +
            '<button class="sp-big" id="spPlay" type="button"><span aria-hidden="true">🔊</span> <span id="spPlayText"></span></button>' +
            '<button class="sp-big is-listen" id="spMic" type="button" hidden><span class="sp-dot" aria-hidden="true">🎙️</span> <span id="spMicText"></span></button>' +
          '</div>' +
          '<div class="sp-asrnote" id="spAsrNote" hidden></div>' +
          '<div class="sp-check">' +
            '<button class="sp-ok" id="spOk" type="button">✓ <span id="spOkText"></span></button>' +
            '<button class="sp-again" id="spAgain" type="button">🔁 <span id="spAgainText"></span></button>' +
          '</div>' +
          '<div class="sp-done" id="spDone" hidden></div>' +
          '<div class="sp-foot-row">' +
            '<button class="sp-mini" id="spPrev" type="button" aria-label="previous">‹</button>' +
            '<span class="sp-dots" id="spDots"></span>' +
            '<span class="sp-count" id="spCount"></span>' +
            '<span class="sp-spacer"></span>' +
            '<button class="sp-mini" id="spCheer" type="button">💛 <span id="spCheerText"></span></button>' +
            '<button class="sp-mini" id="spRecBtn" type="button">🎙️ <span id="spRecText"></span></button>' +
            '<button class="sp-mini" id="spRecPlay" type="button" hidden>▶</button>' +
            '<button class="sp-mini" id="spRecDel" type="button" hidden>✕</button>' +
            '<button class="sp-mini" id="spSkip" type="button"></button>' +
          '</div>' +
        '</div>' +
        '<footer class="modal-foot sp-foot">' +
          '<button class="ghost-btn" type="button" data-sp-close="1" id="spQuit"></button>' +
          '<button class="primary-btn" type="button" id="spNextStage"></button>' +
        '</footer>' +
      '</div>';
    document.body.appendChild(m);
    modal = m;
    bindModal();
    paintStatic();
    return m;
  }

  function paintStatic() {
    if (!modal) return;
    var set = function (id, text) { var n = $(id); if (n) n.textContent = text; };
    set('spTitleText', T('따라 말하기', 'Say It'));
    set('spOkText', T('잘했어요', 'Got it'));
    set('spAgainText', T('한 번 더', 'One more'));
    set('spPlayText', T('다시 듣기', 'Listen again'));
    set('spMicText', T('말해보기', 'Speak'));
    set('spCheerText', T('응원', 'Cheer'));
    set('spRecText', T('녹음', 'Record'));
    set('spSkip', T('건너뛰기 →', 'Skip →'));
    set('spQuit', T('그만하기', 'Close'));
    set('spQPlayText', T('질문', 'Question'));
    paintSets();
    var steps = $('spSteps');
    if (steps) {
      steps.innerHTML = '';
      for (var i = 0; i < STAGES.length; i++) {
        var st = STAGES[i];
        var b = el('button', 'sp-step');
        b.type = 'button';
        b.setAttribute('data-stage', st.id);
        b.setAttribute('role', 'tab');
        b.innerHTML = '<span class="sp-step-emoji" aria-hidden="true">' + st.emoji + '</span>' +
          '<span class="sp-step-text">' + (koMode() ? st.shortKo : st.shortEn) + '</span>';
        steps.appendChild(b);
      }
    }
    var x = modal.querySelector('.sp-x');
    if (x) x.setAttribute('aria-label', T('닫기', 'Close'));
  }

  /* 세트 칩 — 📚 사이트워드 · ❄️ 12월 겨울 Q&A · 🔤 겨울 단어 파닉스 */
  function paintSets() {
    var box = $('spSets');
    if (!box) return;
    box.innerHTML = '';
    for (var i = 0; i < SET_IDS.length; i++) {
      var id = SET_IDS[i];
      var b = el('button', 'sp-set');
      b.type = 'button';
      b.setAttribute('data-sp-set', id);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', SP.set === id ? 'true' : 'false');
      var n = id === 'winter' ? winterItems().length : (id === 'phonics' ? phonicsWords().length : opt('setSize', 5));
      b.innerHTML = '<span class="sp-set-emoji" aria-hidden="true">' + setEmoji(id) + '</span>' +
        '<span class="sp-set-text">' + setLabel(id) + '</span>' +
        '<span class="sp-set-n">' + n + '</span>';
      if (SP.set === id) b.classList.add('is-on');
      box.appendChild(b);
    }
  }

  /* ---------- 그리기 ---------- */
  /* 안내문 — 세트·단계별 */
  function guideText(c) {
    if (!c) {
      return T('아직 만들 카드가 없어요. Sight Words에 문장이 있는 단어를 먼저 넣어 주세요.',
        'No cards yet — add sight words with sentences first.');
    }
    if (isWord(c)) {
      return T('🔤 단어를 세 번 들려줘요: 천천히 → 글자 하나씩 → 다시. 그리고 따라 말해 봐요.',
        'The word is read three ways: slow, letter by letter, then normal. Then say it.');
    }
    if (isQA(c)) {
      if (SP.stage === 'echo') return T('① 질문과 대답을 끝까지 들려줘요. 2초 쉼 뒤에 그대로 따라 말해요.',
        '1. Listen to the question and the answer. After a 2-second pause, say them the same way.');
      if (SP.stage === 'card') return T('② 그림을 보고 대답을 골라 봐요. 누르면 완성된 문장을 읽어 줘요.',
        '2. Look at the picture and pick an answer. It reads the whole sentence.');
      return T('③ 빈칸에 들어갈 말을 골라 봐요. 누르면 문장 전체를 읽어 줘요.',
        '3. Pick the words for the blank. It reads the whole sentence.');
    }
    if (SP.stage === 'echo') return T('① 문장을 끝까지 들려줘요. 2초 쉼 뒤에 서한이가 그대로 따라 말해요.',
      '1. Listen to the whole sentence. After a 2-second pause, say it the same way.');
    if (SP.stage === 'card') return T('② 그림 카드를 보고 말해요. 핵심 단어만 맞으면 통과! 틀려도 "다시 해볼까?" 하고 넘어가요.',
      '2. Look at the picture and say it. Matching the key word is enough — a soft "let us try again?" if not.');
    return T('③ 문장 전체를 듣고 빈칸에 들어갈 한 단어를 말해요.',
      '3. Listen to the whole sentence, then say the one word for the blank.');
  }

  /* "이제 따라 말해 봐!" 문구 */
  function turnTextFor(c) {
    if (!c) return '';
    if (isWord(c)) return T('따라 말해 봐!', 'Say it with me!');
    if (isQA(c)) {
      if (SP.stage === 'echo') return T('이제 따라 말해 봐!', 'Now say it with me!');
      if (SP.stage === 'card') return T('그림을 보고 대답해 볼까?', 'What will you say?');
      return T('빈칸에 들어갈 말은?', 'Which words go in the blank?');
    }
    return SP.stage === 'echo' ? T('이제 따라 말해 봐!', 'Now say it with me!')
      : SP.stage === 'card' ? T('그림을 보고 말해 볼까?', 'What does the picture say?')
        : T('빈칸에 들어갈 단어는?', 'Which word goes in the blank?');
  }

  /* ❄️ 겨울 Q&A — 대답 보기 / 빈칸 보기 칩 */
  function renderChoices(c) {
    var box = $('spChoices');
    if (!box) return;
    if (!isQA(c)) { box.hidden = true; box.innerHTML = ''; return; }
    var list = qaChoices(c);
    box.hidden = !list.length;
    box.innerHTML = '';
    for (var i = 0; i < list.length; i++) {
      var text = String(list[i]);
      var chosen = (SP.stage === 'fill') ? sameText(SP.pickOpt, text) : (SP.pickAns === i);
      var row = el('div', 'sp-choice' + (chosen ? ' is-on' : ''));
      var b = el('button', 'sp-choice-main');
      b.type = 'button';
      b.setAttribute('data-sp-answer', String(i));
      b.setAttribute('data-sp-text', text);
      var span = el('span', 'sp-choice-text');
      span.textContent = text;
      b.appendChild(span);
      row.appendChild(b);
      if (SP.stage === 'fill' && /[A-Za-z]/.test(text)) {
        var p = el('button', 'sp-choice-ph');
        p.type = 'button';
        p.setAttribute('data-sp-phonics', text);
        p.setAttribute('aria-label', T(text + ' 파닉스로 듣기', 'Hear ' + text + ' sound by sound'));
        p.textContent = '🔤';
        row.appendChild(p);
      }
      box.appendChild(row);
    }
  }

  /* 보기 문구 → 낱말마다 파닉스로 읽기 (Christmas trees → Christmas, trees) */
  function phonicsOfPhrase(text) {
    var parts = String(text || '').split(/\s+/), words = [], seen = {}, i;
    for (i = 0; i < parts.length; i++) {
      var k = normWord(parts[i]);
      if (!k || seen[k] || !chunksOf(k).length) continue;
      seen[k] = 1;
      words.push(k);
    }
    if (!words.length) return false;
    SP.phText = '🔤 ' + words.map(chunkText).join('  /  ') + ' → ' + words.join(' ');
    render();
    var at = 0;
    function next() {
      if (at >= words.length) return;
      speakPhonics(words[at++], next, null);
    }
    next();
    return true;
  }

  function render() {
    if (!modal) return;
    var c = cur(), n = SP.cards.length;
    var wd = isWord(c) || SP.set === 'phonics';
    var qa = isQA(c);
    var idx = stageIndex(SP.stage);

    var pill = $('spStagePill');
    if (pill) pill.textContent = wd ? T('단어', 'Word') : ((idx + 1) + T('단계', '/3'));

    var stars = $('spStars');
    if (stars) stars.textContent = '⭐ ' + SP.stars;

    paintSets();

    /* 단계 탭 */
    var steps = $('spSteps');
    if (steps) {
      steps.hidden = wd;
      var btns = steps.querySelectorAll('.sp-step');
      for (var i = 0; i < btns.length; i++) {
        var on = btns[i].getAttribute('data-stage') === SP.stage;
        btns[i].classList.toggle('is-on', on);
        btns[i].classList.toggle('is-done', doneCount(STAGES[i].id) >= n && n > 0);
        btns[i].setAttribute('aria-selected', on ? 'true' : 'false');
      }
    }

    /* 안내문 */
    var guide = $('spGuide');
    if (guide) guide.textContent = guideText(c);

    /* 질문 줄 (❄️ 겨울 Q&A) */
    var q = $('spQ');
    if (q) {
      if (qa) { q.hidden = false; q.textContent = '❓ ' + c.q; }
      else { q.hidden = true; q.textContent = ''; }
    }

    /* 카드 */
    var pic = $('spPic'), sent = $('spSent'), hint = $('spHint'), ph = $('spPh'), wnode = $('spWord');
    if (pic) pic.textContent = c ? (c.pic || '🖼️') : '🖼️';
    if (sent) {
      sent.classList.toggle('is-word', !!wd);
      if (!c) sent.textContent = '';
      else if (wd) sent.textContent = c.word;
      else if (qa) {
        if (SP.stage === 'fill') sent.textContent = SP.pickOpt ? fillSentence(c, SP.pickOpt) : String(c.tmpl || c.sentence || '');
        else if (SP.stage === 'card') sent.textContent = (SP.pickAns >= 0 && c.answers[SP.pickAns])
          ? c.answers[SP.pickAns] : T('아래에서 대답을 골라 봐요!', 'Pick an answer below!');
        else sent.textContent = (SP.pickAns >= 0 && c.answers[SP.pickAns]) ? c.answers[SP.pickAns] : c.sentence;
      }
      else if (SP.stage === 'echo') sent.textContent = c.sentence;
      else if (SP.stage === 'fill') sent.textContent = blankSentence(c.sentence, c.word);
      else sent.textContent = maskSentence(c.sentence, c.hint || c.word);
    }
    if (hint) {
      if (c && !qa && !wd && SP.stage === 'card' && opt('stage2Hint', true)) {
        hint.hidden = false;
        hint.textContent = '🔑 ' + (c.hint || c.word);
      } else { hint.hidden = true; hint.textContent = ''; }
    }
    /* 🔤 파닉스 힌트 — 단어 카드는 늘 보이고, 겨울 Q&A 는 🔤 를 누르면 */
    if (ph) {
      if (c && wd) { ph.hidden = false; ph.textContent = '🔤 ' + chunkText(c.word); }
      else if (c && SP.phText) { ph.hidden = false; ph.textContent = SP.phText; }
      else { ph.hidden = true; ph.textContent = ''; }
    }
    if (wnode) {
      if (c && (wd || (qa && SP.stage === 'fill')) && SP.revealed) {
        wnode.hidden = false;
        wnode.textContent = '✓ ' + (qa ? (SP.pickOpt || c.answer || '') : c.word);
      } else { wnode.hidden = true; wnode.textContent = ''; }
    }

    renderChoices(c);

    /* 프롬프트·대기바 */
    var turn = $('spTurn'), turnText = $('spTurnText');
    if (turn && turnText) {
      turn.hidden = !SP.pauseDone || !c;
      turnText.textContent = turnTextFor(c);
    }
    /* 🎙️ 말해보기 — 2·3단계·단어 카드에서, 기기가 지원할 때만 */
    var mic = $('spMic');
    if (mic) {
      var canSpeak = !!c && (wd || SP.stage !== 'echo');
      mic.hidden = !(canSpeak && asrSupported() && ASR.state !== 'off');
      mic.classList.toggle('is-listen', ASR.state === 'listening');
      var mt = $('spMicText');
      if (mt) mt.textContent = ASR.state === 'listening' ? T('듣고 있어요…', 'Listening…') : T('말해보기', 'Speak');
    }
    paintAsrNote();

    /* ❓ 질문만 듣기 — 겨울 Q&A 에서만 */
    var qp = $('spQPlay');
    if (qp) qp.hidden = !qa;

    /* 아래 줄 */
    var dots = $('spDots');
    if (dots) {
      var html = '';
      for (var k = 0; k < n; k++) html += (isDone(k, SP.stage) ? '<span class="is-on">★</span>' : '☆');
      dots.innerHTML = html;
      dots.setAttribute('aria-label', T('이번 단계에서 ' + doneCount(SP.stage) + '장 끝냈어요', doneCount(SP.stage) + ' of ' + n + ' done'));
    }
    var count = $('spCount');
    if (count) count.textContent = n ? (Math.min(SP.i + 1, n) + ' / ' + n) : '0 / 0';
    var prev = $('spPrev');
    if (prev) prev.disabled = SP.i <= 0;
    var nt = $('spNextStage');
    if (nt) {
      if (wd) nt.textContent = T('다음 단어 →', 'Next word →');
      else if (SP.stage === 'echo') nt.textContent = T('2단계 · 카드 보고 →', 'Step 2 · Say it →');
      else if (SP.stage === 'card') nt.textContent = T('3단계 · 빈칸 채우기 →', 'Step 3 · Blank →');
      else if (qa) nt.textContent = T('🔤 겨울 단어 파닉스로 →', '🔤 Winter words →');
      else nt.textContent = T('📖 빈칸 놀이로 →', '📖 Open Fill the Sentence');
    }
    var dn = $('spDone');
    if (dn) {
      if (c && n && doneCount(SP.stage) >= n) {
        dn.hidden = false;
        if (wd) dn.textContent = T(n + '개 단어 모두 끝! 🎉', 'All ' + n + ' words done! 🎉');
        else if (SP.stage === 'fill') dn.textContent = T(n + '장 모두 끝! 이제 앱의 빈칸 놀이로 이어가요 🎉', 'All ' + n + ' done! Hand over to Fill the Sentence 🎉');
        else dn.textContent = T(n + '장 모두 끝! 다음 단계로 가 볼까요? 🎉', 'All ' + n + ' done! Ready for the next step? 🎉');
      } else { dn.hidden = true; dn.textContent = ''; }
    }
    renderRec();
  }

  function paintAsrNote() {
    var note = $('spAsrNote');
    if (!note) return;
    var txt = '';
    if (!asrSupported() || ASR.state === 'off') {
      txt = T('<b>이 기기에서는 자동 확인이 안 돼요.</b> 대신 엄마가 ✓ 잘했어요 / 🔁 한 번 더로 봐 주세요.',
        '<b>Auto-check is not available on this device.</b> Please tap ✓ Got it or 🔁 One more.');
      if (ASR.state === 'off' && ASR.lastError === 'not-allowed') {
        txt = T('<b>마이크 권한이 없어서 자동 확인을 껐어요.</b> 엄마가 ✓ / 🔁 로 봐 주세요.',
          '<b>Mic permission was not given, so auto-check is off.</b> Please use ✓ / 🔁.');
      }
    } else if (ASR.state === 'listening') {
      txt = T('듣고 있어요… 다 말하면 자동으로 확인해요.', 'Listening… it checks when you finish.');
    } else if (SP.heard) {
      txt = T('들린 말: “' + SP.heard + '”', 'Heard: “' + SP.heard + '”');
    }
    note.hidden = !txt;
    note.innerHTML = txt;
  }

  function renderRec() {
    var b = $('spRecBtn'), pl = $('spRecPlay'), del = $('spRecDel'), rt = $('spRecText');
    if (!b) return;
    b.classList.toggle('is-rec', !!REC.on);
    if (rt) rt.textContent = REC.on ? T('멈춤', 'Stop') : (REC.url ? T('다시 녹음', 'Re-record') : T('녹음', 'Record'));
    if (pl) pl.hidden = !REC.url || REC.on;
    if (del) del.hidden = !REC.url || REC.on;
    b.hidden = !recSupported();
  }

  /* ============================================================
     재생 · 흐름
  ============================================================ */
  function clearTimers() {
    if (SP.timer) { clearTimeout(SP.timer); SP.timer = null; }
    if (SP.waitTimer) { clearTimeout(SP.waitTimer); SP.waitTimer = null; }
    if (SP.guard) { clearTimeout(SP.guard); SP.guard = null; }
    if (SP.startGuard) { clearTimeout(SP.startGuard); SP.startGuard = null; }
  }
  function setTurn(on) {
    SP.pauseDone = !!on;
    var turn = $('spTurn');
    if (turn) {
      turn.hidden = !on;
      turn.classList.toggle('is-live', !!on);
      var t = $('spTurnText');
      if (t && on) {
        t.textContent = SP.stage === 'echo' ? T('이제 따라 말해 봐!', 'Now say it with me!')
          : SP.stage === 'card' ? T('그림을 보고 말해 볼까?', 'What does the picture say?')
            : T('빈칸에 들어갈 단어는?', 'Which word goes in the blank?');
      }
    }
  }
  function showWait(ms) {
    var w = $('spWait'), bar = $('spWaitBar');
    if (!w || !bar) return;
    w.hidden = false;
    w.classList.remove('is-run');
    bar.style.transitionDuration = '0ms';
    bar.style.transform = 'scaleX(0)';
    /* 다음 프레임에 시작해야 애니메이션이 보여요 */
    SP.waitTimer = setTimeout(function () {
      bar.style.transitionDuration = ms + 'ms';
      bar.style.transform = 'scaleX(1)';
      w.classList.add('is-run');
    }, 16);
  }
  function startPause(muted) {
    clearTimers();
    setTurn(false);
    if (muted) { setTurn(true); return; }
    var ms = clamp(Number(opt('echoPauseMs', 2000)) || 0, 0, 10000);
    if (!ms) { setTurn(true); return; }
    showWait(ms);
    SP.timer = setTimeout(function () {
      SP.timer = null;
      var w = $('spWait');
      if (w) w.hidden = true;
      setTurn(true);
      chime('listen');
    }, ms);
  }
  /* 지금 카드의 문장 전체를 들려줘요 (1·3단계는 다 들려준 뒤 2초 쉼)
     ❄️ 겨울 Q&A 는 질문 → 대답 순서, 🔤 단어 카드는 파닉스로 읽어요. */
  function speakCard(withPause) {
    var c = cur();
    if (!c) return false;
    clearTimers();
    setTurn(false);
    var done = once(function () {
      if (!SP.open) return;
      if (withPause) startPause(false);
      else setTurn(true);
    });
    var heard = false;
    var onStart = function () {
      heard = true;
      if (SP.startGuard) { clearTimeout(SP.startGuard); SP.startGuard = null; }
    };
    var started = false;
    var isWordCard = isWord(c) || SP.set === 'phonics';
    if (isWordCard) {
      started = speakPhonics(c.word, done, onStart);
    } else if (isQA(c)) {
      started = saySequence([[c.q, 'en'], [qaSentence(c) || c.sentence, 'en']], done, onStart);
    } else {
      started = say(c.sentence, 'en', done, onStart);
    }
    if (!started) { done(); return false; }
    /* 소리가 늦게 시작하는 기기: 시작하면 그때부터 쉼을 세요 */
    SP.startGuard = setTimeout(function () {
      SP.startGuard = null;
      if (heard) return;
      done();                                    /* 소리가 안 났으면 기다리지 않고 "따라 말해 봐" */
    }, 1600);
    /* mp3·음성이 아주 길게 멈춘 경우를 대비한 안전장치 */
    SP.guard = setTimeout(function () { done(); }, (isQA(c) || isWordCard) ? 16000 : 12000);
    return true;
  }

  function enterCard(speakNow) {
    clearTimers();
    ASR.state = ASR.state === 'off' ? 'off' : 'idle';
    recStop(true);
    recClear();
    SP.heard = '';
    SP.match = null;
    SP.revealed = false;
    SP.pauseDone = false;
    SP.pickAns = -1;
    SP.pickOpt = '';
    SP.phText = '';
    var w = $('spWait');
    if (w) w.hidden = true;
    render();
    if (!cur()) return;
    if (SP.stage === 'card') { setTurn(true); return; }   /* 2단계는 스스로 말해 보고, 필요하면 🔊 */
    if (speakNow) speakCard(true);
    else setTurn(false);
  }

  function go(i) {
    var n = SP.cards.length;
    if (!n) return;
    SP.i = clamp(i, 0, n - 1);
    enterCard(true);
    save();
  }
  function advance() {
    var n = SP.cards.length, next = -1;
    for (var i = SP.i + 1; i < n; i++) if (!isDone(i, SP.stage)) { next = i; break; }
    if (next < 0) for (var j = 0; j < SP.i; j++) if (!isDone(j, SP.stage)) { next = j; break; }
    if (next < 0) { render(); return false; }             /* 다 끝났어요 */
    go(next);
    return true;
  }

  function mark(kind) {
    var c = cur();
    if (!c) return;
    if (kind === 'ok') {
      var key = cardKey(SP.i, SP.stage);
      var isNew = !SP.done[key];
      SP.done[key] = 1;
      if (isNew) SP.stars++;
      save();
      var st = $('spStars');
      if (st) { st.textContent = '⭐ ' + SP.stars; st.classList.remove('is-pop'); void st.offsetWidth; st.classList.add('is-pop'); }
      chime('ok');
      if (SP.stage === 'fill') SP.revealed = true;
      render();
      if (opt('autoAdvance', true)) {
        var waitMs = SP.stage === 'fill' ? 1300 : clamp(Number(opt('autoAdvanceMs', 450)) || 0, 120, 3000);
        SP.timer = setTimeout(function () {
          SP.timer = null;
          if (!SP.open) return;
          if (!advance()) render();
        }, waitMs);
      }
    } else if (kind === 'again') {
      SP.heard = '';
      ASR.state = ASR.state === 'off' ? 'off' : 'idle';
      if (SP.stage === 'fill') SP.revealed = false;
      if (isQA(c)) {
        var said = SP.stage === 'fill'
          ? (SP.pickOpt ? fillSentence(c, SP.pickOpt) : '')
          : ((SP.pickAns >= 0 && c.answers[SP.pickAns]) || '');
        render(); setTurn(true);
        if (said) saySequence([[c.q, 'en'], [said, 'en']]);
        else speakCard(false);
      } else if (SP.stage === 'card') { render(); setTurn(true); speakCard(false); }
      else { render(); speakCard(true); }
    } else if (kind === 'skip') {
      advance();
    }
  }

  function setStage(id) {
    var found = false;
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) found = true;
    if (!found) return false;
    if (SP.set === 'phonics') return false;        /* 🔤 단어 카드는 단계가 없어요 */
    SP.stage = id;
    SP.pickAns = -1;
    SP.pickOpt = '';
    SP.phText = '';
    SP.i = firstUndone(id);
    save();
    enterCard(true);
    return true;
  }

  /* 3단계 → 앱의 Fill the Sentence 로 넘기기 */
  function handoffToFill() {
    close();
    var panel = $('panelSight');
    if (panel && panel.hidden) { var tab = $('tabSight'); if (tab) { try { tab.click(); } catch (e) { /* 무시 */ } } }
    var mode = $('modeFill');
    if (mode) { try { mode.click(); } catch (e) { /* 무시 */ } }
    return !!mode;
  }

  /* ---------- 마이크 ---------- */
  function doListen() {
    var c = cur();
    if (!c) return;
    if (ASR.state === 'listening') { asrStop(); render(); return; }
    ASR.state = ASR.state === 'off' ? 'off' : 'idle';
    ASR.lastError = '';
    SP.heard = '';
    render();
    asrListen(function (res) {
      if (!SP.open) return;
      if (res && res.reason && /not-allowed|service-not-allowed|audio-capture|network|start-failed|unsupported/i.test(res.reason)) {
        ASR.state = 'off';
        ASR.lastError = res.reason;
        render();
        return;
      }
      var text = (res && res.text) || '';
      SP.heard = text;
      var m = matchCard(text, cur());
      SP.match = m;
      render();
      if (m.pass) {
        SP.timer = setTimeout(function () {
          SP.timer = null;
          if (!SP.open) return;
          mark('ok');
        }, 300);
      } else if (text) {
        /* 틀렸다고 하지 않아요 — "다시 해볼까?"만 */
        var line = pickOne((data().retry || {})[koMode() ? 'ko' : 'en']) ||
          T('다시 해볼까?', 'Let us try again?');
        var note = $('spAsrNote');
        if (note) {
          note.hidden = false;
          note.innerHTML = T('<b>' + line + '</b> 엄마가 ✓ 를 눌러도 돼요.', '<b>' + line + '</b> Mom can tap ✓ too.');
        }
        chime('listen');
      }
    });
    render();
  }

  function cheer() {
    var line = pickOne((data().praise || {})[koMode() ? 'ko' : 'en']) || T('잘했어!', 'Great job!');
    var note = $('spAsrNote');
    if (note) { note.hidden = false; note.textContent = '💛 ' + line; }
    say(line, koMode() ? 'ko' : 'en');
    chime('ok');
  }

  /* ============================================================
     열기 / 닫기
  ============================================================ */
  function open(setId) {
    buildModal();
    if (!SP.cards.length) loadSet();
    if (setId && SET_IDS.indexOf(setId) >= 0) setSet(setId);
    SP.lastFocus = document.activeElement;
    SP.open = true;
    modal.hidden = false;
    if (document.documentElement) document.documentElement.classList.add('modal-open');
    SP.i = firstUndone(SP.stage);
    paintStatic();
    paintAsrNote();
    render();
    enterCard(true);
    var ok = $('spOk');
    if (ok && ok.focus) { try { ok.focus({ preventScroll: true }); } catch (e) { /* 무시 */ } }
    return true;
  }
  function close() {
    if (!modal || modal.hidden) { SP.open = false; return false; }
    clearTimers();
    stopVoice();
    asrStop();
    recStop(true);
    recClear();
    modal.hidden = true;
    SP.open = false;
    SP.pauseDone = false;
    var others = document.querySelectorAll('.modal:not([hidden])');
    if (!others.length && document.documentElement) document.documentElement.classList.remove('modal-open');
    if (SP.lastFocus && SP.lastFocus.focus) { try { SP.lastFocus.focus({ preventScroll: true }); } catch (e) { /* 무시 */ } }
    return true;
  }

  /* ============================================================
     이벤트
  ============================================================ */
  /* ❄️ 대답 보기 / 빈칸 보기 눌렀을 때 — 완성된 문장을 읽어 줘요 */
  function pickChoice(idx, text) {
    var c = cur();
    if (!isQA(c)) return false;
    clearTimers();
    if (SP.stage === 'fill') {
      SP.pickOpt = String(text || '');
      SP.pickAns = -1;
      SP.phText = '';
      SP.revealed = false;
      render();
      setTurn(true);
      if (SP.pickOpt) saySequence([[c.q, 'en'], [fillSentence(c, SP.pickOpt), 'en']]);
      chime('ok');
      return true;
    }
    SP.pickAns = (idx >= 0 && c.answers[idx]) ? idx : -1;
    SP.pickOpt = '';
    SP.phText = '';
    render();
    setTurn(true);
    var ans = SP.pickAns >= 0 ? c.answers[SP.pickAns] : String(text || '');
    if (ans) saySequence([[c.q, 'en'], [ans, 'en']]);
    chime('ok');
    return true;
  }

  function bindModal() {
    modal.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t) return;
      var closer = t.closest ? t.closest('[data-sp-close]') : null;
      if (closer) { close(); return; }
      var setBtn = t.closest ? t.closest('[data-sp-set]') : null;
      if (setBtn) {
        var sid = setBtn.getAttribute('data-sp-set');
        if (sid) { setSet(sid); }
        return;
      }
      var step = t.closest ? t.closest('.sp-step') : null;
      if (step) { setStage(step.getAttribute('data-stage')); return; }
      var phBtn = t.closest ? t.closest('[data-sp-phonics]') : null;
      if (phBtn) { phonicsOfPhrase(phBtn.getAttribute('data-sp-phonics')); return; }
      var ansBtn = t.closest ? t.closest('[data-sp-answer]') : null;
      if (ansBtn) {
        pickChoice(parseInt(ansBtn.getAttribute('data-sp-answer'), 10), ansBtn.getAttribute('data-sp-text'));
        return;
      }
      var id = t.closest ? (t.closest('button') || {}).id : '';
      if (!id) return;
      switch (id) {
        case 'spPlay': speakCard(SP.stage !== 'card'); break;
        case 'spQPlay':
          var cq = cur();
          if (isQA(cq)) { clearTimers(); setTurn(true); say(cq.q, 'en'); }
          break;
        case 'spMic': doListen(); break;
        case 'spOk': mark('ok'); break;
        case 'spAgain': mark('again'); break;
        case 'spSkip': mark('skip'); break;
        case 'spPrev': go(SP.i - 1); break;
        case 'spNextStage':
          if (isWord(cur()) || SP.set === 'phonics') { if (!advance()) render(); }
          else if (SP.stage === 'echo') setStage('card');
          else if (SP.stage === 'card') setStage('fill');
          else if (isQA(cur())) setSet('phonics');
          else handoffToFill();
          break;
        case 'spCheer': cheer(); break;
        case 'spRecBtn': recStart(function () { renderRec(); }); break;
        case 'spRecPlay': recPlay(); break;
        case 'spRecDel': recClear(); renderRec(); break;
        default: break;
      }
    });
    modal.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); close(); }
    });
  }

  function bindGlobal() {
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      if (t.closest('#spOpenBtn')) { ev.preventDefault(); open(); return; }
      /* 히어로 카드 아래 [❄️ 12월 겨울 Q&A] · [🔤 겨울 단어] 바로 열기 */
      var quick = t.closest('#spQuick [data-sp-set]');
      if (quick && !SP.open) { ev.preventDefault(); open(quick.getAttribute('data-sp-set')); }
    }, true);

    document.addEventListener('keydown', function (ev) {
      if (!SP.open || ev.key !== 'Escape') return;
      /* 앱의 다른 모달과 겹치지 않게 우리 것만 닫아요 */
      close();
    });

    /* 언어를 바꾸면 문구도 같이 바뀌게 */
    try {
      var mo = new MutationObserver(function () {
        if (!SP.open && !$('spOpenBtn')) return;
        paintEntry();
        paintStatic();
        if (SP.open) render();
      });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    } catch (e) { /* 무시 */ }

    /* 화면이 다시 그려져도 버튼이 사라지지 않게 (아주 가벼운 점검) */
    setInterval(function () {
      if (!document.body) return;
      if (!$('spOpenBtn')) { MOUNT_TRIES++; if (MOUNT_TRIES % 15 === 0) paintEntry(); buildEntry(); }
    }, 4000);
  }

  /* ============================================================
     시작
  ============================================================ */
  function start() {
    try {
      buildEntry();
      buildModal();
      bindGlobal();
      if (!SP.cards.length) loadSet();
      render();
    } catch (e) {
      /* 모듈이 앱을 망가뜨리지 않도록 조용히 물러나요 */
      try { if (window.console && console.warn) console.warn('[speaking] 시작 실패', e); } catch (e2) { /* 무시 */ }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  /* 테스트·점검용 (화면에는 영향 없음) */
  window.SEOHAN_SPEAKING = {
    version: VERSION,
    build: BUILD,
    open: open,
    close: close,
    isOpen: function () { return !!SP.open; },
    stage: function () { return SP.stage; },
    setStage: setStage,
    stages: function () { return STAGES.map(function (s) { return s.id; }); },
    set: function () { return SP.set; },
    setSet: setSet,
    sets: function () { return SET_IDS.slice(); },
    winterItems: winterItems,
    winterCards: winterCards,
    phonicsCards: phonicsCards,
    phonicsWords: phonicsWords,
    chunks: chunksOf,
    chunkText: chunkText,
    fillSentence: fillSentence,
    qaSentence: qaSentence,
    qaChoices: qaChoices,
    pick: pickChoice,
    phonicsPhrase: phonicsOfPhrase,
    cards: function () { return SP.cards.slice(); },
    index: function () { return SP.i; },
    go: go,
    next: advance,
    card: function () { return cur(); },
    mark: mark,
    stars: function () { return SP.stars; },
    done: function () { return JSON.parse(JSON.stringify(SP.done)); },
    doneCount: function () { return doneCount(SP.stage); },
    match: function (text) { return matchCard(text, cur()); },
    matchCard: matchCard,
    keywordsOf: keywordsOf,
    blank: blankSentence,
    mask: maskSentence,
    contentWords: contentWords,
    asrSupported: asrSupported,
    asrState: function () { return ASR.state; },
    asrError: function () { return ASR.lastError; },
    heard: function () { return SP.heard || ''; },
    recSupported: recSupported,
    handoff: handoffToFill,
    newSet: newSet,
    loadSet: loadSet,
    buildSet: buildSet,
    wordPool: wordPool,
    pauseDone: function () { return !!SP.pauseDone; },
    storage: storeRead
  };
})();
