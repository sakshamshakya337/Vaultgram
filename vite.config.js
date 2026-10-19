import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'virtual-pwa-fallback',
      resolveId(id) {
        if (id === 'virtual:pwa-register') return '\0virtual:pwa-register';
      },
      load(id) {
        if (id === '\0virtual:pwa-register') {
          return 'export function registerSW() { return () => {}; }';
        }
      },
    },
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/stream': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
