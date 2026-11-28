// ============================================================
// 🗣️ 따라 말하기 카드 — 테스트 공용 도우미
//   · 저장소의 진짜 index.html (또는 지정한 SEOHAN_REPO) 을 그대로 씁니다.
//   · jsdom 이 <link>/<script src> 를 받아오지 않으므로 인라인으로 바꿔 넣어요.
//   · jsdom 필요: NODE_PATH=/path/to/node_modules (예: npm i jsdom@22)
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export function jsdomModule() {
  try {
    return require('jsdom');
  } catch (e) {
    throw new Error('jsdom 이 필요해요 → NODE_PATH=/path/to/node_modules  (예: npm i jsdom@22). ' + e.message);
  }
}
export function loadJsdom() { return jsdomModule().JSDOM; }

export const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_DIR = path.dirname(TEST_DIR);
export const SPEAKING_DIR = path.join(REPO_DIR, 'speaking');

export function repoDir() {
  return process.env.SEOHAN_REPO ? path.resolve(process.env.SEOHAN_REPO) : REPO_DIR;
}

export function readPatchFile(name) {
  return fs.readFileSync(path.join(SPEAKING_DIR, name), 'utf8');
}

const INCLUDE_LINES = [
  '<link rel="stylesheet" href="./speaking/speaking.css">',
  '<script src="./speaking/speaking.data.js" defer></script>',
  '<script src="./speaking/speaking.js" defer></script>'
];

export function assertIncludes(html) {
  if (html.indexOf(INCLUDE_LINES[0]) < 0 || html.indexOf(INCLUDE_LINES[1]) < 0 || html.indexOf(INCLUDE_LINES[2]) < 0) {
    throw new Error('index.html 에 speaking 3줄(css·data·js)이 없어요');
  }
  return html;
}

// css → data → js 를 인라인으로 (defer 실행 순서와 같게)
export function inlineForJsdom(html) {
  const css = readPatchFile('speaking.css');
  const data = readPatchFile('speaking.data.js');
  const js = readPatchFile('speaking.js');
  let out = html
    .replace(INCLUDE_LINES[0], '<style>\n' + css + '\n</style>')
    .replace(INCLUDE_LINES[1], '<script>\n' + data + '\n</script>')
    .replace(INCLUDE_LINES[2], '<script>\n' + js + '\n</script>');
  if (out.indexOf('window.SEOHAN_SPEAKING') === -1) throw new Error('모듈이 인라인되지 않았어요');
  return out;
}

// 공통 스텁: 음성 · 기기 음성 · 오디오 · 마이크 · 음성인식
export function installStubs(window, opts = {}) {
  window.fetch = () => Promise.reject(new Error('offline test'));
  window.matchMedia = window.matchMedia || (q => ({
    matches: false, media: q, addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; }
  }));

  const state = {
    spoken: [],
    audioTries: [],
    rec: null           // 테스트가 조작하는 FakeSpeechRecognition 인스턴스
  };

  window.AudioContext = window.webkitAudioContext = function () {
    return {
      state: 'running', destination: {}, currentTime: 0, sampleRate: 22050,
      resume() { return Promise.resolve(); },
      createBuffer() { return { getChannelData() { return new Float32Array(1); }, duration: 0 }; },
      createBufferSource() { return { buffer: null, connect() {}, start() {}, stop() {}, onended: null }; },
      createOscillator() {
        return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} };
      },
      createGain() { return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }; }
    };
  };

  // mp3 재생 시도는 항상 실패 → 기기 음성(speechSynthesis)으로 넘어가게
  window.Audio = function (src) {
    state.audioTries.push(src);
    return {
      src: src || '', preload: '',
      addEventListener() {}, removeEventListener() {},
      play() { return Promise.reject(new Error('no audio in test')); },
      pause() {}, load() {}
    };
  };

  const synth = {
    speaking: false, pending: false, paused: false,
    speak(u) {
      state.spoken.push({ text: u.text, lang: u.lang, rate: u.rate, voice: u.voice ? u.voice.name : null });
      synth.speaking = true;
      if (typeof u.onstart === 'function') u.onstart();
      setTimeout(() => {
        synth.speaking = false;
        if (typeof u.onend === 'function') u.onend();
      }, 1);
    },
    cancel() { synth.speaking = false; state.cancelled = (state.cancelled || 0) + 1; },
    pause() {}, resume() {},
    getVoices() {
      return [
        { name: 'Samantha', lang: 'en-US', localService: true },
        { name: 'Daniel', lang: 'en-GB', localService: true },
        { name: 'Yuna', lang: 'ko-KR', localService: true }
      ];
    },
    addEventListener() {}, removeEventListener() {}
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true, writable: true });
  window.SpeechSynthesisUtterance = function (text) {
    this.text = text; this.lang = ''; this.rate = 1; this.pitch = 1; this.volume = 1; this.voice = null;
    this.onstart = null; this.onend = null; this.onerror = null;
  };

  // 마이크 (녹음)
  const tracks = [{ stopped: false, stop() { this.stopped = true; } }];
  window.MediaRecorder = function () {
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
    this.start = () => { this.state = 'recording'; };
    this.stop = () => {
      this.state = 'inactive';
      if (typeof this.ondataavailable === 'function') this.ondataavailable({ data: { size: 10 } });
      if (typeof this.onstop === 'function') this.onstop();
    };
  };
  window.MediaRecorder.isTypeSupported = () => true;
  window.URL.createObjectURL = window.URL.createObjectURL || (() => 'blob:test');
  window.URL.revokeObjectURL = window.URL.revokeObjectURL || (() => {});
  Object.defineProperty(window.navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: () => Promise.resolve({ getTracks: () => tracks }) }
  });

  // 음성 인식 — 테스트가 직접 결과를 먹여요
  function FakeSpeechRecognition() {
    state.rec = this;
    window.__rec = this;
    this.aborted = false;
  }
  FakeSpeechRecognition.prototype.start = function () { this.started = true; };
  FakeSpeechRecognition.prototype.stop = function () { if (this.onend) this.onend(); };
  FakeSpeechRecognition.prototype.abort = function () { this.aborted = true; if (this.onend) this.onend(); };
  FakeSpeechRecognition.prototype.say = function (text) {
    const alt = [{ transcript: text }];
    alt.length = 1;
    if (this.onresult) this.onresult({ results: [[...alt]] });
    if (this.onend) this.onend();
  };
  FakeSpeechRecognition.prototype.fail = function (err) {
    if (this.onerror) this.onerror({ error: err });
    if (this.onend) this.onend();
  };
  if (opts.speechRecognition !== false) window.webkitSpeechRecognition = FakeSpeechRecognition;

  // 테스트가 꺼내 쓰는 기록
  window.__spokenLog = state.spoken;
  window.__audioTries = state.audioTries;
  window.__stubs = state;
  return state;
}

export function makeRunner(title) {
  const results = [];
  let failures = 0;
  return {
    ok(name, cond, detail) {
      results.push({ name, pass: !!cond, detail });
      if (!cond) failures++;
      return !!cond;
    },
    eq(name, actual, expected) {
      const pass = JSON.stringify(actual) === JSON.stringify(expected);
      return this.ok(name, pass, pass ? '' : `기대=${JSON.stringify(expected)} 실제=${JSON.stringify(actual)}`);
    },
    async step(name, fn) {
      try { await fn(); } catch (e) {
        results.push({ name, pass: false, detail: '예외: ' + (e && e.stack ? e.stack.split('\n')[0] : e) });
        failures++;
      }
    },
    report() {
      console.log('\n=== ' + title + ' ===');
      for (const r of results) {
        console.log((r.pass ? '  ✅ ' : '  ❌ ') + r.name + (r.pass || !r.detail ? '' : '\n       ' + r.detail));
      }
      const total = results.length;
      console.log(`\n  ${total - failures}/${total} 통과` + (failures ? ` · 실패 ${failures}` : ''));
      return failures === 0;
    }
  };
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
