import axios from "axios";
import type {
  AgentStatus,
  Action,
  Personality,
  Memory,
  Learning,
  KnowledgeBase,
  InferenceRule,
} from "@/types/jarvis";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
  timeout: 10000,
});

// Agent Status endpoints
export async function getAgentStatus(): Promise<AgentStatus> {
  const response = await apiClient.get<AgentStatus>("/api/agent/status");
  return response.data;
}

export async function getRecentActions(limit: number = 50): Promise<Action[]> {
  const response = await apiClient.get<Action[]>("/api/agent/actions", {
    params: { limit },
  });
  return response.data;
}

export async function pauseAgent(): Promise<void> {
  await apiClient.post("/api/agent/pause");
}

export async function resumeAgent(): Promise<void> {
  await apiClient.post("/api/agent/resume");
}

export async function stopAgent(): Promise<void> {
  await apiClient.post("/api/agent/stop");
}

// Personality endpoints
export async function getPersonality(): Promise<Personality> {
  const response = await apiClient.get<Personality>("/api/personality");
  return response.data;
}

export async function updatePersonality(
  personality: Partial<Personality>
): Promise<Personality> {
  const response = await apiClient.put<Personality>(
    "/api/personality",
    personality
  );
  return response.data;
}

export async function addTrait(trait: any): Promise<void> {
  await apiClient.post("/api/personality/traits", trait);
}

export async function removeTrait(traitName: string): Promise<void> {
  await apiClient.delete(`/api/personality/traits/${traitName}`);
}

// Memory endpoints
export async function searchMemory(
  query: string,
  limit?: number
): Promise<Memory[]> {
  const response = await apiClient.get<Memory[]>("/api/memory/search", {
    params: { query, limit },
  });
  return response.data;
}

export async function getMemoryByRole(role: string): Promise<Memory[]> {
  const response = await apiClient.get<Memory[]>(
    `/api/memory/by-role/${role}`
  );
  return response.data;
}

// Learning endpoints
export async function getLearning(limit?: number): Promise<Learning[]> {
  const response = await apiClient.get<Learning[]>("/api/learning", {
    params: { limit },
  });
  return response.data;
}

export async function getLearningStats() {
  const response = await apiClient.get("/api/learning/stats");
  return response.data;
}

export async function addLearning(learning: Learning): Promise<void> {
  await apiClient.post("/api/learning", learning);
}

// Knowledge Base endpoints
export async function getKnowledge(limit?: number): Promise<KnowledgeBase[]> {
  const response = await apiClient.get<KnowledgeBase[]>("/api/knowledge", {
    params: { limit },
  });
  return response.data;
}

export async function createKnowledge(
  knowledge: KnowledgeBase
): Promise<KnowledgeBase> {
  const response = await apiClient.post<KnowledgeBase>(
    "/api/knowledge",
    knowledge
  );
  return response.data;
}

export async function updateKnowledge(
  slug: string,
  knowledge: Partial<KnowledgeBase>
): Promise<KnowledgeBase> {
  const response = await apiClient.put<KnowledgeBase>(
    `/api/knowledge/${slug}`,
    knowledge
  );
  return response.data;
}

export async function deleteKnowledge(slug: string): Promise<void> {
  await apiClient.delete(`/api/knowledge/${slug}`);
}

// Inference Rules endpoints
export async function getRules(limit?: number): Promise<InferenceRule[]> {
  const response = await apiClient.get<InferenceRule[]>("/api/rules", {
    params: { limit },
  });
  return response.data;
}

export async function createRule(rule: InferenceRule): Promise<InferenceRule> {
  const response = await apiClient.post<InferenceRule>("/api/rules", rule);
  return response.data;
}

export async function updateRule(
  ruleId: string,
  rule: Partial<InferenceRule>
): Promise<InferenceRule> {
  const response = await apiClient.put<InferenceRule>(
    `/api/rules/${ruleId}`,
    rule
  );
  return response.data;
}

export async function deleteRule(ruleId: string): Promise<void> {
  await apiClient.delete(`/api/rules/${ruleId}`);
}

export async function testRule(ruleId: string): Promise<any> {
  const response = await apiClient.post(`/api/rules/${ruleId}/test`);
  return response.data;
}

export default apiClient;
