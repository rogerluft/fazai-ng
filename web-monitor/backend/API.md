# FazAI Web Monitor - Backend API Documentation

## Overview

Backend API for FazAI Web Monitor - provides REST endpoints for managing infrastructure integrations.

- **Base URL**: `http://localhost:3001`
- **Authentication**: HTTP Basic Auth (credentials from `/etc/fazai/fazai.conf`)
- **Default Credentials**: `admin` / `fazai123`

## Authentication

Protected routes require HTTP Basic Authentication:

```bash
# Example with curl
curl -u admin:fazai123 http://localhost:3001/api/integrations/cloudflare/zones
```

### Configuration Keys

Set in `/etc/fazai/fazai.conf`:

```
WEB_UI_USERNAME=admin
WEB_UI_PASSWORD=fazai123
```

## Response Format

All endpoints return JSON with standardized structure:

### Success Response
```json
{
  "success": true,
  "data": { /* result data */ }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message description"
}
```

## HTTP Status Codes

- `200` - Success (GET, DELETE, PATCH operations)
- `201` - Created (POST operations)
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication failed)
- `404` - Not Found
- `500` - Internal Server Error

---

## Public Endpoints (No Auth)

### Health Check
```
GET /api/integrations/health
```

Returns server health status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-12-17T10:30:00.000Z",
    "version": "1.0.0"
  }
}
```

---

## Cloudflare Integration

Base path: `/api/integrations/cloudflare`

### Zones

#### List Zones
```
GET /api/integrations/cloudflare/zones
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "zone-id",
      "name": "example.com",
      "status": "active",
      "account": {
        "id": "account-id",
        "name": "Account Name"
      }
    }
  ]
}
```

### DNS Records

#### List DNS Records
```
GET /api/integrations/cloudflare/zones/:zoneId/dns
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "record-id",
      "type": "A",
      "name": "www.example.com",
      "content": "192.168.1.1",
      "proxied": true,
      "ttl": 1
    }
  ]
}
```

#### Create DNS Record
```
POST /api/integrations/cloudflare/zones/:zoneId/dns
```

**Request Body:**
```json
{
  "type": "A",
  "name": "subdomain.example.com",
  "content": "192.168.1.100",
  "proxied": false,
  "ttl": 3600
}
```

#### Delete DNS Record
```
DELETE /api/integrations/cloudflare/zones/:zoneId/dns/:recordId
```

### Firewall

#### List Firewall Rules
```
GET /api/integrations/cloudflare/zones/:zoneId/firewall
```

### SSL

#### Get SSL Settings
```
GET /api/integrations/cloudflare/zones/:zoneId/ssl
```

#### Update SSL Mode
```
PATCH /api/integrations/cloudflare/zones/:zoneId/ssl
```

**Request Body:**
```json
{
  "mode": "full"
}
```

Valid modes: `off`, `flexible`, `full`, `strict`

### Cache

#### Purge Cache
```
POST /api/integrations/cloudflare/zones/:zoneId/cache/purge
```

**Request Body (purge everything):**
```json
{
  "purge_everything": true
}
```

**Request Body (purge specific files):**
```json
{
  "files": [
    "https://example.com/style.css",
    "https://example.com/script.js"
  ]
}
```

### Analytics

#### Get Analytics
```
GET /api/integrations/cloudflare/zones/:zoneId/analytics?since=-1440
```

Query params:
- `since` - Time in minutes (default: `-1440` for last 24 hours)

---

## SpamExperts Integration

Base path: `/api/integrations/spamexperts`

### Domains

#### List Domains
```
GET /api/integrations/spamexperts/domains
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "domain": "example.com",
      "status": "active",
      "emailsToday": 150,
      "spamBlocked": 45,
      "quarantined": 3,
      "destination": "mail.example.com"
    }
  ]
}
```

#### Add Domain
```
POST /api/integrations/spamexperts/domains
```

**Request Body:**
```json
{
  "domain": "newdomain.com",
  "destination": "mail.newdomain.com"
}
```

#### Remove Domain
```
DELETE /api/integrations/spamexperts/domains/:domain
```

### Quarantine

#### List Quarantine Messages
```
GET /api/integrations/spamexperts/quarantine/:domain?limit=50
```

Query params:
- `limit` - Max messages to return (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "msg-id",
      "date": "2025-12-17T10:30:00Z",
      "from": "sender@example.com",
      "to": "recipient@example.com",
      "subject": "Message subject",
      "score": 8.5
    }
  ]
}
```

#### Release Message
```
POST /api/integrations/spamexperts/quarantine/:messageId/release
```

#### Delete Message
```
DELETE /api/integrations/spamexperts/quarantine/:messageId
```

### Reports

#### Get Report
```
GET /api/integrations/spamexperts/reports/:domain?period=24h
```

Query params:
- `period` - Time period: `24h`, `7d`, `30d` (default: `24h`)

### Lists (Whitelist/Blacklist)

#### List Entries
```
GET /api/integrations/spamexperts/lists/:type
```

`:type` - `whitelist` or `blacklist`

#### Add Entry
```
POST /api/integrations/spamexperts/lists/:type
```

**Request Body:**
```json
{
  "entry": "trusted@example.com"
}
```

#### Remove Entry
```
DELETE /api/integrations/spamexperts/lists/:type/:entry
```

---

## OPNsense Integration

Base path: `/api/integrations/opnsense`

### Firewall

#### List Firewall Rules
```
GET /api/integrations/opnsense/firewall
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "rule-uuid",
      "action": "pass",
      "interface": "wan",
      "protocol": "tcp",
      "source": "any",
      "destination": "192.168.1.100",
      "port": "443",
      "enabled": true
    }
  ]
}
```

#### Add Firewall Rule
```
POST /api/integrations/opnsense/firewall
```

**Request Body:**
```json
{
  "action": "pass",
  "interface": "wan",
  "protocol": "tcp",
  "source": "any",
  "destination": "192.168.1.100",
  "port": "443",
  "enabled": true
}
```

#### Delete Firewall Rule
```
DELETE /api/integrations/opnsense/firewall/:uuid
```

#### Apply Firewall Changes
```
POST /api/integrations/opnsense/firewall/apply
```

**Important:** Changes are not active until applied!

### NAT (Port Forwarding)

#### List NAT Rules
```
GET /api/integrations/opnsense/nat
```

#### Add Port Forward
```
POST /api/integrations/opnsense/nat
```

**Request Body:**
```json
{
  "interface": "wan",
  "protocol": "tcp",
  "externalPort": "8080",
  "internalIP": "192.168.1.100",
  "internalPort": "80",
  "enabled": true
}
```

#### Delete NAT Rule
```
DELETE /api/integrations/opnsense/nat/:uuid
```

#### Apply NAT Changes
```
POST /api/integrations/opnsense/nat/apply
```

### VPN

#### List VPN Tunnels
```
GET /api/integrations/opnsense/vpn
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "ikeid": "vpn-id",
      "descr": "Site-to-Site VPN",
      "remote-gw": "vpn.example.com",
      "status": "connected"
    }
  ]
}
```

#### Connect VPN
```
POST /api/integrations/opnsense/vpn/:ikeid/connect
```

#### Disconnect VPN
```
POST /api/integrations/opnsense/vpn/:ikeid/disconnect
```

### Network

#### List Interfaces
```
GET /api/integrations/opnsense/interfaces
```

#### List DHCP Leases
```
GET /api/integrations/opnsense/dhcp/leases
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "address": "192.168.1.50",
      "mac": "00:11:22:33:44:55",
      "hostname": "device-name",
      "descr": "Device description",
      "status": "active"
    }
  ]
}
```

### System

#### Get System Status
```
GET /api/integrations/opnsense/system/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hostname": "firewall.example.com",
    "product_version": "24.7",
    "cpu_usage": 15.5,
    "mem_usage": 45.2,
    "temp": 38
  }
}
```

---

## Error Handling

All endpoints implement try/catch with standardized error responses:

```json
{
  "success": false,
  "error": "Descriptive error message"
}
```

Common errors:
- **Missing credentials** - Check `/etc/fazai/fazai.conf` for API keys
- **Invalid parameters** - Check request body structure
- **API errors** - Check external service status

---

## Implementation Notes

### Manager Import Paths

All routes import the real managers from the main project:

```typescript
import { CloudflareManager } from '../../../src/cloudflare-manager';
import { SpamExpertsManager } from '../../../src/spamexperts-manager';
import { OPNsenseManager } from '../../../src/opnsense-manager';
```

### No Placeholders

All functionality uses real implementations - no mocks or placeholders.

### TypeScript Strict Mode

- All code uses TypeScript strict mode
- No `any` types allowed
- Proper error handling throughout

### Async/Await Pattern

All async operations use modern async/await syntax with proper error handling.

---

## Development

### Start Server
```bash
cd /home/rluft/fazai-ng/web-monitor/backend
npm start
```

### Build
```bash
npm run build
```

### Test Endpoints
```bash
# Test with curl (protected endpoint)
curl -u admin:fazai123 http://localhost:3001/api/integrations/cloudflare/zones

# Test health check (public)
curl http://localhost:3001/api/integrations/health
```

---

## Configuration Requirements

Ensure `/etc/fazai/fazai.conf` contains:

```bash
# Cloudflare
CLOUDFLARE_API_KEY=your_api_key
CLOUDFLARE_ACCOUNT_ID=your_account_id

# SpamExperts
SPAMEXPERTS_API_KEY=your_api_key
# OR
SPAMEXPERTS_USERNAME=your_username
SPAMEXPERTS_PASSWORD=your_password
SPAMEXPERTS_API_URL=https://api.antispamcloud.com/

# OPNsense
OPNSENSE_API_URL=https://firewall.example.com
OPNSENSE_API_KEY=your_api_key
OPNSENSE_API_SECRET=your_api_secret
OPNSENSE_VERIFY_SSL=true

# Web UI Authentication
WEB_UI_USERNAME=admin
WEB_UI_PASSWORD=fazai123

# Server Configuration
WEB_MONITOR_HOSTNAME=localhost
WEB_MONITOR_BACKEND_PORT=3001
```

---

## Architecture

```
┌─────────────────┐
│   Web Browser   │
└────────┬────────┘
         │ HTTP Basic Auth
         ↓
┌─────────────────┐
│  Express Server │
│   (Port 3001)   │
└────────┬────────┘
         │
    ┌────┴────┐
    │  Auth   │ Middleware
    │  CORS   │
    │  JSON   │
    └────┬────┘
         │
    ┌────┴────┐
    │  Routes │
    └────┬────┘
         │
    ┌────┴───────────────┐
    │                    │
    ↓                    ↓
┌─────────┐      ┌──────────────┐
│ Public  │      │  Protected   │
│ Routes  │      │   Routes     │
│         │      │ (auth req'd) │
│ /tasks  │      │ /integrations│
└─────────┘      └──────┬───────┘
                        │
         ┌──────────────┼──────────────┐
         ↓              ↓               ↓
    ┌─────────┐   ┌──────────┐   ┌──────────┐
    │Cloudflare│  │SpamExperts│  │ OPNsense │
    │ Manager  │  │  Manager   │  │ Manager  │
    └─────────┘   └──────────┘   └──────────┘
```

---

## Files Structure

```
/home/rluft/fazai-ng/web-monitor/backend/
├── src/
│   ├── middleware/
│   │   └── auth.ts           # HTTP Basic Auth
│   ├── routes/
│   │   ├── index.ts          # Main router
│   │   ├── cloudflare.routes.ts
│   │   ├── spamexperts.routes.ts
│   │   └── opnsense.routes.ts
│   ├── services/
│   │   └── jules-monitor.ts  # Task monitoring
│   ├── config.ts -> ../../src/config.ts
│   └── server.ts             # Express app
├── package.json
└── API.md                    # This file
```
