/* ============================================================
   🗣️ 서한이 루틴 · 따라 말하기 카드 — 설정 파일 (speaking.data.js)
   ------------------------------------------------------------
   · 여기 값만 고치면 화면 문구 말고 동작이 바뀌어요.
   · 문장·그림은 seohan-routine 의 window.SIGHT_DATA(ex) 를 그대로 씁니다.
     (그래서 새 단어를 앱 설정에서 추가하면 카드에도 자동으로 나와요)
   · keywords: 교재 보조 단어(ex[1]) 말고도 받아 줄 단어를 더할 때 씁니다.
       예) 'even': ['even']  → 아이가 'even'이라고만 해도 통과
   · winter: EOS Speaking List 12월 (All about Winter!) 10문항 그대로
   · phonics: 겨울 보기 단어의 첫소리·분절 힌트 (chunks = 소리 묶음)
   ============================================================ */
window.SPEAKING_DATA = {
  version: '0.2.0',

  options: {
    setSize: 5,          /* 한 세트 장수 (3~5) */
    echoPauseMs: 2000,   /* 1단계: 문장을 다 들려준 뒤 쉬는 시간 (2초) */
    rate: 0.9,           /* 영어 문장 속도 — 앱 본체와 같은 0.9 */
    autoAdvance: true,   /* ✓ 를 누르면 다음 카드로 자동 이동 */
    autoAdvanceMs: 650,
    stage2Hint: true,    /* 2단계에서 핵심 단어 힌트를 보여 줄지 */
    asrTimeoutMs: 8000,  /* 🎙️ 말해보기 한 번에 기다리는 시간 */
    phonicsRate: 0.55,   /* 🔤 파닉스: 글자·단어를 아주 천천히 */
    phonicsPauseMs: 240  /* 🔤 파닉스: 글자 사이 쉼 */
  },

  /* 교재 보조 단어 말고도 통과로 봐 줄 단어 (없으면 비워 두세요) */
  keywords: {
    even: ['even'],
    sounds: ['sound', 'sounds'],
    goes: ['go', 'goes'],
    another: ['another'],
    into: ['into', 'in'],
    year: ['year'],
    right: ['right']
  },

  /* 세 가지 연습 세트 (모달 위쪽 칩) */
  sets: {
    sight:   { emoji: '📚', ko: '사이트워드',      en: 'Sight Words' },
    winter:  { emoji: '❄️', ko: '12월 겨울 Q&A',   en: 'Dec Winter Q&A' },
    phonics: { emoji: '🔤', ko: '겨울 단어 파닉스', en: 'Winter Words' }
  },

  /* ============================================================
     ❄️ EOS Speaking List · December · All about Winter!
     ------------------------------------------------------------
     · q       질문 (교재 그대로)
     · answers 보기 답 (교재 그대로 — Yes/No 는 두세 가지)
     · fill    3단계 빈칸 카드: tmpl(빈칸 문장) · answer(정답) · options(보기)
     · 9번은 교재 오타 open gits → open gifts 로 바로잡았어요.
     ============================================================ */
  winter: {
    title: 'EOS Speaking List · December · All about Winter!',
    items: [
      {
        n: 1, pic: '🥶', kind: 'yn',
        q: 'Is it cold today?',
        answers: ['Yes, it is very cold.', 'Yes, it is a little cold.', 'No, it is not cold.'],
        fill: { tmpl: 'Yes, it is very ______.', answer: 'cold', options: ['cold', 'hot'] }
      },
      {
        n: 2, pic: '🧣', kind: 'yn',
        q: 'Do you like cold weather?',
        answers: ['Yes, I like cold weather.', "No, I don't like cold weather."],
        fill: { tmpl: 'Yes, I like cold ______.', answer: 'weather', options: ['weather', 'water'] }
      },
      {
        n: 3, pic: '⛄', kind: 'yn',
        q: 'Do you like winter?',
        answers: ['Yes, I like winter.', 'No, I do not like winter.'],
        fill: { tmpl: 'Yes, I like ______.', answer: 'winter', options: ['winter', 'summer'] }
      },
      {
        n: 4, pic: '🎄', kind: 'blank',
        q: 'What can you see in winter?',
        answers: ['I can see Christmas trees.', 'I can see snow.', 'I can see Santa Claus.'],
        fill: {
          tmpl: 'I can see ______.',
          answer: 'snow',
          options: ['Christmas trees', 'snow', 'Santa Claus']
        }
      },
      {
        n: 5, pic: '⛄', kind: 'blank',
        q: 'What do you like to do in winter?',
        answers: ['I like to have snowball fights in winter.', 'I like to build snowmen in winter.', 'I like to ice skate in winter.'],
        fill: {
          tmpl: 'I like to ______ in winter.',
          answer: 'build snowmen',
          options: ['have snowball fights', 'build snowmen', 'ice skate']
        }
      },
      {
        n: 6, pic: '🍊', kind: 'blank',
        q: 'What do you like to eat in winter?',
        answers: ['I like to eat oranges in winter.', 'I like to eat soup in winter.', 'I like to eat cookies in winter.'],
        fill: {
          tmpl: 'I like to eat ______ in winter.',
          answer: 'oranges',
          options: ['oranges', 'soup', 'cookies']
        }
      },
      {
        n: 7, pic: '🧤', kind: 'blank',
        q: 'What do you wear in winter?',
        answers: ['I wear jackets in winter.', 'I wear mittens in winter.', 'I wear boots in winter.'],
        fill: {
          tmpl: 'I wear ______ in winter.',
          answer: 'mittens',
          options: ['jackets', 'mittens', 'boots']
        }
      },
      {
        n: 8, pic: '🎅', kind: 'yn',
        q: 'Do you like Christmas?',
        answers: ['Yes, I like Christmas.', 'No, I do not like Christmas.'],
        fill: { tmpl: 'Yes, I like ______.', answer: 'Christmas', options: ['Christmas', 'Halloween'] }
      },
      {
        n: 9, pic: '🎁', kind: 'blank',
        q: 'What do you do on Christmas?',
        answers: ['On Christmas I open gifts.', 'On Christmas I eat cake.', 'On Christmas I sleep.'],
        fill: {
          tmpl: 'On Christmas I ______.',
          answer: 'open gifts',
          options: ['open gifts', 'eat cake', 'sleep']
        }
      },
      {
        n: 10, pic: '🤖', kind: 'blank',
        q: 'What did you get for Christmas?',
        answers: ['I got a doll for Christmas!', 'I got a toy for Christmas!', 'I got a robot for Christmas!', 'I got a gift for Christmas!'],
        fill: {
          tmpl: 'I got ______ for Christmas!',
          answer: 'robot',
          options: ['doll', 'toy', 'robot', 'gift']
        }
      }
    ]
  },

  /* ============================================================
     🔤 겨울 단어 파닉스 — 소리 묶음(chunks) 과 그림
     ------------------------------------------------------------
     · chunks 를 ' · ' 로 이어 화면에 보여 주고, 한 묶음씩 천천히 읽어요.
     · 4~10번 보기 단어 + 핵심 겨울 단어 15개가 모두 들어 있어요.
     ============================================================ */
  phonics: {
    snow:      { pic: '❄️', chunks: ['s', 'n', 'ow'] },
    christmas: { pic: '🎄', chunks: ['ch', 'r', 'i', 's', 't', 'm', 'a', 's'] },
    trees:     { pic: '🌲', chunks: ['t', 'r', 'ee', 's'] },
    santa:     { pic: '🎅', chunks: ['s', 'a', 'n', 't', 'a'] },
    claus:     { pic: '🎅', chunks: ['c', 'l', 'au', 's'] },
    have:      { pic: '✋', chunks: ['h', 'a', 've'] },
    snowball:  { pic: '⛄', chunks: ['s', 'n', 'ow', 'b', 'a', 'll'] },
    fights:    { pic: '❄️', chunks: ['f', 'i', 'gh', 't', 's'] },
    build:     { pic: '🧱', chunks: ['b', 'ui', 'l', 'd'] },
    snowmen:   { pic: '⛄', chunks: ['s', 'n', 'ow', 'm', 'e', 'n'] },
    ice:       { pic: '🧊', chunks: ['i', 'ce'] },
    skate:     { pic: '⛸️', chunks: ['s', 'k', 'a', 'te'] },
    oranges:   { pic: '🍊', chunks: ['o', 'r', 'a', 'n', 'g', 'e', 's'] },
    soup:      { pic: '🍲', chunks: ['s', 'ou', 'p'] },
    cookies:   { pic: '🍪', chunks: ['c', 'oo', 'k', 'ie', 's'] },
    jackets:   { pic: '🧥', chunks: ['j', 'a', 'ck', 'e', 'ts'] },
    mittens:   { pic: '🧤', chunks: ['m', 'i', 'tt', 'e', 'n', 's'] },
    boots:     { pic: '🥾', chunks: ['b', 'oo', 'ts'] },
    open:      { pic: '🎁', chunks: ['o', 'p', 'e', 'n'] },
    gifts:     { pic: '🎁', chunks: ['g', 'i', 'f', 'ts'] },
    eat:       { pic: '🍽️', chunks: ['ea', 't'] },
    cake:      { pic: '🍰', chunks: ['c', 'a', 'ke'] },
    sleep:     { pic: '😴', chunks: ['s', 'l', 'ee', 'p'] },
    doll:      { pic: '🪆', chunks: ['d', 'o', 'll'] },
    toy:       { pic: '🧸', chunks: ['t', 'oy'] },
    robot:     { pic: '🤖', chunks: ['r', 'o', 'b', 'o', 't'] },
    gift:      { pic: '🎁', chunks: ['g', 'i', 'f', 't'] },
    cold:      { pic: '🥶', chunks: ['c', 'o', 'l', 'd'] },
    hot:       { pic: '🥵', chunks: ['h', 'o', 't'] },
    weather:   { pic: '🌤️', chunks: ['w', 'ea', 'th', 'e', 'r'] },
    water:     { pic: '💧', chunks: ['w', 'a', 't', 'e', 'r'] },
    winter:    { pic: '⛄', chunks: ['w', 'i', 'n', 't', 'e', 'r'] },
    summer:    { pic: '☀️', chunks: ['s', 'u', 'mm', 'e', 'r'] },
    halloween: { pic: '🎃', chunks: ['h', 'a', 'll', 'o', 'w', 'ee', 'n'] }
  },

  /* 💛 응원 한마디 (한국어는 기기 음성으로 읽어요 — mp3 필요 없음) */
  praise: {
    ko: [
      '잘했어!',
      '멋져, 서한이!',
      '정말 좋았어!',
      '목소리가 씩씩해!',
      '한 번 더 해 볼까?',
      '엄마가 들었어!'
    ],
    en: [
      'Great job!',
      'Nice work!',
      'I heard you!',
      'So brave!'
    ]
  },

  /* 🔁 다시 해 볼 때 (틀렸다고 하지 않아요) */
  retry: {
    ko: ['다시 해 볼까?', '한 번 더 천천히!', '괜찮아, 또 해 보자!'],
    en: ['Let us try again?', 'Once more, slowly?']
  }
};
