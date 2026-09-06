# 서버 준비 — 무엇을 사고, 어떻게 올리고, 어떻게 지키나

> 사장님이 **미리 준비**하실 것과, 서버에서 **순서대로 칠 명령**을 한 장에 모았습니다.
> 이 앱은 주문·고객을 **파일(.data/)** 에 저장하므로 Vercel 같은 서버리스가 아니라
> **VPS 한 대**가 맞습니다. 사이트가 공개 https 주소에 떠야 확장도, 웹스토어 심사도 됩니다.

## 0. 미리 준비할 것 (사장님)

| 준비물 | 권장 | 비고 |
|---|---|---|
| **VPS 1대** | Ubuntu 24.04, 2 vCPU · 2GB RAM · 40GB, 싱가포르 또는 서울 | 월 1만원 안팎. 베트남 고객·한국 운영자 양쪽에서 가까운 곳 |
| **도메인** | 예: `app.1dollartool.com` (이미 확장 허용 목록에 `*.1dollartool.com` 있음) | DNS 에 A 레코드 → VPS IP |
| **SSH 키** | 비밀번호 로그인 대신 키 | 윈도우: `ssh-keygen`, 공개키를 VPS 에 등록 |
| **텔레그램 봇** | @BotFather 로 봇 생성 → 토큰, 운영자·물류사 채팅 ID | 알림용 |
| **비밀값 3개** | `ADMIN_TOKEN`, `SESSION_SECRET`, (쓰면) `PAYMENT_WEBHOOK_TOKEN` | `openssl rand -hex 24` 로 생성, 사장님만 보관 |
| **백업 장소** | 구글드라이브(rclone) 또는 다른 PC | `.data/` 는 곧 고객 자산 |

## 1. 서버 세팅 — 처음 한 번, 이 순서대로

```bash
# (1) 기본 — 방화벽·자동 보안 업데이트
sudo apt update && sudo apt -y upgrade
sudo apt -y install ufw unattended-upgrades git
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw --force enable

# (2) Node 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt -y install nodejs
node -v   # v22 이상

# (3) 앱 계정과 코드
sudo useradd -m -s /bin/bash kb
sudo mkdir -p /srv/kb && sudo chown kb:kb /srv/kb
sudo -iu kb bash -c 'git clone -b claude/korean-beauty-direct-purchase-98zv0u https://github.com/LifeTools114/next-js-demo-project.git /srv/kb'
sudo -iu kb bash -c 'cd /srv/kb && npm ci && cp .env.production.example .env.local'
sudo -iu kb nano /srv/kb/.env.local     # ADMIN_TOKEN, BASE_URL, SESSION_SECRET, 텔레그램 값 채우기
sudo -iu kb bash -c 'cd /srv/kb && npm run build'

# (4) 서비스로 띄우기 (재부팅·죽음에 자동 복구)
sudo cp /srv/kb/deploy/kb.service /etc/systemd/system/kb.service
sudo systemctl daemon-reload && sudo systemctl enable --now kb
sudo systemctl status kb --no-pager      # active (running) 이면 됨
curl -s http://127.0.0.1:3000/api/extension/config | head -c 200   # JSON 이 나오면 됨

# (5) HTTPS — Caddy 가 인증서를 자동으로 받습니다
sudo apt -y install debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt -y install caddy
sudo cp /srv/kb/deploy/Caddyfile /etc/caddy/Caddyfile && sudo nano /etc/caddy/Caddyfile   # 도메인 바꾸기
sudo systemctl reload caddy
# 브라우저에서 https://<도메인>/privacy 가 열리면 완료

# (6) 백업 — 매일 03:10
sudo -iu kb bash -c 'crontab -l 2>/dev/null; echo "10 3 * * * /srv/kb/scripts/backup-data.sh >> /srv/kb/backup.log 2>&1"' | sudo -iu kb crontab -
```

## 2. 환경변수 — 무엇을 꼭 넣나

| 변수 | 필수 | 뜻 |
|---|---|---|
| `ADMIN_TOKEN` | **필수** | /admin·운영 API 열쇠. 없으면 프로덕션에서 운영 기능이 막힙니다 |
| `BASE_URL` | **필수** | `https://<도메인>` — 알림 링크 |
| `SESSION_SECRET` | 권장 | PIN 해제 표시 서명. 없으면 재시작마다 고객이 PIN 을 다시 넣음 |
| `TELEGRAM_BOT_TOKEN` `TELEGRAM_OPERATOR_CHAT_ID` `TELEGRAM_PARTNER_CHAT_ID` | 권장 | 주문·상태 알림, 물류사 연동 |
| `PAYMENT_WEBHOOK_TOKEN` | 선택 | 입금 자동 확인 웹훅을 쓸 때 |
| 창고·계좌·사업자·환율 | 선택 | 코드 기본값과 다를 때만 (`.env.production.example` 참고) |

## 3. 날마다 · 바뀔 때

| 언제 | 명령 |
|---|---|
| 코드 새 버전 올릴 때 | `sudo -iu kb bash -c 'cd /srv/kb && git pull && npm ci && npm run build' && sudo systemctl restart kb` |
| 잘 도는지 | `sudo systemctl status kb` · `journalctl -u kb -n 100 --no-pager` |
| 백업 확인 | `ls /srv/kb/backups` (30일치) · 복구는 `tar -xzf` 로 `.data/` 되돌리고 `systemctl restart kb` |
| 확장 배포본 | 사장님 PC에서 `STORE_BACKEND_URL=https://<도메인> npm run pack:store` |
| 운영자 PC | 서버가 정본입니다. PC 에서는 브라우저로 `https://<도메인>/admin` 만 쓰고, `npm run dev` 는 개발·시험용으로만 |

## 4. 지켜야 할 것

- `.env.local` 은 **서버에만**. 깃에 올리지 않습니다(이미 무시 목록). 값이 대화·캡처에 노출됐으면 바로 새로 만듭니다.
- SSH 는 키로만. `sudo nano /etc/ssh/sshd_config` 에서 `PasswordAuthentication no` 뒤 `sudo systemctl restart ssh`.
- `.data/` 백업이 다른 장소에 한 벌 더 있는지 한 달에 한 번 확인.
- 문제가 생기면 `journalctl -u kb -n 200` 을 찍어 보내주세요.

## 5. 다 됐는지 확인 — 다섯 줄

1. `https://<도메인>/` 첫 화면, `/privacy`, `/rates` 가 열린다.
2. `https://<도메인>/api/extension/config` 가 JSON 을 돌려준다 (확장이 붙는 문).
3. `https://<도메인>/admin` 에 ADMIN_TOKEN 을 넣으면 주문·고객 판이 보인다.
4. 시험 주문 하나 → 텔레그램에 알림이 온다 → /admin 에서 입금 확인 → 고객 /my 에 전체 주문.
5. `ls /srv/kb/backups` 에 오늘 날짜 파일이 있다.
