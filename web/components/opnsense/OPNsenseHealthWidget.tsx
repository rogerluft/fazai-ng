"use client";

import React, { useEffect, useState } from 'react';
import { Shield, Activity, Wifi, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Interfaces baseadas no backend 'feat/opnsense-integration' (src/services/api-status-checker.ts)
interface FirewallStatus {
  status: 'ok' | 'warning' | 'error' | 'maintenance';
  uptime: number;
  cpu_usage: number;
  memory_usage: number;
  active_rules: number;
  wan_ip?: string;
  last_check: string;
}

export function OPNsenseHealthWidget() {
  const [data, setData] = useState<FirewallStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Simulação de fetch para demonstrar a "ponte" com o backend que vamos mergear
  useEffect(() => {
    // No futuro, isso chamará /api/integrations/opnsense/system/status
    const mockFetch = async () => {
      await new Promise(r => setTimeout(r, 1500)); // Network delay simulation
      setData({
        status: 'ok',
        uptime: 145023, // seconds
        cpu_usage: 12,
        memory_usage: 45,
        active_rules: 142,
        wan_ip: '203.0.113.45',
        last_check: new Date().toISOString()
      });
      setLoading(false);
    };
    mockFetch();
  }, []);

  if (loading) {
    return (
      <Card className="w-full h-[200px] animate-pulse bg-muted/20 border-border/50">
        <CardContent className="flex items-center justify-center h-full text-muted-foreground">
          <Activity className="w-6 h-6 animate-spin mr-2" />
          Conectando ao Firewall...
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="w-full bg-card border-l-4 border-l-emerald-500 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-foreground/80 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-500" />
          OPNsense Firewall
        </CardTitle>
        {data.status === 'ok' ? (
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        )}
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-2 gap-4 pt-4">
          
          {/* Status Principal */}
          <div className="flex flex-col space-y-1">
            <span className="text-xs text-muted-foreground">Status Operacional</span>
            <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
              <CheckCircle className="w-4 h-4" />
              <span>Ativo</span>
            </div>
          </div>

          {/* WAN IP */}
          <div className="flex flex-col space-y-1">
            <span className="text-xs text-muted-foreground">WAN IP</span>
            <div className="flex items-center gap-1.5 text-foreground font-mono text-sm">
              <Wifi className="w-3.5 h-3.5 text-blue-500" />
              {data.wan_ip || '---'}
            </div>
          </div>

          {/* Métricas Compactas */}
          <div className="col-span-2 mt-2 pt-2 border-t border-border/50 flex justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className={cn("font-mono font-medium", data.cpu_usage > 80 ? "text-red-500" : "text-foreground")}>
                {data.cpu_usage}%
              </span> CPU
            </div>
            <div className="flex items-center gap-1">
              <span className="font-mono font-medium text-foreground">{data.memory_usage}%</span> RAM
            </div>
            <div className="flex items-center gap-1">
              <span className="font-mono font-medium text-foreground">{data.active_rules}</span> Regras
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
