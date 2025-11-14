import { create } from "zustand";
import type { AgentStatus, Action } from "@/types/jarvis";

interface JarvisStore {
  agentStatus: AgentStatus | null;
  recentActions: Action[];
  isLoading: boolean;
  error: string | null;

  setAgentStatus: (status: AgentStatus) => void;
  addAction: (action: Action) => void;
  setRecentActions: (actions: Action[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearActions: () => void;
}

const defaultAgentStatus: AgentStatus = {
  status: "offline",
  uptime_seconds: 0,
  actions_per_minute: 0,
  success_rate: 0,
  total_actions: 0,
  errors_count: 0,
  memory_usage_mb: 0,
  cpu_usage_percent: 0,
};

export const useJarvisStore = create<JarvisStore>((set) => ({
  agentStatus: defaultAgentStatus,
  recentActions: [],
  isLoading: false,
  error: null,

  setAgentStatus: (status: AgentStatus) =>
    set({ agentStatus: status, error: null }),

  addAction: (action: Action) =>
    set((state) => ({
      recentActions: [action, ...state.recentActions].slice(0, 50),
    })),

  setRecentActions: (actions: Action[]) =>
    set({ recentActions: actions }),

  setLoading: (loading: boolean) =>
    set({ isLoading: loading }),

  setError: (error: string | null) =>
    set({ error }),

  clearActions: () =>
    set({ recentActions: [] }),
}));
