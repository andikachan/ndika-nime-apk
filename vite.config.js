import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'https://elainawanggy.vercel.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/ndikagantengtobrutbanget': {
        target: 'https://api.ndikacunk.my.id',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ndikagantengtobrutbanget/, ''),
      }
    }
  }
})