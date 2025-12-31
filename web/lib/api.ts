
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
  PersonalityTrait,
} from "@/types/fazai";

const apiClient = axios.create({
  baseURL: "/api",
  timeout: 10000,
});

// Personality endpoints
export async function getPersonality(): Promise<Personality> {
  const response = await apiClient.get<Personality>("/personality");
  return response.data;
}

export async function addTrait(trait: PersonalityTrait): Promise<void> {
  // @todo: This is a placeholder. The backend PUT handler replaces the
  // entire personality, so a full implementation requires fetching the
  // current personality, adding the new trait, and then PUTting the
  // entire object back. This is too complex for the current scope.
  console.warn("addTrait is not fully implemented and is a placeholder.");
  return Promise.resolve();
}

export async function removeTrait(traitName: string): Promise<void> {
  // @todo: Similar to addTrait, this is a placeholder.
  console.warn("removeTrait is not fully implemented and is a placeholder.");
  return Promise.resolve();
}


// Source Code endpoints
export async function getSourceCode(limit: number = 100): Promise<SourceCode[]> {
  const response = await apiClient.get<SourceCode[]>("/source", {
    params: { limit },
  });
  return response.data;
}

export default apiClient;
