/**
 * FazAI Dashboard API Routes
 *
 * REST endpoints for knowledge management and agent operations
 */

import { Router } from "express";
import { statusRouter } from "./status";
import { collectionsRouter } from "./collections";
import { searchRouter } from "./search";
import { agentRouter } from "./agent";
import { skillsRouter } from "./skills";
import { sambaRouter } from "./samba";
import { configRouter } from "./config";
import { promptsRouter } from "./prompts";
import { terminalRouter } from "./terminal";

export const apiRouter = Router();

// Mount sub-routers
apiRouter.use("/status", statusRouter);
apiRouter.use("/collections", collectionsRouter);
apiRouter.use("/search", searchRouter);
apiRouter.use("/agent", agentRouter);
apiRouter.use("/skills", skillsRouter);
apiRouter.use("/samba", sambaRouter);
apiRouter.use("/config", configRouter);
apiRouter.use("/prompts", promptsRouter);
apiRouter.use("/terminal", terminalRouter);

// API info endpoint
apiRouter.get("/", (req, res) => {
  res.json({
    name: "FazAI Dashboard API",
    version: "1.0.0",
    endpoints: {
      status: {
        "GET /api/status": "System status (Qdrant, Ollama, GenAIScript)",
      },
      collections: {
        "GET /api/collections": "List FazAI collections",
        "GET /api/collections/:name": "Get collection details",
        "GET /api/collections/:name/points": "List points in collection",
        "DELETE /api/collections/:name": "Delete collection",
      },
      search: {
        "POST /api/search": "Semantic search across collections",
      },
      agent: {
        "POST /api/agent/run": "Execute GenAIScript agent",
        "POST /api/agent/reflect": "Trigger reflection",
        "GET /api/agent/scripts": "List available scripts",
      },
      skills: {
        "POST /api/skills/seek": "Trigger skill seeker",
        "GET /api/skills": "List generated skills",
      },
      samba: {
        "GET /api/samba/shares": "List Samba shares",
        "POST /api/samba/shares": "Add share for directory",
        "DELETE /api/samba/shares/:name": "Remove share",
        "GET /api/samba/status": "Samba service status",
        "POST /api/samba/users": "Create Samba user (info)",
        "POST /api/samba/groups": "Create Samba group (info)",
        "POST /api/samba/restart": "Restart Samba services",
      },
      config: {
        "GET /api/config": "List configurable FazAI settings",
        "PUT /api/config": "Update configurations directly to fazai.conf",
      },
      prompts: {
        "GET /api/prompts": "List system prompts",
        "GET /api/prompts/:id": "Get prompt content",
        "POST /api/prompts": "Create new prompt",
        "PUT /api/prompts/:id": "Update existing prompt",
        "DELETE /api/prompts/:id": "Delete a prompt",
      },
      terminal: {
        "GET /api/terminal/status": "Check ttyd status",
        "GET /api/terminal/url": "Get iframe URL for ttyd",
        "POST /api/terminal/start": "Try to start ttyd locally",
      }
    },
  });
});
