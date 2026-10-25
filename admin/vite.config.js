import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// 与前台、后端共用同一份 PBLOG.json
const pblog = require('../config/index.js');

export default defineConfig(({ mode }) => {
  const cfg = pblog.load();
  const service = pblog.publicConfig();

  return {
    plugins: [
      react(),
      {
        name: 'pblog-config',
        transformIndexHtml(html) {
          const inject = `<script>window.__PBLOG__=${JSON.stringify(service).replace(/</g, '\\u003c')}</script>`;
          return html.replace('</head>', `${inject}</head>`);
        },
      },
    ],
    define: {
      __PBLOG_CONFIG__: JSON.stringify(service),
    },
    base: '/admin/',
    server: {
      port: 5174,
      host: true,
      proxy: {
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
          manualChunks: { vendor: ['react', 'react-dom', 'react-router-dom'] },
        },
      },
    },
  };
});
