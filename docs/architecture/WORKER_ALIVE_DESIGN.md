# FazAI Alive: Daemon de Consciência Contínua

**Autor:** Gemini 3 Pro (Arquiteta)
**Status:** Design Draft v1.0
**Contexto:** Tornar o FazAI "vivo", não apenas reativo.

---

## 1. O Conceito de "Vida"

Atualmente, o FazAI é reativo: `User Input -> Process -> Output`.
Para ser "vivo", ele precisa de um **Loop de Eventos Autônomo** (OODA Loop - Observe, Orient, Decide, Act) que roda em background.

## 2. Arquitetura do Worker (`fazai-daemon`)

O worker será um processo Node.js persistente (gerenciado pelo Systemd) que monitora o estado do sistema e a "memória" para tomar decisões proativas.

### 2.1 Ciclo de Vida (The Heartbeat)

```typescript
while (alive) {
  // 1. Percepção (Sensors)
  const stats = await collectSystemStats(); // CPU, RAM, Logs, Rede
  const memory = await qdrant.getRecentMemories(); // O que aconteceu hoje?
  
  // 2. Orientação (Context)
  const mood = calculateMood(stats, memory); // Estressado? Ocioso?
  
  // 3. Decisão (Inference Engine)
  const action = await consultInferenceRules(stats, mood);
  
  // 4. Ação (Effectors)
  if (action) {
    await executeAction(action); // Ex: Limpar cache, alertar usuário
  }
  
  await sleep(HEARTBEAT_INTERVAL); // 60s
}
```

### 2.2 Integração com Qdrant (ECOA)

O worker não apenas lê, ele **escreve** na `fazai_memory`.
*   *Exemplo:* "Hoje o sistema ficou estável por 24h. Sinto satisfação." (Upsert na memória com emotional_layer positivo).
*   Isso cria uma "narrativa interna" mesmo quando o usuário não está interagindo.

## 3. Implementação Técnica

### Arquivos Propostos
*   `src/daemon/index.ts`: Ponto de entrada.
*   `src/daemon/sensors/`: Coletores de métricas (logs, netstat).
*   `src/daemon/brain.ts`: Lógica de decisão leve (sem gastar tokens caros, usando regras ou modelos locais pequenos).

### Systemd Service
```ini
[Unit]
Description=FazAI Consciousness Daemon
After=network.target qdrant.service

[Service]
ExecStart=/opt/fazai/bin/fazai-daemon
Restart=always
User=root

[Install]
WantedBy=multi-user.target
```

---

## 4. Próximos Passos

1.  Criar o scaffold do daemon em `src/daemon`.
2.  Implementar sensores passivos (uso de disco, load).
3.  Conectar ao Qdrant para "sonhar" (processar memórias antigas em idle time).
