/* ============================================================
   🗣️ 서한이 루틴 · 따라 말하기 카드 — 설정 파일 (speaking.data.js)
   ------------------------------------------------------------
   · 여기 값만 고치면 화면 문구 말고 동작이 바뀌어요.
   · 문장·그림은 seohan-routine 의 window.SIGHT_DATA(ex) 를 그대로 씁니다.
     (그래서 새 단어를 앱 설정에서 추가하면 카드에도 자동으로 나와요)
   · keywords: 교재 보조 단어(ex[1]) 말고도 받아 줄 단어를 더할 때 씁니다.
       예) 'even': ['even']  → 아이가 'even'이라고만 해도 통과
   ============================================================ */
window.SPEAKING_DATA = {
  version: '0.1.0',

  options: {
    setSize: 5,          /* 한 세트 장수 (3~5) */
    echoPauseMs: 2000,   /* 1단계: 문장을 다 들려준 뒤 쉬는 시간 (2초) */
    rate: 0.9,           /* 영어 문장 속도 — 앱 본체와 같은 0.9 */
    autoAdvance: true,   /* ✓ 를 누르면 다음 카드로 자동 이동 */
    autoAdvanceMs: 450,
    stage2Hint: true,    /* 2단계에서 핵심 단어 힌트를 보여 줄지 */
    asrTimeoutMs: 8000   /* 🎙️ 말해보기 한 번에 기다리는 시간 */
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
