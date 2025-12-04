#!/usr/bin/env npx ts-node
/**
 * FazAI Personality Importer
 *
 * Importa conversas do Claude Desktop e extrai traços de personalidade
 * para a collection fazai_personality com embeddings REAIS.
 *
 * Uso:
 *   npx ts-node scripts/import-personality.ts ./claudio15-11-25/conversations.json
 */

import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { QdrantClient } from "@qdrant/js-client-rest";
import { createEmbeddingService, getEmbeddingDimension } from "../src/services/embeddings";
import { getConfigValue } from "../src/config";
import { initLogger, logger } from "../src/logger";

// Inicializar logger
initLogger({ levelOverride: "info" });

// Tipos para Claude Desktop Export
interface ClaudeMessage {
    uuid: string;
    text: string;
    sender: "human" | "assistant";
    created_at: string;
    content?: Array<{
        type: string;
        text?: string;
        name?: string;
        input?: any;
    }>;
}

interface ClaudeConversation {
    uuid: string;
    name: string;
    summary?: string;
    created_at: string;
    updated_at: string;
    chat_messages: ClaudeMessage[];
}

// Categorias de traços de personalidade
const PERSONALITY_CATEGORIES = {
    communication: ["resposta", "explicação", "linguagem", "tom", "estilo"],
    technical: ["linux", "rede", "docker", "kubernetes", "segurança", "firewall"],
    problemSolving: ["debug", "troubleshoot", "resolver", "diagnosticar", "análise"],
    values: ["ética", "segurança", "privacidade", "eficiência", "automação"],
    expertise: ["conhecimento", "experiência", "especialidade", "habilidade"],
};

// Extrai traços de personalidade a partir de conversas
function extractPersonalityTraits(conversations: ClaudeConversation[]): Array<{
    trait_name: string;
    category: string;
    value: string;
    intensity: number;
    context: string;
    tags: string[];
}> {
    const traits: Array<{
        trait_name: string;
        category: string;
        value: string;
        intensity: number;
        context: string;
        tags: string[];
    }> = [];

    // Analisar padrões nas conversas
    const technicalTopics: Map<string, number> = new Map();
    const problemPatterns: string[] = [];
    const communicationStyles: string[] = [];

    for (const conv of conversations) {
        if (!conv.chat_messages || conv.chat_messages.length === 0) continue;

        for (const msg of conv.chat_messages) {
            if (msg.sender !== "assistant") continue;

            const text = msg.text || "";
            if (!text || text.length < 50) continue;

            // Detectar tópicos técnicos
            const techPatterns = {
                linux: /linux|ubuntu|debian|centos|systemctl|apt|yum|bash/gi,
                networking: /rede|network|ip|dns|firewall|iptables|router/gi,
                docker: /docker|container|kubernetes|k8s|pod/gi,
                security: /segurança|security|ssl|tls|certificado|permissão/gi,
                monitoring: /monitor|prometheus|grafana|log|alert/gi,
            };

            for (const [topic, pattern] of Object.entries(techPatterns)) {
                const matches = text.match(pattern);
                if (matches) {
                    technicalTopics.set(topic, (technicalTopics.get(topic) || 0) + matches.length);
                }
            }

            // Detectar estilos de comunicação
            if (text.includes("passo a passo") || text.includes("step by step")) {
                communicationStyles.push("metodico");
            }
            if (text.includes("exemplo") || text.includes("exemplo prático")) {
                communicationStyles.push("pratico");
            }
            if (text.match(/```[\s\S]*```/)) {
                communicationStyles.push("tecnico");
            }

            // Detectar abordagem de resolução de problemas
            if (text.includes("primeiro") && text.includes("depois")) {
                problemPatterns.push("sequencial");
            }
            if (text.includes("alternativa") || text.includes("outra opção")) {
                problemPatterns.push("flexivel");
            }
        }
    }

    // Criar traços a partir da análise
    // 1. Expertise técnica
    const sortedTopics = [...technicalTopics.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [topic, count] of sortedTopics) {
        traits.push({
            trait_name: `expertise_${topic}`,
            category: "technical",
            value: `Especialização em ${topic} demonstrada em ${count} interações. Conhecimento profundo aplicado em troubleshooting e implementação.`,
            intensity: Math.min(1.0, count / 50),
            context: "conversa-historico",
            tags: [topic, "expertise", "tecnico"],
        });
    }

    // 2. Estilo de comunicação
    const styleCount = communicationStyles.reduce((acc, style) => {
        acc[style] = (acc[style] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    for (const [style, count] of Object.entries(styleCount)) {
        if (count > 5) {
            traits.push({
                trait_name: `communication_${style}`,
                category: "communication",
                value: `Estilo de comunicação ${style}. Preferência por explicações ${style === "metodico" ? "passo a passo" : style === "pratico" ? "com exemplos práticos" : "técnicas detalhadas"
                    }.`,
                intensity: Math.min(1.0, count / 20),
                context: "estilo-comunicacao",
                tags: ["comunicação", style],
            });
        }
    }

    // 3. Abordagem de resolução de problemas
    const patternCount = problemPatterns.reduce((acc, pattern) => {
        acc[pattern] = (acc[pattern] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    for (const [pattern, count] of Object.entries(patternCount)) {
        if (count > 3) {
            traits.push({
                trait_name: `problem_solving_${pattern}`,
                category: "problemSolving",
                value: `Abordagem ${pattern} para resolução de problemas. ${pattern === "sequencial" ? "Segue metodologia estruturada." : "Considera múltiplas alternativas."
                    }`,
                intensity: Math.min(1.0, count / 15),
                context: "resolucao-problemas",
                tags: ["troubleshooting", pattern],
            });
        }
    }

    // 4. Traços fixos de base
    traits.push({
        trait_name: "base_linux_admin",
        category: "expertise",
        value: "Administrador Linux sênior com foco em automação, segurança e infraestrutura de rede. Experiência em ambientes de produção.",
        intensity: 1.0,
        context: "personalidade-base",
        tags: ["linux", "admin", "senior"],
    });

    traits.push({
        trait_name: "base_communication",
        category: "communication",
        value: "Comunicação técnica clara e objetiva. Preferência por soluções práticas com comandos executáveis.",
        intensity: 0.9,
        context: "personalidade-base",
        tags: ["comunicação", "tecnico"],
    });

    traits.push({
        trait_name: "base_security_first",
        category: "values",
        value: "Segurança como prioridade em todas as operações. Sempre inclui verificações e rollback quando possível.",
        intensity: 0.95,
        context: "personalidade-base",
        tags: ["segurança", "valores"],
    });

    return traits;
}

function generateId(input: string): string {
    return createHash("md5").update(input).digest("hex");
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log("Uso: npx ts-node scripts/import-personality.ts <arquivo.json>");
        console.log("Exemplo: npx ts-node scripts/import-personality.ts ./claudio15-11-25/conversations.json");
        process.exit(1);
    }

    const filePath = args[0];
    if (!fs.existsSync(filePath)) {
        console.error(`Arquivo não encontrado: ${filePath}`);
        process.exit(1);
    }

    console.log("\n🧠 FazAI Personality Importer");
    console.log("━".repeat(50));
    console.log(`📁 Arquivo: ${filePath}`);

    // Carregar conversas
    console.log("\n📖 Carregando conversas...");
    const content = fs.readFileSync(filePath, "utf-8");
    const conversations: ClaudeConversation[] = JSON.parse(content);
    console.log(`   Encontradas: ${conversations.length} conversas`);

    // Filtrar conversas com mensagens
    const validConversations = conversations.filter((c) => c.chat_messages && c.chat_messages.length > 0);
    console.log(`   Com mensagens: ${validConversations.length}`);

    // Extrair traços de personalidade
    console.log("\n🔍 Extraindo traços de personalidade...");
    const traits = extractPersonalityTraits(validConversations);
    console.log(`   Traços encontrados: ${traits.length}`);

    // Inicializar serviço de embeddings
    console.log("\n🔗 Conectando ao serviço de embeddings...");
    const embeddingService = await createEmbeddingService();
    const embeddingInfo = embeddingService.getInfo();
    console.log(`   Provider: ${embeddingInfo.provider}`);
    console.log(`   Modelo: ${embeddingInfo.model}`);
    console.log(`   Dimensão: ${embeddingInfo.dimension}`);

    // Verificar dimensão do Qdrant
    const qdrantUrl = getConfigValue("QDRANT_URL") || "http://localhost:6333";
    const client = new QdrantClient({ url: qdrantUrl });

    // Verificar collection
    try {
        const collectionInfo = await client.getCollection("fazai_personality");
        const collectionDim = (collectionInfo.config?.params?.vectors as any)?.size;
        console.log(`\n📦 Collection fazai_personality: ${collectionDim} dimensões`);

        if (collectionDim !== embeddingInfo.dimension) {
            console.error(`\n❌ ERRO: Dimensão incompatível!`);
            console.error(`   Collection: ${collectionDim} dim`);
            console.error(`   Embedding service: ${embeddingInfo.dimension} dim`);
            console.error(`\n💡 Solução: Recrie a collection com a dimensão correta:`);
            console.error(`   fazai vector recreate --dimension=${embeddingInfo.dimension}`);
            process.exit(1);
        }
    } catch (error: any) {
        console.error(`❌ Erro ao verificar collection: ${error.message}`);
        console.error(`💡 Execute: fazai vector validate`);
        process.exit(1);
    }

    // Gerar embeddings e inserir no Qdrant
    console.log("\n⚡ Gerando embeddings e inserindo no Qdrant...");
    const points: Array<{
        id: string;
        vector: number[];
        payload: Record<string, any>;
    }> = [];

    for (let i = 0; i < traits.length; i++) {
        const trait = traits[i];
        const textToEmbed = `${trait.trait_name}: ${trait.value}`;

        process.stdout.write(`   [${i + 1}/${traits.length}] ${trait.trait_name}... `);

        try {
            const vector = await embeddingService.generate(textToEmbed);
            points.push({
                id: generateId(`personality-${trait.trait_name}`),
                vector,
                payload: {
                    trait_name: trait.trait_name,
                    category: trait.category,
                    value: trait.value,
                    intensity: trait.intensity,
                    context: trait.context,
                    tags: trait.tags,
                    imported_at: new Date().toISOString(),
                    source: "claude-desktop-conversations",
                },
            });
            console.log("✓");
        } catch (error: any) {
            console.log(`✗ (${error.message})`);
        }
    }

    // Inserir no Qdrant
    if (points.length > 0) {
        console.log(`\n📤 Inserindo ${points.length} pontos no Qdrant...`);
        await client.upsert("fazai_personality", {
            wait: true,
            points,
        });
        console.log("   ✓ Inserção concluída!");
    }

    // Resumo
    console.log("\n━".repeat(50));
    console.log("📊 Resumo da importação:");
    console.log(`   Conversas analisadas: ${validConversations.length}`);
    console.log(`   Traços extraídos: ${traits.length}`);
    console.log(`   Embeddings gerados: ${points.length}`);
    console.log(`   Collection: fazai_personality`);
    console.log("\n✅ Importação concluída com sucesso!");
}

main().catch((error) => {
    console.error("\n❌ Erro fatal:", error.message);
    process.exit(1);
});
