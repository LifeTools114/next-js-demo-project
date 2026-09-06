#!/usr/bin/env bash
# 코드 새 버전 올리기 — root 로:  bash /srv/kb/deploy/update.sh
set -euo pipefail
APP_DIR=/srv/kb

# 1) 먼저 코드를 받고, 새로 받은 이 스크립트로 이어서 돕니다 — 실행 중인 옛 스크립트에 없는 단계(설치 등)를 빠뜨리지 않게
if [ "${1:-}" != "--pulled" ]; then
  sudo -iu kb bash -c "cd $APP_DIR && git pull --ff-only" 2>&1 | tail -n 3
  exec bash "$APP_DIR/deploy/update.sh" --pulled
fi

# 2) 캡처 글자 읽기(OCR)용 tesseract — 없으면 한 번만 설치 (폰 캡처 공유, 26-09-07)
if ! command -v tesseract >/dev/null 2>&1 || ! tesseract --list-langs 2>/dev/null | grep -q '^kor$'; then
  echo "tesseract(한국어) 설치 중…"
  DEBIAN_FRONTEND=noninteractive apt-get install -y -q tesseract-ocr tesseract-ocr-kor >/dev/null
fi

# 3) 설치·빌드·재시작
sudo -iu kb bash -c "cd $APP_DIR && npm ci --no-audit --no-fund && npm run build" 2>&1 | tail -n 15
systemctl restart kb
sleep 3
curl -fsS http://127.0.0.1:3000/api/extension/config >/dev/null && echo "✅ 새 버전이 떴습니다 ($(sudo -iu kb git -C $APP_DIR log --oneline -1))" \
  || { echo "앱이 응답하지 않습니다:"; journalctl -u kb -n 60 --no-pager; exit 1; }
echo "   OCR: $(tesseract --version 2>/dev/null | head -n 1) · 언어: $(tesseract --list-langs 2>/dev/null | grep -E '^(kor|eng)$' | tr '\n' ' ')"
