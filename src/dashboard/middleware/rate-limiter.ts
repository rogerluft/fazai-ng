/**
 * Rate Limiter Middleware
 *
 * Simple in-memory rate limiting
 */

import { Request, Response, NextFunction } from "express";
import { ApiError } from "./error-handler";
import { logger } from "../../logger";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Simple in-memory rate limiter
 */
class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private windowMs: number = 60000, // 1 minute
    private maxRequests: number = 100
  ) {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.resetAt < now) {
      // New window
      const resetAt = now + this.windowMs;
      this.store.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: this.maxRequests - 1, resetAt };
    }

    if (entry.count >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt < now) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Global rate limiter instance
const limiter = new RateLimiter();

/**
 * Rate limiting middleware
 */
export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  // Use IP as key (in production, use authenticated user ID)
  const key = req.ip || "unknown";

  const result = limiter.check(key);

  // Set rate limit headers
  res.setHeader("X-RateLimit-Limit", limiter["maxRequests"]);
  res.setHeader("X-RateLimit-Remaining", result.remaining);
  res.setHeader("X-RateLimit-Reset", new Date(result.resetAt).toISOString());

  if (!result.allowed) {
    logger.warn(`Rate limit exceeded for ${key}`);
    throw new ApiError(429, "Too many requests", {
      retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
    });
  }

  next();
}

/**
 * Cleanup on process exit
 */
process.on("beforeExit", () => {
  limiter.destroy();
});
