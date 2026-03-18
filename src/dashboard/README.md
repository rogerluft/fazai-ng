# FazAI Dashboard

REST API para gerenciamento de conhecimento e monitoramento do FazAI.

**Documentação completa:** [docs/guides/DASHBOARD.md](../../docs/guides/DASHBOARD.md)

## Quick Start

```bash
fazai dashboard start          # Iniciar (localhost:3000)
fazai dashboard start --port 8080  # Porta customizada
fazai dashboard stop           # Parar
fazai dashboard status         # Status
```

## Verificar

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api | jq   # Lista todos endpoints
```

## Arquitetura

```
src/dashboard/
├── server.ts           # DashboardServer (Express setup)
├── routes/
│   ├── api.ts          # Router principal
│   ├── status.ts       # Status endpoints
│   ├── collections.ts  # Qdrant collections
│   ├── search.ts       # Busca semântica
│   ├── agent.ts        # GenAIScript agents
│   ├── skills.ts       # Skill management
│   └── samba.ts        # Samba shares
└── middleware/
    ├── cors.ts         # CORS
    ├── rate-limiter.ts # Rate limiting
    ├── request-logger.ts # Logging
    ├── error-handler.ts  # Error handling
    └── async-handler.ts  # Async wrapper
```

## Documentação Relacionada

- [Referência completa de endpoints](../../docs/guides/DASHBOARD.md)
- [Arquitetura de Servidores](../../docs/architecture/SERVERS_ARCHITECTURE.md)
- [Web UI](../../docs/guides/WEB_UI.md)
