/**
 * Request Logger Middleware
 *
 * Logs HTTP requests with timing information
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "../../logger";

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, path, ip } = req;

  // Log request
  logger.debug(`→ ${method} ${path} from ${ip}`);

  // Capture response
  res.on("finish", () => {
    const duration = Date.now() - start;
    const { statusCode } = res;

    const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "debug";

    logger[level](`← ${method} ${path} ${statusCode} (${duration}ms)`);
  });

  next();
}

/**
 * Request ID middleware (for tracing)
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = req.headers["x-request-id"] || generateId();
  req.headers["x-request-id"] = id as string;
  res.setHeader("x-request-id", id);
  next();
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
