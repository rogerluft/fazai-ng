# FazAI Web Monitor - Backend

Express.js backend server providing REST API for FazAI infrastructure management integrations.

## Features

- HTTP Basic Authentication
- RESTful API for Cloudflare, SpamExperts, and OPNsense
- Real-time task monitoring with Server-Sent Events (SSE)
- TypeScript with strict mode
- No placeholders or mocks - real integrations only

## Quick Start

### Prerequisites

- Node.js 18+ (ESM support)
- TypeScript 5.x
- Access to `/etc/fazai/fazai.conf`

### Installation

```bash
cd /home/rluft/fazai-ng/web-monitor/backend
npm install
```

### Configuration

Edit `/etc/fazai/fazai.conf`:

```bash
# Web UI Authentication
WEB_UI_USERNAME=admin
WEB_UI_PASSWORD=fazai123

# Server Configuration
WEB_MONITOR_HOSTNAME=localhost
WEB_MONITOR_BACKEND_PORT=3001

# Integration APIs (see API.md for complete list)
CLOUDFLARE_API_KEY=your_key
SPAMEXPERTS_API_KEY=your_key
OPNSENSE_API_URL=https://firewall.example.com
OPNSENSE_API_KEY=your_key
OPNSENSE_API_SECRET=your_secret
```

### Run Development Server

```bash
npm start
```

Server starts at: `http://localhost:3001`

### Build for Production

```bash
npm run build
```

Compiled files are output to `dist/`.

## API Documentation

See [API.md](./API.md) for complete endpoint documentation.

## Architecture

```
Express Server (port 3001)
├── Public Routes (no auth)
│   ├── GET  /api/tasks          # List all tasks
│   ├── GET  /api/tasks/:id      # Get specific task
│   └── GET  /api/tasks/:id/stream  # SSE stream for task updates
│
└── Protected Routes (Basic Auth required)
    └── /api/integrations/*
        ├── /cloudflare/*        # Cloudflare API
        ├── /spamexperts/*       # SpamExperts API
        └── /opnsense/*          # OPNsense API
```

## Dependencies

### Runtime
- `express` - Web framework
- `express-basic-auth` - HTTP Basic Authentication
- `axios` - HTTP client (SpamExperts integration)
- `cors` - Cross-Origin Resource Sharing

### Development
- `typescript` - TypeScript compiler
- `ts-node-dev` - TypeScript execution and reload
- `@types/*` - Type definitions

## Project Structure

```
src/
├── middleware/
│   └── auth.ts              # Authentication middleware
├── routes/
│   ├── index.ts             # Main router aggregator
│   ├── cloudflare.routes.ts # Cloudflare endpoints
│   ├── spamexperts.routes.ts # SpamExperts endpoints
│   └── opnsense.routes.ts   # OPNsense endpoints
├── services/
│   └── jules-monitor.ts     # Task monitoring service
├── config.ts -> ../../src/config.ts  # Config loader (symlink)
└── server.ts                # Express app entry point
```

## Environment

### Development Mode
- Auto-reload on file changes
- Detailed error logging
- CORS enabled for all origins

### Production Mode
- Compiled TypeScript
- Optimized for performance
- Proper error handling

## Testing

### Manual Testing with curl

```bash
# Test public endpoint
curl http://localhost:3001/api/tasks

# Test protected endpoint
curl -u admin:fazai123 http://localhost:3001/api/integrations/cloudflare/zones

# Test health check
curl http://localhost:3001/api/integrations/health
```

### Using HTTPie (more readable)

```bash
# Install: sudo apt install httpie

# Test with auth
http -a admin:fazai123 localhost:3001/api/integrations/cloudflare/zones
```

### Using Postman

1. Import collection from `API.md` examples
2. Configure Authorization → Basic Auth
3. Username: `admin`, Password: `fazai123`

## Security

### Authentication
- HTTP Basic Auth on all `/api/integrations/*` routes
- Credentials stored in `/etc/fazai/fazai.conf`
- Default: `admin` / `fazai123` (change in production!)

### CORS
- Enabled for all origins in development
- Configure appropriately for production

### SSL/TLS
- Backend serves HTTP (port 3001)
- Use reverse proxy (nginx/caddy) for HTTPS in production

## Troubleshooting

### Server won't start

**Problem:** Port 3001 already in use
```bash
# Check what's using the port
sudo lsof -i :3001

# Change port in /etc/fazai/fazai.conf
WEB_MONITOR_BACKEND_PORT=3002
```

### Authentication fails

**Problem:** Wrong credentials
```bash
# Check current config
grep WEB_UI_ /etc/fazai/fazai.conf

# Update credentials
nano /etc/fazai/fazai.conf
```

### Integration returns errors

**Problem:** Missing API keys
```bash
# Check if keys are set
grep CLOUDFLARE_API_KEY /etc/fazai/fazai.conf
grep SPAMEXPERTS_API_KEY /etc/fazai/fazai.conf
grep OPNSENSE_API_URL /etc/fazai/fazai.conf

# Set missing keys
nano /etc/fazai/fazai.conf
```

### TypeScript errors

**Problem:** Type checking fails
```bash
# Check TypeScript version
npm list typescript

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## Development Tips

### Auto-reload
The server uses `ts-node-dev` which automatically reloads on file changes.

### Logging
All routes log errors to console with `[ServiceName]` prefix:
```
[Cloudflare] Error listing zones: API key invalid
[SpamExperts] Error adding domain: Domain already exists
[OPNsense] Error applying firewall: Connection timeout
```

### Adding New Routes

1. Create route file in `src/routes/`:
```typescript
// newservice.routes.ts
import { Router } from 'express';
const router = Router();

router.get('/endpoint', async (req, res) => {
  try {
    // Implementation
    res.json({ success: true, data: result });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
```

2. Add to main router in `src/routes/index.ts`:
```typescript
import newServiceRoutes from './newservice.routes';
router.use('/newservice', newServiceRoutes);
```

3. Document in `API.md`

### Manager Integration

All managers are imported from the main FazAI project:

```typescript
import { CloudflareManager } from '../../../src/cloudflare-manager';
```

**Important:** Managers must be instantiated in each route handler:
```typescript
router.get('/example', async (req, res) => {
  const manager = new CloudflareManager();
  const result = await manager.someMethod();
});
```

## Production Deployment

### Systemd Service

Create `/etc/systemd/system/fazai-backend.service`:

```ini
[Unit]
Description=FazAI Web Monitor Backend
After=network.target

[Service]
Type=simple
User=fazai
WorkingDirectory=/opt/fazai/web-monitor/backend
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable fazai-backend
sudo systemctl start fazai-backend
sudo systemctl status fazai-backend
```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name monitor.example.com;

    ssl_certificate /etc/letsencrypt/live/monitor.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/monitor.example.com/privkey.pem;

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Process Manager (PM2)

```bash
# Install PM2
npm install -g pm2

# Start backend
cd /home/rluft/fazai-ng/web-monitor/backend
pm2 start dist/server.js --name fazai-backend

# Auto-start on boot
pm2 startup
pm2 save

# Monitor
pm2 monit
pm2 logs fazai-backend
```

## License

Part of the FazAI project - see main project LICENSE.

## Support

For issues and questions, refer to:
- [API.md](./API.md) - Complete API documentation
- Main FazAI documentation
- Project CHANGELOG.md
