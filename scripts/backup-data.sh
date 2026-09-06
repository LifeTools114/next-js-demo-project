#!/usr/bin/env bash
# 주문·고객 파일(.data/) 백업 — 매일 새벽에 cron 으로 돌립니다. 30일치를 남깁니다.
#   crontab -e  →  10 3 * * * /srv/kb/scripts/backup-data.sh >> /srv/kb/backup.log 2>&1
set -euo pipefail
APP_DIR="${APP_DIR:-/srv/kb}"
DATA_DIR="${ORDER_STORE_DIR:-$APP_DIR/.data}"
OUT_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
[ -d "$DATA_DIR" ] || { echo "$(date -Is) 아직 주문 파일이 없습니다 ($DATA_DIR) — 건너뜀"; exit 0; }
mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M)"
tar -czf "$OUT_DIR/data-$STAMP.tgz" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"
find "$OUT_DIR" -name 'data-*.tgz' -mtime +30 -delete
echo "$(date -Is) backup ok → $OUT_DIR/data-$STAMP.tgz"
# 다른 곳에도 한 벌 (선택): rclone 이 있으면 구글드라이브 등으로
if command -v rclone >/dev/null 2>&1 && [ -n "${RCLONE_REMOTE:-}" ]; then
  rclone copy "$OUT_DIR/data-$STAMP.tgz" "$RCLONE_REMOTE" && echo "  → $RCLONE_REMOTE"
fi
