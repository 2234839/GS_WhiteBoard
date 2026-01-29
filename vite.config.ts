import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

/**
 * GitHub Pages 部署配置
 * 使用完整的仓库名路径确保资源正确加载
 */
export default defineConfig({
  plugins: [vue(), vueDevTools()],
  base: '/GS_WhiteBoard/',
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    open: false,
    allowedHosts: true
  }
})
