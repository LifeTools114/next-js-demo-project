#!/usr/bin/env bash
# 코드 새 버전 올리기 — root 로:  bash /srv/kb/deploy/update.sh
set -euo pipefail
APP_DIR=/srv/kb
# 캡처 글자 읽기(OCR)용 tesseract — 없으면 한 번만 설치 (폰 캡처 공유, 26-09-07)
if ! command -v tesseract >/dev/null 2>&1 || ! tesseract --list-langs 2>/dev/null | grep -q '^kor$'; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y -q tesseract-ocr tesseract-ocr-kor >/dev/null && echo "tesseract 설치됨"
fi
sudo -iu kb bash -c "cd $APP_DIR && git pull --ff-only && npm ci --no-audit --no-fund && npm run build" 2>&1 | tail -n 15
systemctl restart kb
sleep 3
curl -fsS http://127.0.0.1:3000/api/extension/config >/dev/null && echo "✅ 새 버전이 떴습니다 ($(sudo -iu kb git -C $APP_DIR log --oneline -1))" \
  || { echo "앱이 응답하지 않습니다:"; journalctl -u kb -n 60 --no-pager; exit 1; }
