/**
 * FazAI Dashboard - Main Export
 * Barrel export for dashboard components
 */

export {
  DashboardServer,
  DashboardConfig,
  startDashboard,
  stopDashboard,
  getDashboardInstance,
} from "./server";

export { apiRouter } from "./routes/api";
export { statusRouter } from "./routes/status";
export { collectionsRouter } from "./routes/collections";
export { searchRouter } from "./routes/search";
export { agentRouter } from "./routes/agent";
export { skillsRouter } from "./routes/skills";

export {
  ApiError,
  errorHandler,
  notFoundHandler,
  validationError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  internalError,
} from "./middleware/error-handler";
