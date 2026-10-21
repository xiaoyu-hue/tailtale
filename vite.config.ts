import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';

// 版本号单点管理：package.json 的 version 是唯一来源，构建时注入为全局常量
// __APP_VERSION__（应用内版本脚注等运行时展示用）。发版只改 package.json 一处，
// 杜绝「代码里六处手改版本号、漏改一处」的旧模式（见 docs/书时-版本管理规范.md 第 3 节）。
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-512-maskable.png'],
      manifest: {
        name: '书时 TailTale',
        short_name: '书时',
        description: '游戏化阅读器 + 轻量工具箱：读书记时长金币，金币养宠物',
        theme_color: '#e07b39',
        background_color: '#faf6ef',
        display: 'standalone',
        start_url: '/',
        lang: 'zh-CN',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
