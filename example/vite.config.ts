import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'hyprliquid-bridge-widget': '../dist/index.js',
    },
  },
});
