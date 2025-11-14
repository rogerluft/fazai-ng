"use client";

import React, { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import * as api from "@/lib/api";
import { useJarvisStore } from "@/lib/store";
import { TrendingUp, AlertCircle, CheckCircle, Zap } from "lucide-react";

const queryClient = new QueryClient();

function LearningContent() {
  const { setLoading } = useJarvisStore();

  const { data: learnings = [], isLoading } = useQuery({
    queryKey: ["learning"],
    queryFn: () => api.getLearning(100),
  });

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  // Prepare data for charts
  const categoryData = [
    { name: "Linux", value: learnings.filter((l) => l.category === "linux").length },
    { name: "Network", value: learnings.filter((l) => l.category === "network").length },
    { name: "Security", value: learnings.filter((l) => l.category === "security").length },
    { name: "Social", value: learnings.filter((l) => l.category === "social").length },
  ];

  const outcomeData = [
    { name: "Sucesso", value: learnings.filter((l) => l.outcome === "sucesso").length },
    { name: "Falha", value: learnings.filter((l) => l.outcome === "falha").length },
    { name: "Parcial", value: learnings.filter((l) => l.outcome === "parcial").length },
  ];

  const COLORS = ["#10b981", "#ef4444", "#f59e0b"];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "erro":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "acerto":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "padrão":
        return <TrendingUp className="h-4 w-4 text-blue-500" />;
      case "otimização":
        return <Zap className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getOutcomeBadgeVariant = (outcome: string) => {
    switch (outcome) {
      case "sucesso":
        return "success";
      case "falha":
        return "destructive";
      case "parcial":
        return "warning";
      default:
        return "default";
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Learning</h1>
        <p className="text-muted-foreground">
          Monitor agent learning progress, errors, and pattern detection
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Learnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{learnings.length}</div>
            <p className="text-xs text-muted-foreground">From system start</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {learnings.length === 0
                ? "0%"
                : (
                    (learnings.filter((l) => l.outcome === "sucesso").length /
                      learnings.length) *
                    100
                  ).toFixed(1) + "%"}
            </div>
            <p className="text-xs text-muted-foreground">Overall success</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {learnings.length === 0
                ? "0%"
                : (
                    (learnings.reduce((acc, l) => acc + l.confidence, 0) /
                      learnings.length) *
                    100
                  ).toFixed(1) + "%"}
            </div>
            <p className="text-xs text-muted-foreground">Confidence level</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Errors Found</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {learnings.filter((l) => l.type === "erro").length}
            </div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Learnings by Category</CardTitle>
            <CardDescription>Distribution across different domains</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outcome Distribution</CardTitle>
            <CardDescription>Success vs Failure vs Partial</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={outcomeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {outcomeData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Learning List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Learnings</CardTitle>
          <CardDescription>Latest discoveries and improvements</CardDescription>
        </CardHeader>
        <CardContent>
          {learnings.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No learnings recorded yet
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {learnings.slice(0, 20).map((learning) => (
                <div
                  key={learning.learning_id}
                  className="border border-border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(learning.type)}
                      <h4 className="font-semibold text-sm">{learning.title}</h4>
                    </div>
                    <Badge variant={getOutcomeBadgeVariant(learning.outcome)}>
                      {learning.outcome}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {learning.description}
                  </p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Category: {learning.category}
                    </span>
                    <span className="font-medium">
                      Confidence: {(learning.confidence * 100).toFixed(0)}%
                    </span>
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

export default function LearningPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <LearningContent />
    </QueryClientProvider>
  );
}
