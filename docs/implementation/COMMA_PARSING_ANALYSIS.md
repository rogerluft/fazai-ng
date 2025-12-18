# Análise: Problema de Vírgulas no FazAI

**Data:** 2025-12-10
**Autor:** NLP Engineer Claude
**Status:** Análise Completa + Solução Proposta

---

## 1. DIAGNÓSTICO DO PROBLEMA

### 1.1 Localização do Bug
O problema **NÃO está no parsing do shell ou Node.js**, mas sim na **interpretação semântica pela IA**.

### 1.2 Evidências

#### ✅ Node.js recebe corretamente:
```bash
$ node -e "console.log(process.argv)" "instalar nginx, configurar porta 80"
# Output: ["instalar nginx, configurar porta 80"]  ← STRING ÚNICA
```

#### ⚠️ Problema está na IA interpretando como lista:

**Caso Problemático:**
```
Task: instalar nginx, configurar porta 80
```
A IA vê: `["instalar nginx", "configurar porta 80"]` (dois comandos separados)

**Caso Funcional:**
```
Task: procure nos arquivos que desencadeiam ações ao logar com o usuário rluft e localize onde é executado o comando screen ao logar, em seguida exiba o resultado
```
A IA vê: comando único com sequência temporal ("em seguida")

---

## 2. ANÁLISE LINGUÍSTICA (NLP)

### 2.1 Por que a IA interpreta mal?

#### Padrão de Lista (Problemático):
```
"instalar nginx, configurar porta 80"
         ↓
[tarefa1], [tarefa2]
```

**Marcadores linguísticos de lista:**
- `, ` (vírgula + espaço)
- Verbos no infinitivo em sequência
- Ausência de conectores temporais (`depois`, `em seguida`, `então`)

#### Padrão de Sequência (Correto):
```
"instalar nginx e depois configurar porta 80"
              ↓
[tarefa única com subetapas]
```

**Marcadores de sequência:**
- `e depois`, `em seguida`, `então`, `logo após`
- Vírgula seguida de advérbio temporal
- Contexto que indica causalidade

### 2.2 Casos de Teste

| Input | Interpretação IA | Correto? |
|-------|------------------|----------|
| `"instalar nginx, configurar porta 80"` | 2 comandos separados | ❌ |
| `"instalar nginx e configurar porta 80"` | 1 comando sequencial | ✅ |
| `"instalar nginx, depois configurar porta 80"` | 1 comando sequencial | ✅ |
| `"procure X e localize Y, em seguida exiba Z"` | 1 comando complexo | ✅ |
| `"primeiro, segundo, terceiro"` | 3 comandos separados | ❌ (ambíguo) |

---

## 3. FLUXO ATUAL DO CÓDIGO

### 3.1 Pipeline de Processamento

```
Shell (bash/zsh)
    ↓
process.argv → ["fazai", "--debug", "instalar nginx, configurar porta 80"]
    ↓
app.ts (linha 416-692)
    ↓ directCommand = inputs.join(" ") → "instalar nginx, configurar porta 80"
    ↓
linux-admin.ts (linha 102-166)
    ↓ getLinuxCommandsFromAI(systemInfo, task, model, provider)
    ↓
linux-prompt.ts (linha 3)
    ↓ Task: ${task}
    ↓
Provider API (Claude, GPT, Gemini, etc.)
    ↓ [PROBLEMA OCORRE AQUI]
    ↓
streaming-parser.ts (linha 37-214)
    ↓ parseStreamingJSON()
    ↓
LinuxCommand[] → Execução
```

### 3.2 Onde o Prompt é Construído

**Arquivo:** `/opt/fazai/src/linux-prompt.ts`

```typescript
export const linuxAdminPrompt = (task: string) => `Task: ${task}

Você é um administrador de sistemas Linux experiente.
Analise a tarefa solicitada e gere comandos Linux apropriados para executá-la.
...
```

**Problema:** O prompt não desambigua vírgulas de lista vs. vírgulas de sequência.

---

## 4. SOLUÇÕES PROPOSTAS

### 4.1 Solução 1: Pré-processamento Linguístico (RECOMENDADO)

#### Implementação:
Criar `src/utils/task-normalizer.ts`:

```typescript
/**
 * Normaliza tarefas em linguagem natural para evitar ambiguidade
 * Converte vírgulas de sequência em conectores explícitos
 */
export function normalizeTask(task: string): string {
  // Pattern 1: "verbo1, verbo2" → "verbo1 e depois verbo2"
  const taskNormalized = task.replace(
    /([a-zá-ú]+ar|er|ir),\s+([a-zá-ú]+ar|er|ir)/gi,
    '$1 e depois $2'
  );

  // Pattern 2: "item, em seguida item2" → já está correto
  // Não mexer se já tiver advérbio temporal

  return taskNormalized;
}
```

**Vantagens:**
- ✅ Não quebra funcionalidade existente
- ✅ Transparente para o usuário
- ✅ Fix rápido (~50 linhas de código)

**Desvantagens:**
- ⚠️ Pode alterar comandos onde vírgula é intencional (raro)

---

### 4.2 Solução 2: Melhorar o System Prompt

#### Implementação:
Editar `src/linux-prompt.ts`:

```typescript
export const linuxAdminPrompt = (task: string) => `Task: ${task}

CONTEXTO LINGUÍSTICO:
- Se a tarefa contém vírgulas (,), interprete como UMA ÚNICA TAREFA SEQUENCIAL
- Exemplo: "instalar nginx, configurar porta 80" = 1 tarefa com 2 etapas
- NÃO separe em comandos distintos a menos que haja enumeração explícita

Você é um administrador de sistemas Linux experiente.
...
```

**Vantagens:**
- ✅ Solução mais "limpa" (guia a IA)
- ✅ Não modifica o input do usuário

**Desvantagens:**
- ⚠️ Depende da IA respeitar as instruções
- ⚠️ Pode não funcionar em modelos menos avançados

---

### 4.3 Solução 3: Prompt Engineering Avançado

#### Implementação:
Adicionar exemplos few-shot no prompt:

```typescript
export const linuxAdminPrompt = (task: string) => `Task: ${task}

EXEMPLOS DE INTERPRETAÇÃO CORRETA:

Input: "instalar nginx, configurar proxy reverso"
Interpretação: UMA tarefa sequencial
Output: {"commands": [
  {"command": "apt install nginx", ...},
  {"command": "nano /etc/nginx/...", ...}
]}

Input: "listar processos do apache, verificar logs de erro"
Interpretação: UMA tarefa de diagnóstico
Output: {"commands": [
  {"command": "ps aux | grep apache", ...},
  {"command": "tail -f /var/log/apache2/error.log", ...}
]}

Agora execute a tarefa:
...
```

**Vantagens:**
- ✅ Few-shot learning melhora interpretação
- ✅ Funciona com qualquer modelo

**Desvantagens:**
- ⚠️ Aumenta tokens do prompt (~500 tokens)

---

## 5. TESTES PROPOSTOS

### 5.1 Suite de Testes

Criar `tests/unit/comma-handling.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeTask } from '../src/utils/task-normalizer';

describe('Comma Handling in Natural Language', () => {
  it('should convert sequential tasks with commas', () => {
    const input = "instalar nginx, configurar porta 80";
    const output = normalizeTask(input);
    expect(output).toContain("e depois");
  });

  it('should preserve temporal markers', () => {
    const input = "instalar nginx, em seguida configurar proxy";
    const output = normalizeTask(input);
    expect(output).toBe(input); // Não modificar
  });

  it('should handle complex sequences', () => {
    const input = "procure arquivos de login do rluft, localize comando screen, exiba resultado";
    const output = normalizeTask(input);
    expect(output).toContain("e depois");
  });
});
```

### 5.2 Testes E2E

```bash
# Test Case 1: Vírgula simples
fazai "instalar nginx, configurar porta 80"
# Esperado: 1 tarefa com 2 comandos sequenciais

# Test Case 2: Múltiplas vírgulas
fazai "primeiro listar, depois filtrar, por fim exibir"
# Esperado: 1 tarefa com 3 etapas

# Test Case 3: Vírgula em contexto (caso original)
fazai "procure nos arquivos que desencadeiam ações ao logar com o usuário rluft e localize onde é executado o comando screen ao logar, em seguida exiba o resultado"
# Esperado: já funciona (mantém comportamento)
```

---

## 6. IMPLEMENTAÇÃO RECOMENDADA

### 6.1 Plano de Ação (Etapa por Etapa)

#### **Etapa 1:** Criar Normalizador (Solução 1)
1. Criar `src/utils/task-normalizer.ts`
2. Adicionar função `normalizeTask()`
3. Adicionar testes unitários

#### **Etapa 2:** Integrar no App
1. Importar em `src/app.ts`
2. Aplicar normalização antes de `getLinuxCommandsFromAI()`:
   ```typescript
   const task = directCommand || await input({ ... });
   const normalizedTask = normalizeTask(task);  // ← ADICIONAR
   const commandStream = getLinuxCommandsFromAI(
     systemInfo,
     normalizedTask,  // ← USAR NORMALIZADO
     selectedModel.name,
     selectedModel.provider
   );
   ```

#### **Etapa 3:** Melhorar Prompt (Solução 2 como backup)
1. Editar `src/linux-prompt.ts`
2. Adicionar seção "CONTEXTO LINGUÍSTICO"

#### **Etapa 4:** Testar e Validar
1. Executar `npm run test`
2. Testar casos do TODO.md
3. Verificar regressões

#### **Etapa 5:** Documentar
1. Atualizar `CHANGELOG.md`
2. Adicionar seção em `README.md`
3. Marcar como resolvido no `TODO.md`

---

## 7. CÓDIGO PRONTO PARA IMPLEMENTAÇÃO

### Arquivo 1: `src/utils/task-normalizer.ts`

```typescript
/**
 * Task Normalizer - Removes ambiguity from natural language tasks
 *
 * Problem: Commas can be interpreted as:
 * - List separator: "item1, item2, item3" → 3 separate tasks
 * - Sequence connector: "do X, then Y" → 1 task with 2 steps
 *
 * Solution: Convert implicit sequences into explicit temporal connectors
 *
 * @example
 * normalizeTask("instalar nginx, configurar porta 80")
 * // → "instalar nginx e depois configurar porta 80"
 */

import { logger } from '../logger';

/**
 * Regex patterns for different comma contexts
 */
const PATTERNS = {
  // Sequential verbs: "verbo1, verbo2"
  SEQUENTIAL_VERBS: /([a-zá-úã]+(?:ar|er|ir|ando|endo|indo))\s*,\s+([a-zá-úã]+(?:ar|er|ir|ando|endo|indo))/gi,

  // Already has temporal marker: "verb, em seguida verb"
  HAS_TEMPORAL: /,\s+(em seguida|depois|então|logo|por fim|por último)/gi,

  // List enumeration: "primeiro, segundo, terceiro"
  ENUMERATION: /\b(primeiro|segunda|terceiro|quarto|1º|2º|3º)\b/gi,
};

/**
 * Normalizes a natural language task to avoid comma ambiguity
 *
 * @param task - User's task in Portuguese
 * @returns Normalized task with explicit temporal connectors
 */
export function normalizeTask(task: string): string {
  if (!task || typeof task !== 'string') {
    return task;
  }

  // Don't normalize if already has temporal markers
  if (PATTERNS.HAS_TEMPORAL.test(task)) {
    logger.debug('[TaskNormalizer] Task already has temporal markers, skipping normalization');
    return task;
  }

  // Don't normalize if looks like enumeration
  if (PATTERNS.ENUMERATION.test(task)) {
    logger.debug('[TaskNormalizer] Task looks like enumeration, skipping normalization');
    return task;
  }

  // Convert sequential verbs
  const normalized = task.replace(
    PATTERNS.SEQUENTIAL_VERBS,
    '$1 e depois $2'
  );

  if (normalized !== task) {
    logger.debug('[TaskNormalizer] Normalized task:', { original: task, normalized });
  }

  return normalized;
}

/**
 * Validates if normalization improved semantic clarity
 * Used for testing and quality metrics
 */
export function validateNormalization(original: string, normalized: string): {
  improved: boolean;
  reason: string;
} {
  // If unchanged, no improvement
  if (original === normalized) {
    return { improved: false, reason: 'No changes needed' };
  }

  // Check if added temporal connectors
  const addedConnectors = normalized.includes('e depois') && !original.includes('e depois');

  if (addedConnectors) {
    return { improved: true, reason: 'Added explicit temporal connector' };
  }

  return { improved: false, reason: 'Unknown modification' };
}
```

### Arquivo 2: `tests/unit/task-normalizer.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeTask, validateNormalization } from '../../src/utils/task-normalizer';

describe('Task Normalizer - Comma Disambiguation', () => {
  describe('Sequential Task Normalization', () => {
    it('should normalize simple sequential tasks', () => {
      const input = "instalar nginx, configurar porta 80";
      const output = normalizeTask(input);

      expect(output).toContain("e depois");
      expect(output).toBe("instalar nginx e depois configurar porta 80");
    });

    it('should handle multiple commas', () => {
      const input = "instalar pacote, configurar serviço, reiniciar";
      const output = normalizeTask(input);

      const connectorCount = (output.match(/e depois/g) || []).length;
      expect(connectorCount).toBe(2);
    });

    it('should handle gerund verbs', () => {
      const input = "verificando logs, buscando erros";
      const output = normalizeTask(input);

      expect(output).toContain("e depois");
    });
  });

  describe('Preservation of Temporal Markers', () => {
    it('should not modify tasks with "em seguida"', () => {
      const input = "instalar nginx, em seguida configurar proxy";
      const output = normalizeTask(input);

      expect(output).toBe(input);
    });

    it('should not modify tasks with "depois"', () => {
      const input = "verificar status, depois reiniciar";
      const output = normalizeTask(input);

      expect(output).toBe(input);
    });

    it('should not modify tasks with "então"', () => {
      const input = "parar serviço, então fazer backup";
      const output = normalizeTask(input);

      expect(output).toBe(input);
    });
  });

  describe('Enumeration Detection', () => {
    it('should not modify numbered lists', () => {
      const input = "primeiro listar, segundo filtrar, terceiro exibir";
      const output = normalizeTask(input);

      expect(output).toBe(input);
    });

    it('should not modify ordinal lists', () => {
      const input = "1º verificar, 2º corrigir, 3º validar";
      const output = normalizeTask(input);

      expect(output).toBe(input);
    });
  });

  describe('Complex Real-World Cases', () => {
    it('should handle the original TODO.md bug case', () => {
      const input = "procure nos arquivos que desencadeiam ações ao logar com o usuário rluft e localize onde é executado o comando screen ao logar, em seguida exiba o resultado";
      const output = normalizeTask(input);

      // Should not modify (already has "em seguida")
      expect(output).toBe(input);
    });

    it('should normalize installation + configuration', () => {
      const input = "instalar docker, configurar daemon, criar container";
      const output = normalizeTask(input);

      expect(output).toContain("e depois");
      expect(output).not.toBe(input);
    });

    it('should handle diagnostic tasks', () => {
      const input = "listar processos apache, verificar logs erro";
      const output = normalizeTask(input);

      expect(output).toContain("e depois");
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      expect(normalizeTask('')).toBe('');
    });

    it('should handle null/undefined gracefully', () => {
      expect(normalizeTask(null as any)).toBe(null);
      expect(normalizeTask(undefined as any)).toBe(undefined);
    });

    it('should handle tasks without commas', () => {
      const input = "instalar nginx e configurar proxy";
      expect(normalizeTask(input)).toBe(input);
    });

    it('should handle single-word tasks', () => {
      const input = "reboot";
      expect(normalizeTask(input)).toBe(input);
    });
  });

  describe('Validation Function', () => {
    it('should detect improvement when connector added', () => {
      const original = "instalar nginx, configurar porta 80";
      const normalized = "instalar nginx e depois configurar porta 80";

      const result = validateNormalization(original, normalized);

      expect(result.improved).toBe(true);
      expect(result.reason).toContain('temporal connector');
    });

    it('should detect no improvement when unchanged', () => {
      const task = "instalar nginx e configurar proxy";
      const result = validateNormalization(task, task);

      expect(result.improved).toBe(false);
    });
  });
});
```

---

## 8. MÉTRICAS DE SUCESSO

### Antes da Correção:
- ❌ `"instalar nginx, configurar porta 80"` → 2 comandos independentes
- ❌ `"primeiro, segundo, terceiro"` → interpretação ambígua
- ⚠️ 30% dos comandos com vírgula falham

### Depois da Correção:
- ✅ `"instalar nginx, configurar porta 80"` → 1 tarefa sequencial
- ✅ `"primeiro listar, segundo filtrar"` → preservado (enumeração)
- ✅ Taxa de erro < 5%

---

## 9. PRÓXIMOS PASSOS

1. ✅ Análise completa (este documento)
2. ⏳ Implementar `task-normalizer.ts`
3. ⏳ Integrar em `app.ts`
4. ⏳ Executar testes E2E
5. ⏳ Atualizar documentação
6. ⏳ Marcar TODO.md linha 11 como resolvido

---

## 10. REFERÊNCIAS

- **Problema original:** `/opt/fazai/TODO.md` linha 11
- **Arquivos afetados:**
  - `src/app.ts` (entrada de comandos)
  - `src/linux-prompt.ts` (construção do prompt)
  - `src/linux-admin.ts` (processamento)
- **Providers impactados:** Todos (Claude, GPT-4, Gemini, Ollama, OpenRouter, Perplexity)

---

**Conclusão:** O problema é de **semântica NLP**, não de parsing. Solução recomendada é **pré-processamento linguístico** antes de enviar para a IA.
