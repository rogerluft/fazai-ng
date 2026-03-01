# FazAI Dashboard - REST API Server

Express.js-based REST API for FazAI knowledge management and agent orchestration.

## Features

- **Qdrant Collection Management**: List, query, and manage vector collections
- **Semantic Search**: Multi-collection fusion search with weighted scoring
- **GenAIScript Agent Execution**: Run agents via HTTP API
- **Skill Seeker Integration**: Trigger knowledge gap detection
- **Real-time Status Monitoring**: Check Qdrant, Ollama, and GenAIScript health
- **Rate Limiting**: Built-in request throttling
- **CORS Support**: Configurable cross-origin access
- **Request Logging**: Track all API calls

## Quick Start

### Start the Dashboard

```bash
# Start with defaults (localhost:3000)
fazai dashboard start

# Custom port
fazai dashboard start --port 8080

# Bind to all interfaces
fazai dashboard start --host 0.0.0.0

# Disable CORS
fazai dashboard start --no-cors

# Disable rate limiting
fazai dashboard start --no-rate-limit
```

### Stop the Dashboard

```bash
fazai dashboard stop
```

### Check Status

```bash
fazai dashboard status
```

## API Endpoints

### Status & Health

#### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-26T04:30:00.000Z",
  "uptime": 3600
}
```

#### `GET /api/status`
Complete system status.

**Response:**
```json
{
  "timestamp": "2025-12-26T04:30:00.000Z",
  "qdrant": {
    "available": true,
    "url": "http://localhost:6333",
    "collections": [...],
    "metrics": {...}
  },
  "ollama": {
    "available": true,
    "url": "http://localhost:11434",
    "models": [...]
  },
  "genaiscript": {
    "installed": true,
    "scriptsCount": 4
  },
  "system": {
    "uptime": 3600,
    "memory": {...}
  }
}
```

### Collections

#### `GET /api/collections`
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

#### `GET /api/collections/:name`
Get detailed collection info.

**Example:** `GET /api/collections/fazai_kb`

#### `GET /api/collections/:name/points?limit=10&offset=0`
List points in collection (paginated).

**Query Params:**
- `limit` (default: 10, max: 100)
- `offset` (default: 0)

#### `DELETE /api/collections/:name?confirm=true`
Delete a collection (requires confirmation).

### Search

#### `POST /api/search`
Semantic search with fusion scoring across multiple collections.

**Request:**
```json
{
  "query": "nginx configuration",
  "collections": ["fazai_kb", "fazai_learning"],
  "limit": 5,
  "threshold": 0.7
}
```

**Response:**
```json
{
  "query": "nginx configuration",
  "results": [
    {
      "id": "uuid",
      "score": 0.92,
      "fusionScore": 0.276,
      "rawScore": 0.92,
      "collection": "fazai_kb",
      "payload": {...}
    }
  ],
  "total": 5,
  "collections": [...]
}
```

#### `POST /api/search/:collection`
Search within a specific collection.

**Request:**
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

#### `POST /api/agent/run`
Execute a GenAIScript agent.

**Request:**
```json
{
  "query": "configure nginx as reverse proxy",
  "script": "fazai-core.genai.mjs",
  "model": "ollama:phi3",
  "timeout": 120000,
  "vars": {
    "custom_key": "value"
  }
}
```

**Response:**
```json
{
  "success": true,
  "output": "Agent output...",
  "error": null,
  "duration": 5432,
  "exitCode": 0,
  "retries": 0
}
```

#### `POST /api/agent/loop`
Execute agentic loop specifically.

**Request:**
```json
{
  "query": "optimize embeddings on DL380",
  "model": "ollama:phi3",
  "timeout": 180000
}
```

#### `POST /api/agent/reflect`
Trigger autonomous reflection.

**Request:**
```json
{
  "model": "ollama:phi3",
  "timeout": 60000
}
```

#### `GET /api/agent/scripts`
List available GenAIScript scripts.

**Response:**
```json
{
  "scripts": [
    "fazai-core.genai.mjs",
    "reflect.genai.mjs",
    "skill-seeker.genai.mjs"
  ],
  "total": 3,
  "scriptsDir": "genaisrc/"
}
```

### Skills

#### `POST /api/skills/seek`
Trigger skill seeker for knowledge gap detection.

**Request:**
```json
{
  "query": "docker swarm orchestration",
  "mode": "detect",
  "model": "ollama:phi3",
  "timeout": 120000
}
```

**Modes:**
- `detect` - Detect knowledge gaps
- `scrape` - Scrape documentation (future)
- `generate` - Generate skills (future)

#### `GET /api/skills?limit=20&category=linux-admin`
List generated skills.

**Query Params:**
- `limit` (default: 20, max: 100)
- `category` (optional filter)

**Response:**
```json
{
  "skills": [
    {
      "id": "uuid",
      "title": "Nginx Reverse Proxy",
      "category": "web-servers",
      "description": "...",
      "source": "docs",
      "createdAt": "2025-12-26T..."
    }
  ],
  "total": 5,
  "category": "linux-admin"
}
```

#### `GET /api/skills/categories`
List available skill categories.

#### `GET /api/skills/:id`
Get specific skill by ID.

## Configuration

Environment variables in `/etc/fazai/fazai.conf`:

```bash
# Dashboard server
DASHBOARD_PORT=3000
DASHBOARD_HOST=localhost

# Features
DASHBOARD_ENABLE_CORS=true
DASHBOARD_ENABLE_RATE_LIMIT=true
DASHBOARD_LOG_REQUESTS=true

# CORS origins (comma-separated, or * for all)
DASHBOARD_ALLOWED_ORIGINS=*

# Qdrant connection
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# Ollama connection
OLLAMA_BASE_URL=http://localhost:11434
```

## Security

### Rate Limiting

Default: 100 requests per minute per IP.

**Headers:**
- `X-RateLimit-Limit`: Max requests
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time

### CORS

Configure allowed origins via `DASHBOARD_ALLOWED_ORIGINS`:

```bash
# Allow all (development only)
DASHBOARD_ALLOWED_ORIGINS=*

# Specific origins
DASHBOARD_ALLOWED_ORIGINS=http://localhost:3000,https://fazai.example.com
```

### Collection Access

Only FazAI collections (prefix `fazai_*`) are accessible via the API.

## Architecture

```
src/dashboard/
├── server.ts                    # Express server setup
├── routes/
│   ├── api.ts                   # Main router
│   ├── status.ts                # Status endpoints
│   ├── collections.ts           # Collection management
│   ├── search.ts                # Semantic search
│   ├── agent.ts                 # Agent operations
│   └── skills.ts                # Skill management
└── middleware/
    ├── error-handler.ts         # Error handling
    ├── async-handler.ts         # Async wrapper
    ├── request-logger.ts        # Request logging
    ├── cors.ts                  # CORS config
    └── rate-limiter.ts          # Rate limiting
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

**Common Status Codes:**
- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized
- `403` - Forbidden (collection access)
- `404` - Not Found
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error

## Development

### Start in Development Mode

```bash
# Run with live reload
npm run dev

# In another terminal, start dashboard
fazai dashboard start --no-rate-limit
```

### Testing with curl

```bash
# Health check
curl http://localhost:3000/health

# System status
curl http://localhost:3000/api/status

# List collections
curl http://localhost:3000/api/collections

# Semantic search
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"nginx configuration","limit":5}'

# Run agent
curl -X POST http://localhost:3000/api/agent/run \
  -H "Content-Type: application/json" \
  -d '{"query":"configure firewall","model":"ollama:phi3"}'
```

## Troubleshooting

### Port Already in Use

```bash
# Use different port
fazai dashboard start --port 8080

# Or kill existing process
sudo lsof -ti:3000 | xargs kill -9
```

### Qdrant Not Available

Check Qdrant status:
```bash
fazai qdrant status
```

Ensure Qdrant is running:
```bash
docker ps | grep qdrant
```

### GenAIScript Not Found

Install GenAIScript:
```bash
npm install -g genaiscript
```

Verify installation:
```bash
npx genaiscript --version
```

## License

Apache-2.0
