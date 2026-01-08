/**
 * FazAI Health Check Endpoint
 * 
 * Usado pelo Render.com para verificar se o servico esta saudavel.
 * Retorna status 200 se tudo OK, ou 503 se houver problemas.
 */

import { NextResponse } from 'next/server';

interface HealthStatus {
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    version: string;
    uptime: number;
    services: {
      nextjs: boolean;
      ttyd?: boolean;
    };
}

// Tempo de inicio do servidor
const startTime = Date.now();

export async function GET(): Promise<NextResponse<HealthStatus>> {
    const health: HealthStatus = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || '3.14.x',
          uptime: Math.floor((Date.now() - startTime) / 1000),
          services: {
                  nextjs: true,
          },
    };

  // Verificar ttyd se configurado
  const ttydPort = process.env.TTYD_PORT || '7681';
    try {
          const ttydResponse = await fetch(`http://localhost:${ttydPort}/`, {
                  method: 'HEAD',
                  signal: AbortSignal.timeout(2000),
          });
          health.services.ttyd = ttydResponse.ok;
    } catch {
          // ttyd pode nao estar rodando (ambiente dev)
      health.services.ttyd = false;
    }

  // Se algum servico critico falhar, marcar como unhealthy
  if (!health.services.nextjs) {
        health.status = 'unhealthy';
        return NextResponse.json(health, { status: 503 });
  }

  return NextResponse.json(health, { status: 200 });
}
