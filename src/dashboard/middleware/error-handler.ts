/**
 * Error Handler Middleware
 *
 * Centralized error handling for Express routes
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "../../logger";

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = "ApiError";
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error response interface
 */
interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: any;
  timestamp: string;
  path?: string;
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  error: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Don't log if headers already sent
  if (res.headersSent) {
    return next(error);
  }

  const isApiError = error instanceof ApiError;
  const statusCode = isApiError ? error.statusCode : 500;

  // Log error
  if (statusCode >= 500) {
    logger.error(`Server error: ${error.message}`, {
      path: req.path,
      method: req.method,
      stack: error.stack,
    });
  } else {
    logger.debug(`Client error (${statusCode}): ${error.message}`, {
      path: req.path,
      method: req.method,
    });
  }

  // Build error response
  const errorResponse: ErrorResponse = {
    error: error.name || "Error",
    message: error.message || "Internal server error",
    statusCode,
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  // Add details for API errors
  if (isApiError && error.details) {
    errorResponse.details = error.details;
  }

  // Don't expose stack traces in production
  if (process.env.NODE_ENV !== "production" && error.stack) {
    (errorResponse as any).stack = error.stack.split("\n");
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * 404 handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found`,
    statusCode: 404,
    timestamp: new Date().toISOString(),
    path: req.path,
  });
}

/**
 * Validation error helper
 */
export function validationError(message: string, details?: any): ApiError {
  return new ApiError(400, message, details);
}

/**
 * Unauthorized error helper
 */
export function unauthorizedError(message = "Unauthorized"): ApiError {
  return new ApiError(401, message);
}

/**
 * Forbidden error helper
 */
export function forbiddenError(message = "Forbidden"): ApiError {
  return new ApiError(403, message);
}

/**
 * Not found error helper
 */
export function notFoundError(resource: string): ApiError {
  return new ApiError(404, `${resource} not found`);
}

/**
 * Internal server error helper
 */
export function internalError(message = "Internal server error"): ApiError {
  return new ApiError(500, message);
}
