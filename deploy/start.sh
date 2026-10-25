#!/usr/bin/env sh
# ============================================================
# PBLOG 首次部署脚本（在项目根目录执行）
#   sh deploy/start.sh
#
# 依次执行：检查环境 → 建 .env 校验 → 构建启动 → 等库就绪
#           → 迁移建表 → 写入种子数据
#
# 兼容两种 Compose：
#   docker compose      （Docker 20.10+ 的插件，推荐）
#   docker-compose      （独立安装的 v1 / v2 二进制）
# ============================================================
set -e

# ---------- 0. 选择 docker compose 命令 ----------
DC=""
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "错误：未找到 docker compose，也未找到 docker-compose"
  echo ""
  echo "修复方式（按顺序尝试）："
  echo ""
  echo "  A) Ubuntu 官方源安装（apt 包名是 docker-compose-v2，不是 docker-compose-plugin）"
  echo "       apt-get update && apt-get install -y docker-compose-v2"
  echo "     若提示找不到，再试：apt-get install -y docker-compose"
  echo ""
  echo "  B) 安装独立二进制（通用，最稳）"
  echo "       ARCH=$(uname -m); [ \"$ARCH\" = \"aarch64\" ] && ARCH=aarch64 || ARCH=x86_64"
  echo "       curl -SL https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-$ARCH \\"
  echo "         -o /usr/local/bin/docker-compose"
  echo "       chmod +x /usr/local/bin/docker-compose"
  echo "       docker-compose version"
  echo ""
  echo "      GitHub 拉不动时用阿里云镜像："
  echo "       https://mirrors.aliyun.com/docker-ce/linux/static/stable/$ARCH/"
  echo ""
  echo "  C) 不装 Compose，改用原生 docker 命令部署"
  echo "       sh deploy/start-no-compose.sh"
  exit 1
fi
echo "使用 Compose 命令：$DC"

# ---------- 1. docker 守护进程是否可用 ----------
if ! docker info >/dev/null 2>&1; then
  echo "错误：无法连接 docker 守护进程"
  echo "  请确认 dockerd 已启动：systemctl status docker"
  echo "  如果当前是非 root 用户：sudo usermod -aG docker \$USER 后重新登录"
  exit 1
fi

# ---------- 2. .env ----------
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
case "$PBLOG_PUBLIC_URL" in *localhost*) echo "提示：PBLOG_PUBLIC_URL 仍是 localhost，仅适合本机访问";; esac
if [ -n "$need_change" ]; then
  echo "以下变量仍为默认值或为空，请先在 .env 中修改：$need_change"
  echo "  生成密钥：openssl rand -hex 32"
  exit 1
fi

# ---------- 3. 构建并启动 ----------
echo "==> 构建并启动容器"
# 先 build 再 up：不用 --build，因为 v1/v2 对该参数的处理不一致
$DC build
$DC up -d --remove-orphans

# ---------- 4. 等待数据库 ----------
echo "==> 等待数据库就绪（最多 120 秒）"
i=0
until $DC exec -T db sh -c 'mysqladmin ping -h 127.0.0.1 -u root -p"$MYSQL_ROOT_PASSWORD" --silent' >/dev/null 2>&1; do
  i=$((i + 2))
  if [ "$i" -ge 120 ]; then
    echo "数据库 120 秒内未就绪，请检查：$DC logs db"
    exit 1
  fi
  sleep 2
done
echo "数据库已就绪"

# ---------- 5. 等待后端就绪 ----------
echo "==> 等待后端启动"
i=0
until $DC exec -T server node -e "require('http').get('http://127.0.0.1:8080/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" >/dev/null 2>&1; do
  i=$((i + 2))
  if [ "$i" -ge 60 ]; then
    echo "后端 60 秒内未就绪，查看日志：$DC logs --tail=50 server"
    exit 1
  fi
  sleep 2
done
echo "后端已就绪"

# ---------- 6. 迁移（幂等，每次执行都安全） ----------
echo "==> 执行数据库迁移（建表，已存在的表会跳过）"
$DC exec -T server npm run migrate

# ---------- 7. 种子数据（已有管理员则跳过，不会覆盖你的数据） ----------
echo "==> 检查种子数据"
HAS_USER=$($DC exec -T db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" -N -B -e "SELECT COUNT(*) FROM users;" "$MYSQL_DATABASE"' 2>/dev/null | tr -d '\r')
if [ "${HAS_USER:-0}" -gt 0 ] 2>/dev/null; then
  echo "    数据库已有 ${HAS_USER} 个账号，跳过种子写入（不会覆盖现有数据）"
else
  $DC exec -T server npm run seed
fi

# ---------- 8. 自检 ----------
echo "==> 自检"
HEALTH=$($DC exec -T server node -e "require('http').get('http://127.0.0.1:8080/healthz',r=>{r.resume();process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))" >/dev/null 2>&1 && echo OK || echo FAIL)
CORS=$(curl -s http://127.0.0.1/api/config 2>/dev/null | head -c 200)
if [ "$HEALTH" = "OK" ]; then
  echo "    后端 /healthz        OK"
else
  echo "    后端 /healthz        失败，请查看：$DC logs --tail=50 server"
fi
echo "    接口自检            ${CORS:-（未响应）}"

# ---------- 9. 完成 ----------
PUBLIC_URL=${PBLOG_PUBLIC_URL:-http://localhost}
HTTP_PORT=${PBLOG_HTTP_PORT:-80}
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
echo "  查看状态： $DC ps"
echo "  查看日志： $DC logs -f server"
echo "  停止服务： $DC down"
