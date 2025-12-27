"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useJarvisStore } from "@/lib/store";
import { Plus, Trash2, RefreshCw, Server, FolderOpen, Users } from "lucide-react";
import type { SambaShare, SambaStatus, CreateSharePayload } from "@/types/samba.types";

const queryClient = new QueryClient();

// API functions
async function getSambaStatus(): Promise<SambaStatus> {
  const response = await fetch("/api/samba/status");
  if (!response.ok) throw new Error("Failed to fetch Samba status");
  return response.json();
}

async function createShare(share: CreateSharePayload): Promise<void> {
  const response = await fetch("/api/samba/shares", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(share),
  });
  if (!response.ok) throw new Error("Failed to create share");
}

async function deleteShare(name: string): Promise<void> {
  const response = await fetch(`/api/samba/shares/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete share");
}

async function restartSamba(): Promise<void> {
  const response = await fetch("/api/samba/restart", {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to restart Samba");
}

function SambaContent() {
  const { setLoading, setError } = useJarvisStore();
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [newShare, setNewShare] = useState({
    name: "",
    path: "",
    comment: "",
    validUsers: "",
    readonly: false,
    browseable: true,
    guestOk: false,
  });

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ["samba-status"],
    queryFn: getSambaStatus,
    refetchInterval: 30000, // Refresh every 30s
  });

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  const createMutation = useMutation({
    mutationFn: createShare,
    onSuccess: () => {
      refetch();
      setShowForm(false);
      setNewShare({
        name: "",
        path: "",
        comment: "",
        validUsers: "",
        readonly: false,
        browseable: true,
        guestOk: false,
      });
    },
    onError: (error) => {
      setError(String(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteShare,
    onSuccess: () => {
      refetch();
      setDeleteConfirm(null);
    },
    onError: (error) => {
      setError(String(error));
    },
  });

  const restartMutation = useMutation({
    mutationFn: restartSamba,
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      setError(String(error));
    },
  });

  const handleCreate = () => {
    if (newShare.name && newShare.path) {
      createMutation.mutate(newShare);
    }
  };

  const handleDelete = (name: string) => {
    if (deleteConfirm === name) {
      deleteMutation.mutate(name);
    } else {
      setDeleteConfirm(name);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Samba File Sharing</h1>
          <p className="text-muted-foreground">
            Manage Samba shares and network file access
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => restartMutation.mutate()}
            disabled={!status?.running}
          >
            <Server className="h-4 w-4" />
            Restart Service
          </Button>
        </div>
      </div>

      {/* Service Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Service Status</CardTitle>
              <CardDescription>
                {status?.version && `Samba ${status.version}`}
              </CardDescription>
            </div>
            <Badge
              variant={status?.running ? "default" : "destructive"}
              className={status?.running ? "bg-green-500" : ""}
            >
              {status?.running ? "Running" : "Stopped"}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6">
        {/* Create Share Form */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle>Create Share</CardTitle>
              <CardDescription>Add a new Samba file share</CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setShowForm(!showForm)}
              variant={showForm ? "outline" : "default"}
            >
              <Plus className="h-4 w-4" />
              {showForm ? "Cancel" : "New Share"}
            </Button>
          </CardHeader>
          {showForm && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Share Name</label>
                  <Input
                    placeholder="e.g., Public"
                    value={newShare.name}
                    onChange={(e) =>
                      setNewShare({ ...newShare, name: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Network visible name (no spaces)
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Directory Path</label>
                  <Input
                    placeholder="/srv/samba/public"
                    value={newShare.path}
                    onChange={(e) =>
                      setNewShare({ ...newShare, path: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Absolute path on server
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Comment</label>
                <Input
                  placeholder="Description of this share"
                  value={newShare.comment}
                  onChange={(e) =>
                    setNewShare({ ...newShare, comment: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">Valid Users</label>
                <Input
                  placeholder="user1, user2, @group (comma separated)"
                  value={newShare.validUsers}
                  onChange={(e) =>
                    setNewShare({ ...newShare, validUsers: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty for all users. Use @groupname for groups
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newShare.readonly}
                    onChange={(e) =>
                      setNewShare({ ...newShare, readonly: e.target.checked })
                    }
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Read-only</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newShare.browseable}
                    onChange={(e) =>
                      setNewShare({ ...newShare, browseable: e.target.checked })
                    }
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Browseable</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newShare.guestOk}
                    onChange={(e) =>
                      setNewShare({ ...newShare, guestOk: e.target.checked })
                    }
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Guest Access</span>
                </label>
              </div>

              <Button onClick={handleCreate} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Create Share
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Shares List */}
        <Card>
          <CardHeader>
            <CardTitle>Active Shares</CardTitle>
            <CardDescription>
              Total: {status?.shares?.length || 0} shares configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!status?.shares || status.shares.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No shares configured yet. Create your first share!
              </div>
            ) : (
              <div className="space-y-3">
                {status.shares.map((share) => (
                  <div
                    key={share.name}
                    className="border border-border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <FolderOpen className="h-4 w-4 text-primary" />
                          <h4 className="font-semibold">{share.name}</h4>
                        </div>
                        {share.comment && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {share.comment}
                          </p>
                        )}
                        <div className="bg-secondary/50 rounded p-2 space-y-1">
                          <p className="text-xs font-mono text-muted-foreground">
                            <strong>Path:</strong> {share.path}
                          </p>
                          {share.validUsers && share.validUsers.length > 0 && (
                            <p className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              <strong>Valid Users:</strong>{" "}
                              {share.validUsers.join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelete(share.name)}
                          className={`p-2 rounded transition-colors ${
                            deleteConfirm === share.name
                              ? "bg-destructive text-destructive-foreground"
                              : "hover:bg-destructive/10 text-destructive"
                          }`}
                          title={
                            deleteConfirm === share.name
                              ? "Click again to confirm"
                              : "Delete share"
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      {share.readonly && (
                        <Badge variant="outline">Read-only</Badge>
                      )}
                      {share.browseable && (
                        <Badge variant="outline">Browseable</Badge>
                      )}
                      {share.guestOk && (
                        <Badge variant="secondary">Guest OK</Badge>
                      )}
                      {!share.validUsers ||
                        (share.validUsers.length === 0 && (
                          <Badge variant="default">All Users</Badge>
                        ))}
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

export default function SambaPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <SambaContent />
    </QueryClientProvider>
  );
}
