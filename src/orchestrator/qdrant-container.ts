/**
 * Qdrant Podman Container Management
 *
 * Provides container lifecycle management for Qdrant:
 * - Start/Stop/Restart container
 * - Health checks and status monitoring
 * - Log retrieval
 * - Automatic recovery on crash
 *
 * Container Configuration:
 *   Name: qdrant
 *   Image: qdrant/qdrant:latest
 *   Ports: 6333:6333, 6334:6334
 *   Storage: /var/lib/qdrant
 *
 * Usage:
 *   import { startQdrantContainer, getQdrantContainerStatus } from './orchestrator/qdrant-container';
 *
 *   // Start container
 *   await startQdrantContainer();
 *
 *   // Check status
 *   const status = await getQdrantContainerStatus();
 *   console.log(status.running);
 */

import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../logger";
import { getConfigValue } from "../config";

const execAsync = promisify(exec);

/**
 * Container status information
 */
export interface ContainerStatus {
  name: string;
  state: string;
  status: string;
  running: boolean;
  ports?: string;
  image?: string;
}

/**
 * Default container configuration
 */
const CONTAINER_NAME = "qdrant";
const CONTAINER_IMAGE = "docker.io/qdrant/qdrant:latest";
const QDRANT_HTTP_PORT = 6333;
const QDRANT_GRPC_PORT = 6334;
const QDRANT_DATA_DIR = "/var/lib/qdrant";

/**
 * Execute podman command
 */
async function runPodmanCommand(command: string): Promise<string> {
  try {
    logger.debug(`[Podman] Executing: podman ${command}`);
    const { stdout, stderr } = await execAsync(`podman ${command}`);

    if (stderr && !stderr.includes("Warning")) {
      logger.debug(`[Podman] stderr: ${stderr}`);
    }

    return stdout.trim();
  } catch (error: any) {
    logger.error(`[Podman] Command failed: ${error.message}`);
    throw new Error(`Podman command failed: ${error.message}`);
  }
}

/**
 * Check if Podman is installed
 */
async function isPodmanInstalled(): Promise<boolean> {
  try {
    await execAsync("which podman");
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if container exists
 */
async function containerExists(): Promise<boolean> {
  try {
    const output = await runPodmanCommand(`ps -a --filter name=^${CONTAINER_NAME}$ --format "{{.Names}}"`);
    return output === CONTAINER_NAME;
  } catch {
    return false;
  }
}

/**
 * Get container status
 *
 * @returns Container status information
 */
export async function getQdrantContainerStatus(): Promise<ContainerStatus> {
  if (!(await isPodmanInstalled())) {
    throw new Error("Podman is not installed. Install with: sudo dnf install podman");
  }

  if (!(await containerExists())) {
    return {
      name: CONTAINER_NAME,
      state: "missing",
      status: "Container does not exist",
      running: false,
    };
  }

  try {
    const format = "{{.State}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}";
    const output = await runPodmanCommand(`ps -a --filter name=^${CONTAINER_NAME}$ --format "${format}"`);

    const [state, status, ports, image] = output.split("\t");

    return {
      name: CONTAINER_NAME,
      state,
      status,
      running: state.toLowerCase() === "running",
      ports: ports || undefined,
      image: image || undefined,
    };
  } catch (error: any) {
    throw new Error(`Failed to get container status: ${error.message}`);
  }
}

/**
 * Create and start Qdrant container
 *
 * @returns Container ID
 */
export async function startQdrantContainer(): Promise<string> {
  if (!(await isPodmanInstalled())) {
    throw new Error("Podman is not installed. Install with: sudo dnf install podman");
  }

  const exists = await containerExists();

  if (exists) {
    const status = await getQdrantContainerStatus();

    if (status.running) {
      logger.info(`[Qdrant Container] Already running`);
      return CONTAINER_NAME;
    }

    // Start existing container
    logger.info(`[Qdrant Container] Starting existing container`);
    await runPodmanCommand(`start ${CONTAINER_NAME}`);
    logger.info(`[Qdrant Container] ✓ Container started`);
    return CONTAINER_NAME;
  }

  // Create new container
  logger.info(`[Qdrant Container] Creating new container`);

  const runCommand = [
    `run -d`,
    `--name ${CONTAINER_NAME}`,
    `-p ${QDRANT_HTTP_PORT}:6333`,
    `-p ${QDRANT_GRPC_PORT}:6334`,
    `-v ${QDRANT_DATA_DIR}:/qdrant/storage:z`,
    `--restart unless-stopped`,
    CONTAINER_IMAGE,
  ].join(" ");

  try {
    const containerId = await runPodmanCommand(runCommand);
    logger.info(`[Qdrant Container] ✓ Container created and started: ${containerId}`);
    return containerId;
  } catch (error: any) {
    // If creation failed due to data directory permissions, provide helpful message
    if (error.message.includes("permission denied")) {
      throw new Error(
        `Permission denied accessing ${QDRANT_DATA_DIR}. Run: sudo mkdir -p ${QDRANT_DATA_DIR} && sudo chown $USER:$USER ${QDRANT_DATA_DIR}`
      );
    }
    throw error;
  }
}

/**
 * Stop Qdrant container
 */
export async function stopQdrantContainer(): Promise<void> {
  if (!(await isPodmanInstalled())) {
    throw new Error("Podman is not installed");
  }

  if (!(await containerExists())) {
    logger.warn(`[Qdrant Container] Container does not exist`);
    return;
  }

  const status = await getQdrantContainerStatus();

  if (!status.running) {
    logger.info(`[Qdrant Container] Already stopped`);
    return;
  }

  logger.info(`[Qdrant Container] Stopping container`);
  await runPodmanCommand(`stop ${CONTAINER_NAME}`);
  logger.info(`[Qdrant Container] ✓ Container stopped`);
}

/**
 * Restart Qdrant container
 */
export async function restartQdrantContainer(): Promise<void> {
  if (!(await isPodmanInstalled())) {
    throw new Error("Podman is not installed");
  }

  if (!(await containerExists())) {
    // Container doesn't exist, create and start it
    await startQdrantContainer();
    return;
  }

  logger.info(`[Qdrant Container] Restarting container`);
  await runPodmanCommand(`restart ${CONTAINER_NAME}`);
  logger.info(`[Qdrant Container] ✓ Container restarted`);
}

/**
 * Remove Qdrant container
 *
 * @param force - Force remove even if running
 */
export async function removeQdrantContainer(force: boolean = false): Promise<void> {
  if (!(await isPodmanInstalled())) {
    throw new Error("Podman is not installed");
  }

  if (!(await containerExists())) {
    logger.warn(`[Qdrant Container] Container does not exist`);
    return;
  }

  const forceFlag = force ? "-f" : "";
  logger.info(`[Qdrant Container] Removing container`);
  await runPodmanCommand(`rm ${forceFlag} ${CONTAINER_NAME}`);
  logger.info(`[Qdrant Container] ✓ Container removed`);
}

/**
 * Get container logs
 *
 * @param lines - Number of lines to retrieve (default: 50)
 * @returns Log output
 */
export async function getQdrantContainerLogs(lines: number = 50): Promise<string> {
  if (!(await isPodmanInstalled())) {
    throw new Error("Podman is not installed");
  }

  if (!(await containerExists())) {
    throw new Error("Container does not exist");
  }

  try {
    const logs = await runPodmanCommand(`logs --tail ${lines} ${CONTAINER_NAME}`);
    return logs;
  } catch (error: any) {
    throw new Error(`Failed to get container logs: ${error.message}`);
  }
}

/**
 * Follow container logs (stream)
 *
 * @param callback - Function to call for each log line
 * @returns Function to stop following logs
 */
export function followQdrantContainerLogs(
  callback: (line: string) => void
): () => void {
  const process = exec(`podman logs -f ${CONTAINER_NAME}`);

  if (process.stdout) {
    process.stdout.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (line.trim()) {
          callback(line);
        }
      }
    });
  }

  if (process.stderr) {
    process.stderr.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (line.trim()) {
          callback(`[STDERR] ${line}`);
        }
      }
    });
  }

  // Return stop function
  return () => {
    process.kill();
  };
}

/**
 * Health check: ping Qdrant HTTP API
 *
 * @returns true if Qdrant responds to health check
 */
export async function healthCheckQdrant(): Promise<boolean> {
  try {
    const url = getConfigValue("QDRANT_URL") || "http://localhost:6333";
    const response = await fetch(`${url}/healthz`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Wait for Qdrant to be ready
 *
 * @param timeoutMs - Maximum time to wait (default: 30000ms)
 * @param intervalMs - Check interval (default: 1000ms)
 * @returns true if ready, false if timeout
 */
export async function waitForQdrantReady(
  timeoutMs: number = 30000,
  intervalMs: number = 1000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await healthCheckQdrant()) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return false;
}

/**
 * Ensure Qdrant container is running and healthy
 *
 * @returns true if running and healthy
 */
export async function ensureQdrantRunning(): Promise<boolean> {
  const status = await getQdrantContainerStatus();

  if (!status.running) {
    logger.info(`[Qdrant Container] Starting container...`);
    await startQdrantContainer();

    logger.info(`[Qdrant Container] Waiting for Qdrant to be ready...`);
    const ready = await waitForQdrantReady();

    if (!ready) {
      logger.error(`[Qdrant Container] Timeout waiting for Qdrant to be ready`);
      return false;
    }

    logger.info(`[Qdrant Container] ✓ Qdrant is ready`);
    return true;
  }

  // Container is running, check health
  const healthy = await healthCheckQdrant();

  if (!healthy) {
    logger.warn(`[Qdrant Container] Container is running but not responding to health checks`);
    return false;
  }

  return true;
}
