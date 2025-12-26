/**
 * Async Handler Wrapper
 *
 * Wraps async route handlers to catch errors and pass to error middleware
 */

import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wrap async route handlers to catch errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Wrap multiple async handlers
 */
export function asyncHandlers(
  ...fns: Array<(req: Request, res: Response, next: NextFunction) => Promise<any>>
): RequestHandler[] {
  return fns.map((fn) => asyncHandler(fn));
}
