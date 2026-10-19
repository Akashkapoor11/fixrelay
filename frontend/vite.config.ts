import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const frontendRoot = fileURLToPath(new URL('.', import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  root: frontendRoot,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve(frontendRoot, '../dist/client'),
    emptyOutDir: true, // always clean stale files from previous builds
    sourcemap: !isProd, // omit sourcemaps from the production bundle
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/mcp': { target: 'http://127.0.0.1:8000', changeOrigin: false },
    },
  },
});
