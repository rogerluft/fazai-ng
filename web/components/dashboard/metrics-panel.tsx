"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Mock data - in production, this would come from an API
const chartData = [
  { time: "00:00", success: 95, errors: 5 },
  { time: "04:00", success: 92, errors: 8 },
  { time: "08:00", success: 98, errors: 2 },
  { time: "12:00", success: 97, errors: 3 },
  { time: "16:00", success: 94, errors: 6 },
  { time: "20:00", success: 96, errors: 4 },
  { time: "24:00", success: 99, errors: 1 },
];

export function MetricsPanel() {
  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Performance Metrics (24h)</CardTitle>
        <CardDescription>Success vs Error Rate</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="success"
              stroke="#10b981"
              name="Success Rate %"
            />
            <Line
              type="monotone"
              dataKey="errors"
              stroke="#ef4444"
              name="Error Rate %"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
