# Threat Intelligence Agent

Agente especializado em busca e análise de ameaças cibernéticas.

## Descrição

Este agente consulta múltiplas fontes de inteligência de ameaças para verificar a reputação de IPs, domínios e hashes de arquivos. Os resultados são indexados no Qdrant para consulta futura.

## Quando Usar

- Verificar se um IP está em blacklists (RBLs)
- Analisar reputação de domínios suspeitos
- Verificar hashes de arquivos no VirusTotal
- Investigar origem de ataques ou spam
- Construir base de conhecimento de ameaças

## Fontes Consultadas

### RBLs (Real-time Blackhole Lists) - Sem API Key
| Lista | Zone | Propósito |
|-------|------|-----------|
| Spamhaus ZEN | zen.spamhaus.org | Agregado (SBL+XBL+PBL) |
| Spamhaus SBL | sbl.spamhaus.org | Spam sources |
| Spamhaus XBL | xbl.spamhaus.org | Exploits/proxies |
| Barracuda | b.barracudacentral.org | Spam/malware |
| SORBS | dnsbl.sorbs.net | Spam relays |
| SpamCop | bl.spamcop.net | User-reported spam |
| UCEPROTECT | dnsbl-1.uceprotect.net | Abuse |
| CBL | cbl.abuseat.org | Botnet/malware |

### Domain Blacklists - Sem API Key
| Lista | Zone |
|-------|------|
| Spamhaus DBL | dbl.spamhaus.org |
| SURBL | multi.surbl.org |
| URIBL | multi.uribl.com |

### APIs (Requerem Key)
| Serviço | Variável | Tier Gratuito |
|---------|----------|---------------|
| VirusTotal | VIRUSTOTAL_API_KEY | 500 req/dia |
| AbuseIPDB | ABUSEIPDB_API_KEY | 1000 req/dia |

## Como Usar

### Via GenAIScript

```bash
# Verificar IP
genaiscript run threat-intel --vars "target=1.2.3.4" --vars "type=ip"

# Verificar domínio
genaiscript run threat-intel --vars "target=suspicious.com" --vars "type=domain"

# Verificar hash
genaiscript run threat-intel --vars "target=abc123..." --vars "type=hash"

# Sem indexar no Qdrant
genaiscript run threat-intel --vars "target=1.2.3.4" --vars "type=ip" --vars "save=false"
```

### Via FazAI CLI (futuro)

```bash
fazai threat-intel 1.2.3.4
fazai threat-intel suspicious.com --type=domain
fazai threat-intel abc123hash --type=hash
```

## Níveis de Risco

| Nível | Critério | Ação Sugerida |
|-------|----------|---------------|
| LOW | Não listado em nenhuma fonte | Monitorar |
| HIGH | Listado em 1-3 fontes | Investigar |
| CRITICAL | Listado em 4+ fontes ou VT detections > 5 | Bloquear imediatamente |

## Indexação no Qdrant

Ameaças são indexadas na collection `fazai_threats` com:
- `target`: IP, domínio ou hash
- `type`: ip, domain, hash
- `risk_level`: LOW, HIGH, CRITICAL
- `details`: Resultado completo da análise
- `indexed_at`: Timestamp
- `source`: fazai-threat-intel

### Buscar Ameaças Conhecidas

```bash
# Via GenAIScript
genaiscript run threat-intel --vars "target=spammer" --vars "type=search"
```

## Configuração

Adicione as API keys em `/etc/fazai/fazai.conf`:

```bash
VIRUSTOTAL_API_KEY=sua_key_aqui
ABUSEIPDB_API_KEY=sua_key_aqui
```

## Exemplos de Uso

### Investigar IP de ataque

```bash
genaiscript run threat-intel --vars "target=185.220.101.1" --vars "type=ip"
```

Resultado esperado:
```
🎯 TARGET: 185.220.101.1
📊 TIPO: ip
⚠️  NÍVEL DE RISCO: CRITICAL

📋 RESUMO:
- Listado em 7 de 10 RBLs
- Tor exit node conhecido
- 156 reports no AbuseIPDB

🔍 DETALHES:
- Spamhaus ZEN: LISTADO (127.0.0.4)
- Barracuda: LISTADO
- País: DE (Alemanha)

💡 RECOMENDAÇÃO:
- Bloquear imediatamente no firewall
- Adicionar à blacklist permanente
```

## Integração com Outros Agentes

| Agente | Integração |
|--------|------------|
| devops-engineer | Aplicar bloqueio em firewall |
| shell-scripting-pro | Criar scripts de automação |
| backend-architect | Design de sistema de proteção |

## Arquivos Relacionados

- `genaisrc/threat-intel.genai.mjs` - Script GenAIScript
- `src/services/threat-intel.ts` - Serviço TypeScript (futuro)
- Qdrant collection: `fazai_threats`
