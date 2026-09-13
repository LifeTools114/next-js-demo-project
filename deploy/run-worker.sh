#!/usr/bin/env bash
# kb-worker 서비스가 실행하는 크롬 시작 스크립트 (systemd ExecStart). 직접 부를 일은 없습니다.
#
# 환경(EnvironmentFile=/srv/kb/.env.local + 유닛의 Environment=):
#   KB_CHROME          크롬 실행 파일 (setup-worker.sh 가 유닛에 적어 둠)
#   BASE_URL, ADMIN_TOKEN
#   KB_WORKER_PROXY    (선택) 쇼핑몰이 서버 IP 를 막을 때 — 한국 주거용 프록시 주소. 예) http://gw.example.com:8000
#                      또는 socks5://gw.example.com:1080. 크롬은 프록시의 사용자·비밀번호를 못 받으므로 **서버 IP 허용(whitelist)**
#                      방식으로 계약하세요. 우리 사이트(BASE_URL)·localhost 는 프록시를 거치지 않습니다.
#   KB_WORKER_IMAGES   (선택) 1 이면 프록시를 써도 그림을 내려받음. 기본은 프록시를 쓸 때만 그림을 끕니다 (트래픽 요금 절약 —
#                      대표 사진 주소는 메타 태그라 그림 없이도 읽힙니다).
# 바꾼 뒤: systemctl restart kb-worker
set -euo pipefail
: "${KB_CHROME:?KB_CHROME 이 없습니다 — deploy/setup-worker.sh 를 다시 실행하세요}"
: "${BASE_URL:?BASE_URL 이 없습니다}"
: "${ADMIN_TOKEN:?ADMIN_TOKEN 이 없습니다}"
APP_DIR=${APP_DIR:-/srv/kb}
EXT_DIR=$APP_DIR/extension
PROFILE=$APP_DIR/.chrome-worker
HOST=$(printf '%s' "$BASE_URL" | sed -E 's#^[a-zA-Z]+://##; s#[/:].*$##')

ARGS=(
  --no-first-run --no-default-browser-check --no-sandbox --disable-gpu --disable-dev-shm-usage
  --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows
  --disable-session-crashed-bubble --disable-features=TranslateUI --lang=ko-KR --window-size=1280,900
  "--user-data-dir=$PROFILE" "--disable-extensions-except=$EXT_DIR" "--load-extension=$EXT_DIR"
)
if [ -n "${KB_WORKER_PROXY:-}" ]; then
  ARGS+=( "--proxy-server=$KB_WORKER_PROXY" "--proxy-bypass-list=$HOST;localhost;127.0.0.1;<-loopback>" )
  [ "${KB_WORKER_IMAGES:-0}" = 1 ] || ARGS+=( --blink-settings=imagesEnabled=false )
  echo "kb-worker: 프록시 사용 $KB_WORKER_PROXY (우회 대상 아님: $HOST)"
fi

# 시작 주소는 우리 사이트의 부팅 페이지 — 설정은 # 뒤라 서버·로그에 남지 않고, 확장이 이 탭을 대신 읽기 창으로 바꿉니다
exec /usr/bin/xvfb-run -a -s "-screen 0 1280x900x24" "$KB_CHROME" "${ARGS[@]}" "$BASE_URL/kb-worker-boot#backend=$BASE_URL&token=$ADMIN_TOKEN&start=1"
