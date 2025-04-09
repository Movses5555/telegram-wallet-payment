import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
      }
    })
  ],
  define: {
    'process.env': {}
  },
  server: {
    host: true,       
    allowedHosts: 'all',
    port: 5173,       
  },
})
