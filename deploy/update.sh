#!/usr/bin/env bash
# 코드 새 버전 올리기 — root 로:  bash /srv/kb/deploy/update.sh
set -euo pipefail
APP_DIR=/srv/kb
sudo -iu kb bash -c "cd $APP_DIR && git pull --ff-only && npm ci --no-audit --no-fund && npm run build" 2>&1 | tail -n 15
systemctl restart kb
sleep 3
curl -fsS http://127.0.0.1:3000/api/extension/config >/dev/null && echo "✅ 새 버전이 떴습니다 ($(sudo -iu kb git -C $APP_DIR log --oneline -1))" \
  || { echo "앱이 응답하지 않습니다:"; journalctl -u kb -n 60 --no-pager; exit 1; }
