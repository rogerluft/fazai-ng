"use client";

import React, { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useJarvisStore } from "@/lib/store";
import * as api from "@/lib/api";
import { Clock, CheckCircle, AlertCircle, Loader } from "lucide-react";

export function ActionTimeline() {
  const { recentActions, setRecentActions, setLoading } = useJarvisStore();

  const { data, isLoading } = useQuery({
    queryKey: ["recent-actions"],
    queryFn: () => api.getRecentActions(50),
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (data) {
      setRecentActions(data);
    }
  }, [data, setRecentActions]);

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  const actions = recentActions || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "executing":
        return <Loader className="h-4 w-4 animate-spin text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      completed: "success",
      failed: "destructive",
      executing: "info",
      pending: "warning",
    };
    return variants[status] || "default";
  };

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Action Timeline</CardTitle>
        <CardDescription>Last 50 actions from the agent</CardDescription>
      </CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No actions recorded yet
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {actions.map((action) => (
              <div
                key={action.action_id}
                className="flex items-start gap-3 rounded-lg border border-border p-3"
              >
                <div className="mt-1">
                  {getStatusIcon(action.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">
                      {action.type}
                    </span>
                    <Badge variant={getStatusBadge(action.status)}>
                      {action.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {action.description}
                  </p>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(action.timestamp).toLocaleTimeString()}
                    {action.duration_ms && ` • ${action.duration_ms}ms`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
