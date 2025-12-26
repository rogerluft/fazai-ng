/**
 * CORS Middleware
 *
 * Cross-Origin Resource Sharing configuration
 */

import { Request, Response, NextFunction } from "express";
import { getConfigValue } from "../../config";

/**
 * CORS middleware
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const allowedOrigins = (getConfigValue("DASHBOARD_ALLOWED_ORIGINS") || "*").split(",");

  const origin = req.headers.origin;

  if (allowedOrigins.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Request-ID"
  );
  res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
}
