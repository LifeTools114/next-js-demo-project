#!/usr/bin/env bash
# ─── 서버 한 번에 세팅 — Ubuntu 24.04, root 로 실행. 다시 실행해도 안전합니다(멱등) ───
#
#   curl -fsSL https://raw.githubusercontent.com/LifeTools114/next-js-demo-project/claude/korean-beauty-direct-purchase-98zv0u/deploy/setup-server.sh -o setup.sh
#   bash setup.sh                       # 기본 도메인 naka.1dollartool.com
#   bash setup.sh 다른.도메인.com        # 다른 도메인이면 인자로
#
# 하는 일: 방화벽·스왑·시간대 → Node 22 → kb 계정 + 코드(/srv/kb) → .env.local(비밀값 자동 생성)
#          → npm ci + build → systemd 서비스 → Caddy HTTPS → 매일 백업 cron
set -euo pipefail

DOMAIN="${1:-naka.1dollartool.com}"
BRANCH="${BRANCH:-claude/korean-beauty-direct-purchase-98zv0u}"
REPO="${REPO:-https://github.com/LifeTools114/next-js-demo-project.git}"
APP_DIR=/srv/kb
ENV_FILE=$APP_DIR/.env.local

if [ "$(id -u)" -ne 0 ]; then echo "root 로 실행하세요:  sudo -i  후 다시"; exit 1; fi
case "$DOMAIN" in
  *.*) ;;
  *) echo "도메인이 이상합니다: $DOMAIN  (예: naka.1dollartool.com)"; exit 1 ;;
esac

export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
APT="apt-get -y -q -o Dpkg::Options::=--force-confold"
step() { printf '\n━━━ %s ━━━\n' "$*"; }
as_kb() { sudo -iu kb "$@"; }

step "1/8 시스템 업데이트 · 방화벽 · 스왑 · 시간대   (도메인: $DOMAIN)"
apt-get update -q
$APT upgrade
$APT install sudo ufw unattended-upgrades git curl ca-certificates gnupg openssl
ufw allow OpenSSH >/dev/null
ufw allow 80 >/dev/null
ufw allow 443 >/dev/null
ufw --force enable >/dev/null
timedatectl set-timezone Asia/Seoul || true
if [ ! -f /swapfile ]; then                      # 메모리 2GB 서버에서 빌드가 죽지 않도록 2GB 스왑
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

step "2/8 Node 22"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/^v//; s/\..*//')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  $APT install nodejs
fi
echo "node $(node -v) · npm $(npm -v)"

step "3/8 앱 계정(kb) · 코드 → $APP_DIR"
id kb >/dev/null 2>&1 || useradd -m -s /bin/bash kb
mkdir -p $APP_DIR && chown kb:kb $APP_DIR
if [ ! -d $APP_DIR/.git ]; then
  as_kb git clone -q -b "$BRANCH" "$REPO" $APP_DIR
else
  as_kb git -C $APP_DIR pull -q --ff-only
fi
as_kb git -C $APP_DIR log --oneline -1

step "4/8 환경변수 $ENV_FILE"
if [ ! -f "$ENV_FILE" ]; then
  as_kb cp $APP_DIR/.env.production.example "$ENV_FILE"
  as_kb sed -i "s|^ADMIN_TOKEN=.*|ADMIN_TOKEN=$(openssl rand -hex 24)|; s|^SESSION_SECRET=.*|SESSION_SECRET=$(openssl rand -hex 24)|" "$ENV_FILE"
  echo "ADMIN_TOKEN · SESSION_SECRET 을 새로 만들었습니다"
else
  echo "이미 있어서 그대로 둡니다 (BASE_URL 만 맞춤)"
fi
as_kb sed -i "s|^BASE_URL=.*|BASE_URL=https://$DOMAIN|" "$ENV_FILE"
chmod 600 "$ENV_FILE"

step "5/8 설치 · 빌드  (몇 분 걸립니다 — 기다려 주세요)"
as_kb bash -c "cd $APP_DIR && npm ci --no-audit --no-fund && npm run build"

step "6/8 서비스 등록 (재부팅·오류 시 자동 복구)"
cp $APP_DIR/deploy/kb.service /etc/systemd/system/kb.service
systemctl daemon-reload
systemctl enable kb >/dev/null 2>&1
systemctl restart kb
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 2
  if curl -fsS http://127.0.0.1:3000/api/extension/config >/dev/null 2>&1; then echo "앱 응답 OK (3000번)"; break; fi
  if [ "$i" = 10 ]; then echo "앱이 응답하지 않습니다 — 아래 로그를 보내주세요"; journalctl -u kb -n 60 --no-pager; exit 1; fi
done

step "7/8 HTTPS (Caddy) — $DOMAIN 인증서 자동 발급"
if ! command -v caddy >/dev/null 2>&1; then
  $APT install debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q && $APT install caddy
fi
sed "s|naka.1dollartool.com|$DOMAIN|" $APP_DIR/deploy/Caddyfile > /etc/caddy/Caddyfile
systemctl enable caddy >/dev/null 2>&1
systemctl restart caddy

step "8/8 백업 — 매일 03:10 → $APP_DIR/backups (30일치)"
chmod +x $APP_DIR/scripts/backup-data.sh
( as_kb crontab -l 2>/dev/null | grep -v backup-data.sh || true
  echo "10 3 * * * $APP_DIR/scripts/backup-data.sh >> $APP_DIR/backup.log 2>&1" ) | as_kb crontab -

PUB_IP="$(curl -fsS -4 --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
DNS_IP="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1; exit}' || true)"
printf '\n✅ 세팅 끝.\n'
printf '   이 서버 IP  : %s\n   %s → %s\n' "$PUB_IP" "$DOMAIN" "${DNS_IP:-(아직 DNS 없음)}"
if [ "$DNS_IP" != "$PUB_IP" ]; then
  printf '   ⚠ DNS 가 아직 이 서버를 가리키지 않습니다. 도메인 관리에서 A 레코드 %s → %s 를 넣고\n     몇 분 뒤  systemctl reload caddy  를 치면 인증서를 받습니다.\n' "${DOMAIN%%.*}" "$PUB_IP"
fi
printf '   브라우저     : https://%s/privacy  가 열리면 완료\n' "$DOMAIN"
printf '   운영자 열쇠  : grep ADMIN_TOKEN %s   (이 값은 /admin 로그인용 — 대화·캡처에 올리지 마세요)\n' "$ENV_FILE"
printf '   코드 갱신    : bash %s/deploy/update.sh\n' "$APP_DIR"
