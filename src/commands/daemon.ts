import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { logger } from '../logger';
import { getConfigValue } from '../config';

export async function handleDaemonCommand(args: string[]) {
  const portStr = getConfigValue('FAZAI_DAEMON_PORT') || '18789';
  const port = parseInt(portStr, 10);

  logger.info(`Starting Fazai Daemon on port ${port}...`);

  const app = express();
  app.use(express.json());

  // Simple HTTP health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'fazai-daemon', time: Date.now() });
  });

  // REST API placeholders (future Telegram plugin / OpenClaw TUI integration)
  app.post('/api/message', (req, res) => {
    const { text, from } = req.body;
    logger.info(`Received HTTP message from ${from}: ${text}`);
    // Future: Route to AgentOrchestrator
    res.json({ status: 'queued' });
  });

  const server = createServer(app);

  // WebSocket Server (compatible with OpenClaw Gateway architecture)
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, req) => {
    const ip = req.socket.remoteAddress;
    logger.info(`[Daemon] New WebSocket connection from ${ip}`);

    ws.on('message', (message) => {
      try {
        const payload = JSON.parse(message.toString());
        logger.debug(`[Daemon] Received WS message: ${JSON.stringify(payload)}`);

        // Handle OpenClaw-like Gateway Protocol (example)
        if (payload.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', time: Date.now() }));
        } else if (payload.type === 'message') {
          logger.info(`[Daemon] Process message: ${payload.text}`);
          // Future: Route to AgentOrchestrator and return streaming response
          ws.send(JSON.stringify({ type: 'ack', id: payload.id }));
        }
      } catch (error: any) {
        logger.error(`[Daemon] WS Message parse error: ${error.message}`);
      }
    });

    ws.on('close', () => {
      logger.info(`[Daemon] WebSocket connection closed (${ip})`);
    });
  });

  server.listen(port, '0.0.0.0', () => {
    logger.info(`✅ Fazai Daemon running on http://0.0.0.0:${port}`);
    logger.info(`✅ WebSocket endpoint: ws://0.0.0.0:${port}`);
    logger.info(`Process will remain alive in background...`);
  });

  // Handle graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down Fazai Daemon...');
    server.close(() => {
      logger.info('HTTP/WS Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
