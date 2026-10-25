# PBLOG

一个前后端分离的个人博客系统。前台、管理端、后端三端共用一个配置文件，自带 Docker 部署方案。

界面风格支持 **亚克力 / 液态玻璃 / Material / 扁平** 四套质感体系，与配色系统相互独立 —— 换风格不影响你调的配色，换配色也不影响风格。

> 用到的开源项目与第三方资源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

---

## 功能

**内容**
- 文章（Markdown 编辑、草稿 / 定时发布 / 回收站、置顶、slug 自定义）
- 独立页面、分类（支持层级）、标签
- 媒体库（图片上传，自动压缩与格式转换）
- 全文搜索、文章目录、阅读时长、阅读量统计（按访客去重）

**互动**
- 评论（支持审核、Markdown、树状回复）
- 留言墙（弹幕气泡布局 + 树状展开）
- 聊天室（公共房间与登录用户房间，SSE 实时推送，支持图片 / 视频）
- 友情链接

**用户**
- 注册 / 登录 / 邮箱验证（SMTP 后台配置）
- 个人中心、头像、跨设备偏好同步
- JWT 鉴权 + 刷新令牌，bcrypt 密码散列

**外观**
- 四套界面风格（亚克力 / 液态玻璃 / Material / 扁平），可管理员锁定
- 配色方案（预设色板 + 自定义取色）、明暗模式、字号、圆角、阅读宽度
- 页面背景（全局 / 分页面，支持 UAPI 每日壁纸）
- 点击特效（基于 ba-click-fx，蔚蓝档案风格）
- 页面过渡（原生 View Transitions API）
- 音乐播放器（网易云外链）

**系统**
- 统一配置中心（三端共用 `PBLOG.json`，支持环境变量插值）
- 操作审计日志
- 访问统计（真实数据，无伪造）
- UAPI 第三方接口集成（一言 / 壁纸 / 热搜 / 天气，带本地缓存）
- RSS / Sitemap

---

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Node.js · Express 4 · mysql2 · JWT · bcryptjs · nodemailer · multer · sharp |
| 前台 | React 18 · Vite 5 · React Router 6 |
| 管理端 | React 18 · Vite 5 · React Router 6 |
| 数据库 | MySQL 8 |
| 样式 | 原生 CSS + CSS 变量（无 UI 框架、无图标库，图标全部内联 SVG） |
| 部署 | Docker / Docker Compose · Nginx |

---

## 快速开始

### 1. 准备环境变量

```bash
cp .env.example .env
```

编辑 `.env`，至少填上这几项：

```dotenv
# 站点地址（本地调试用 http://localhost，部署到域名时填完整地址）
PBLOG_PUBLIC_URL=http://localhost

# JWT 密钥，必须 32 位以上随机。生成方法：
#   openssl rand -hex 32
PBLOG_JWT_SECRET=

# 数据库密码
PBLOG_DB_ROOT_PASSWORD=
PBLOG_DB_PASSWORD=

# 管理员账号（仅首次建库时用于创建，之后改这里不影响已有账号）
PBLOG_ADMIN_PASSWORD=
```

> `.env` 含真实密钥，已在 `.gitignore` 中排除。**不要提交它。**

### 2. 启动

```bash
chmod +x deploy/*.sh
docker compose up -d --build
```

首次启动会自动建表并创建管理员账号。默认端口 80（可用 `PBLOG_HTTP_PORT` 修改）。

- 前台：`http://localhost`
- 管理端：`http://localhost/admin`

### 3. 不用 Docker

```bash
./deploy/start-no-compose.sh
```

---

## 目录结构

```
.
├── PBLOG.json              统一配置（三端共用）
├── config/index.js         配置加载器（支持 ${ENV:-默认值} 插值）
├── docker-compose.yml
├── .env.example            环境变量模板
├── server/                 后端
│   ├── Dockerfile
│   └── src/
│       ├── app.js, index.js
│       ├── db/             schema.sql / 迁移 / 初始化
│       ├── lib/            鉴权、Markdown、邮件、文本处理
│       ├── middleware/
│       └── routes/         公开 API / 鉴权 / 会员 / 聊天 / 留言 / 管理端
├── web/                    前台
│   └── src/
│       ├── components/     UI 组件
│       ├── pages/          页面
│       ├── context/        站点 / 会员状态
│       ├── lib/            API、主题、缓存
│       └── styles/         base / components / skin / ...
├── admin/                  管理端
│   └── src/pages/          25 个管理页面
└── deploy/                 启动脚本、备份脚本、Nginx 配置
```

---

## 界面风格与配色的关系

风格系统（`web/src/styles/skin.css`）和配色系统在结构上互不干扰：

- **配色** 控制颜色：`--accent` / `--bg` / `--text` / `--surface-line`
- **风格** 控制质感：`--sx-blur` / `--sx-saturate` / `--sx-border` / `--sx-shadow` / `--sx-sheen` / `--sx-noise` …

每种风格只改变量值，不写死任何颜色（需要颜色时用 `color-mix` 从 `--bg` / `--accent` 派生）。所以换风格不会覆盖用户的配色选择。

切换方式：`<html data-skin="acrylic|liquid|material|classic">`，与 `data-theme`（明暗）并列，由 `theme.js` 写入。

优先级与配色一致：**个人偏好 > 站点默认**。管理员可在后台锁定风格，锁定后前台用户无法更改。

---

## 备份与恢复

```bash
# 备份（代码 + 数据库卷）
./deploy/backup.sh

# 恢复
tar xzf pblog-backup-<时间戳>.tar.gz
```

---

## 开源项目与许可

本项目在开发中参考、使用或集成了以下开源项目。在此一并致谢。

### 运行时依赖

| 项目 | 许可 | 用途 |
|---|---|---|
| [React](https://github.com/facebook/react) | MIT | 前台与管理端的 UI 框架 |
| [React Router](https://github.com/remix-run/react-router) | MIT | 前端路由 |
| [Vite](https://github.com/vitejs/vite) | MIT | 构建工具 |
| [Express](https://github.com/expressjs/express) | MIT | 后端 Web 框架 |
| [mysql2](https://github.com/sidorares/node-mysql2) | MIT | MySQL 驱动 |
| [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) | MIT | JWT 签名与校验 |
| [bcrypt.js](https://github.com/dcodeIO/bcrypt.js) | MIT | 密码散列 |
| [nodemailer](https://github.com/nodemailer/nodemailer) | MIT-0 | 邮件发送 |
| [multer](https://github.com/expressjs/multer) | MIT | 文件上传 |
| [sharp](https://github.com/lovell/sharp) | Apache-2.0 | 图片处理与压缩 |
| [sanitize-html](https://github.com/apostrophecms/sanitize-html) | MIT | HTML 净化，防 XSS |
| [slugify](https://github.com/simov/slugify) | MIT | URL slug 生成 |
| [helmet](https://github.com/helmetjs/helmet) | MIT | HTTP 安全响应头 |
| [compression](https://github.com/expressjs/compression) | MIT | 响应压缩 |
| [cors](https://github.com/expressjs/cors) | MIT | 跨域处理 |
| [morgan](https://github.com/expressjs/morgan) | MIT | 请求日志 |
| [dotenv](https://github.com/motdotla/dotenv) | BSD-2-Clause | 环境变量加载 |
| [ba-click-fx](https://github.com/CialloKing/ba-click-fx) | MIT | 点击特效与光标拖尾（蔚蓝档案风格） |

### 设计参考

| 项目 | 说明 |
|---|---|
| [Windows Fluent / Acrylic](https://learn.microsoft.com/windows/apps/design/style/acrylic) | 亚克力材质的视觉规范参考 |
| [Apple Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass) | 液态玻璃材质的设计参考 |
| [Material Design 3](https://m3.material.io/) | Material 风格的色阶与形状体系参考 |
| [View Transitions API](https://developer.mozilla.org/docs/Web/API/View_Transitions_API) | 页面过渡的底层能力（浏览器原生） |

### 第三方服务

| 服务 | 说明 |
|---|---|
| [网易云音乐外链播放器](https://music.163.com/) | 音乐播放器（iframe 外链，不涉及音频抓取） |
| [UAPI](https://uapis.cn/) | 一言 / 壁纸 / 热搜 / 天气等公共接口（需自行申请 Token） |

---

## 许可

本项目代码以 MIT 许可发布，详见 [LICENSE](LICENSE)。

使用到的第三方项目版权归各自作者所有，遵循各自的许可协议。
