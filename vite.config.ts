import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

/**
 * GitHub Pages 部署配置
 * 使用相对路径 './' 以适应不同的部署环境
 */
export default defineConfig({
  plugins: [vue(), vueDevTools()],
  base: './',
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
