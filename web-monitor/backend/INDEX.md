# FazAI Web Monitor - Backend Documentation Index

Complete documentation for the FazAI Web Monitor backend API server.

---

## Quick Start

```bash
# 1. Install dependencies
cd /home/rluft/fazai-ng/web-monitor/backend
npm install

# 2. Configure (if needed)
sudo nano /etc/fazai/fazai.conf

# 3. Start server
npm start

# 4. Test
curl http://localhost:3001/api/integrations/health
```

---

## Documentation Files

### 📘 [README.md](./README.md)
**Start here for basic usage**

- Quick start guide
- Installation instructions
- Configuration guide
- Development setup
- Production deployment
- Troubleshooting

**Read this if**: You're setting up the backend for the first time.

---

### 📗 [API.md](./API.md)
**Complete API reference**

- All endpoint definitions
- Request/response formats
- Authentication details
- Error codes
- Configuration requirements
- Example requests

**Read this if**: You need to understand or integrate with specific API endpoints.

---

### 📙 [ARCHITECTURE.md](./ARCHITECTURE.md)
**System design and architecture**

- System overview diagrams
- Request flow
- Component responsibilities
- Data flow layers
- File structure
- Security considerations
- Performance characteristics

**Read this if**: You want to understand how the system works internally.

---

### 📕 [IMPLEMENTATION.md](./IMPLEMENTATION.md)
**Technical implementation details**

- Files created/modified
- Patterns implemented
- Integration with managers
- TypeScript compliance
- Security measures
- Next steps

**Read this if**: You're reviewing the implementation or making changes.

---

### 📓 [EXAMPLES.md](./EXAMPLES.md)
**Practical usage examples**

- curl examples
- JavaScript/TypeScript integration
- React components
- Error handling
- Testing workflows
- Script examples (Bash, Python)

**Read this if**: You want copy-paste examples for common operations.

---

## What's Implemented

### Core Features
- ✅ HTTP Basic Authentication
- ✅ RESTful API design
- ✅ 33 endpoints across 3 integrations
- ✅ Real-time task monitoring (SSE)
- ✅ TypeScript strict mode
- ✅ Standardized response format
- ✅ Comprehensive error handling

### Integrations
- ✅ **Cloudflare** - 9 endpoints (zones, DNS, firewall, SSL, cache, analytics)
- ✅ **SpamExperts** - 10 endpoints (domains, quarantine, reports, lists)
- ✅ **OPNsense** - 13 endpoints (firewall, NAT, VPN, network, system)

### Documentation
- ✅ API reference
- ✅ Architecture diagrams
- ✅ Usage examples
- ✅ Deployment guide
- ✅ Troubleshooting

---

## Key Concepts

### Authentication
```bash
# All /api/integrations/* routes require HTTP Basic Auth
curl -u admin:fazai123 http://localhost:3001/api/integrations/cloudflare/zones
```

Credentials stored in `/etc/fazai/fazai.conf`:
```
WEB_UI_USERNAME=admin
WEB_UI_PASSWORD=fazai123
```

### Response Format
All endpoints return JSON with consistent structure:

**Success:**
```json
{
  "success": true,
  "data": { /* actual data */ }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message"
}
```

### Manager Integration
Routes import and use real managers from the main FazAI project:

```typescript
import { CloudflareManager } from '../../../src/cloudflare-manager';

const manager = new CloudflareManager();
const zones = await manager.listZones();
```

**No placeholders. No mocks. Real implementations only.**

---

## File Structure

```
backend/
├── src/
│   ├── middleware/
│   │   └── auth.ts              # HTTP Basic Auth
│   ├── routes/
│   │   ├── index.ts             # Main router
│   │   ├── cloudflare.routes.ts
│   │   ├── spamexperts.routes.ts
│   │   └── opnsense.routes.ts
│   ├── services/
│   │   └── jules-monitor.ts     # Task monitoring
│   ├── config.ts                # Symlink to ../../src/config.ts
│   └── server.ts                # Express app
│
├── Documentation/
│   ├── INDEX.md                 # This file
│   ├── README.md                # Usage guide
│   ├── API.md                   # API reference
│   ├── ARCHITECTURE.md          # System design
│   ├── IMPLEMENTATION.md        # Technical details
│   └── EXAMPLES.md              # Code examples
│
├── package.json
└── tsconfig.json
```

---

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express 5.x
- **Language**: TypeScript (strict mode)
- **Auth**: express-basic-auth
- **HTTP Client**: Axios (for SpamExperts)
- **Build**: TypeScript compiler + ts-node-dev

---

## Configuration

All configuration comes from `/etc/fazai/fazai.conf`:

```bash
# Server
WEB_MONITOR_HOSTNAME=localhost
WEB_MONITOR_BACKEND_PORT=3001

# Authentication
WEB_UI_USERNAME=admin
WEB_UI_PASSWORD=fazai123

# Cloudflare
CLOUDFLARE_API_KEY=your_key
CLOUDFLARE_ACCOUNT_ID=your_account_id

# SpamExperts
SPAMEXPERTS_API_KEY=your_key
SPAMEXPERTS_API_URL=https://api.antispamcloud.com/

# OPNsense
OPNSENSE_API_URL=https://firewall.example.com
OPNSENSE_API_KEY=your_key
OPNSENSE_API_SECRET=your_secret
OPNSENSE_VERIFY_SSL=true
```

---

## Common Tasks

### Start Development Server
```bash
cd /home/rluft/fazai-ng/web-monitor/backend
npm start
```

Server runs at: `http://localhost:3001`

### Test Endpoint
```bash
# Health check (public)
curl http://localhost:3001/api/integrations/health

# Cloudflare zones (protected)
curl -u admin:fazai123 http://localhost:3001/api/integrations/cloudflare/zones
```

### Build for Production
```bash
npm run build
```

Output: `dist/`

### View Logs
```bash
# Server logs to stdout
npm start

# Or with systemd
sudo journalctl -u fazai-backend -f

# Or with PM2
pm2 logs fazai-backend
```

---

## API Endpoints Summary

### Public (No Auth)
- `GET /api/integrations/health` - Health check
- `GET /api/tasks` - List tasks
- `GET /api/tasks/:id` - Get task
- `GET /api/tasks/:id/stream` - Stream task updates (SSE)

### Cloudflare (Auth Required)
- `GET /cloudflare/zones` - List zones
- `GET /cloudflare/zones/:id/dns` - List DNS records
- `POST /cloudflare/zones/:id/dns` - Create DNS record
- `DELETE /cloudflare/zones/:id/dns/:recordId` - Delete DNS record
- `GET /cloudflare/zones/:id/firewall` - List firewall rules
- `GET /cloudflare/zones/:id/ssl` - Get SSL settings
- `PATCH /cloudflare/zones/:id/ssl` - Update SSL mode
- `POST /cloudflare/zones/:id/cache/purge` - Purge cache
- `GET /cloudflare/zones/:id/analytics` - Get analytics

### SpamExperts (Auth Required)
- `GET /spamexperts/domains` - List domains
- `POST /spamexperts/domains` - Add domain
- `DELETE /spamexperts/domains/:domain` - Remove domain
- `GET /spamexperts/quarantine/:domain` - List quarantine
- `POST /spamexperts/quarantine/:id/release` - Release message
- `DELETE /spamexperts/quarantine/:id` - Delete message
- `GET /spamexperts/reports/:domain` - Get report
- `GET /spamexperts/lists/:type` - List entries
- `POST /spamexperts/lists/:type` - Add entry
- `DELETE /spamexperts/lists/:type/:entry` - Remove entry

### OPNsense (Auth Required)
- `GET /opnsense/firewall` - List firewall rules
- `POST /opnsense/firewall` - Add firewall rule
- `DELETE /opnsense/firewall/:uuid` - Delete firewall rule
- `POST /opnsense/firewall/apply` - Apply firewall changes
- `GET /opnsense/nat` - List NAT rules
- `POST /opnsense/nat` - Add port forward
- `DELETE /opnsense/nat/:uuid` - Delete NAT rule
- `POST /opnsense/nat/apply` - Apply NAT changes
- `GET /opnsense/vpn` - List VPN tunnels
- `POST /opnsense/vpn/:id/connect` - Connect VPN
- `POST /opnsense/vpn/:id/disconnect` - Disconnect VPN
- `GET /opnsense/interfaces` - List interfaces
- `GET /opnsense/dhcp/leases` - List DHCP leases
- `GET /opnsense/system/status` - Get system status

---

## Troubleshooting

### Server won't start
```bash
# Check if port is in use
sudo lsof -i :3001

# Check config file
cat /etc/fazai/fazai.conf | grep WEB_MONITOR

# Check logs
npm start
```

### Authentication fails
```bash
# Verify credentials
grep WEB_UI /etc/fazai/fazai.conf

# Test with default credentials
curl -u admin:fazai123 http://localhost:3001/api/integrations/health
```

### API returns errors
```bash
# Check if external API credentials are set
grep CLOUDFLARE_API_KEY /etc/fazai/fazai.conf
grep SPAMEXPERTS_API_KEY /etc/fazai/fazai.conf
grep OPNSENSE_API_URL /etc/fazai/fazai.conf

# Test external API directly (if possible)
# Check server logs for detailed error messages
```

---

## Resources

### Internal Documentation
- [README.md](./README.md) - Setup and usage
- [API.md](./API.md) - API reference
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [IMPLEMENTATION.md](./IMPLEMENTATION.md) - Technical details
- [EXAMPLES.md](./EXAMPLES.md) - Code examples

### External Resources
- Express.js: https://expressjs.com/
- TypeScript: https://www.typescriptlang.org/
- Cloudflare API: https://developers.cloudflare.com/api/
- OPNsense API: https://docs.opnsense.org/development/api.html

### Main Project
- FazAI project root: `/home/rluft/fazai-ng/`
- Managers: `/home/rluft/fazai-ng/src/*-manager.ts`
- Config: `/home/rluft/fazai-ng/src/config.ts`

---

## Development Workflow

1. **Read** [README.md](./README.md) for setup
2. **Configure** `/etc/fazai/fazai.conf`
3. **Start** development server: `npm start`
4. **Test** with curl or Postman
5. **Reference** [API.md](./API.md) for endpoints
6. **Copy** examples from [EXAMPLES.md](./EXAMPLES.md)
7. **Understand** architecture from [ARCHITECTURE.md](./ARCHITECTURE.md)
8. **Review** implementation in [IMPLEMENTATION.md](./IMPLEMENTATION.md)

---

## Next Steps

### For Development
1. Install dependencies: `npm install`
2. Start server: `npm start`
3. Test endpoints: See [EXAMPLES.md](./EXAMPLES.md)

### For Production
1. Build: `npm run build`
2. Configure systemd service
3. Setup reverse proxy (nginx)
4. Enable SSL/TLS
5. Monitor logs

### For Integration
1. Read [API.md](./API.md) for endpoint details
2. Copy examples from [EXAMPLES.md](./EXAMPLES.md)
3. Implement error handling
4. Test thoroughly

---

## Status

**Implementation**: ✅ Complete
**Documentation**: ✅ Complete
**Testing**: ⏳ Manual testing required
**Deployment**: ⏳ Not yet deployed

**Ready for**: Development and testing

---

## Support

For questions or issues:
1. Check relevant documentation file
2. Review [EXAMPLES.md](./EXAMPLES.md) for similar use cases
3. Check main FazAI project documentation
4. Review CHANGELOG.md in main project

---

## License

Part of the FazAI project. See main project LICENSE.

---

**Last Updated**: 2025-12-17
**Version**: 1.0.0
**Author**: Claude Code (Backend Architect)
