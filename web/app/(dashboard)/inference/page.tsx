"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import * as api from "@/lib/api";
import { useFazaiStore } from "@/lib/store";
import { Plus, Trash2, Play, ToggleLeft, ToggleRight } from "lucide-react";
import type { InferenceRule } from "@/types/fazai";

const queryClient = new QueryClient();

function InferenceContent() {
  const { setLoading, setError } = useFazaiStore();
  const [showForm, setShowForm] = useState(false);
  const [newRule, setNewRule] = useState<Partial<InferenceRule>>({
    priority: 5,
    enabled: true,
    created_by: "user",
  });

  const { data: rules = [], isLoading, refetch } = useQuery({
    queryKey: ["rules"],
    queryFn: () => api.getRules(100),
  });

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  const createMutation = useMutation({
    mutationFn: (rule: InferenceRule) => api.createRule(rule),
    onSuccess: () => {
      refetch();
      setShowForm(false);
      setNewRule({ priority: 5, enabled: true, created_by: "user" });
    },
    onError: (error) => {
      setError(String(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) => api.deleteRule(ruleId),
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      setError(String(error));
    },
  });

  const testMutation = useMutation({
    mutationFn: (ruleId: string) => api.testRule(ruleId),
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      setError(String(error));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (rule: InferenceRule) =>
      api.updateRule(rule.rule_id, { enabled: !rule.enabled }),
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      setError(String(error));
    },
  });

  const handleCreate = () => {
    if (
      newRule.rule_id &&
      newRule.title &&
      newRule.condition &&
      newRule.action
    ) {
      createMutation.mutate({
        rule_id: newRule.rule_id,
        title: newRule.title,
        description: newRule.description || "",
        condition: newRule.condition,
        action: newRule.action,
        priority: newRule.priority || 5,
        enabled: newRule.enabled || true,
        created_by: newRule.created_by || "user",
        created_at: new Date().toISOString(),
      } as InferenceRule);
    }
  };

  // Sort by priority (descending)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inference Rules</h1>
        <p className="text-muted-foreground">
          Create and manage decision-making rules for the autonomous agent
        </p>
      </div>

      <div className="grid gap-6">
        {/* Create Rule Form */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle>Create Rule</CardTitle>
              <CardDescription>Add a new inference rule</CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setShowForm(!showForm)}
              variant={showForm ? "outline" : "default"}
            >
              <Plus className="h-4 w-4" />
              {showForm ? "Cancel" : "New Rule"}
            </Button>
          </CardHeader>
          {showForm && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Rule ID</label>
                  <Input
                    placeholder="e.g., rule_auto_restart"
                    value={newRule.rule_id || ""}
                    onChange={(e) =>
                      setNewRule({ ...newRule, rule_id: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    placeholder="e.g., Auto Restart Service"
                    value={newRule.title || ""}
                    onChange={(e) =>
                      setNewRule({ ...newRule, title: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  placeholder="Brief description of the rule..."
                  value={newRule.description || ""}
                  onChange={(e) =>
                    setNewRule({ ...newRule, description: e.target.value })
                  }
                  className="w-full h-16 px-3 py-2 rounded-md border border-input bg-background"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Condition</label>
                <textarea
                  placeholder="e.g., service_status == 'down' AND retry_count < 3"
                  value={newRule.condition || ""}
                  onChange={(e) =>
                    setNewRule({ ...newRule, condition: e.target.value })
                  }
                  className="w-full h-16 px-3 py-2 rounded-md border border-input bg-background font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Action</label>
                <textarea
                  placeholder="e.g., restart_service(service_name)"
                  value={newRule.action || ""}
                  onChange={(e) =>
                    setNewRule({ ...newRule, action: e.target.value })
                  }
                  className="w-full h-16 px-3 py-2 rounded-md border border-input bg-background font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  Priority: {newRule.priority}
                </label>
                <Slider
                  value={[newRule.priority || 5]}
                  onValueChange={(value) =>
                    setNewRule({ ...newRule, priority: value[0] })
                  }
                  min={1}
                  max={10}
                  step={1}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Higher priority rules are evaluated first
                </p>
              </div>

              <Button onClick={handleCreate} className="w-full">
                Create Rule
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Rules List */}
        <Card>
          <CardHeader>
            <CardTitle>Inference Rules</CardTitle>
            <CardDescription>Total: {rules.length} rules</CardDescription>
          </CardHeader>
          <CardContent>
            {sortedRules.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No rules defined yet. Create your first rule!
              </div>
            ) : (
              <div className="space-y-3">
                {sortedRules.map((rule) => (
                  <div
                    key={rule.rule_id}
                    className="border border-border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{rule.title}</h4>
                          <button
                            onClick={() => toggleMutation.mutate(rule)}
                            className="p-1 hover:bg-accent rounded"
                          >
                            {rule.enabled ? (
                              <ToggleRight className="h-4 w-4 text-green-500" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {rule.description}
                        </p>
                        <div className="bg-secondary/50 rounded p-2 space-y-1">
                          <p className="text-xs font-mono text-muted-foreground">
                            <strong>Condition:</strong> {rule.condition}
                          </p>
                          <p className="text-xs font-mono text-muted-foreground">
                            <strong>Action:</strong> {rule.action}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => testMutation.mutate(rule.rule_id)}
                          className="p-2 hover:bg-accent rounded"
                          title="Test rule"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(rule.rule_id)}
                          className="p-2 hover:bg-destructive/10 text-destructive rounded"
                          title="Delete rule"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      <Badge variant="secondary">
                        Priority: {rule.priority}
                      </Badge>
                      <Badge variant="outline">
                        {rule.created_by === "user" ? "User" : "Autonomous"}
                      </Badge>
                      {rule.apply_count && (
                        <span className="text-xs text-muted-foreground">
                          Applied {rule.apply_count} times
                        </span>
                      )}
                      {rule.last_applied && (
                        <span className="text-xs text-muted-foreground">
                          Last: {new Date(rule.last_applied).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function InferencePage() {
  return (
    <QueryClientProvider client={queryClient}>
      <InferenceContent />
    </QueryClientProvider>
  );
}
