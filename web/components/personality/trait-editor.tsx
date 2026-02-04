"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Trash2, Plus, Edit2 } from "lucide-react";
import type { Trait } from "@/types/fazai";

interface TraitEditorProps {
  traits: Trait[];
  onAddTrait: (trait: Trait) => void;
  onRemoveTrait: (traitName: string) => void;
  onUpdateTrait: (trait: Trait) => void;
}

export function TraitEditor({
  traits,
  onAddTrait,
  onRemoveTrait,
  onUpdateTrait,
}: TraitEditorProps) {
  const [newTrait, setNewTrait] = useState<Partial<Trait>>({
    category: "comunicação",
    intensity: 0.5,
  });
  const [showForm, setShowForm] = useState(false);
  const [editingTraitName, setEditingTraitName] = useState<string | null>(null);

  const handleSaveTrait = () => {
    if (newTrait.trait_name && newTrait.value && newTrait.category) {
      const traitData: Trait = {
        trait_name: newTrait.trait_name,
        value: newTrait.value,
        category: newTrait.category as any,
        intensity: newTrait.intensity || 0.5,
      };

      if (editingTraitName) {
        onUpdateTrait(traitData);
      } else {
        onAddTrait(traitData);
      }

      setNewTrait({ category: "comunicação", intensity: 0.5 });
      setShowForm(false);
      setEditingTraitName(null);
    }
  };

  const handleEditClick = (trait: Trait) => {
    setNewTrait(trait);
    setEditingTraitName(trait.trait_name);
    setShowForm(true);
  };

  const handleCancel = () => {
    setNewTrait({ category: "comunicação", intensity: 0.5 });
    setShowForm(false);
    setEditingTraitName(null);
  };

  const categories = [
    { id: "comunicação", label: "Comunicação", color: "bg-blue-500" },
    { id: "decisão", label: "Decisão", color: "bg-purple-500" },
    { id: "ética", label: "Ética", color: "bg-green-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Traits</h2>
        <Button
          onClick={showForm ? handleCancel : () => setShowForm(true)}
          variant={showForm ? "outline" : "default"}
        >
          {showForm ? (
            "Cancel"
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" /> Add Trait
            </>
          )}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle>
              {editingTraitName ? "Edit Trait" : "Add New Trait"}
            </CardTitle>
            <CardDescription>
              {editingTraitName
                ? "Update the details of the selected trait"
                : "Define a new behavioral characteristic for the agent"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Trait Name</label>
                  <Input
                    placeholder="e.g., Autonomy, Creativity"
                    value={newTrait.trait_name || ""}
                    disabled={!!editingTraitName}
                    onChange={(e) =>
                      setNewTrait({ ...newTrait, trait_name: e.target.value })
                    }
                  />
                  {editingTraitName && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Trait name cannot be changed while editing
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Value</label>
                  <Input
                    placeholder="e.g., High, Medium, Low"
                    value={newTrait.value || ""}
                    onChange={(e) =>
                      setNewTrait({ ...newTrait, value: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Category</label>
                <div className="flex gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() =>
                        setNewTrait({
                          ...newTrait,
                          category: cat.id as any,
                        })
                      }
                      className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                        newTrait.category === cat.id
                          ? cat.color + " text-white"
                          : "border border-border"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">
                  Intensity: {((newTrait.intensity || 0) * 100).toFixed(0)}%
                </label>
                <Slider
                  value={[(newTrait.intensity || 0.5) * 100]}
                  onValueChange={(value) =>
                    setNewTrait({
                      ...newTrait,
                      intensity: value[0] / 100,
                    })
                  }
                  min={0}
                  max={100}
                  step={1}
                />
              </div>

              <Button onClick={handleSaveTrait} className="w-full">
                {editingTraitName ? "Update Trait" : "Add Trait"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {traits.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No traits defined yet. Add your first trait!
          </div>
        ) : (
          traits.map((trait) => {
            const category = categories.find((c) => c.id === trait.category);
            return (
              <Card key={trait.trait_name}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{trait.trait_name}</h3>
                        <Badge
                          className={`${category?.color} text-white`}
                          variant="default"
                        >
                          {category?.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {trait.value}
                      </p>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-xs text-muted-foreground">
                            Intensity
                          </span>
                          <span className="text-xs font-medium">
                            {(trait.intensity * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{
                              width: `${trait.intensity * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleEditClick(trait)}
                        className="text-muted-foreground hover:text-primary transition-colors p-2"
                        title="Edit trait"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onRemoveTrait(trait.trait_name)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-2"
                        title="Delete trait"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
