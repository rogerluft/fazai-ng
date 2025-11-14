"use client";

import React, { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useJarvisStore } from "@/lib/store";
import * as api from "@/lib/api";
import { Play, Pause, Square } from "lucide-react";

export function AgentStatus() {
  const { agentStatus, setAgentStatus, setLoading, setError } = useJarvisStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["agent-status"],
    queryFn: api.getAgentStatus,
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  useEffect(() => {
    if (data) {
      setAgentStatus(data);
    }
  }, [data, setAgentStatus]);

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  useEffect(() => {
    if (error) {
      setError(String(error));
    }
  }, [error, setError]);

  if (isLoading && !agentStatus) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  const status = agentStatus || ({
    status: "offline",
    uptime_seconds: 0,
    actions_per_minute: 0,
    success_rate: 0,
    total_actions: 0,
    errors_count: 0,
    memory_usage_mb: 0,
    cpu_usage_percent: 0,
  } as any);

  const statusColor = {
    online: "success",
    offline: "destructive",
    paused: "warning",
  } as const;

  const handlePause = async () => {
    try {
      setLoading(true);
      await api.pauseAgent();
      refetch();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    try {
      setLoading(true);
      await api.resumeAgent();
      refetch();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    try {
      setLoading(true);
      await api.stopAgent();
      refetch();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const uptime = Math.floor(status.uptime_seconds / 3600);
  const uptimeMinutes = Math.floor((status.uptime_seconds % 3600) / 60);

  return (
    <Card className="col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Agent Status</CardTitle>
            <CardDescription>Terminal Jarvis autonomous agent</CardDescription>
          </div>
          <Badge variant={statusColor[status.status as keyof typeof statusColor]}>
            {status.status.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Status Overview */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Uptime</p>
              <p className="text-2xl font-bold">
                {uptime}h {uptimeMinutes}m
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Actions/Min</p>
              <p className="text-2xl font-bold">
                {status.actions_per_minute.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Success Rate</p>
              <p className="text-2xl font-bold">
                {(status.success_rate * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Actions</p>
              <p className="text-2xl font-bold">{status.total_actions}</p>
            </div>
          </div>

          {/* System Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Memory Usage</p>
              <p className="text-lg font-semibold">{status.memory_usage_mb}MB</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">CPU Usage</p>
              <p className="text-lg font-semibold">{status.cpu_usage_percent}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Errors</p>
              <p className="text-lg font-semibold text-red-500">
                {status.errors_count}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Action</p>
              <p className="text-lg font-semibold truncate">
                {status.last_action || "—"}
              </p>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex gap-2">
            {status.status === "online" && (
              <Button variant="outline" size="sm" onClick={handlePause}>
                <Pause className="h-4 w-4" />
                Pause
              </Button>
            )}
            {status.status === "paused" && (
              <Button variant="outline" size="sm" onClick={handleResume}>
                <Play className="h-4 w-4" />
                Resume
              </Button>
            )}
            <Button variant="destructive" size="sm" onClick={handleStop}>
              <Square className="h-4 w-4" />
              Stop
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
