import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    devtools(),
    viteReact({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    tailwindcss(),
    nodePolyfills({
      include: ['buffer'],
      globals: { Buffer: true },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true, // Bind to all interfaces for Docker
    port: 5173,
    strictPort: true, // Exit if port is already in use
    allowedHosts: ['.ngrok-free.app', '.ngrok.io'], // Allow all ngrok domains
    watch: {
      usePolling: true, // Enable polling for file changes in Docker
    },
    hmr: {
      clientPort: 5173, // Ensure HMR works through Docker port mapping
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/ai': {
        target: process.env.VITE_AI_AGENT_URL,
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/ai/, ''),
      },
    },
  },
})
