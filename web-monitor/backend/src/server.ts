// src/server.ts
import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { julesMonitor } from './services/jules-monitor';
import { authMiddleware } from './middleware/auth';
import apiRoutes from './routes/index';

// Load config from /etc/fazai/fazai.conf
function loadConfig(): { hostname: string; port: number } {
  try {
    const configContent = readFileSync('/etc/fazai/fazai.conf', 'utf-8');
    const lines = configContent.split('\n');

    let hostname = 'localhost';
    let port = 3001;

    for (const line of lines) {
      // Skip comments and empty lines
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      if (trimmed.startsWith('WEB_MONITOR_HOSTNAME=')) {
        const value = trimmed.split('=')[1]?.trim();
        // Validate hostname (alphanumeric, dots, hyphens only)
        if (value && /^[a-zA-Z0-9.-]+$/.test(value)) {
          hostname = value;
        } else {
          console.warn(`Invalid hostname in config: ${value}, using default`);
        }
      }

      if (trimmed.startsWith('WEB_MONITOR_BACKEND_PORT=')) {
        const value = trimmed.split('=')[1]?.trim();
        const parsedPort = parseInt(value || '', 10);
        // Validate port range (1024-65535 for non-root)
        if (!isNaN(parsedPort) && parsedPort >= 1024 && parsedPort <= 65535) {
          port = parsedPort;
        } else {
          console.warn(`Invalid port in config: ${value}, using default 3001`);
        }
      }
    }

    return { hostname, port };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.warn(`Could not read /etc/fazai/fazai.conf: ${err.message}`);
    console.warn('Using default config: localhost:3001');
    return { hostname: 'localhost', port: 3001 };
  }
}

const config = loadConfig();
const app = express();
const port = config.port;

app.use(cors());
app.use(express.json());

// ============================================================================
// Public Routes (no authentication)
// ============================================================================

// Endpoint to get all tasks
app.get('/api/tasks', (req, res) => {
  res.json(julesMonitor.getTasks());
});

// Endpoint to get a single task
app.get('/api/tasks/:id', (req, res) => {
  const task = julesMonitor.getTask(req.params.id);
  if (task) {
    res.json(task);
  } else {
    res.status(404).send('Task not found');
  }
});

// SSE endpoint for real-time updates for a specific task
app.get('/api/tasks/:id/stream', (req, res) => {
  const taskId = req.params.id;
  const task = julesMonitor.getTask(taskId);

  if (!task) {
    return res.status(404).send('Task not found');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  interface SSEEvent {
    type: 'initial' | 'update';
    payload: ReturnType<typeof julesMonitor.getTask>;
  }

  const sendEvent = (data: SSEEvent): void => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const initialData: SSEEvent = { type: 'initial', payload: task };
  sendEvent(initialData);

  const updateListener = (updatedTask: ReturnType<typeof julesMonitor.getTask>): void => {
    if (updatedTask && updatedTask.id === taskId) {
      sendEvent({ type: 'update', payload: updatedTask });
    }
  };

  julesMonitor.on('update', updateListener);

  req.on('close', () => {
    julesMonitor.removeListener('update', updateListener);
    res.end();
  });
});

// ============================================================================
// Protected Routes (require authentication)
// ============================================================================

// Mount protected integration API routes
app.use('/api/integrations', authMiddleware, apiRoutes);


app.listen(port, () => {
  console.log(`Backend server listening at http://${config.hostname}:${port}`);
  console.log(`Local access: http://localhost:${port}`);
});
