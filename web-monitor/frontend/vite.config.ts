import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow access from any hostname
    port: 8080,
    strictPort: false,
    cors: true,
    allowedHosts: ['all'], // Allow all hostnames (walker.local, walker.storageweb, etc)
  },
})
