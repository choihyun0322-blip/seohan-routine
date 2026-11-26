/* ============================================================
   🗣️ 서한이 루틴 · 따라 말하기 카드 v0.1 (speaking.js)
   ------------------------------------------------------------
   · 서한이 루틴(index.html)을 고치지 않고 <script> 한 줄로 붙는 독립 모듈이에요.
   · 하는 일 (말하기 3단계 · 한 세트 5장)
       1단계  전체 문장을 듣고 → 2초 쉼 → 그대로 따라 말하기 (Echo)
       2단계  그림 카드를 보고 말하기 → 핵심 단어만 맞으면 통과
              (SpeechRecognition 이 되는 기기에서만 자동 확인,
               안 되면 곧바로 엄마 ✓ / 🔁 로 넘어가요)
       3단계  문장 전체를 듣고 빈칸 한 단어 채우기 (= Fill the Sentence)
   · 판정(O/X)은 하지 않아요. 통과는 언제나 엄마의 ✓ / 🔁 이고,
     자동 확인은 '맞았을 때 칭찬'만 하고 틀렸을 때는 "다시 해볼까?"만 띄워요.
   · 문장·그림은 앱의 window.SIGHT_DATA(ex) 를 그대로 써서 새 단어도 자동 반영.
   · 두 번 넣어도 한 번만 동작해요. (중복 주입 방지)
   ============================================================ */
(function () {
  'use strict';

  var VERSION = '0.1.0';
  var BUILD = '2026-11-27';

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
        u.rate = (lg === 'ko') ? 0.98 : Number(opt('rate', 0.9)) || 0.9;
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
    if (playMp3(t, (lg === 'ko') ? 'ko' : 'mom', tts, finish, onStart)) return true;
    tts();
    return true;
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
  function stageDef(id) {
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) return STAGES[i];
    return STAGES[0];
  }
  function stageIndex(id) {
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) return i;
    return 0;
  }

  var SP = {
    open: false,
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
    heard: '',
    match: null,
    lastFocus: null
  };

  function save() {
    storeWrite({
      date: SP.date, seed: SP.seed,
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
      if (saved.stage && stageIndex(saved.stage) >= 0) SP.stage = saved.stage;
    } else {
      SP.seed = ((Date.now() & 0xffffffff) ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
      SP.done = {};
      SP.stars = 0;
    }
    SP.date = today;
    SP.cards = buildSet(opt('setSize', 5), SP.seed);
    if (!sameDay) save();
    return SP.cards.length;
  }
  function newSet() {
    var seed = ((Date.now() & 0xffffffff) ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    while (seed === SP.seed) seed = (seed + 7919) >>> 0;   /* 같은 세트가 또 나오지 않게 */
    SP.seed = seed;
    SP.date = todayKey();
    SP.done = {};
    SP.cards = buildSet(opt('setSize', 5), seed);
    SP.i = 0;
    save();
    render();
    enterCard(true);
    return SP.cards.length;
  }
  function cardKey(i, stage) {
    var c = SP.cards[i];
    return (stage || SP.stage) + '|' + (c ? c.word : String(i));
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
      '</button>';
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
        '<div class="sp-steps" id="spSteps" role="tablist"></div>' +
        '<div class="modal-body sp-body">' +
          '<p class="sp-guide" id="spGuide"></p>' +
          '<div class="sp-card" id="spCard">' +
            '<p class="sp-pic" id="spPic" aria-hidden="true"></p>' +
            '<p class="sp-sent" id="spSent"></p>' +
            '<p class="sp-hint" id="spHint" hidden></p>' +
            '<p class="sp-word" id="spWord" hidden></p>' +
          '</div>' +
          '<div class="sp-turn" id="spTurn" hidden>' +
            '<span class="sp-turn-ico" aria-hidden="true">🎤</span>' +
            '<span id="spTurnText" aria-live="polite"></span>' +
          '</div>' +
          '<div class="sp-wait" id="spWait" hidden><span class="sp-wait-bar" id="spWaitBar"></span></div>' +
          '<div class="sp-actions">' +
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

  /* ---------- 그리기 ---------- */
  function render() {
    if (!modal) return;
    var c = cur(), st = stageDef(SP.stage), n = SP.cards.length;
    var idx = stageIndex(SP.stage);

    var pill = $('spStagePill');
    if (pill) pill.textContent = (idx + 1) + T('단계', '/3');

    var stars = $('spStars');
    if (stars) stars.textContent = '⭐ ' + SP.stars;

    /* 단계 탭 */
    var steps = $('spSteps') ? $('spSteps').querySelectorAll('.sp-step') : [];
    for (var i = 0; i < steps.length; i++) {
      var on = steps[i].getAttribute('data-stage') === SP.stage;
      steps[i].classList.toggle('is-on', on);
      steps[i].classList.toggle('is-done', doneCount(STAGES[i].id) >= n && n > 0);
      steps[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }

    /* 안내문 */
    var guide = $('spGuide');
    if (guide) {
      if (!c) guide.textContent = T('아직 만들 카드가 없어요. Sight Words에 문장이 있는 단어를 먼저 넣어 주세요.',
        'No cards yet — add sight words with sentences first.');
      else if (SP.stage === 'echo') guide.textContent = T('① 문장을 끝까지 들려줘요. 2초 쉼 뒤에 서한이가 그대로 따라 말해요.',
        '1. Listen to the whole sentence. After a 2-second pause, say it the same way.');
      else if (SP.stage === 'card') guide.textContent = T('② 그림 카드를 보고 말해요. 핵심 단어만 맞으면 통과! 틀려도 "다시 해볼까?" 하고 넘어가요.',
        '2. Look at the picture and say it. Matching the key word is enough — a soft "let us try again?" if not.');
      else guide.textContent = T('③ 문장 전체를 듣고 빈칸에 들어갈 한 단어를 말해요.',
        '3. Listen to the whole sentence, then say the one word for the blank.');
    }

    /* 카드 */
    var pic = $('spPic'), sent = $('spSent'), hint = $('spHint'), word = $('spWord');
    if (pic) pic.textContent = c ? (c.pic || '🖼️') : '🖼️';
    if (sent) {
      sent.innerHTML = '';
      if (!c) sent.textContent = '';
      else if (SP.stage === 'echo') sent.textContent = c.sentence;
      else if (SP.stage === 'fill') sent.textContent = blankSentence(c.sentence, c.word);
      else sent.textContent = maskSentence(c.sentence, c.hint || c.word);
    }
    if (hint) {
      if (c && SP.stage === 'card' && opt('stage2Hint', true)) {
        hint.hidden = false;
        hint.textContent = '🔑 ' + (c.hint || c.word);
      } else { hint.hidden = true; hint.textContent = ''; }
    }
    if (word) {
      if (c && SP.stage === 'fill' && SP.revealed) { word.hidden = false; word.textContent = '✓ ' + c.word; }
      else { word.hidden = true; word.textContent = ''; }
    }

    /* 프롬프트·대기바 */
    var turn = $('spTurn'), turnText = $('spTurnText');
    if (turn && turnText) {
      turn.hidden = !SP.pauseDone || !c;
      turnText.textContent = SP.stage === 'echo' ? T('이제 따라 말해 봐!', 'Now say it with me!')
        : SP.stage === 'card' ? T('그림을 보고 말해 볼까?', 'What does the picture say?')
          : T('빈칸에 들어갈 단어는?', 'Which word goes in the blank?');
    }
    /* 🎙️ 말해보기 — 2·3단계에서만, 기기가 지원할 때만 */
    var mic = $('spMic');
    if (mic) {
      var showMic = !!c && SP.stage !== 'echo' && asrSupported() && ASR.state !== 'off';
      mic.hidden = !showMic;
      mic.classList.toggle('is-listen', ASR.state === 'listening');
      var mt = $('spMicText');
      if (mt) mt.textContent = ASR.state === 'listening' ? T('듣고 있어요…', 'Listening…') : T('말해보기', 'Speak');
    }
    paintAsrNote();

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
      if (SP.stage === 'echo') nt.textContent = T('2단계 · 카드 보고 →', 'Step 2 · Say it →');
      else if (SP.stage === 'card') nt.textContent = T('3단계 · 빈칸 채우기 →', 'Step 3 · Blank →');
      else nt.textContent = T('📖 빈칸 놀이로 →', '📖 Open Fill the Sentence');
    }
    var dn = $('spDone');
    if (dn) {
      if (c && n && doneCount(SP.stage) >= n) {
        dn.hidden = false;
        dn.textContent = SP.stage === 'fill'
          ? T('5장 모두 끝! 이제 앱의 빈칸 놀이로 이어가요 🎉', 'All 5 done! Hand over to Fill the Sentence 🎉')
          : T('5장 모두 끝! 다음 단계로 가 볼까요? 🎉', 'All 5 done! Ready for the next step? 🎉');
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
  /* 지금 카드의 문장 전체를 들려줘요 (1·3단계는 다 들려준 뒤 2초 쉼) */
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
    var started = say(c.sentence, 'en', done, function () {
      heard = true;
      if (SP.startGuard) { clearTimeout(SP.startGuard); SP.startGuard = null; }
    });
    if (!started) { done(); return false; }
    /* 소리가 늦게 시작하는 기기: 시작하면 그때부터 쉼을 세요 */
    SP.startGuard = setTimeout(function () {
      SP.startGuard = null;
      if (heard) return;
      done();                                    /* 소리가 안 났으면 기다리지 않고 "따라 말해 봐" */
    }, 1600);
    /* mp3·음성이 아주 길게 멈춘 경우를 대비한 안전장치 */
    SP.guard = setTimeout(function () { done(); }, 12000);
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
      if (SP.stage === 'card') { render(); setTurn(true); speakCard(false); }
      else { render(); speakCard(true); }
    } else if (kind === 'skip') {
      advance();
    }
  }

  function setStage(id) {
    var found = false;
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) found = true;
    if (!found) return false;
    SP.stage = id;
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
      var m = matchTranscript(text, cur());
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
  function open(stage) {
    buildModal();
    if (!SP.cards.length) loadSet();
    if (stage) SP.stage = stage;
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
  function bindModal() {
    modal.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t) return;
      var closer = t.closest ? t.closest('[data-sp-close]') : null;
      if (closer) { close(); return; }
      var step = t.closest ? t.closest('.sp-step') : null;
      if (step) { setStage(step.getAttribute('data-stage')); return; }
      var id = t.closest ? (t.closest('button') || {}).id : '';
      if (!id) return;
      switch (id) {
        case 'spPlay': speakCard(SP.stage !== 'card'); break;
        case 'spMic': doListen(); break;
        case 'spOk': mark('ok'); break;
        case 'spAgain': mark('again'); break;
        case 'spSkip': mark('skip'); break;
        case 'spPrev': go(SP.i - 1); break;
        case 'spNextStage':
          if (SP.stage === 'echo') setStage('card');
          else if (SP.stage === 'card') setStage('fill');
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
      if (t.closest('#spOpenBtn')) { ev.preventDefault(); open(); }
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
    cards: function () { return SP.cards.slice(); },
    index: function () { return SP.i; },
    go: go,
    next: advance,
    card: function () { return cur(); },
    mark: mark,
    stars: function () { return SP.stars; },
    done: function () { return JSON.parse(JSON.stringify(SP.done)); },
    doneCount: function () { return doneCount(SP.stage); },
    match: function (text) { return matchTranscript(text, cur()); },
    matchCard: matchTranscript,
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
