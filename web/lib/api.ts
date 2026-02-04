import axios from "axios";
import type {
  AgentStatus,
  Action,
  Personality,
  Memory,
  Learning,
  KnowledgeBase,
  InferenceRule,
  SourceCode,
} from "@/types/fazai";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
  timeout: 10000,
});

// Agent Status & Actions
export async function getAgentStatus(): Promise<AgentStatus> {
  // MOCK: Returns a default online status
  return Promise.resolve({ status: "online", uptime_seconds: 3600, actions_per_minute: 10, success_rate: 99, total_actions: 1000, errors_count: 5, memory_usage_mb: 512, cpu_usage_percent: 25 });
}

export async function pauseAgent(): Promise<void> { await apiClient.post("/api/agent/pause"); }
export async function resumeAgent(): Promise<void> { await apiClient.post("/api/agent/resume"); }
export async function stopAgent(): Promise<void> { await apiClient.post("/api/agent/stop"); }

export async function getRecentActions(limit: number = 10): Promise<Action[]> {
  return Promise.resolve([]);
}

// Inference Rules
export async function getRules(limit: number = 100): Promise<InferenceRule[]> {
    return Promise.resolve([]);
}
export async function createRule(rule: Partial<InferenceRule>): Promise<void> { }
export async function updateRule(id: string, rule: Partial<InferenceRule>): Promise<void> { }
export async function deleteRule(id: string): Promise<void> { }
export async function testRule(id: string): Promise<{ success: boolean; result: string }> {
    return Promise.resolve({ success: true, result: "mocked response" });
}

// Knowledge Base
export async function getKnowledge(limit: number = 100): Promise<KnowledgeBase[]> {
    return Promise.resolve([]);
}
export async function createKnowledge(kb: Partial<KnowledgeBase>): Promise<void> { }
export async function deleteKnowledge(id: string): Promise<void> { }

// Learning
export async function getLearning(limit: number = 100): Promise<Learning[]> {
    return Promise.resolve([]);
}

// Memory
export async function searchMemory(query: string, limit: number = 10): Promise<Memory[]> {
    return Promise.resolve([]);
}

export async function getMemoryByRole(role: string, limit: number = 50): Promise<Memory[]> {
    return Promise.resolve([]);
}

// Personality
export async function getPersonality(): Promise<Personality> {
  const response = await apiClient.get<Personality>("/api/personality");
  return response.data;
}

export async function addTrait(trait: any): Promise<void> {
  await apiClient.post("/api/personality/traits", trait);
}

export async function removeTrait(name: string): Promise<void> {
  await apiClient.delete("/api/personality/traits", {
    params: { trait_name: name },
  });
}

export async function updateTrait(trait: any): Promise<void> {
  await apiClient.put("/api/personality/traits", trait);
}

// Source Code endpoints
export async function getSourceCode(limit: number = 100): Promise<SourceCode[]> {
  try {
    const response = await apiClient.get<SourceCode[]>("/api/source", {
      params: { limit },
    });
    return response.data;
  } catch (error) {
    console.error("Failed to get source code:", error);
    return [];
  }
}

export default apiClient;

// This export map ensures all functions are available under a single 'api' import
export const api = {
  getAgentStatus,
  pauseAgent,
  resumeAgent,
  stopAgent,
  getRecentActions,
  getRules,
  createRule,
  updateRule,
  deleteRule,
  testRule,
  getKnowledge,
  createKnowledge,
  deleteKnowledge,
  getLearning,
  searchMemory,
  getMemoryByRole,
  getPersonality,
  addTrait,
  removeTrait,
  updateTrait,
  getSourceCode,
};
