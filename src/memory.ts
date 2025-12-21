import fs from "fs";
import path from "path";
import { logger } from "./logger";
import { FAZAI_PATHS, ensureFazaiDirectories } from "./utils/paths";

type ChatRole = "user" | "assistant";

export interface ConversationEntry {
  timestamp: string;
  role: ChatRole;
  content: string;
}

const DATA_DIR = FAZAI_PATHS.DATA;
const MEMORY_FILE = FAZAI_PATHS.MEMORY_FILE;
const COMMAND_HISTORY_FILE = FAZAI_PATHS.HISTORY_FILE;

function ensureDataDir(): void {
  ensureFazaiDirectories();
}

function readJsonFile<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) {
      return fallback;
    }
    const raw = fs.readFileSync(file, "utf-8");
    return JSON.parse(raw) as T;
  } catch (error) {
    logger.warn(`⚠️  Falha ao ler ${file}:`, error);
    return fallback;
  }
}

function writeJsonFile(file: string, value: unknown): void {
  try {
    ensureDataDir();
    fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf-8");
  } catch (error) {
    logger.warn(`⚠️  Falha ao salvar ${file}:`, error);
  }
}

export function loadConversationHistory(limit: number = 50): ConversationEntry[] {
  const entries = readJsonFile<ConversationEntry[]>(MEMORY_FILE, []);
  if (!Array.isArray(entries)) {
    return [];
  }
  if (limit <= 0) {
    return entries;
  }
  return entries.slice(-limit);
}

export function appendConversationEntry(entry: ConversationEntry): void {
  const entries = readJsonFile<ConversationEntry[]>(MEMORY_FILE, []);
  entries.push(entry);
  writeJsonFile(MEMORY_FILE, entries.slice(-500)); // Limita crescimento
}

export function loadCommandHistory(limit: number = 100): string[] {
  try {
    if (!fs.existsSync(COMMAND_HISTORY_FILE)) {
      return [];
    }
    const lines = fs.readFileSync(COMMAND_HISTORY_FILE, "utf-8").split(/\r?\n/).filter(Boolean);
    if (limit <= 0) {
      return lines;
    }
    return lines.slice(-limit);
  } catch (error) {
    logger.warn(`⚠️  Falha ao ler histórico de comandos:`, error);
    return [];
  }
}

export function appendCommandHistory(entry: string): void {
  try {
    ensureDataDir();
    fs.appendFileSync(COMMAND_HISTORY_FILE, `${entry}\n`, "utf-8");
  } catch (error) {
    logger.warn(`⚠️  Falha ao salvar histórico de comandos:`, error);
  }
}

export function clearPersistentMemory(): void {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      fs.unlinkSync(MEMORY_FILE);
    }
  } catch (error) {
    logger.warn(`⚠️  Falha ao limpar memória contextual:`, error);
  }
}

export function clearPersistentHistory(): void {
  try {
    if (fs.existsSync(COMMAND_HISTORY_FILE)) {
      fs.unlinkSync(COMMAND_HISTORY_FILE);
    }
  } catch (error) {
    logger.warn(`⚠️  Falha ao limpar histórico de comandos:`, error);
  }
}

// Arquivo para traços de personalidade
const PERSONALITY_FILE = path.join(DATA_DIR, "personality.json");

// Definição da interface para um traço de personalidade
export interface PersonalityTrait {
  trait_id: string; // Identificador único do traço
  category: "expertise" | "communication" | "behavior" | "preferences" | "constraints";
  name: string;
  description: string;
  strength: number; // Força do traço, de 0.0 a 1.0
  active: boolean; // Se o traço está ativo
  last_updated: string; // Timestamp da última atualização
}

/**
 * Carrega todos os traços de personalidade do arquivo.
 * Retorna um array vazio se o arquivo não existir ou for inválido.
 */
export function loadPersonalityTraits(): PersonalityTrait[] {
  return readJsonFile<PersonalityTrait[]>(PERSONALITY_FILE, []);
}

/**
 * Salva todos os traços de personalidade no arquivo, sobrescrevendo o conteúdo.
 * @param traits O array completo de traços de personalidade a ser salvo.
 */
export function savePersonalityTraits(traits: PersonalityTrait[]): void {
  writeJsonFile(PERSONALITY_FILE, traits);
}

/**
 * Atualiza um traço de personalidade específico ou o adiciona se não existir.
 * Esta função implementa a lógica de atualização dinâmica para a evolução ECOA.
 *
 * @param traitUpdate O traço de personalidade com as atualizações a serem aplicadas.
 * @param adjustment O fator de ajuste para a força do traço (ex: +0.05 ou -0.02).
 */
export function updatePersonalityTrait(
  trait_id: string,
  adjustment: number,
  details?: Partial<Omit<PersonalityTrait, "trait_id" | "strength">>
): PersonalityTrait | null {
  const traits = loadPersonalityTraits();
  const traitIndex = traits.findIndex((t) => t.trait_id === trait_id);

  if (traitIndex !== -1) {
    // Atualiza traço existente
    const trait = traits[traitIndex];
    trait.strength = Math.max(0, Math.min(1, trait.strength + adjustment)); // Garante que a força fique entre 0 e 1
    trait.last_updated = new Date().toISOString();

    // Aplica outras atualizações se fornecidas
    if (details) {
      Object.assign(trait, { ...details, trait_id, strength: trait.strength });
    }

    traits[traitIndex] = trait;
    savePersonalityTraits(traits);
    logger.info(`Traço de personalidade atualizado: ${trait.name} (Força: ${trait.strength.toFixed(3)})`);
    return trait;
  } else if (details && details.name && details.category && details.description) {
    // Adiciona novo traço se não existir e detalhes forem fornecidos
    const newTrait: PersonalityTrait = {
      trait_id,
      strength: Math.max(0, Math.min(1, 0.5 + adjustment)), // Começa com força base de 0.5
      last_updated: new Date().toISOString(),
      active: true,
      ...details,
      name: details.name,
      category: details.category,
      description: details.description,
    };
    traits.push(newTrait);
    savePersonalityTraits(traits);
    logger.info(`Novo traço de personalidade adicionado: ${newTrait.name}`);
    return newTrait;
  } else {
    logger.warn(`⚠️  Tentativa de atualizar traço inexistente (${trait_id}) sem detalhes para criação.`);
    return null;
  }
}
