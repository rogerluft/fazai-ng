"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import * as api from "@/lib/api";
import { useFazaiStore } from "@/lib/store";
import { Plus, Trash2, Check } from "lucide-react";
import type { KnowledgeBase } from "@/types/fazai";

const queryClient = new QueryClient();

function KnowledgeContent() {
  const { setLoading, setError } = useFazaiStore();
  const [showForm, setShowForm] = useState(false);
  const [newKb, setNewKb] = useState<Partial<KnowledgeBase>>({
    category: "networking",
  });

  const { data: knowledge = [], isLoading, refetch } = useQuery({
    queryKey: ["knowledge"],
    queryFn: () => api.getKnowledge(100),
  });

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  const createMutation = useMutation({
    mutationFn: (kb: KnowledgeBase) => api.createKnowledge(kb),
    onSuccess: () => {
      refetch();
      setShowForm(false);
      setNewKb({ category: "networking" });
    },
    onError: (error) => {
      setError(String(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (slug: string) => api.deleteKnowledge(slug),
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      setError(String(error));
    },
  });

  const handleCreate = () => {
    if (newKb.slug && newKb.title && newKb.summary && newKb.category) {
      createMutation.mutate(newKb as KnowledgeBase);
    }
  };

  const categories = [
    { id: "networking", label: "Networking" },
    { id: "storage", label: "Storage" },
    { id: "security", label: "Security" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
        <p className="text-muted-foreground">
          Manage and organize the agent's knowledge repository
        </p>
      </div>

      <div className="grid gap-6">
        {/* Add Knowledge Form */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle>Add Knowledge</CardTitle>
              <CardDescription>Add new knowledge to the base</CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setShowForm(!showForm)}
              variant={showForm ? "outline" : "default"}
            >
              <Plus className="h-4 w-4" />
              {showForm ? "Cancel" : "New Entry"}
            </Button>
          </CardHeader>
          {showForm && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Slug</label>
                  <Input
                    placeholder="e.g., docker-networking"
                    value={newKb.slug || ""}
                    onChange={(e) => setNewKb({ ...newKb, slug: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    placeholder="e.g., Docker Networking Guide"
                    value={newKb.title || ""}
                    onChange={(e) => setNewKb({ ...newKb, title: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Summary</label>
                <textarea
                  placeholder="Brief summary..."
                  value={newKb.summary || ""}
                  onChange={(e) => setNewKb({ ...newKb, summary: e.target.value })}
                  className="w-full h-20 px-3 py-2 rounded-md border border-input bg-background"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <select
                    value={newKb.category || "networking"}
                    onChange={(e) =>
                      setNewKb({ ...newKb, category: e.target.value as any })
                    }
                    className="w-full px-3 py-2 rounded-md border border-input bg-background"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Scope</label>
                  <Input
                    placeholder="e.g., cluster"
                    value={newKb.scope || ""}
                    onChange={(e) => setNewKb({ ...newKb, scope: e.target.value as any })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Confidence</label>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    placeholder="0.0-1.0"
                    value={newKb.confidence || ""}
                    onChange={(e) =>
                      setNewKb({
                        ...newKb,
                        confidence: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <Button onClick={handleCreate} className="w-full">
                <Check className="h-4 w-4" />
                Create Entry
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Knowledge Entries */}
        <Card>
          <CardHeader>
            <CardTitle>Knowledge Entries</CardTitle>
            <CardDescription>Total: {knowledge.length} entries</CardDescription>
          </CardHeader>
          <CardContent>
            {knowledge.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No knowledge entries yet. Create your first entry!
              </div>
            ) : (
              <div className="grid gap-4">
                {knowledge.map((entry) => (
                  <div
                    key={entry.slug}
                    className="border border-border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="font-semibold">{entry.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {entry.summary}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteMutation.mutate(entry.slug)}
                        className="text-muted-foreground hover:text-destructive p-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <Badge variant="secondary">{entry.category}</Badge>
                      {entry.scope && <Badge variant="outline">{entry.scope}</Badge>}
                      {entry.validated && <Badge variant="success">Validated</Badge>}
                      {entry.confidence && (
                        <span className="text-xs text-muted-foreground">
                          Confidence: {(entry.confidence * 100).toFixed(0)}%
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

export default function KnowledgePage() {
  return (
    <QueryClientProvider client={queryClient}>
      <KnowledgeContent />
    </QueryClientProvider>
  );
}
