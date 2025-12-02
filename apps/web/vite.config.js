import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],

  // ⭐ Vitest 配置
  test: {
    environment: 'jsdom',           // 让 vitest 有 document / window
    globals: true,                  // describe / it / expect 变成全局（可选）
    setupFiles: './src/setupTests.js', // 跑测试前先执行这个文件
  },
})
