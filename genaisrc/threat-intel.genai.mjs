/**
 * FazAI Threat Intelligence Agent
 *
 * Busca IPs, domínios e hashes em:
 * - RBLs (Spamhaus, Barracuda, SORBS, etc.)
 * - Antivírus (VirusTotal API)
 * - Listas de má reputação
 * - Spammers e atividade hostil
 *
 * Usage:
 *   genaiscript run threat-intel --vars "target=1.2.3.4" --vars "type=ip"
 *   genaiscript run threat-intel --vars "target=evil.com" --vars "type=domain"
 *   genaiscript run threat-intel --vars "target=abc123hash" --vars "type=hash"
 */

const target = env.vars.target;
const targetType = env.vars.type || "ip"; // ip, domain, hash
const saveToQdrant = env.vars.save !== "false";
const ollamaUrl = env.vars.ollama_url || process.env.OLLAMA_BASE_URL || "http://localhost:11434";

if (!target) {
  throw new Error("Target required: --vars 'target=1.2.3.4'");
}

script({
  title: "FazAI Threat Intelligence",
  description: `Análise de reputação para ${targetType}: ${target}`,
  model: "ollama:llama3",
  temperature: 0.1,
  maxTokens: 4096,
});

// ============================================================================
// RBL (Real-time Blackhole Lists) - DNS-based, no API key needed
// ============================================================================
const RBL_SERVERS = [
  { name: "Spamhaus ZEN", zone: "zen.spamhaus.org" },
  { name: "Spamhaus SBL", zone: "sbl.spamhaus.org" },
  { name: "Spamhaus XBL", zone: "xbl.spamhaus.org" },
  { name: "Barracuda", zone: "b.barracudacentral.org" },
  { name: "SORBS", zone: "dnsbl.sorbs.net" },
  { name: "SpamCop", zone: "bl.spamcop.net" },
  { name: "UCEPROTECT L1", zone: "dnsbl-1.uceprotect.net" },
  { name: "Invaluement", zone: "dnsbl.invaluement.com" },
  { name: "Abuseat CBL", zone: "cbl.abuseat.org" },
  { name: "PSBL", zone: "psbl.surriel.com" },
];

const DOMAIN_BLACKLISTS = [
  { name: "Spamhaus DBL", zone: "dbl.spamhaus.org" },
  { name: "SURBL", zone: "multi.surbl.org" },
  { name: "URIBL", zone: "multi.uribl.com" },
  { name: "Invaluement URI", zone: "dnsbl.invaluement.com" },
];

// ============================================================================
// Tool: Check IP in RBLs
// ============================================================================
defTool(
  "check_ip_rbl",
  "Verifica um IP em múltiplas RBLs (Real-time Blackhole Lists)",
  {
    type: "object",
    properties: {
      ip: {
        type: "string",
        description: "Endereço IP para verificar (ex: 1.2.3.4)",
      },
    },
    required: ["ip"],
  },
  async ({ ip }) => {
    const dns = await import("dns");
    const { promisify } = await import("util");
    const resolve4 = promisify(dns.resolve4);

    // Reverse IP for RBL query (1.2.3.4 -> 4.3.2.1)
    const reversedIp = ip.split(".").reverse().join(".");

    const results = [];

    for (const rbl of RBL_SERVERS) {
      const query = `${reversedIp}.${rbl.zone}`;
      try {
        const addresses = await resolve4(query);
        results.push({
          rbl: rbl.name,
          zone: rbl.zone,
          listed: true,
          response: addresses,
          severity: "HIGH",
        });
      } catch (err) {
        if (err.code === "ENOTFOUND" || err.code === "ENODATA") {
          results.push({
            rbl: rbl.name,
            zone: rbl.zone,
            listed: false,
          });
        } else {
          results.push({
            rbl: rbl.name,
            zone: rbl.zone,
            error: err.message,
          });
        }
      }
    }

    const listed = results.filter(r => r.listed);
    return JSON.stringify({
      ip,
      total_rbls: RBL_SERVERS.length,
      listed_count: listed.length,
      risk_level: listed.length > 3 ? "CRITICAL" : listed.length > 0 ? "HIGH" : "LOW",
      details: results,
    }, null, 2);
  }
);

// ============================================================================
// Tool: Check Domain Reputation
// ============================================================================
defTool(
  "check_domain_reputation",
  "Verifica reputação de domínio em blacklists e SURBL",
  {
    type: "object",
    properties: {
      domain: {
        type: "string",
        description: "Domínio para verificar (ex: evil.com)",
      },
    },
    required: ["domain"],
  },
  async ({ domain }) => {
    const dns = await import("dns");
    const { promisify } = await import("util");
    const resolve4 = promisify(dns.resolve4);
    const resolveTxt = promisify(dns.resolveTxt);
    const resolveMx = promisify(dns.resolveMx);

    const results = {
      domain,
      blacklists: [],
      dns_info: {},
      whois_hint: null,
    };

    // Check domain blacklists
    for (const bl of DOMAIN_BLACKLISTS) {
      const query = `${domain}.${bl.zone}`;
      try {
        const addresses = await resolve4(query);
        results.blacklists.push({
          list: bl.name,
          listed: true,
          response: addresses,
        });
      } catch (err) {
        if (err.code === "ENOTFOUND" || err.code === "ENODATA") {
          results.blacklists.push({ list: bl.name, listed: false });
        }
      }
    }

    // Get DNS records for context
    try {
      results.dns_info.mx = await resolveMx(domain);
    } catch { results.dns_info.mx = null; }

    try {
      results.dns_info.txt = await resolveTxt(domain);
    } catch { results.dns_info.txt = null; }

    try {
      results.dns_info.a = await resolve4(domain);
    } catch { results.dns_info.a = null; }

    const listedCount = results.blacklists.filter(b => b.listed).length;
    results.risk_level = listedCount > 2 ? "CRITICAL" : listedCount > 0 ? "HIGH" : "LOW";

    return JSON.stringify(results, null, 2);
  }
);

// ============================================================================
// Tool: Check Hash with VirusTotal (if API key available)
// ============================================================================
defTool(
  "check_hash_virustotal",
  "Verifica hash de arquivo no VirusTotal (requer VIRUSTOTAL_API_KEY)",
  {
    type: "object",
    properties: {
      hash: {
        type: "string",
        description: "Hash MD5, SHA1 ou SHA256",
      },
    },
    required: ["hash"],
  },
  async ({ hash }) => {
    const apiKey = process.env.VIRUSTOTAL_API_KEY;

    if (!apiKey) {
      return JSON.stringify({
        error: "VIRUSTOTAL_API_KEY não configurada em fazai.conf",
        hash,
        tip: "Adicione VIRUSTOTAL_API_KEY=xxx em /etc/fazai/fazai.conf",
      });
    }

    try {
      const response = await fetch(`https://www.virustotal.com/api/v3/files/${hash}`, {
        headers: { "x-apikey": apiKey },
      });

      if (response.status === 404) {
        return JSON.stringify({ hash, found: false, message: "Hash não encontrado no VT" });
      }

      const data = await response.json();
      const stats = data.data?.attributes?.last_analysis_stats || {};

      return JSON.stringify({
        hash,
        found: true,
        detections: stats.malicious || 0,
        total_engines: (stats.malicious || 0) + (stats.undetected || 0),
        risk_level: stats.malicious > 5 ? "CRITICAL" : stats.malicious > 0 ? "HIGH" : "LOW",
        names: data.data?.attributes?.names?.slice(0, 5) || [],
        type: data.data?.attributes?.type_description,
      }, null, 2);
    } catch (error) {
      return JSON.stringify({ error: error.message, hash });
    }
  }
);

// ============================================================================
// Tool: Check with AbuseIPDB (if API key available)
// ============================================================================
defTool(
  "check_abuseipdb",
  "Verifica IP no AbuseIPDB (requer ABUSEIPDB_API_KEY)",
  {
    type: "object",
    properties: {
      ip: {
        type: "string",
        description: "Endereço IP para verificar",
      },
    },
    required: ["ip"],
  },
  async ({ ip }) => {
    const apiKey = process.env.ABUSEIPDB_API_KEY;

    if (!apiKey) {
      return JSON.stringify({
        error: "ABUSEIPDB_API_KEY não configurada",
        ip,
        tip: "Registre grátis em abuseipdb.com e adicione a key em fazai.conf",
      });
    }

    try {
      const response = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90`, {
        headers: {
          "Key": apiKey,
          "Accept": "application/json",
        },
      });

      const data = await response.json();
      const info = data.data || {};

      return JSON.stringify({
        ip,
        abuse_confidence: info.abuseConfidencePercentage || 0,
        total_reports: info.totalReports || 0,
        country: info.countryCode,
        isp: info.isp,
        domain: info.domain,
        is_tor: info.isTor,
        risk_level: info.abuseConfidencePercentage > 50 ? "CRITICAL" :
                   info.abuseConfidencePercentage > 20 ? "HIGH" : "LOW",
      }, null, 2);
    } catch (error) {
      return JSON.stringify({ error: error.message, ip });
    }
  }
);

// ============================================================================
// Tool: Index Threat to Qdrant
// ============================================================================
defTool(
  "index_threat",
  "Indexa ameaça identificada no Qdrant para consulta futura",
  {
    type: "object",
    properties: {
      target: { type: "string", description: "IP, domínio ou hash" },
      type: { type: "string", description: "ip, domain ou hash" },
      risk_level: { type: "string", description: "LOW, HIGH ou CRITICAL" },
      details: { type: "string", description: "JSON com detalhes da análise" },
    },
    required: ["target", "type", "risk_level", "details"],
  },
  async ({ target, type, risk_level, details }) => {
    const { qdrantUpsert, ensureCollection, COLLECTIONS } = await import("./tools/qdrant-tools.mjs");

    // Criar collection se não existir
    const collectionName = "fazai_threats";
    await ensureCollection(collectionName);

    // Gerar embedding do target
    const response = await fetch(`${ollamaUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "nomic-embed-text",
        prompt: `${type}: ${target} - ${risk_level} threat. ${details}`,
      }),
    });

    const embData = await response.json();
    const vector = embData.embedding;

    // Ensure 768 dimensions (nomic-embed-text native)
    if (vector.length > 768) vector.length = 768;

    const point = {
      id: Date.now(),
      vector,
      payload: {
        target,
        type,
        risk_level,
        details: JSON.parse(details),
        indexed_at: new Date().toISOString(),
        source: "fazai-threat-intel",
      },
    };

    await qdrantUpsert(collectionName, [point]);

    return JSON.stringify({
      success: true,
      message: `Ameaça indexada: ${target} (${risk_level})`,
      collection: collectionName,
    });
  }
);

// ============================================================================
// Tool: Search Known Threats
// ============================================================================
defTool(
  "search_threats",
  "Busca ameaças conhecidas no Qdrant",
  {
    type: "object",
    properties: {
      query: { type: "string", description: "Termo de busca" },
      limit: { type: "number", description: "Número de resultados", default: 10 },
    },
    required: ["query"],
  },
  async ({ query, limit = 10 }) => {
    const { qdrantSearch, ensureCollection } = await import("./tools/qdrant-tools.mjs");

    const collectionName = "fazai_threats";
    await ensureCollection(collectionName);

    // Gerar embedding da query
    const response = await fetch(`${ollamaUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "nomic-embed-text",
        prompt: query,
      }),
    });

    const embData = await response.json();
    const vector = embData.embedding;

    // Ensure 768 dimensions (nomic-embed-text native)
    if (vector.length > 768) vector.length = 768;

    const results = await qdrantSearch(collectionName, vector, limit);
    return JSON.stringify(results, null, 2);
  }
);

// ============================================================================
// Main Prompt
// ============================================================================
$`
Você é um analista de Threat Intelligence do FazAI.

TARGET: ${target}
TYPE: ${targetType}

MISSÃO:
1. Analise o target usando as ferramentas disponíveis
2. Para IP: use check_ip_rbl e check_abuseipdb
3. Para domain: use check_domain_reputation
4. Para hash: use check_hash_virustotal
5. Compile um relatório de risco
6. ${saveToQdrant ? "Indexe a ameaça no Qdrant usando index_threat" : "NÃO indexar (save=false)"}

FORMATO DO RELATÓRIO:
\`\`\`
🎯 TARGET: [target]
📊 TIPO: [ip/domain/hash]
⚠️  NÍVEL DE RISCO: [LOW/HIGH/CRITICAL]

📋 RESUMO:
- [principais achados]

🔍 DETALHES:
- RBLs listadas: X de Y
- [outros detalhes relevantes]

💡 RECOMENDAÇÃO:
- [ação sugerida]
\`\`\`

Seja objetivo e técnico. Foque em informações acionáveis.
`;
