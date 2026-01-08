"use client";

import React, { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TraitEditor } from "@/components/personality/trait-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import * as api from "@/lib/api";
import { useFazaiStore } from "@/lib/store";

const queryClient = new QueryClient();

function PersonalityContent() {
  const { setLoading, setError } = useFazaiStore();

  const { data: personality, isLoading, refetch } = useQuery({
    queryKey: ["personality"],
    queryFn: api.getPersonality,
  });

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  const addTraitMutation = useMutation({
    mutationFn: api.addTrait,
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      setError(String(error));
    },
  });

  const removeTraitMutation = useMutation({
    mutationFn: api.removeTrait,
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      setError(String(error));
    },
  });

  if (isLoading && !personality) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading personality...</p>
      </div>
    );
  }

  const traits = personality?.traits || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Personality</h1>
        <p className="text-muted-foreground">
          Manage the traits and behavioral characteristics of the FazAI agent
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Agent Personality Traits</CardTitle>
            <CardDescription>
              Define and adjust the behavioral characteristics of the autonomous agent
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TraitEditor
              traits={traits}
              onAddTrait={(trait) => addTraitMutation.mutate(trait)}
              onRemoveTrait={(name) => removeTraitMutation.mutate(name)}
              onUpdateTrait={(_trait) => {
                // TODO: Implement update
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Personality Preview</CardTitle>
            <CardDescription>
              How the agent will behave based on current traits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {traits.length === 0 ? (
                <p className="text-muted-foreground">
                  No traits configured yet. Add traits to see behavior preview.
                </p>
              ) : (
                <>
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      <strong>Communication Style:</strong> The agent will interact
                      based on the configured communication traits. Higher intensity
                      means more pronounced behavior.
                    </p>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    <p className="text-sm text-green-600 dark:text-green-400">
                      <strong>Decision Making:</strong> Actions will be taken
                      according to decision-making traits with the configured
                      intensity levels.
                    </p>
                  </div>
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                    <p className="text-sm text-purple-600 dark:text-purple-400">
                      <strong>Ethical Guidelines:</strong> All actions will respect
                      the ethical constraints defined by the current trait set.
                    </p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PersonalityPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <PersonalityContent />
    </QueryClientProvider>
  );
}
