"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AgentStatus } from "@/components/dashboard/agent-status";
import { MetricsPanel } from "@/components/dashboard/metrics-panel";
import { ActionTimeline } from "@/components/dashboard/action-timeline";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      retry: 2,
      retryDelay: (attemptIndex) =>
        Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

export default function DashboardPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and control the Terminal Jarvis autonomous agent
          </p>
        </div>

        <div className="grid gap-6 grid-cols-2">
          <AgentStatus />
          <MetricsPanel />
          <ActionTimeline />
        </div>
      </div>
    </QueryClientProvider>
  );
}
