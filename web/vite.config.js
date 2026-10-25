import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// 统一配置文件（与后端、管理端共用同一个 PBLOG.json）
const pblog = require('../config/index.js');

export default defineConfig(({ mode }) => {
  const cfg = pblog.load();
  const publicCfg = pblog.publicConfig();

  return {
    plugins: [
      react(),
      {
        // 把公开配置注入前端，构建后可独立于后端运行
        name: 'pblog-config',
        transformIndexHtml(html) {
          const inject = `<script>window.__PBLOG__=${JSON.stringify(publicCfg).replace(/</g, '\\u003c')}</script>`;
          const theme = publicCfg.sites.theme || {};
          const initial = `<script>(function(){try{var t=localStorage.getItem('pblog.theme')||${JSON.stringify(theme.mode || 'dark')};document.documentElement.dataset.theme=t;var a=localStorage.getItem('pblog.accent');if(a)document.documentElement.style.setProperty('--accent',a);}catch(e){}})();</script>`;
          return html.replace('</head>', `${inject}${initial}</head>`);
        },
      },
    ],
    define: {
      __PBLOG_CONFIG__: JSON.stringify(publicCfg),
      __PBLOG_BUILD_MODE__: JSON.stringify(mode),
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        // 开发环境把 /api 与 /uploads 代理到后端，避免跨域
        '/api': { target: cfg.backend.publicUrl, changeOrigin: true },
        '/uploads': { target: cfg.backend.publicUrl, changeOrigin: true },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
    },
  };
});
