# Cloudflare Page - Troubleshooting Guide

## Problemas Comuns e Soluções

### 1. Backend não responde (erro de conexão)

**Sintoma:**
```
Error: Failed to fetch
Error: Network request failed
```

**Solução:**
```bash
# Verificar se backend está rodando
curl -u admin:fazai123 http://localhost:3001/api/integrations/cloudflare/zones

# Se não responder, iniciar backend
cd /home/rluft/fazai-ng/web-monitor/backend
npm run dev
```

**Porta correta:** Backend deve rodar na porta 3001

---

### 2. Erro de autenticação (401 Unauthorized)

**Sintoma:**
```
Error: HTTP 401: Unauthorized
```

**Causa:** Credenciais incorretas ou não enviadas

**Solução:**
```typescript
// Verificar em useCloudflare.ts
const AUTH_CREDENTIALS = btoa('admin:fazai123');

// Deve gerar: YWRtaW46ZmF6YWkxMjM=
```

---

### 3. CORS Error

**Sintoma:**
```
Access to fetch at 'http://localhost:3001/...' from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Solução:**

Backend precisa ter CORS habilitado:

```javascript
// backend/server.js ou app.js
const cors = require('cors');
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
```

---

### 4. TypeScript errors ao compilar

**Sintoma:**
```
error TS2322: Type 'string' is not assignable to type 'CloudflareZone'
```

**Solução:**
```bash
# Limpar cache e reinstalar
cd /home/rluft/fazai-ng/web-monitor/frontend
rm -rf node_modules package-lock.json
npm install

# Verificar tipos
npx tsc --noEmit
```

---

### 5. Componente não renderiza (tela branca)

**Causa:** Erro JavaScript não capturado

**Solução:**

1. Abrir DevTools (F12)
2. Ver Console para erros
3. Verificar imports:

```typescript
// CloudflarePage.tsx - imports devem estar corretos
import { useCloudflare } from '../hooks/useCloudflare';
import ZonesTable from '../components/cloudflare/ZonesTable';
// etc...
```

---

### 6. Zones não carregam (array vazio)

**Sintoma:**
- Página carrega
- Mostra "No zones found"
- Mas deveria ter zonas

**Debug:**

```typescript
// Adicionar console.log em useCloudflare.ts
const fetchZones = useCallback(async () => {
  setLoading(true);
  setError(null);

  try {
    const response = await fetchWithAuth<CloudflareZone[]>('/zones');
    console.log('Response:', response); // DEBUG

    if (response.success) {
      console.log('Zones:', response.result); // DEBUG
      setZones(response.result);
    }
  } catch (err) {
    console.error('Error:', err); // DEBUG
    // ...
  }
});
```

**Verificar:**
- Backend responde com `{ success: true, result: [...] }`
- Cloudflare API key está configurada no backend
- Zone ID correto

---

### 7. DNS records não aparecem após criar

**Causa:** Auto-refresh pode ter falhado

**Solução:**

```typescript
// Verificar em useCloudflare.ts - createDNSRecord
if (response.success) {
  await fetchDNSRecords(zoneId); // ← Esta linha deve existir
  return true;
}
```

**Workaround:** Trocar de tab e voltar (força novo fetch)

---

### 8. Build falha com erro de memória

**Sintoma:**
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Solução:**
```bash
# Aumentar memória do Node
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

---

### 9. Tailwind classes não aplicam

**Sintoma:** Componentes sem estilo

**Causa:** Tailwind não configurado ou não compila

**Solução:**

```bash
# Verificar se tailwind.config.js existe
cat tailwind.config.js

# Deve ter content configurado:
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // ...
}

# Rebuild
npm run build
```

---

### 10. Hook useEffect loop infinito

**Sintoma:**
- Página trava
- Console mostra centenas de requests

**Causa:** Dependency array incorreto

**Solução:**

```typescript
// ❌ ERRADO - causa loop
useEffect(() => {
  fetchZones();
}, [zones]); // zones muda → fetch → zones muda → ...

// ✅ CORRETO
useEffect(() => {
  fetchZones();
}, [fetchZones]); // fetchZones é memoizado com useCallback
```

---

## Debug Checklist

Quando algo não funciona, verificar na ordem:

1. [ ] Backend rodando? (`curl http://localhost:3001/health`)
2. [ ] Auth correto? (admin:fazai123)
3. [ ] CORS habilitado no backend?
4. [ ] DevTools Console mostra erros?
5. [ ] Network tab mostra requests falhando?
6. [ ] TypeScript compila? (`npx tsc --noEmit`)
7. [ ] Imports corretos? (paths relativos)
8. [ ] Dependencies instaladas? (`npm install`)
9. [ ] Vite dev server rodando? (`npm run dev`)
10. [ ] Browser cache limpo? (Ctrl+Shift+R)

---

## Comandos Úteis

### Limpar tudo e recomeçar
```bash
cd /home/rluft/fazai-ng/web-monitor/frontend
rm -rf node_modules dist package-lock.json
npm install
npm run build
npm run dev
```

### Testar API manualmente
```bash
# Zones
curl -u admin:fazai123 http://localhost:3001/api/integrations/cloudflare/zones | jq

# DNS (substitua ZONE_ID)
curl -u admin:fazai123 http://localhost:3001/api/integrations/cloudflare/zones/ZONE_ID/dns | jq

# Criar DNS (POST)
curl -X POST -u admin:fazai123 \
  -H "Content-Type: application/json" \
  -d '{"type":"A","name":"test","content":"192.0.2.1"}' \
  http://localhost:3001/api/integrations/cloudflare/zones/ZONE_ID/dns | jq
```

### Ver logs do backend
```bash
cd /home/rluft/fazai-ng/web-monitor/backend
npm run dev
# Logs aparecem aqui
```

### TypeScript check
```bash
cd /home/rluft/fazai-ng/web-monitor/frontend
npx tsc --noEmit
```

---

## Logs de Referência

### Backend saudável
```
Server running on http://localhost:3001
Cloudflare API configured
```

### Frontend saudável
```
VITE v5.2.0  ready in 300 ms
➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### Request bem-sucedido (DevTools Network)
```
Status: 200 OK
Response:
{
  "success": true,
  "result": [...]
}
```

---

## Contato

Se nada funcionar, verificar:

1. **Backend logs** - Erro pode estar lá
2. **Browser DevTools Console** - JavaScript errors
3. **Network tab** - Requests falhando
4. **Cloudflare API status** - https://www.cloudflarestatus.com/

---

**Última atualização:** 2025-12-17
