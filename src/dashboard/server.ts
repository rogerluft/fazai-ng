/**
 * FazAI Express.js Dashboard Server
 *
 * REST API for FazAI knowledge management and agent monitoring
 *
 * Features:
 * - Qdrant collection management
 * - GenAIScript agent execution
 * - Semantic search across collections
 * - Real-time status monitoring
 * - Skill seeker integration
 */

import express, { Express } from "express";
import { createServer, Server } from "http";
import { logger } from "../logger";
import { getConfigValue } from "../config";
import { apiRouter } from "./routes/api";
import { errorHandler } from "./middleware/error-handler";
import { requestLogger } from "./middleware/request-logger";
import { corsMiddleware } from "./middleware/cors";
import { rateLimiter } from "./middleware/rate-limiter";

export interface DashboardConfig {
  port: number;
  host: string;
  enableCors: boolean;
  enableRateLimit: boolean;
  logRequests: boolean;
}

export class DashboardServer {
  private app: Express;
  private server: Server | null = null;
  private config: DashboardConfig;

  constructor(config?: Partial<DashboardConfig>) {
    this.config = {
      port: parseInt(getConfigValue("DASHBOARD_PORT") || "3000", 10),
      host: getConfigValue("DASHBOARD_HOST") || "localhost",
      enableCors: getConfigValue("DASHBOARD_ENABLE_CORS") !== "false",
      enableRateLimit: getConfigValue("DASHBOARD_ENABLE_RATE_LIMIT") !== "false",
      logRequests: getConfigValue("DASHBOARD_LOG_REQUESTS") !== "false",
      ...config,
    };

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware stack
   */
  private setupMiddleware(): void {
    // Body parsers
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // CORS
    if (this.config.enableCors) {
      this.app.use(corsMiddleware);
    }

    // Request logging
    if (this.config.logRequests) {
      this.app.use(requestLogger);
    }

    // Rate limiting
    if (this.config.enableRateLimit) {
      this.app.use(rateLimiter);
    }
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // API routes
    this.app.use("/api", apiRouter);

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: "Not Found",
        message: `Route ${req.method} ${req.path} not found`,
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = createServer(this.app);

        this.server.listen(this.config.port, this.config.host, () => {
          logger.info(
            `🚀 FazAI Dashboard running on http://${this.config.host}:${this.config.port}`
          );
          logger.info(`   Health: http://${this.config.host}:${this.config.port}/health`);
          logger.info(`   API: http://${this.config.host}:${this.config.port}/api`);
          resolve();
        });

        this.server.on("error", (error: NodeJS.ErrnoException) => {
          if (error.code === "EADDRINUSE") {
            logger.error(
              `Port ${this.config.port} is already in use. Try a different port.`
            );
          } else {
            logger.error(`Server error: ${error.message}`);
          }
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the server gracefully
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      logger.info("Shutting down dashboard server...");

      this.server.close((error) => {
        if (error) {
          logger.error(`Error shutting down: ${error.message}`);
          reject(error);
        } else {
          logger.info("Dashboard server stopped");
          this.server = null;
          resolve();
        }
      });

      // Force close after 5 seconds
      const forceCloseTimeout = setTimeout(() => {
        logger.warn("Force closing server after timeout");

        // server.closeAllConnections() was added in Node v18.2.0
        // For broader compatibility, we can destroy sockets manually if needed
        if (this.server && typeof this.server.closeAllConnections === 'function') {
           this.server.closeAllConnections();
        }

        this.server = null;
        resolve();
      }, 5000);

      // Prevent the timeout from keeping the process alive
      forceCloseTimeout.unref();
    });
  }

  /**
   * Get Express app instance (for testing)
   */
  getApp(): Express {
    return this.app;
  }

  /**
   * Get server configuration
   */
  getConfig(): DashboardConfig {
    return { ...this.config };
  }
}

/**
 * Create and start dashboard server
 */
export async function startDashboard(config?: Partial<DashboardConfig>): Promise<DashboardServer> {
  const server = new DashboardServer(config);
  await server.start();
  return server;
}

/**
 * Singleton instance for CLI usage
 */
let dashboardInstance: DashboardServer | null = null;

export async function getDashboardInstance(config?: Partial<DashboardConfig>): Promise<DashboardServer> {
  if (!dashboardInstance) {
    dashboardInstance = new DashboardServer(config);
  }
  return dashboardInstance;
}

export async function stopDashboard(): Promise<void> {
  if (dashboardInstance) {
    await dashboardInstance.stop();
    dashboardInstance = null;
  }
}
