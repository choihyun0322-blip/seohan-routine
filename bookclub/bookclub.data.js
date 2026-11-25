/* ============================================================
   📖 서한이 루틴 · 북클럽 책 읽기 — 주별 책 데이터
   ------------------------------------------------------------
   ▸ 이 파일 하나만 고치면 다음 주 책으로 바뀝니다. (bookclub.js 는 그대로)
   ▸ 열쇠(key)는 ISO 주차 "YYYY-Www" 이고, 함께 적은 from~to 날짜로도 찾습니다.
   ▸ 오늘이 들어 있는 주차가 없으면 '오늘 이전에서 가장 가까운 주차'를 보여 주고,
     그것도 없으면 가장 빠른 주차를 보여 줍니다. (책 목록이 비지 않아요)
   ▸ 새 주차 추가 예시는 파일 맨 아래 주석을 보세요.
   ============================================================ */
window.BOOKCLUB_WEEKS = {

  /* ---- 화면·동작 설정 (선택) ---- */
  "__options__": {
    /* 숙제 '북클럽 책 읽기'를 모달의 [다 읽었어요] 로 체크할지 (true/false) */
    autoCheckHomework: true,
    /* 값을 넣으면 항상 그 주차를 보여 줍니다. 예: "2026-W48" (비우면 오늘 날짜 기준) */
    pinKey: "",
    /* 모달 제목 */
    title: "📖 Book Club"
  },

  /* ================= 이번 주 (2026-11-23 ~ 11-29) ================= */
  "2026-W48": {
    from: "2026-11-23",
    to: "2026-11-29",
    label: { ko: "11월 4주", en: "Nov · Week 4" },

    books: [
      {
        id: "floppys-bath",
        title: "Floppy's Bath",
        tag: { ko: "목욕", en: "Bath" },
        emoji: "🛁",
        color: "#38bdf8",
        questions: [
          {
            en: "Look! Is Floppy clean or dirty?",
            ko: "이것 봐! Floppy는 깨끗해, 더러워?",
            choices: ["Clean!", "Dirty!"]
          },
          {
            en: "What do we use to wash Floppy?",
            ko: "Floppy를 씻을 때 뭐를 쓸까?",
            answerEn: "Dog shampoo!",
            answerKo: "강아지 샴푸!"
          },
          {
            en: "Do you like taking a bath?",
            ko: "서한이도 목욕 좋아해?",
            choices: ["Yes, I do!", "No, I don't."]
          }
        ]
      },
      {
        id: "at-the-carnival",
        title: "At the Carnival",
        tag: { ko: "범퍼카", en: "Bumper car" },
        emoji: "🎠",
        color: "#f59e0b",
        questions: [
          {
            en: "What color is his car?",
            ko: "그 차는 무슨 색이지?",
            answerEn: "Red!",
            answerKo: "빨간색!"
          },
          {
            en: "Does he look happy or sad?",
            ko: "그는 행복해 보여, 슬퍼 보여?",
            answerEn: "Happy!",
            answerKo: "행복해 보여!"
          },
          {
            en: "Do you want to ride a bumper car?",
            ko: "타보고 싶어?",
            choices: ["Yes, I do!", "So much!"]
          }
        ]
      },
      {
        id: "where-is-teddy",
        title: "Where is Teddy?",
        tag: { ko: "테디 찾기", en: "Find Teddy" },
        emoji: "🧸",
        color: "#a78bfa",
        questions: [
          {
            en: "Where is Teddy hiding?",
            ko: "어디 숨었을까?",
            choices: ["Under the bed!", "In the toy box!"]
          },
          {
            en: "Do you have a favorite teddy bear?",
            ko: "좋아하는 곰인형 있어?",
            choices: ["Yes, I do!", "No, I don't."]
          }
        ]
      }
    ]
  }

  /* ------------------------------------------------------------
     ▸ 다음 주 책을 넣는 방법 ①  이번 주 블록을 복사해서 새 주차로 붙여 넣기

       "2026-W49": {
         from: "2026-11-30",
         to: "2026-12-06",
         label: { ko: "12월 1주", en: "Dec · Week 1" },
         books: [
           { id: "book-1", title: "Book Title", tag: { ko: "주제", en: "Theme" },
             emoji: "📗", color: "#22c55e",
             questions: [
               { en: "Question in English?", ko: "한국어 힌트",
                 answerEn: "Answer!", answerKo: "답" },      // 답을 알려 줄 때
               { en: "Another question?", ko: "힌트",
                 choices: ["Yes, I do!", "No, I don't."] }    // 아이가 골라 말할 때
             ] }
         ]
       },

     ▸ 방법 ②  주차 구분 없이 늘 같은 책을 보여 주려면 위 "2026-W48" 블록의
               books 만 새 책으로 바꾸면 됩니다. (날짜는 그대로 두어도 됩니다.)
     ------------------------------------------------------------ */
};
