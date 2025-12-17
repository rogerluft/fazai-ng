# API Usage Examples - FazAI Web Monitor Backend

Quick reference with practical examples for testing and integrating with the backend API.

---

## Prerequisites

```bash
# Backend should be running
cd /home/rluft/fazai-ng/web-monitor/backend
npm start
```

Default credentials: `admin` / `fazai123`

---

## Tools

### 1. curl (available everywhere)
```bash
# Basic usage
curl -u admin:fazai123 http://localhost:3001/api/integrations/cloudflare/zones
```

### 2. httpie (more readable)
```bash
# Install: sudo apt install httpie
http -a admin:fazai123 localhost:3001/api/integrations/cloudflare/zones
```

### 3. JavaScript/TypeScript (Fetch)
```typescript
const response = await fetch('http://localhost:3001/api/integrations/cloudflare/zones', {
  headers: {
    'Authorization': 'Basic ' + btoa('admin:fazai123')
  }
});
const data = await response.json();
```

### 4. Axios
```typescript
import axios from 'axios';
const api = axios.create({
  baseURL: 'http://localhost:3001/api/integrations',
  auth: { username: 'admin', password: 'fazai123' }
});
const { data } = await api.get('/cloudflare/zones');
```

---

## General Patterns

### Success Response
```json
{
  "success": true,
  "data": { /* actual data */ }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error description"
}
```

### Check for Success
```typescript
if (response.success) {
  console.log(response.data);
} else {
  console.error(response.error);
}
```

---

## Cloudflare Examples

### List All Zones
```bash
curl -u admin:fazai123 \
  http://localhost:3001/api/integrations/cloudflare/zones
```

```typescript
const { data } = await api.get('/cloudflare/zones');
console.log('Zones:', data.data);
```

### Get DNS Records for Zone
```bash
ZONE_ID="your-zone-id"
curl -u admin:fazai123 \
  "http://localhost:3001/api/integrations/cloudflare/zones/${ZONE_ID}/dns"
```

### Create DNS Record
```bash
curl -u admin:fazai123 \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "type": "A",
    "name": "subdomain.example.com",
    "content": "192.168.1.100",
    "proxied": false,
    "ttl": 3600
  }' \
  "http://localhost:3001/api/integrations/cloudflare/zones/${ZONE_ID}/dns"
```

```typescript
await api.post(`/cloudflare/zones/${zoneId}/dns`, {
  type: 'A',
  name: 'subdomain.example.com',
  content: '192.168.1.100',
  proxied: false,
  ttl: 3600
});
```

### Delete DNS Record
```bash
curl -u admin:fazai123 \
  -X DELETE \
  "http://localhost:3001/api/integrations/cloudflare/zones/${ZONE_ID}/dns/${RECORD_ID}"
```

### Get SSL Settings
```bash
curl -u admin:fazai123 \
  "http://localhost:3001/api/integrations/cloudflare/zones/${ZONE_ID}/ssl"
```

### Update SSL Mode
```bash
curl -u admin:fazai123 \
  -X PATCH \
  -H "Content-Type: application/json" \
  -d '{"mode": "full"}' \
  "http://localhost:3001/api/integrations/cloudflare/zones/${ZONE_ID}/ssl"
```

### Purge Cache (Everything)
```bash
curl -u admin:fazai123 \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"purge_everything": true}' \
  "http://localhost:3001/api/integrations/cloudflare/zones/${ZONE_ID}/cache/purge"
```

### Purge Specific Files
```bash
curl -u admin:fazai123 \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      "https://example.com/style.css",
      "https://example.com/script.js"
    ]
  }' \
  "http://localhost:3001/api/integrations/cloudflare/zones/${ZONE_ID}/cache/purge"
```

### Get Analytics (Last 24h)
```bash
curl -u admin:fazai123 \
  "http://localhost:3001/api/integrations/cloudflare/zones/${ZONE_ID}/analytics?since=-1440"
```

---

## SpamExperts Examples

### List Domains
```bash
curl -u admin:fazai123 \
  http://localhost:3001/api/integrations/spamexperts/domains
```

```typescript
const { data } = await api.get('/spamexperts/domains');
console.log('Domains:', data.data);
```

### Add Domain
```bash
curl -u admin:fazai123 \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "newdomain.com",
    "destination": "mail.newdomain.com"
  }' \
  http://localhost:3001/api/integrations/spamexperts/domains
```

```typescript
await api.post('/spamexperts/domains', {
  domain: 'newdomain.com',
  destination: 'mail.newdomain.com'
});
```

### Remove Domain
```bash
curl -u admin:fazai123 \
  -X DELETE \
  http://localhost:3001/api/integrations/spamexperts/domains/example.com
```

### List Quarantine Messages
```bash
curl -u admin:fazai123 \
  "http://localhost:3001/api/integrations/spamexperts/quarantine/example.com?limit=50"
```

### Release Message from Quarantine
```bash
MESSAGE_ID="msg-id-here"
curl -u admin:fazai123 \
  -X POST \
  "http://localhost:3001/api/integrations/spamexperts/quarantine/${MESSAGE_ID}/release"
```

### Delete Message from Quarantine
```bash
curl -u admin:fazai123 \
  -X DELETE \
  "http://localhost:3001/api/integrations/spamexperts/quarantine/${MESSAGE_ID}"
```

### Get Report (24h)
```bash
curl -u admin:fazai123 \
  "http://localhost:3001/api/integrations/spamexperts/reports/example.com?period=24h"
```

### Get Report (7 days)
```bash
curl -u admin:fazai123 \
  "http://localhost:3001/api/integrations/spamexperts/reports/example.com?period=7d"
```

### List Whitelist
```bash
curl -u admin:fazai123 \
  http://localhost:3001/api/integrations/spamexperts/lists/whitelist
```

### Add to Whitelist
```bash
curl -u admin:fazai123 \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"entry": "trusted@example.com"}' \
  http://localhost:3001/api/integrations/spamexperts/lists/whitelist
```

### Remove from Whitelist
```bash
curl -u admin:fazai123 \
  -X DELETE \
  http://localhost:3001/api/integrations/spamexperts/lists/whitelist/trusted@example.com
```

### List Blacklist
```bash
curl -u admin:fazai123 \
  http://localhost:3001/api/integrations/spamexperts/lists/blacklist
```

### Add to Blacklist
```bash
curl -u admin:fazai123 \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"entry": "spam@example.com"}' \
  http://localhost:3001/api/integrations/spamexperts/lists/blacklist
```

---

## OPNsense Examples

### List Firewall Rules
```bash
curl -u admin:fazai123 \
  http://localhost:3001/api/integrations/opnsense/firewall
```

```typescript
const { data } = await api.get('/opnsense/firewall');
console.log('Firewall Rules:', data.data);
```

### Add Firewall Rule
```bash
curl -u admin:fazai123 \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "action": "pass",
    "interface": "wan",
    "protocol": "tcp",
    "source": "any",
    "destination": "192.168.1.100",
    "port": "443",
    "enabled": true
  }' \
  http://localhost:3001/api/integrations/opnsense/firewall
```

```typescript
await api.post('/opnsense/firewall', {
  action: 'pass',
  interface: 'wan',
  protocol: 'tcp',
  source: 'any',
  destination: '192.168.1.100',
  port: '443',
  enabled: true
});
```

### Delete Firewall Rule
```bash
RULE_UUID="rule-uuid-here"
curl -u admin:fazai123 \
  -X DELETE \
  "http://localhost:3001/api/integrations/opnsense/firewall/${RULE_UUID}"
```

### Apply Firewall Changes
```bash
curl -u admin:fazai123 \
  -X POST \
  http://localhost:3001/api/integrations/opnsense/firewall/apply
```

### List NAT Rules
```bash
curl -u admin:fazai123 \
  http://localhost:3001/api/integrations/opnsense/nat
```

### Add Port Forward
```bash
curl -u admin:fazai123 \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "interface": "wan",
    "protocol": "tcp",
    "externalPort": "8080",
    "internalIP": "192.168.1.100",
    "internalPort": "80",
    "enabled": true
  }' \
  http://localhost:3001/api/integrations/opnsense/nat
```

### Delete NAT Rule
```bash
NAT_UUID="nat-uuid-here"
curl -u admin:fazai123 \
  -X DELETE \
  "http://localhost:3001/api/integrations/opnsense/nat/${NAT_UUID}"
```

### Apply NAT Changes
```bash
curl -u admin:fazai123 \
  -X POST \
  http://localhost:3001/api/integrations/opnsense/nat/apply
```

### List VPN Tunnels
```bash
curl -u admin:fazai123 \
  http://localhost:3001/api/integrations/opnsense/vpn
```

### Connect VPN Tunnel
```bash
VPN_ID="vpn-ikeid-here"
curl -u admin:fazai123 \
  -X POST \
  "http://localhost:3001/api/integrations/opnsense/vpn/${VPN_ID}/connect"
```

### Disconnect VPN Tunnel
```bash
curl -u admin:fazai123 \
  -X POST \
  "http://localhost:3001/api/integrations/opnsense/vpn/${VPN_ID}/disconnect"
```

### List Network Interfaces
```bash
curl -u admin:fazai123 \
  http://localhost:3001/api/integrations/opnsense/interfaces
```

### List DHCP Leases
```bash
curl -u admin:fazai123 \
  http://localhost:3001/api/integrations/opnsense/dhcp/leases
```

### Get System Status
```bash
curl -u admin:fazai123 \
  http://localhost:3001/api/integrations/opnsense/system/status
```

---

## Public Endpoints (No Auth)

### Health Check
```bash
curl http://localhost:3001/api/integrations/health
```

Response:
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

### List Tasks (Jules Monitor)
```bash
curl http://localhost:3001/api/tasks
```

### Get Specific Task
```bash
TASK_ID="task-id-here"
curl "http://localhost:3001/api/tasks/${TASK_ID}"
```

### Stream Task Updates (SSE)
```bash
curl -N "http://localhost:3001/api/tasks/${TASK_ID}/stream"
```

---

## Frontend Integration Examples

### React Component Example

```typescript
import { useState, useEffect } from 'react';
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api/integrations',
  auth: {
    username: 'admin',
    password: 'fazai123'
  }
});

function CloudflareZones() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchZones() {
      try {
        const { data } = await api.get('/cloudflare/zones');
        if (data.success) {
          setZones(data.data);
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchZones();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <ul>
      {zones.map(zone => (
        <li key={zone.id}>{zone.name}</li>
      ))}
    </ul>
  );
}
```

### Custom API Hook

```typescript
import { useState, useCallback } from 'react';
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api/integrations',
  auth: {
    username: 'admin',
    password: 'fazai123'
  }
});

function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (method, endpoint, data = null) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.request({
        method,
        url: endpoint,
        data
      });
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.error);
      }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { request, loading, error };
}

// Usage
function MyComponent() {
  const { request, loading, error } = useApi();

  async function handleAction() {
    const zones = await request('GET', '/cloudflare/zones');
    console.log(zones);
  }

  return (
    <button onClick={handleAction} disabled={loading}>
      {loading ? 'Loading...' : 'Fetch Zones'}
    </button>
  );
}
```

### Server-Sent Events (SSE) Example

```typescript
function TaskMonitor({ taskId }) {
  const [task, setTask] = useState(null);

  useEffect(() => {
    const eventSource = new EventSource(
      `http://localhost:3001/api/tasks/${taskId}/stream`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'initial' || data.type === 'update') {
        setTask(data.payload);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [taskId]);

  if (!task) return <div>Connecting...</div>;

  return (
    <div>
      <h2>Task: {task.id}</h2>
      <p>Status: {task.status}</p>
      <pre>{JSON.stringify(task, null, 2)}</pre>
    </div>
  );
}
```

---

## Error Handling Examples

### Check for API Errors

```typescript
async function callApi() {
  try {
    const response = await fetch('http://localhost:3001/api/integrations/cloudflare/zones', {
      headers: {
        'Authorization': 'Basic ' + btoa('admin:fazai123')
      }
    });

    const data = await response.json();

    if (!response.ok) {
      // HTTP error (401, 500, etc.)
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    if (!data.success) {
      // API error (returned success: false)
      throw new Error(data.error);
    }

    // Success
    return data.data;
  } catch (error) {
    console.error('API call failed:', error.message);
    throw error;
  }
}
```

### With Axios (Simpler)

```typescript
async function callApi() {
  try {
    const { data } = await api.get('/cloudflare/zones');

    if (!data.success) {
      throw new Error(data.error);
    }

    return data.data;
  } catch (error) {
    if (error.response?.status === 401) {
      console.error('Authentication failed');
    } else if (error.response?.status === 500) {
      console.error('Server error:', error.response.data.error);
    } else {
      console.error('Network error:', error.message);
    }
    throw error;
  }
}
```

---

## Testing Workflow

### 1. Test Authentication

```bash
# Should fail with 401
curl http://localhost:3001/api/integrations/cloudflare/zones

# Should succeed
curl -u admin:fazai123 http://localhost:3001/api/integrations/cloudflare/zones
```

### 2. Test Health Check

```bash
curl http://localhost:3001/api/integrations/health
```

Should return:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "...",
    "version": "1.0.0"
  }
}
```

### 3. Test Each Integration

```bash
# Cloudflare
curl -u admin:fazai123 http://localhost:3001/api/integrations/cloudflare/zones

# SpamExperts
curl -u admin:fazai123 http://localhost:3001/api/integrations/spamexperts/domains

# OPNsense
curl -u admin:fazai123 http://localhost:3001/api/integrations/opnsense/system/status
```

### 4. Test Error Handling

```bash
# Missing required field (should return 400)
curl -u admin:fazai123 \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:3001/api/integrations/cloudflare/zones/ZONE_ID/dns

# Invalid credentials (should return 401)
curl -u wrong:password http://localhost:3001/api/integrations/cloudflare/zones
```

---

## Bash Script Example

```bash
#!/bin/bash

# Configuration
API_URL="http://localhost:3001/api/integrations"
AUTH="admin:fazai123"

# Function to call API
api_call() {
  local method=$1
  local endpoint=$2
  local data=$3

  if [ -n "$data" ]; then
    curl -s -u "$AUTH" \
      -X "$method" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "${API_URL}${endpoint}"
  else
    curl -s -u "$AUTH" \
      -X "$method" \
      "${API_URL}${endpoint}"
  fi
}

# List Cloudflare zones
echo "Fetching Cloudflare zones..."
zones=$(api_call GET "/cloudflare/zones")
echo "$zones" | jq '.'

# Get first zone ID
zone_id=$(echo "$zones" | jq -r '.data[0].id')
echo "First zone ID: $zone_id"

# List DNS records for zone
echo "Fetching DNS records..."
api_call GET "/cloudflare/zones/$zone_id/dns" | jq '.'
```

Make it executable:
```bash
chmod +x test-api.sh
./test-api.sh
```

---

## Python Example

```python
import requests
from requests.auth import HTTPBasicAuth

API_URL = "http://localhost:3001/api/integrations"
AUTH = HTTPBasicAuth("admin", "fazai123")

def call_api(method, endpoint, data=None):
    url = f"{API_URL}{endpoint}"
    response = requests.request(method, url, json=data, auth=AUTH)
    return response.json()

# List Cloudflare zones
zones = call_api("GET", "/cloudflare/zones")
if zones["success"]:
    print("Zones:", zones["data"])
else:
    print("Error:", zones["error"])

# Add DNS record
result = call_api("POST", "/cloudflare/zones/ZONE_ID/dns", {
    "type": "A",
    "name": "subdomain.example.com",
    "content": "192.168.1.100",
    "proxied": False,
    "ttl": 3600
})
print(result)
```

---

## Summary

This file provides:
- curl examples for all major operations
- JavaScript/TypeScript integration patterns
- React component examples
- Error handling strategies
- Testing workflows
- Script examples (Bash, Python)

For complete API documentation, see [API.md](./API.md).
