#!/usr/bin/env bash
# ============================================================
# 🗣️ 따라 말하기 카드 — 전체 테스트 (단위 + DOM)
#   · node 18+ · jsdom 필요 (npm i jsdom@22  또는 NODE_PATH 로 지정)
#   · 대상 = 이 저장소의 index.html 그대로 (SEOhan_REPO 로 다른 사본 지정 가능)
#   실행: bash test/run-tests.sh
# ============================================================
set -e
cd "$(dirname "$0")/.."

NODE_BIN="${NODE_BIN:-node}"

if ! "$NODE_BIN" -e "require('jsdom')" >/dev/null 2>&1; then
  echo "· jsdom 이 없어요 → npm i jsdom@22  (또는 NODE_PATH=/path/to/node_modules)"
  exit 2
fi

echo "저장소: ${SEOHAN_REPO:-$(pwd)}"
"$NODE_BIN" test/unit-test.mjs
"$NODE_BIN" test/dom-test.mjs

echo ""
echo "모든 테스트 통과 ✅"
