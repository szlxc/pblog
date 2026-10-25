#!/usr/bin/env sh
# ============================================================
# PBLOG 部署脚本（不依赖 docker compose）
#   sh deploy/start-no-compose.sh
#
# 只用原生 docker 命令完成：
#   建网络 → 建数据卷 → 构建镜像 → 起 MySQL → 等就绪
#   → 起后端 → 构建并起 Nginx → 迁移建表 → 写入种子
#
# 效果与 docker-compose.yml 等价，适合没装 compose 的服务器。
# ============================================================
set -e

NET=pblog-net
VOL_DB=pblog-db-data
VOL_UP=pblog-uploads
C_DB=pblog-db
C_API=pblog-server
C_WEB=pblog-web

# ---------- 0. 环境检查 ----------
if ! docker info >/dev/null 2>&1; then
  echo "错误：无法连接 docker 守护进程（systemctl status docker）"
  exit 1
fi

if [ ! -f .env ]; then
  echo "未找到 .env，正在从 .env.example 复制，请修改后再运行"
  cp .env.example .env
  exit 1
fi

set -a; . ./.env; set +a

need_change=""
case "$PBLOG_JWT_SECRET" in ""|*change_me*) need_change="$need_change PBLOG_JWT_SECRET";; esac
case "$PBLOG_DB_ROOT_PASSWORD" in ""|*change_me*) need_change="$need_change PBLOG_DB_ROOT_PASSWORD";; esac
case "$PBLOG_DB_PASSWORD" in ""|*change_me*) need_change="$need_change PBLOG_DB_PASSWORD";; esac
if [ -n "$need_change" ]; then
  echo "以下变量仍为默认值，请先在 .env 中修改：$need_change"
  echo "  生成密钥：openssl rand -hex 32"
  exit 1
fi

DB_NAME=${PBLOG_DB_NAME:-pblog}
DB_USER=${PBLOG_DB_USER:-pblog}
DB_PASS=${PBLOG_DB_PASSWORD:?}
DB_ROOT=${PBLOG_DB_ROOT_PASSWORD:?}
PUBLIC_URL=${PBLOG_PUBLIC_URL:-http://localhost}
HTTP_PORT=${PBLOG_HTTP_PORT:-80}

# ---------- 1. 网络与卷 ----------
echo "==> 准备网络与数据卷"
docker network inspect "$NET" >/dev/null 2>&1 || docker network create "$NET"
docker volume inspect "$VOL_DB" >/dev/null 2>&1 || docker volume create "$VOL_DB"
docker volume inspect "$VOL_UP" >/dev/null 2>&1 || docker volume create "$VOL_UP"

# ---------- 2. MySQL ----------
echo "==> 启动 MySQL"
if docker ps -a --format '{{.Names}}' | grep -qx "$C_DB"; then
  echo "    容器已存在，直接启动"
  docker start "$C_DB" >/dev/null
else
  docker run -d --name "$C_DB" \
    --network "$NET" \
    --restart unless-stopped \
    -e MYSQL_ROOT_PASSWORD="$DB_ROOT" \
    -e MYSQL_DATABASE="$DB_NAME" \
    -e MYSQL_USER="$DB_USER" \
    -e MYSQL_PASSWORD="$DB_PASS" \
    -v "$VOL_DB":/var/lib/mysql \
    -v "$(pwd)/server/src/db/schema.sql":/docker-entrypoint-initdb.d/01-schema.sql:ro \
    mysql:8.0 \
    --character-set-server=utf8mb4 \
    --collation-server=utf8mb4_unicode_ci \
    --default-authentication-plugin=mysql_native_password >/dev/null
fi

echo "==> 等待数据库就绪（最多 180 秒）"
i=0
until docker exec "$C_DB" sh -c 'mysqladmin ping -h 127.0.0.1 -u root -p"$MYSQL_ROOT_PASSWORD" --silent' >/dev/null 2>&1; do
  i=$((i + 3))
  if [ "$i" -ge 180 ]; then
    echo "数据库 180 秒内未就绪，查看日志：docker logs $C_DB"
    exit 1
  fi
  sleep 3
done
echo "    数据库已就绪"

# ---------- 3. 后端镜像 ----------
echo "==> 构建后端镜像"
docker build -f server/Dockerfile -t pblog-server:latest .

echo "==> 启动后端"
docker rm -f "$C_API" >/dev/null 2>&1 || true
docker run -d --name "$C_API" \
  --network "$NET" \
  --restart unless-stopped \
  -e NODE_ENV=production \
  -e PBLOG_HOST=0.0.0.0 \
  -e PBLOG_PORT=8080 \
  -e PBLOG_PUBLIC_URL="$PUBLIC_URL" \
  -e PBLOG_FRONTEND_URL="${PBLOG_FRONTEND_URL:-$PUBLIC_URL}" \
  -e PBLOG_ADMIN_URL="${PBLOG_ADMIN_URL:-$PUBLIC_URL/admin}" \
  -e PBLOG_JWT_SECRET="$PBLOG_JWT_SECRET" \
  -e PBLOG_DB_HOST="$C_DB" \
  -e PBLOG_DB_PORT=3306 \
  -e PBLOG_DB_USER="$DB_USER" \
  -e PBLOG_DB_PASSWORD="$DB_PASS" \
  -e PBLOG_DB_NAME="$DB_NAME" \
  -e PBLOG_ADMIN_USER="${PBLOG_ADMIN_USER:-admin}" \
  -e PBLOG_ADMIN_PASSWORD="${PBLOG_ADMIN_PASSWORD:-CHANGE_ME_BEFORE_DEPLOY}" \
  -e PBLOG_UPLOAD_DIR=/app/data/uploads \
  -v "$VOL_UP":/app/data/uploads \
  pblog-server:latest >/dev/null

echo "==> 等待后端响应"
i=0
until docker exec "$C_API" node -e "require('http').get('http://127.0.0.1:8080/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" >/dev/null 2>&1; do
  i=$((i + 2))
  if [ "$i" -ge 60 ]; then
    echo "后端 60 秒内未就绪，查看日志：docker logs $C_API"
    exit 1
  fi
  sleep 2
done
echo "    后端已就绪"

# ---------- 4. 前端镜像 ----------
echo "==> 构建前端镜像（Nginx + 前台 + 管理端）"
docker build -f Dockerfile.web --build-arg "PBLOG_PUBLIC_URL=$PUBLIC_URL" -t pblog-web:latest .

echo "==> 启动 Nginx"
docker rm -f "$C_WEB" >/dev/null 2>&1 || true
docker run -d --name "$C_WEB" \
  --network "$NET" \
  --restart unless-stopped \
  -p "$HTTP_PORT":80 \
  pblog-web:latest >/dev/null

# ---------- 5. 迁移与种子 ----------
echo "==> 执行数据库迁移（建表）"
docker exec "$C_API" npm run migrate

echo "==> 写入种子数据"
docker exec "$C_API" npm run seed || echo "    种子数据可能已存在，已跳过"

# ---------- 6. 完成 ----------
PORT_SUFFIX=""
case "$HTTP_PORT" in 80|"") ;; *) PORT_SUFFIX=":$HTTP_PORT";; esac

echo ""
echo "=============================================="
echo " 部署完成"
echo "=============================================="
echo "  前台：    ${PUBLIC_URL%/}${PORT_SUFFIX}/"
echo "  管理端：  ${PUBLIC_URL%/}${PORT_SUFFIX}/admin/"
echo "  管理员：  ${PBLOG_ADMIN_USER:-admin} / ${PBLOG_ADMIN_PASSWORD:-CHANGE_ME_BEFORE_DEPLOY}"
echo ""
echo "  查看容器： docker ps"
echo "  后端日志： docker logs -f $C_API"
echo "  停止服务： docker stop $C_API $C_WEB $C_DB"
