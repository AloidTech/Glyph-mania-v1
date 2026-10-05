import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          tensorflow: ['@tensorflow/tfjs'],
          reactVendor: ['react', 'react-dom', 'react-router-dom'],
          uiIcons: ['@phosphor-icons/react', 'react-icons'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
