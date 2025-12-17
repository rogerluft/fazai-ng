import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

// Load hostname from config
function getHostname(): string {
  try {
    const config = readFileSync('/etc/fazai/fazai.conf', 'utf-8');
    const match = config.match(/^WEB_MONITOR_HOSTNAME=(.+)$/m);
    return match ? match[1].trim() : 'localhost';
  } catch {
    return 'localhost';
  }
}

const hostname = getHostname();

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 8080,
    strictPort: false,
    cors: {
      origin: [
        'http://localhost:8080',
        'http://127.0.0.1:8080',
        `http://${hostname}:8080`,
        `http://${hostname}.local:8080`,
      ],
      credentials: true,
    },
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      hostname,
      `${hostname}.local`,
      'walker.local',
      'walker.storageweb',
    ],
  },
})
