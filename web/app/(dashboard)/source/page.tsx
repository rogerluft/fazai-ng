"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import * as api from "@/lib/api";
import { useJarvisStore } from "@/lib/store";
import { Code, Search, FileText, Calendar } from "lucide-react";
import type { SourceCode } from "@/types/fazai";

const queryClient = new QueryClient();

function SourceContent() {
  const { setLoading } = useJarvisStore();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: sourceItems = [], isLoading } = useQuery({
    queryKey: ["source-code"],
    queryFn: () => api.getSourceCode(200),
  });

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  const filteredItems = sourceItems.filter(item => 
    item.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Source Code Index</h1>
        <p className="text-muted-foreground">
          Explore the auto-indexed source code and metadata (Metacognition)
        </p>
      </div>

      <div className="flex items-center gap-2 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by path, filename or category..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-6">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading indexed source code...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
            No source items found matching your search.
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredItems.map((item) => (
              <Card key={item.semantic_id} className="overflow-hidden">
                <CardHeader className="bg-muted/30 pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-md">
                        {item.is_jsdoc ? <FileText className="h-4 w-4 text-primary" /> : <Code className="h-4 w-4 text-primary" />}
                      </div>
                      <div>
                        <CardTitle className="text-base font-mono">{item.filename}</CardTitle>
                        <CardDescription className="text-xs font-mono">{item.path}</CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={item.importance_weight >= 0.9 ? "default" : "secondary"}>
                        Weight: {item.importance_weight.toFixed(1)}
                      </Badge>
                      <Badge variant="outline">{item.category}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="bg-black/90 rounded-md p-4 overflow-x-auto max-h-[300px]">
                    <pre className="text-xs text-emerald-400 font-mono">
                      <code>{item.content}</code>
                    </pre>
                  </div>
                  
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      Indexed: {new Date(item.indexed_at).toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">v{item.fazai_version}</Badge>
                    </div>
                    {item.functions && item.functions.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold">Functions:</span> {item.functions.join(", ")}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SourcePage() {
  return (
    <QueryClientProvider client={queryClient}>
      <SourceContent />
    </QueryClientProvider>
  );
}
