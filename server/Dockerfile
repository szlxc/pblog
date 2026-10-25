# ---------- PBLOG 后端镜像 ----------
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=Asia/Shanghai

# 国内构建：换成中科大 alpine 源，避免 dl-cdn.alpinelinux.org 超时
# 如果你的服务器访问官方源没问题，可以删掉这两行
RUN sed -i 's#dl-cdn.alpinelinux.org#mirrors.ustc.edu.cn#g' /etc/apk/repositories

# sharp 在 alpine 上需要 libc6-compat；tini 用于正确转发信号
RUN apk add --no-cache libc6-compat tini tzdata

# npm 换国内镜像（可删，删掉则走官方 registry）
RUN npm config set registry https://registry.npmmirror.com

# 先装依赖，利用 Docker 层缓存：package.json 不变就不会重装
COPY server/package.json ./server/package.json
RUN cd server && npm install --omit=dev --no-audit --no-fund

# 源码 + 统一配置文件
COPY config ./config
COPY PBLOG.json ./PBLOG.json
COPY server ./server

WORKDIR /app/server
RUN mkdir -p /app/data/uploads

ENV PBLOG_UPLOAD_DIR=/app/data/uploads
EXPOSE 8080

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
