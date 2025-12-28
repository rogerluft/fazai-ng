"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useJarvisStore } from "@/lib/store";
import { Plus, Trash2, RefreshCw, Server, FolderOpen, Users, AlertCircle, UserPlus, UsersIcon } from "lucide-react";

const queryClient = new QueryClient();

// API Response Types (matching backend)
interface SharesResponse {
  total: number;
  shares: Array<{
    name: string;
    path: string | null;
    validUsers: string[];
    writable: boolean;
    browseable: boolean;
    forceGroup: string | null;
  }>;
}

interface StatusResponse {
  status: "running" | "stopped";
  services: {
    smb: string;
    nmb: string;
  };
}

interface ApiResponse {
  success: boolean;
  message: string;
  output?: string;
  command?: string;
  note?: string;
}

// API functions
async function getShares(): Promise<SharesResponse> {
  const response = await fetch("/api/samba/shares");
  if (!response.ok) throw new Error("Failed to fetch shares");
  return response.json();
}

async function getSambaStatus(): Promise<StatusResponse> {
  const response = await fetch("/api/samba/status");
  if (!response.ok) throw new Error("Failed to fetch Samba status");
  return response.json();
}

async function createShare(path: string): Promise<ApiResponse> {
  const response = await fetch("/api/samba/shares", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create share");
  }
  return response.json();
}

async function deleteShare(name: string): Promise<ApiResponse> {
  const response = await fetch(`/api/samba/shares/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to delete share");
  }
  return response.json();
}

async function restartSamba(): Promise<ApiResponse> {
  const response = await fetch("/api/samba/restart", {
    method: "POST",
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to restart Samba");
  }
  return response.json();
}

async function createUser(username: string): Promise<ApiResponse> {
  const response = await fetch("/api/samba/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create user");
  }
  return response.json();
}

async function createGroup(groupname: string, users?: string[]): Promise<ApiResponse> {
  const response = await fetch("/api/samba/groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupname, users }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create group");
  }
  return response.json();
}

function SambaContent() {
  const { setLoading, setError } = useJarvisStore();
  const [showShareForm, setShowShareForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [newSharePath, setNewSharePath] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newGroupname, setNewGroupname] = useState("");
  const [apiMessage, setApiMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const { data: shares, isLoading: sharesLoading, refetch: refetchShares } = useQuery({
    queryKey: ["samba-shares"],
    queryFn: getShares,
    refetchInterval: 30000,
  });

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ["samba-status"],
    queryFn: getSambaStatus,
    refetchInterval: 30000,
  });

  const isLoading = sharesLoading || statusLoading;

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  const createShareMutation = useMutation({
    mutationFn: createShare,
    onSuccess: (data) => {
      refetchShares();
      setShowShareForm(false);
      setNewSharePath("");
      setApiMessage({ type: "success", text: data.message });
      setTimeout(() => setApiMessage(null), 5000);
    },
    onError: (error: Error) => {
      setError(error.message);
      setApiMessage({ type: "error", text: error.message });
      setTimeout(() => setApiMessage(null), 5000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteShare,
    onSuccess: (data) => {
      refetchShares();
      setDeleteConfirm(null);
      setApiMessage({ type: "success", text: data.message });
      setTimeout(() => setApiMessage(null), 5000);
    },
    onError: (error: Error) => {
      setError(error.message);
      setApiMessage({ type: "error", text: error.message });
      setTimeout(() => setApiMessage(null), 5000);
    },
  });

  const restartMutation = useMutation({
    mutationFn: restartSamba,
    onSuccess: (data) => {
      refetchStatus();
      refetchShares();
      setApiMessage({ type: "success", text: data.message });
      setTimeout(() => setApiMessage(null), 5000);
    },
    onError: (error: Error) => {
      setError(error.message);
      setApiMessage({ type: "error", text: error.message });
      setTimeout(() => setApiMessage(null), 5000);
    },
  });

  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (data) => {
      setShowUserForm(false);
      setNewUsername("");
      setApiMessage({ type: "info", text: `${data.message}\n\nCommand: ${data.command}` });
    },
    onError: (error: Error) => {
      setError(error.message);
      setApiMessage({ type: "error", text: error.message });
      setTimeout(() => setApiMessage(null), 5000);
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: ({ groupname, users }: { groupname: string; users?: string[] }) => createGroup(groupname, users),
    onSuccess: (data) => {
      setShowGroupForm(false);
      setNewGroupname("");
      setApiMessage({ type: "info", text: `${data.message}\n\nCommand: ${data.command}${data.note ? `\n\n${data.note}` : ''}` });
    },
    onError: (error: Error) => {
      setError(error.message);
      setApiMessage({ type: "error", text: error.message });
      setTimeout(() => setApiMessage(null), 5000);
    },
  });

  const handleCreateShare = () => {
    if (newSharePath && newSharePath.startsWith("/")) {
      createShareMutation.mutate(newSharePath);
    } else {
      setApiMessage({ type: "error", text: "Please provide an absolute path starting with /" });
      setTimeout(() => setApiMessage(null), 3000);
    }
  };

  const handleCreateUser = () => {
    if (newUsername && /^[a-z_][a-z0-9_-]*[$]?$/.test(newUsername)) {
      createUserMutation.mutate(newUsername);
    } else {
      setApiMessage({ type: "error", text: "Invalid username format. Must match POSIX username rules." });
      setTimeout(() => setApiMessage(null), 3000);
    }
  };

  const handleCreateGroup = () => {
    if (newGroupname && /^[a-z_][a-z0-9_-]*[$]?$/.test(newGroupname)) {
      createGroupMutation.mutate({ groupname: newGroupname });
    } else {
      setApiMessage({ type: "error", text: "Invalid group name format. Must match POSIX group rules." });
      setTimeout(() => setApiMessage(null), 3000);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Samba File Sharing</h1>
          <p className="text-muted-foreground">
            Manage Samba shares, users, and network file access
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchShares();
              refetchStatus();
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => restartMutation.mutate()}
            disabled={status?.status !== "running"}
          >
            <Server className="h-4 w-4" />
            Restart Service
          </Button>
        </div>
      </div>

      {/* API Messages */}
      {apiMessage && (
        <Alert variant={apiMessage.type === "error" ? "destructive" : "default"}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="whitespace-pre-wrap">{apiMessage.text}</AlertDescription>
        </Alert>
      )}

      {/* Service Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Service Status</CardTitle>
              <CardDescription>
                Samba services: smb.service, nmb.service
              </CardDescription>
            </div>
            <Badge
              variant={status?.status === "running" ? "default" : "destructive"}
              className={status?.status === "running" ? "bg-green-500" : ""}
            >
              {status?.status === "running" ? "Running" : "Stopped"}
            </Badge>
          </div>
        </CardHeader>
        {status?.services && (
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">SMB Service:</span>{" "}
                <Badge variant={status.services.smb === "active" ? "default" : "secondary"}>
                  {status.services.smb}
                </Badge>
              </div>
              <div>
                <span className="font-medium">NMB Service:</span>{" "}
                <Badge variant={status.services.nmb === "active" ? "default" : "secondary"}>
                  {status.services.nmb}
                </Badge>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Create Share Form */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle>Add Share</CardTitle>
              <CardDescription>Share existing directory</CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setShowShareForm(!showShareForm)}
              variant={showShareForm ? "outline" : "default"}
            >
              <FolderOpen className="h-4 w-4" />
              {showShareForm ? "Cancel" : "New"}
            </Button>
          </CardHeader>
          {showShareForm && (
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Directory Path</label>
                <Input
                  placeholder="/srv/samba/public"
                  value={newSharePath}
                  onChange={(e) => setNewSharePath(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Absolute path to existing directory
                </p>
              </div>

              <Button onClick={handleCreateShare} className="w-full" disabled={createShareMutation.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                {createShareMutation.isPending ? "Creating..." : "Create Share"}
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Create User Form */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle>Add User</CardTitle>
              <CardDescription>Create Samba user</CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setShowUserForm(!showUserForm)}
              variant={showUserForm ? "outline" : "default"}
            >
              <UserPlus className="h-4 w-4" />
              {showUserForm ? "Cancel" : "New"}
            </Button>
          </CardHeader>
          {showUserForm && (
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Username</label>
                <Input
                  placeholder="newuser"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  POSIX-compliant username
                </p>
              </div>

              <Button onClick={handleCreateUser} className="w-full" disabled={createUserMutation.isPending}>
                <UserPlus className="h-4 w-4 mr-2" />
                {createUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Create Group Form */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle>Add Group</CardTitle>
              <CardDescription>Create Samba group</CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setShowGroupForm(!showGroupForm)}
              variant={showGroupForm ? "outline" : "default"}
            >
              <UsersIcon className="h-4 w-4" />
              {showGroupForm ? "Cancel" : "New"}
            </Button>
          </CardHeader>
          {showGroupForm && (
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Group Name</label>
                <Input
                  placeholder="newgroup"
                  value={newGroupname}
                  onChange={(e) => setNewGroupname(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  POSIX-compliant group name
                </p>
              </div>

              <Button onClick={handleCreateGroup} className="w-full" disabled={createGroupMutation.isPending}>
                <UsersIcon className="h-4 w-4 mr-2" />
                {createGroupMutation.isPending ? "Creating..." : "Create Group"}
              </Button>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Shares List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Shares</CardTitle>
          <CardDescription>
            Total: {shares?.total || 0} shares configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!shares?.shares || shares.shares.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No shares configured yet. Create your first share!
            </div>
          ) : (
            <div className="space-y-3">
              {shares.shares.map((share) => (
                <div
                  key={share.name}
                  className="border border-border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <FolderOpen className="h-5 w-5 text-primary" />
                        <h4 className="font-semibold text-lg">{share.name}</h4>
                      </div>
                      <div className="bg-secondary/50 rounded p-3 space-y-2">
                        <p className="text-sm font-mono text-muted-foreground">
                          <strong>Path:</strong> {share.path || "Not specified"}
                        </p>
                        {share.validUsers && share.validUsers.length > 0 && (
                          <p className="text-sm font-mono text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <strong>Valid Users:</strong>{" "}
                            {share.validUsers.join(", ")}
                          </p>
                        )}
                        {share.forceGroup && (
                          <p className="text-sm font-mono text-muted-foreground">
                            <strong>Force Group:</strong> {share.forceGroup}
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
                    {share.writable ? (
                      <Badge variant="default" className="bg-blue-500">Writable</Badge>
                    ) : (
                      <Badge variant="outline">Read-only</Badge>
                    )}
                    {share.browseable && (
                      <Badge variant="outline">Browseable</Badge>
                    )}
                    {!share.validUsers || share.validUsers.length === 0 ? (
                      <Badge variant="secondary">All Users</Badge>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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
