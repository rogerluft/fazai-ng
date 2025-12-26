# FazAI Dashboard API Documentation

## Overview

The FazAI Dashboard is a REST API server built with Express.js that provides HTTP endpoints for:
- Qdrant vector database management
- Semantic search across knowledge collections
- GenAIScript agent execution
- Skill seeker integration
- System monitoring

## Quick Start

```bash
# Start the dashboard
fazai dashboard start

# Or with custom settings
fazai dashboard start --port 8080 --host 0.0.0.0

# Check status
curl http://localhost:3000/health
```

## Base URL

Default: `http://localhost:3000`

## Authentication

Currently no authentication required (local use only).

For production deployment, consider adding:
- API key authentication
- JWT tokens
- IP whitelisting

## Endpoints Reference

### Health & Status

#### GET /health
Simple health check.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-26T04:30:00.000Z",
  "uptime": 3600
}
```

#### GET /api/status
Complete system status including Qdrant, Ollama, and GenAIScript.

**Response:**
```json
{
  "timestamp": "2025-12-26T04:30:00.000Z",
  "qdrant": {
    "available": true,
    "url": "http://localhost:6333",
    "version": "1.7.0",
    "collections": [...]
  },
  "ollama": {
    "available": true,
    "models": [...]
  },
  "genaiscript": {
    "installed": true,
    "scriptsCount": 4
  }
}
```

### Collections

#### GET /api/collections
List all FazAI collections.

**Response:**
```json
{
  "total": 4,
  "collections": [
    {
      "name": "fazai_kb",
      "vectorsCount": 1500,
      "pointsCount": 1500,
      "status": "green"
    }
  ]
}
```

#### GET /api/collections/:name
Get detailed collection information.

**Parameters:**
- `name` - Collection name (must start with `fazai_`)

#### GET /api/collections/:name/points
List points in a collection (paginated).

**Query Parameters:**
- `limit` - Max results (default: 10, max: 100)
- `offset` - Starting offset (default: 0)

### Search

#### POST /api/search
Multi-collection semantic search with fusion scoring.

**Request Body:**
```json
{
  "query": "nginx reverse proxy configuration",
  "collections": ["fazai_kb", "fazai_learning"],
  "limit": 5,
  "threshold": 0.7
}
```

**Response:**
```json
{
  "query": "nginx reverse proxy configuration",
  "results": [
    {
      "id": "uuid",
      "score": 0.92,
      "fusionScore": 0.276,
      "collection": "fazai_kb",
      "payload": {
        "title": "Nginx Reverse Proxy Setup",
        "content": "..."
      }
    }
  ],
  "total": 5
}
```

**Fusion Scoring Weights:**
- `fazai_learning`: 0.4 (technical learnings)
- `fazai_kb`: 0.3 (knowledge base)
- `fazai_memory`: 0.2 (conversation memories)
- `fazai_inference`: 0.1 (inference rules)

#### POST /api/search/:collection
Search within a specific collection.

**Request Body:**
```json
{
  "query": "systemctl commands",
  "limit": 10,
  "threshold": 0.8,
  "filter": {
    "must": [
      { "key": "category", "match": { "value": "linux-admin" } }
    ]
  }
}
```

### Agent Operations

#### POST /api/agent/run
Execute a GenAIScript agent.

**Request Body:**
```json
{
  "query": "configure nginx as reverse proxy",
  "script": "fazai-core.genai.mjs",
  "model": "ollama:phi3",
  "timeout": 120000
}
```

**Response:**
```json
{
  "success": true,
  "output": "Agent execution output...",
  "duration": 5432,
  "exitCode": 0
}
```

#### POST /api/agent/loop
Execute the agentic loop specifically.

**Request Body:**
```json
{
  "query": "optimize embeddings on DL380",
  "model": "ollama:phi3",
  "timeout": 180000
}
```

#### POST /api/agent/reflect
Trigger autonomous reflection.

**Request Body:**
```json
{
  "model": "ollama:phi3",
  "timeout": 60000
}
```

#### GET /api/agent/scripts
List available GenAIScript scripts.

**Response:**
```json
{
  "scripts": [
    "fazai-core.genai.mjs",
    "reflect.genai.mjs",
    "skill-seeker.genai.mjs"
  ],
  "total": 3
}
```

### Skills

#### POST /api/skills/seek
Trigger skill seeker for knowledge gap detection.

**Request Body:**
```json
{
  "query": "docker swarm orchestration",
  "mode": "detect",
  "model": "ollama:phi3"
}
```

**Modes:**
- `detect` - Detect knowledge gaps
- `scrape` - Scrape documentation (future)
- `generate` - Generate skills (future)

#### GET /api/skills
List generated skills.

**Query Parameters:**
- `limit` - Max results (default: 20, max: 100)
- `category` - Filter by category (optional)

**Response:**
```json
{
  "skills": [
    {
      "id": "uuid",
      "title": "Nginx Reverse Proxy",
      "category": "web-servers",
      "description": "Configure nginx as reverse proxy",
      "source": "docs"
    }
  ],
  "total": 5
}
```

## Error Handling

All errors return consistent JSON format:

```json
{
  "error": "ErrorType",
  "message": "Human-readable error message",
  "statusCode": 400,
  "timestamp": "2025-12-26T04:30:00.000Z",
  "path": "/api/search"
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (validation error)
- `403` - Forbidden (collection access denied)
- `404` - Not Found
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Rate Limiting

Default: 100 requests per minute per IP.

**Headers:**
- `X-RateLimit-Limit` - Maximum requests allowed
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Time when limit resets

## CORS

Configure allowed origins in `/etc/fazai/fazai.conf`:

```bash
DASHBOARD_ALLOWED_ORIGINS=*  # Allow all (dev only)
# or
DASHBOARD_ALLOWED_ORIGINS=http://localhost:3000,https://fazai.example.com
```

## Configuration

Environment variables in `/etc/fazai/fazai.conf`:

```bash
# Server
DASHBOARD_PORT=3000
DASHBOARD_HOST=localhost

# Features
DASHBOARD_ENABLE_CORS=true
DASHBOARD_ENABLE_RATE_LIMIT=true
DASHBOARD_LOG_REQUESTS=true
DASHBOARD_ALLOWED_ORIGINS=*

# Dependencies
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434
```

## Examples

### Health Check

```bash
curl http://localhost:3000/health
```

### System Status

```bash
curl http://localhost:3000/api/status | jq
```

### List Collections

```bash
curl http://localhost:3000/api/collections | jq '.collections[].name'
```

### Semantic Search

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "nginx configuration",
    "limit": 5,
    "threshold": 0.7
  }' | jq
```

### Execute Agent

```bash
curl -X POST http://localhost:3000/api/agent/run \
  -H "Content-Type: application/json" \
  -d '{
    "query": "configure firewall for web server",
    "model": "ollama:phi3",
    "timeout": 120000
  }' | jq
```

### List Skills

```bash
curl "http://localhost:3000/api/skills?category=linux-admin&limit=10" | jq
```

## Architecture

```
Dashboard Server (Express.js)
├── Routes
│   ├── /health (health check)
│   ├── /api/status (system status)
│   ├── /api/collections (Qdrant management)
│   ├── /api/search (semantic search)
│   ├── /api/agent (GenAIScript execution)
│   └── /api/skills (skill management)
├── Middleware
│   ├── CORS
│   ├── Rate Limiter
│   ├── Request Logger
│   ├── Error Handler
│   └── Async Wrapper
└── Integrations
    ├── Qdrant (vector database)
    ├── GenAIScript (agent runtime)
    └── Embeddings (semantic search)
```

## Security Considerations

### For Development

- Dashboard runs on localhost by default
- No authentication required
- All collections accessible

### For Production

Consider implementing:

1. **Authentication**
   - API key header validation
   - JWT tokens
   - OAuth2

2. **Network Security**
   - Bind to specific interface only
   - Use reverse proxy (nginx/caddy)
   - Enable HTTPS

3. **Rate Limiting**
   - Per-user instead of per-IP
   - Different limits per endpoint
   - Redis-backed rate limiter

4. **Input Validation**
   - Schema validation (Zod/Joi)
   - Sanitize user inputs
   - Limit payload sizes

5. **Monitoring**
   - Request logging
   - Error tracking (Sentry)
   - Performance metrics

## License

Apache-2.0
