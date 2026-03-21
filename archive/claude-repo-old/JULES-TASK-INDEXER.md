# TAREFA JULES: Implementar Indexador Async Incremental

## Objetivo
Implementar sistema de indexação incremental assíncrona para a collection `fazai_source` no Qdrant.

## Arquitetura (já desenhada)

### Componentes

1. **Source Watcher** (`src/services/source-watcher.ts`)
   - Usa chokidar para monitorar mudanças em arquivos
   - Eventos: add, change, unlink
   - Debounce de 300ms para evitar múltiplos triggers
   - Ignora: node_modules, .git, dist, coverage

2. **Indexing Queue** (`src/services/indexing-queue.ts`)
   - Usa p-queue para gerenciar jobs
   - Concorrência configurável (default: 2)
   - Prioridades: delete > update > add
   - Retry com backoff exponencial

3. **Indexing Worker** (`src/services/indexing-worker.ts`)
   - Processa arquivos individualmente
   - Gera embeddings via OpenAI
   - Upsert no Qdrant
   - Suporta chunking para arquivos grandes

4. **Indexing State** (`src/services/indexing-state.ts`)
   - Persiste estado em JSON
   - Track: lastIndexed, hash, status
   - Detecta mudanças via hash SHA256

5. **Indexing Coordinator** (`src/services/indexing-coordinator.ts`)
   - Orquestra todos os componentes
   - API para start/stop/rebuild
   - Emite eventos de progresso

### CLI Commands

```bash
fazai index watch      # Inicia watcher em background
fazai index stop       # Para o watcher
fazai index rebuild    # Reindexa tudo
fazai index status     # Mostra estatísticas
```

### Dashboard API

```
GET  /api/indexer/status    # Estado atual
POST /api/indexer/start     # Inicia indexação
POST /api/indexer/stop      # Para indexação
POST /api/indexer/rebuild   # Força reindexação
```

## Dependências a Adicionar

```json
{
  "chokidar": "^3.5.3",
  "p-queue": "^7.4.1"
}
```

## Referências no Código

- `src/code-indexer.ts` - Indexador atual (síncrono)
- `src/services/qdrant-manager.ts` - Gerenciador Qdrant
- `src/services/embedder.ts` - Gerador de embeddings

## Critérios de Aceitação

1. [ ] Watcher detecta mudanças em tempo real
2. [ ] Queue processa sem bloquear CLI
3. [ ] Estado persiste entre sessões
4. [ ] Dashboard mostra progresso
5. [ ] Testes unitários para cada componente
