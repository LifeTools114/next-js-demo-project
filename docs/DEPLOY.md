# 서버 준비 — 무엇을 사고, 어떻게 올리고, 어떻게 지키나

> 정한 것: **Vultr 싱가포르 VPS(Ubuntu 24.04, 1 vCPU · 2GB) + 도메인 `naka.1dollartool.com`**.
> 이 앱은 주문·고객을 **파일(.data/)** 에 저장하므로 Vercel 같은 서버리스가 아니라
> **VPS 한 대**가 맞습니다. 사이트가 공개 https 주소에 떠야 확장도, 웹스토어 심사도 됩니다.

## ⚠️ Vercel 은 안 됩니다

Vercel(서버리스)은 요청마다 다른 컴퓨터가 돌고 파일이 남지 않아 **주문이 사라집니다.**
`*.vercel.app` 서브도메인도 Vercel 에 올린 앱에만 붙습니다.
서버 관리를 전혀 하고 싶지 않다면 대안은 디스크가 붙는 Render(`render.yaml`, 월 $7+) 이고,
그때는 `ORDER_STORE_DIR=/var/data` 로 저장하며 백업은 /admin 「💾 백업 내려받기」로 손수 합니다.

## 1. 처음 한 번 — 네 단계

### ① DNS — 도메인이 서버를 가리키게 (도메인 관리 화면에서, 1분)

`1dollartool.com` 의 DNS 는 **Vercel** 이 맡고 있습니다(네임서버 ns1/ns2.vercel-dns.com). 그래서
지금은 `naka.1dollartool.com` 을 포함해 모든 이름이 Vercel IP 로 갑니다 — 레코드 한 줄을 더해
`naka` 만 우리 서버로 보냅니다:

Vercel 대시보드 → 위쪽 **Domains** → `1dollartool.com` 클릭 → **DNS Records** 에서 추가

| Name | Type | Value | TTL |
|---|---|---|---|
| `naka` | **A** | **서버 공인 IP** (Vultr 목록의 IP Address) | 60 |

- 이름 칸에는 `naka` 만 (뒤에 `.1dollartool.com` 은 자동).
- 확인: 윈도우 PowerShell 에서 `nslookup naka.1dollartool.com` → 서버 IP 가 나오면 됨 (몇 분 걸릴 수 있음).
- 다른 곳(가비아·Cloudflare 등)으로 DNS 를 옮겼다면 그곳에서 같은 A 레코드를 넣습니다. Cloudflare 는 구름을 **회색(DNS only)** 으로.

### ② 서버에 들어가기 (윈도우 PowerShell)

```powershell
ssh root@<서버 IP>
```
- 처음엔 `Are you sure you want to continue connecting (yes/no)?` → `yes` Enter.
- 비밀번호는 Vultr 인스턴스 화면의 **Password**(눈 아이콘·복사). 붙여넣기는 마우스 **오른쪽 클릭**, 화면엔 아무것도 안 보입니다 → Enter.
- `ssh` 가 없다고 하면: 설정 → 앱 → 선택적 기능 → **OpenSSH 클라이언트** 추가.
- 비밀번호는 대화나 캡처에 올리지 마세요 (IP 는 공개되어도 괜찮습니다).

### ③ 세팅 — 명령 두 줄 (서버 안에서)

```bash
curl -fsSL https://raw.githubusercontent.com/LifeTools114/next-js-demo-project/claude/korean-beauty-direct-purchase-98zv0u/deploy/setup-server.sh -o setup.sh
bash setup.sh
```
`deploy/setup-server.sh` 가 순서대로 다 합니다 — 방화벽·스왑·시간대(서울) → Node 22 → `kb` 계정과
코드(`/srv/kb`) → `.env.local`(`ADMIN_TOKEN`·`SESSION_SECRET` 자동 생성, `BASE_URL=https://naka.1dollartool.com`)
→ 설치·빌드(몇 분) → systemd 서비스 → Caddy HTTPS(인증서 자동) → 매일 03:10 백업.
끝에 `✅ 세팅 끝` 과 함께 DNS 가 이 서버를 가리키는지 알려줍니다.
중간에 멈추면 화면의 마지막 20줄을 보내주세요. **다시 `bash setup.sh` 를 쳐도 안전**합니다(이미 된 건 건너뜀).
다른 도메인을 쓰려면 `bash setup.sh 다른.주소.com`.

### ④ 확인 — 다섯 줄

1. `https://naka.1dollartool.com/` 첫 화면, `/privacy`, `/rates` 가 열린다.
2. `https://naka.1dollartool.com/api/extension/config` 가 JSON 을 돌려준다 (확장이 붙는 문).
3. `https://naka.1dollartool.com/admin` 에 ADMIN_TOKEN 을 넣으면 주문·고객 판이 보인다.
   토큰 보기(서버에서): `grep ADMIN_TOKEN /srv/kb/.env.local` — 비밀번호 수첩에만 적어 두세요.
4. 시험 주문 하나 → /admin 에 뜬다 → 입금 확인 → 고객 /my 에 전체 주문.
5. `ls /srv/kb/backups` 에 내일 새벽 이후 날짜 파일이 생긴다.

## 2. 환경변수 — 무엇이 들어 있나 (`/srv/kb/.env.local`, 서버에만)

| 변수 | 필수 | 뜻 |
|---|---|---|
| `ADMIN_TOKEN` | **필수** | /admin·운영 API 열쇠. 스크립트가 자동 생성. 없으면 운영 기능이 막힙니다 |
| `BASE_URL` | **필수** | `https://naka.1dollartool.com` — 알림 링크 |
| `SESSION_SECRET` | 권장 | PIN 해제 표시 서명. 자동 생성 |
| `TELEGRAM_BOT_TOKEN` `TELEGRAM_OPERATOR_CHAT_ID` `TELEGRAM_PARTNER_CHAT_ID` | 권장 | 주문·상태 알림, 물류사 연동 — 나중에 `nano /srv/kb/.env.local` 로 채우고 `systemctl restart kb` |
| `PAYMENT_WEBHOOK_TOKEN` | 선택 | 입금 자동 확인 웹훅을 쓸 때 |
| 창고·계좌·사업자·환율 | 선택 | 코드 기본값과 다를 때만 (`.env.production.example` 참고) |

nano: 고치고 `Ctrl+O` → `Enter` 저장, `Ctrl+X` 나가기.

## 3. 날마다 · 바뀔 때 (서버에서, root)

| 언제 | 명령 |
|---|---|
| 코드 새 버전 올릴 때 (제가 푸시한 뒤) | `bash /srv/kb/deploy/update.sh` |
| 잘 도는지 | `systemctl status kb --no-pager` · `journalctl -u kb -n 100 --no-pager` |
| 인증서·HTTPS 문제 | `systemctl status caddy --no-pager` · DNS 고친 뒤 `systemctl reload caddy` |
| 백업 확인 | `ls /srv/kb/backups` (30일치) · 복구는 `tar -xzf` 로 `.data/` 되돌리고 `systemctl restart kb` |
| 확장 배포본 | 사장님 PC에서 `npm run pack:store` (기본 서버 naka.1dollartool.com) |
| 운영자 PC | 서버가 정본입니다. PC 에서는 브라우저로 `https://naka.1dollartool.com/admin` 만 쓰고, `npm run dev` 는 개발·시험용으로만 |

## 4. 지켜야 할 것

- `.env.local` 은 **서버에만**. 깃에 올리지 않습니다(이미 무시 목록). 값이 대화·캡처에 노출됐으면 바로 새로 만듭니다.
- `.data/` 백업이 다른 장소에 한 벌 더 있는지 한 달에 한 번 확인 (/admin 「💾 백업 내려받기」 → 구글드라이브).
- 문제가 생기면 `journalctl -u kb -n 200 --no-pager` 를 찍어 보내주세요.
- **SSH 를 키로만** (권장, 사이트가 뜬 뒤 여유 있을 때). 윈도우 PowerShell 에서:
  ```powershell
  ssh-keygen -t ed25519          # 물으면 Enter 세 번
  type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@<서버 IP> "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
  ssh root@<서버 IP>             # 비밀번호 없이 들어가지면 성공
  ```
  그다음 **새 창에서 키 로그인이 되는 걸 확인한 뒤** 서버에서 비밀번호 로그인을 끕니다:
  ```bash
  printf 'PasswordAuthentication no\nPermitRootLogin prohibit-password\n' > /etc/ssh/sshd_config.d/00-kb.conf && sshd -t && systemctl restart ssh
  ```
