"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import * as api from "@/lib/api";
import { useJarvisStore } from "@/lib/store";
import { Search } from "lucide-react";

const queryClient = new QueryClient();

function MemoryContent() {
  const { setLoading } = useJarvisStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const { data: memories = [], isLoading } = useQuery({
    queryKey: ["memory", searchQuery],
    queryFn: () =>
      searchQuery ? api.searchMemory(searchQuery) : api.getMemoryByRole("all"),
  });

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  const filteredMemories = selectedRole
    ? memories.filter((m) => m.role === selectedRole)
    : memories;

  const roles = ["user", "assistant", "system", "autonomous"];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Memory</h1>
        <p className="text-muted-foreground">
          Search and explore the agent's conversation history and memories
        </p>
      </div>

      <div className="grid gap-6">
        {/* Search Bar */}
        <Card>
          <CardHeader>
            <CardTitle>Search Memory</CardTitle>
            <CardDescription>
              Search through stored memories using semantic similarity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search memories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => setSearchQuery("")} variant="outline">
                Clear
              </Button>
            </div>

            {/* Role Filter */}
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Filter by role</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedRole === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedRole(null)}
                >
                  All
                </Button>
                {roles.map((role) => (
                  <Button
                    key={role}
                    variant={selectedRole === role ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedRole(role)}
                  >
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>
              Found {filteredMemories.length} memories
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredMemories.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No memories found. Try a different search query.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredMemories.map((memory) => (
                  <div
                    key={`${memory.conversation_id}-${memory.message_id}`}
                    className="border border-border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary">
                        {memory.role.toUpperCase()}
                      </Badge>
                      {memory.importance && (
                        <div className="text-xs">
                          Importance:{" "}
                          <span className="font-semibold">
                            {(memory.importance * 100).toFixed(0)}%
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm line-clamp-3">{memory.content}</p>
                    {memory.summary && (
                      <p className="text-xs text-muted-foreground italic">
                        Summary: {memory.summary}
                      </p>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {new Date(memory.timestamp).toLocaleString()}
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

export default function MemoryPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryContent />
    </QueryClientProvider>
  );
}
