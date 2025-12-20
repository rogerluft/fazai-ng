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

// ... (existing functions)

// Source Code endpoints
export async function getSourceCode(limit: number = 100): Promise<SourceCode[]> {
  const response = await apiClient.get<SourceCode[]>("/api/source", {
    params: { limit },
  });
  return response.data;
}

export default apiClient;
