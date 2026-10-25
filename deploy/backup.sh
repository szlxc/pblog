#!/usr/bin/env sh
# ============================================================
# 备份数据库与上传文件
#   sh deploy/backup.sh [备份目录，默认 ./backups]
# 兼容 docker compose（插件）与 docker-compose（v1 二进制）
# ============================================================
set -e

if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "错误：未找到 docker compose / docker-compose"
  exit 1
fi

DIR=${1:-./backups}
mkdir -p "$DIR"
STAMP=$(date +%Y%m%d-%H%M%S)

PROJECT=$(basename "$(pwd)")

echo "==> 备份数据库"
$DC exec -T db sh -c 'exec mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers "$MYSQL_DATABASE"' \
  | gzip > "$DIR/db-$STAMP.sql.gz"

echo "==> 备份上传文件"
docker run --rm -v "${PROJECT}_uploads":/data -v "$(pwd)/$DIR":/backup alpine \
  tar czf "/backup/uploads-$STAMP.tar.gz" -C /data .

echo ""
echo "已备份到 $DIR"
ls -lh "$DIR" | tail -5
