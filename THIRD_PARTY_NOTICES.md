# 第三方项目声明

PBLOG 使用了以下开源软件。各项目的版权归其各自作者所有，
并遵循各自的开源许可协议。本文件用于遵守这些协议中的署名要求。

如果你是本项目所依赖的某个项目的作者，并认为这里的署名方式不妥，请联系我修正。

---

## 一、运行时依赖

### 后端（server/）

| 项目 | 版本 | 许可 | 用途 |
|---|---|---|---|
| [express](https://github.com/expressjs/express) | ^4.19.2 | MIT | Web 框架 |
| [mysql2](https://github.com/sidorares/node-mysql2) | ^3.11.3 | MIT | MySQL 驱动 |
| [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) | ^9.0.2 | MIT | JWT 签发与验证 |
| [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | ^2.4.3 | MIT | 密码散列 |
| [nodemailer](https://github.com/nodemailer/nodemailer) | ^6.9.15 | MIT-0 | SMTP 邮件发送 |
| [multer](https://github.com/expressjs/multer) | ^1.4.5-lts.1 | MIT | multipart 文件上传 |
| [sharp](https://github.com/lovell/sharp) | ^0.33.5 | Apache-2.0 | 图片缩放 / 转码 |
| [sanitize-html](https://github.com/apostrophecms/sanitize-html) | ^2.13.1 | MIT | HTML 净化（防 XSS） |
| [slugify](https://github.com/simov/slugify) | ^1.6.6 | MIT | URL slug 生成 |
| [helmet](https://github.com/helmetjs/helmet) | ^7.1.0 | MIT | HTTP 安全响应头 |
| [compression](https://github.com/expressjs/compression) | ^1.7.4 | MIT | gzip 响应压缩 |
| [cors](https://github.com/expressjs/cors) | ^2.8.5 | MIT | 跨域资源共享 |
| [morgan](https://github.com/expressjs/morgan) | ^1.10.0 | MIT | HTTP 请求日志 |
| [dotenv](https://github.com/motdotla/dotenv) | ^16.4.5 | BSD-2-Clause | .env 加载 |

### 前台（web/）

| 项目 | 版本 | 许可 | 用途 |
|---|---|---|---|
| [react](https://github.com/facebook/react) | ^18.3.1 | MIT | UI 框架 |
| [react-dom](https://github.com/facebook/react) | ^18.3.1 | MIT | DOM 渲染 |
| [react-router-dom](https://github.com/remix-run/react-router) | ^6.30.6 | MIT | 路由 |
| [vite](https://github.com/vitejs/vite) | ^5 | MIT | 构建工具 |
| [ba-click-fx](https://github.com/CialloKing/ba-click-fx) | ^1.3.15 | MIT | 点击特效与光标拖尾 |

### 管理端（admin/）

| 项目 | 版本 | 许可 | 用途 |
|---|---|---|---|
| [react](https://github.com/facebook/react) | ^18.3.1 | MIT | UI 框架 |
| [react-dom](https://github.com/facebook/react) | ^18.3.1 | MIT | DOM 渲染 |
| [react-router-dom](https://github.com/remix-run/react-router) | ^6.26.2 | MIT | 路由 |
| [vite](https://github.com/vitejs/vite) | ^5 | MIT | 构建工具 |

---

## 二、特别说明：ba-click-fx

点击特效（`web/src/components/effects/ClickEffect.jsx`）基于
[CialloKing/ba-click-fx](https://github.com/CialloKing/ba-click-fx) 实现。

- 许可：MIT
- 使用方式：npm 依赖 `ba-click-fx@^1.3.15`，在用户浏览器端按需动态加载
- 本项目对该库的用法：仅调用其公开 API（`new BAClickFX(options)`、`setThemeColor`、
  `setPaused`、`clear`、`destroy`），未修改库源码
- 不涉及该项目的游戏素材再分发：素材由 npm 包本身携带，本项目不分发其图像资源

该项目的默认参数来自游戏《蔚蓝档案》的 Unity 资源。相关角色、素材版权归
NEXON Games / Yostar 所有，本项目仅通过上述开源库间接使用，不主张任何相关权利。

---

## 三、设计规范参考

以下为**视觉与交互设计上的参考**，本项目未复制其代码或资源：

| 规范 | 归属 | 参考内容 |
|---|---|---|
| [Windows Fluent Design — Acrylic](https://learn.microsoft.com/windows/apps/design/style/acrylic) | Microsoft | 亚克力材质的模糊、噪点、受光边处理 |
| [Apple Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass) | Apple | 液态玻璃的通透感、高光、大圆角 |
| [Material Design 3](https://m3.material.io/) | Google | 色阶分层（surface container）、形状体系 |
| [View Transitions API](https://developer.mozilla.org/docs/Web/API/View_Transitions_API) | W3C / MDN | 页面过渡（浏览器原生能力） |

上述名称与规范的所有权归各自公司所有，本项目仅在技术描述中引用，
不代表任何形式的隶属、赞助或背书关系。

---

## 四、第三方服务

以下为**可选的运行时第三方服务**，需使用者自行申请凭据：

| 服务 | 用途 | 说明 |
|---|---|---|
| [网易云音乐外链播放器](https://music.163.com/) | 音乐播放 | 通过官方 iframe 外链嵌入，不抓取音频流 |
| [UAPI](https://uapis.cn/) | 一言 / 每日壁纸 / 热搜 / 天气 | 公共 API 平台，需自行注册获取 Token |
| 任意 SMTP 服务 | 邮箱验证、通知 | 在管理端「邮件设置」中配置 |

启用这些服务时，请遵守对应服务的使用条款。

---

## 五、字体

本项目**不打包分发任何字体文件**。

默认字体栈使用系统字体与以下字体名（若用户设备已安装则生效，否则回退系统字体）：

- Inter — SIL Open Font License 1.1
- Noto Sans SC — SIL Open Font License 1.1
- JetBrains Mono — SIL Open Font License 1.1

`index.html` 中仅有一条指向 `fonts.googleapis.com` 的 `preconnect` 资源提示（用于缩短
潜在的外部字体请求的握手时间），**不实际加载任何外部字体文件**。页面渲染完全依赖
用户设备上已安装的字体，缺失时依次回退到系统字体。
