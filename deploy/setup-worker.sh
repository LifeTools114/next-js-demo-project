#!/usr/bin/env bash
# 「대신 읽기」를 서버에서 돌리기 — root 로 한 번:  bash /srv/kb/deploy/setup-worker.sh
#
# 무엇을 하나: 서버에 크롬(Playwright Chromium)과 가상 화면(xvfb)을 깔고, 확장(/srv/kb/extension)을 붙인 크롬을
# systemd 서비스(kb-worker)로 늘 켜 둡니다. 크롬은 시작하자마자 확장의 「대신 읽기」 창을 열어 서버 주소·운영자 토큰을
# 받고(주소 파라미터) 3초마다 작업을 가져갑니다 → 폰 고객의 링크가 사장님 PC 없이도 이름·옵션·가격으로 채워집니다.
#
# ⚠️ 쿠팡이 이 서버 IP 의 크롬까지 막으면(봇 차단) 작업은 「차단됨 (Access Denied)」로 남고, PC 크롬이 살아 있으면 서버가
#    같은 작업을 PC 크롬에 자동으로 넘깁니다. 계속 막히면 .env.local 에 KB_WORKER_PROXY=(한국 주거용 프록시) 를 적고
#    systemctl restart kb-worker (deploy/run-worker.sh 참고). 끄기: systemctl disable --now kb-worker. 다시 실행해도 안전합니다(멱등).
set -euo pipefail
APP_DIR=/srv/kb
EXT_DIR=$APP_DIR/extension
BROWSERS=$APP_DIR/.browsers
PROFILE=$APP_DIR/.chrome-worker
ENV_FILE=$APP_DIR/.env.local
UNIT=/etc/systemd/system/kb-worker.service

[ "$(id -u)" = 0 ] || { echo "root 로 실행하세요: sudo bash $0"; exit 1; }
[ -f "$ENV_FILE" ] || { echo "$ENV_FILE 이 없습니다 — 먼저 setup-server.sh 를 실행하세요"; exit 1; }
grep -q '^ADMIN_TOKEN=.\+' "$ENV_FILE" || { echo "$ENV_FILE 에 ADMIN_TOKEN 이 없습니다"; exit 1; }
BASE_URL=$(grep '^BASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' )
[ -n "$BASE_URL" ] || { echo "$ENV_FILE 에 BASE_URL 이 없습니다"; exit 1; }

echo "1) 가상 화면(xvfb) 설치"
DEBIAN_FRONTEND=noninteractive apt-get install -y -q xvfb >/dev/null

echo "2) 크롬(Playwright Chromium) 설치 → $BROWSERS  (몇 분 걸립니다)"
mkdir -p "$BROWSERS"
PLAYWRIGHT_BROWSERS_PATH="$BROWSERS" npx -y playwright@1 install --with-deps chromium 2>&1 | tail -n 3
CHROME=$(ls -d "$BROWSERS"/chromium-*/chrome-linux*/chrome 2>/dev/null | sort | tail -n 1)
[ -x "$CHROME" ] || { echo "크롬 실행 파일을 찾지 못했습니다: $BROWSERS"; exit 1; }
chown -R kb:kb "$BROWSERS"
mkdir -p "$PROFILE" && chown -R kb:kb "$PROFILE"

echo "3) systemd 서비스 kb-worker 작성 (크롬 실행은 deploy/run-worker.sh — 프록시·그림 설정은 그 파일의 머리말)"
cat > "$UNIT" <<UNIT
[Unit]
Description=베트남 직구 — 대신 읽기 (서버 크롬 + 확장)
After=network-online.target kb.service
Wants=network-online.target

[Service]
User=kb
Environment=HOME=$APP_DIR
Environment=KB_CHROME=$CHROME
Environment=APP_DIR=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/bin/bash $APP_DIR/deploy/run-worker.sh
Restart=always
RestartSec=10
KillMode=mixed
TimeoutStopSec=20

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now kb-worker >/dev/null
sleep 8
echo
if systemctl is-active --quiet kb-worker; then
  echo "✅ kb-worker 가 돌고 있습니다."
else
  echo "❌ kb-worker 가 멈췄습니다:"; journalctl -u kb-worker -n 30 --no-pager; exit 1
fi
echo "   확인: $BASE_URL/admin 맨 위 「🔄 대신 읽기」가 30초 안에 「살아 있음」이 되면 성공."
echo "   시험: 폰에서 쿠팡 상품 링크를 붙여넣어 이름·옵션·가격이 채워지는지. 실패 사유는 같은 패널에 남습니다."
echo "   끄기: systemctl disable --now kb-worker   · 기록: journalctl -u kb-worker -n 50 --no-pager"
