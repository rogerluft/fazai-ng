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
  baseURL: "",
  timeout: 10000,
});

// Agent Status & Actions
export async function getAgentStatus(): Promise<AgentStatus> {
  const response = await apiClient.get<AgentStatus>("/api/agent/status");
  return response.data;
}

export async function pauseAgent(): Promise<void> { await apiClient.post("/api/agent/pause"); }
export async function resumeAgent(): Promise<void> { await apiClient.post("/api/agent/resume"); }
export async function stopAgent(): Promise<void> { await apiClient.post("/api/agent/stop"); }

export async function getRecentActions(limit: number = 10): Promise<Action[]> {
  try {
    const response = await apiClient.get<{ actions: Action[] }>("/api/agent/actions", {
      params: { limit },
    });
    return response.data.actions || [];
  } catch {
    return [];
  }
}

// Inference Rules
export async function getRules(limit: number = 100): Promise<InferenceRule[]> {
  try {
    const response = await apiClient.get<{ rules: InferenceRule[] }>("/api/rules", {
      params: { limit },
    });
    return response.data.rules || [];
  } catch {
    return [];
  }
}

export async function createRule(rule: Partial<InferenceRule>): Promise<void> {
  await apiClient.post("/api/rules", rule);
}

export async function updateRule(id: string, rule: Partial<InferenceRule>): Promise<void> {
  await apiClient.put(`/api/rules/${id}`, rule);
}

export async function deleteRule(id: string): Promise<void> {
  await apiClient.delete("/api/rules", { params: { rule_id: id } });
}

export async function testRule(id: string): Promise<{ success: boolean; result: string }> {
  const response = await apiClient.post(`/api/rules/${id}`, { action: "test" });
  return response.data;
}

// Knowledge Base
export async function getKnowledge(limit: number = 100): Promise<KnowledgeBase[]> {
  try {
    const response = await apiClient.get<{ knowledge: KnowledgeBase[] }>("/api/knowledge", {
      params: { limit },
    });
    return response.data.knowledge || [];
  } catch {
    return [];
  }
}

export async function createKnowledge(kb: Partial<KnowledgeBase>): Promise<void> {
  await apiClient.post("/api/knowledge", kb);
}

export async function deleteKnowledge(id: string): Promise<void> {
  await apiClient.delete(`/api/knowledge/${id}`);
}

// Learning
export async function getLearning(limit: number = 100): Promise<Learning[]> {
  try {
    const response = await apiClient.get<{ learnings: Learning[] }>("/api/learning", {
      params: { limit },
    });
    return response.data.learnings || [];
  } catch {
    return [];
  }
}

// Memory
export async function searchMemory(query: string, limit: number = 10): Promise<Memory[]> {
  try {
    const response = await apiClient.get<{ memories: Memory[] }>("/api/memory/search", {
      params: { query, limit },
    });
    return response.data.memories || [];
  } catch {
    return [];
  }
}

export async function getMemoryByRole(role: string, limit: number = 50): Promise<Memory[]> {
  try {
    const response = await apiClient.get<Memory[]>(`/api/memory/by-role/${role}`);
    return response.data || [];
  } catch {
    return [];
  }
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
