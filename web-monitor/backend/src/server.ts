// src/server.ts
import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { julesMonitor } from './services/jules-monitor';

// Load config from /etc/fazai/fazai.conf
function loadConfig(): { hostname: string; port: number } {
  try {
    const configContent = readFileSync('/etc/fazai/fazai.conf', 'utf-8');
    const lines = configContent.split('\n');

    let hostname = 'localhost';
    let port = 3001;

    for (const line of lines) {
      if (line.startsWith('WEB_MONITOR_HOSTNAME=')) {
        hostname = line.split('=')[1].trim();
      }
      if (line.startsWith('WEB_MONITOR_BACKEND_PORT=')) {
        port = parseInt(line.split('=')[1].trim(), 10);
      }
    }

    return { hostname, port };
  } catch (error) {
    console.warn('Could not read /etc/fazai/fazai.conf, using defaults');
    return { hostname: 'localhost', port: 3001 };
  }
}

const config = loadConfig();
const app = express();
const port = config.port;

app.use(cors());
app.use(express.json());

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

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}

`);
  };

  const initialData = { type: 'initial', payload: task };
  sendEvent(initialData);

  const updateListener = (updatedTask: any) => {
    if (updatedTask.id === taskId) {
      sendEvent({ type: 'update', payload: updatedTask });
    }
  };

  julesMonitor.on('update', updateListener);

  req.on('close', () => {
    julesMonitor.removeListener('update', updateListener);
    res.end();
  });
});


app.listen(port, () => {
  console.log(`Backend server listening at http://${config.hostname}:${port}`);
  console.log(`Local access: http://localhost:${port}`);
});
