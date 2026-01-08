/**
 * Samba API Routes
 *
 * REST API for Samba share management
 */

import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import { ApiError } from "../middleware/error-handler";
import { exec } from "child_process";
import { promisify } from "util";
import { readFile, access } from "fs/promises";
import { constants } from "fs";

const execAsync = promisify(exec);

export const sambaRouter = Router();

const FZSAMBA_SCRIPT = "/opt/fazai/bin/fzsamba";
const SMB_CONF = "/etc/samba/smb.conf";

/**
 * Helper: Check if fzsamba script exists
 */
async function checkFzsambaExists(): Promise<void> {
  try {
    await access(FZSAMBA_SCRIPT, constants.X_OK);
  } catch {
    throw new ApiError(503, "Samba management script not found or not executable");
  }
}

/**
 * Helper: Parse smb.conf to extract shares
 */
async function parseShares(): Promise<any[]> {
  try {
    const content = await readFile(SMB_CONF, "utf-8");
    const lines = content.split("\n");
    const shares: any[] = [];
    let currentShare: any = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect share section [ShareName]
      const shareMatch = trimmed.match(/^\[(.+)\]$/);
      if (shareMatch) {
        if (currentShare) {
          shares.push(currentShare);
        }
        currentShare = {
          name: shareMatch[1],
          path: null,
          validUsers: [],
          writable: false,
          browseable: false,
          forceGroup: null,
        };
        continue;
      }

      if (!currentShare) continue;

      // Parse key = value lines
      const kvMatch = trimmed.match(/^(\w+(?:\s+\w+)*)\s*=\s*(.+)$/);
      if (kvMatch) {
        const key = kvMatch[1].trim().toLowerCase();
        const value = kvMatch[2].trim();

        switch (key) {
          case "path":
            currentShare.path = value;
            break;
          case "valid users":
            currentShare.validUsers = value.split(/\s+/).filter(Boolean);
            break;
          case "writable":
            currentShare.writable = value === "yes";
            break;
          case "browseable":
            currentShare.browseable = value === "yes";
            break;
          case "force group":
            currentShare.forceGroup = value;
            break;
        }
      }
    }

    if (currentShare) {
      shares.push(currentShare);
    }

    return shares;
  } catch (error: any) {
    throw new ApiError(500, `Failed to parse smb.conf: ${error.message}`);
  }
}

/**
 * GET /api/samba/shares
 * List all Samba shares from smb.conf
 */
sambaRouter.get(
  "/shares",
  asyncHandler(async (req, res) => {
    const shares = await parseShares();

    res.json({
      total: shares.length,
      shares,
    });
  })
);

/**
 * POST /api/samba/shares
 * Add new Samba share for an existing directory
 *
 * Body:
 * {
 *   "path": "/path/to/directory"
 * }
 */
sambaRouter.post(
  "/shares",
  asyncHandler(async (req, res) => {
    await checkFzsambaExists();

    const { path } = req.body;

    if (!path || typeof path !== "string") {
      throw new ApiError(400, "Path is required and must be a string");
    }

    if (!path.startsWith("/")) {
      throw new ApiError(400, "Path must be absolute");
    }

    // Execute fzsamba add with sudo
    try {
      const { stdout, stderr } = await execAsync(
        `sudo ${FZSAMBA_SCRIPT} add "${path}"`,
        { timeout: 30000 }
      );

      res.json({
        success: true,
        message: `Share added successfully for ${path}`,
        output: stdout,
      });
    } catch (error: any) {
      throw new ApiError(500, `Failed to add share: ${error.message}`, {
        stderr: error.stderr,
      });
    }
  })
);

/**
 * DELETE /api/samba/shares/:name
 * Remove a Samba share from smb.conf
 */
sambaRouter.delete(
  "/shares/:name",
  asyncHandler(async (req, res) => {
    await checkFzsambaExists();

    const { name } = req.params;

    if (!name) {
      throw new ApiError(400, "Share name is required");
    }

    // Check if share exists
    const shares = await parseShares();
    const shareExists = shares.some((s) => s.name === name);

    if (!shareExists) {
      throw new ApiError(404, `Share '${name}' not found`);
    }

    // Execute fzsamba del with auto-confirmation
    try {
      const { stdout, stderr } = await execAsync(
        `echo "s" | sudo ${FZSAMBA_SCRIPT} del "${name}"`,
        { timeout: 30000 }
      );

      res.json({
        success: true,
        message: `Share '${name}' deleted successfully`,
        output: stdout,
      });
    } catch (error: any) {
      throw new ApiError(500, `Failed to delete share: ${error.message}`, {
        stderr: error.stderr,
      });
    }
  })
);

/**
 * GET /api/samba/status
 * Get Samba service status (smb and nmb)
 */
sambaRouter.get(
  "/status",
  asyncHandler(async (req, res) => {
    try {
      const [smbStatus, nmbStatus] = await Promise.all([
        execAsync("systemctl is-active smb.service", { timeout: 5000 }).catch(
          () => ({ stdout: "inactive", stderr: "" })
        ),
        execAsync("systemctl is-active nmb.service", { timeout: 5000 }).catch(
          () => ({ stdout: "inactive", stderr: "" })
        ),
      ]);

      const isActive =
        smbStatus.stdout.trim() === "active" &&
        nmbStatus.stdout.trim() === "active";

      res.json({
        status: isActive ? "running" : "stopped",
        services: {
          smb: smbStatus.stdout.trim(),
          nmb: nmbStatus.stdout.trim(),
        },
      });
    } catch (error: any) {
      throw new ApiError(500, `Failed to check service status: ${error.message}`);
    }
  })
);

/**
 * POST /api/samba/users
 * Create Samba user
 *
 * Body:
 * {
 *   "username": "newuser"
 * }
 */
sambaRouter.post(
  "/users",
  asyncHandler(async (req, res) => {
    await checkFzsambaExists();

    const { username } = req.body;

    if (!username || typeof username !== "string") {
      throw new ApiError(400, "Username is required and must be a string");
    }

    if (!/^[a-z_][a-z0-9_-]*[$]?$/.test(username)) {
      throw new ApiError(
        400,
        "Invalid username format (must match POSIX username rules)"
      );
    }

    // Note: fzsamba criauser is interactive and requires password input
    // For API, we'll provide guidance but not execute directly
    res.json({
      success: false,
      message:
        "User creation via fzsamba is interactive. Use CLI: sudo fzsamba criauser <username>",
      command: `sudo ${FZSAMBA_SCRIPT} criauser "${username}"`,
    });
  })
);

/**
 * POST /api/samba/groups
 * Create Samba group
 *
 * Body:
 * {
 *   "groupname": "newgroup",
 *   "users": ["user1", "user2"] // optional
 * }
 */
sambaRouter.post(
  "/groups",
  asyncHandler(async (req, res) => {
    await checkFzsambaExists();

    const { groupname, users } = req.body;

    if (!groupname || typeof groupname !== "string") {
      throw new ApiError(400, "Groupname is required and must be a string");
    }

    if (!/^[a-z_][a-z0-9_-]*[$]?$/.test(groupname)) {
      throw new ApiError(
        400,
        "Invalid group name format (must match POSIX group rules)"
      );
    }

    if (users && !Array.isArray(users)) {
      throw new ApiError(400, "Users must be an array");
    }

    // Note: fzsamba criagroup is interactive
    // For API, we'll provide guidance but not execute directly
    res.json({
      success: false,
      message:
        "Group creation via fzsamba is interactive. Use CLI: sudo fzsamba criagroup <groupname>",
      command: `sudo ${FZSAMBA_SCRIPT} criagroup "${groupname}"`,
      note: users
        ? `After creation, add users: ${users.join(", ")}`
        : "Add users interactively when prompted",
    });
  })
);

/**
 * POST /api/samba/restart
 * Restart Samba services (smb and nmb)
 */
sambaRouter.post(
  "/restart",
  asyncHandler(async (req, res) => {
    try {
      const { stdout, stderr } = await execAsync(
        "sudo systemctl restart smb.service nmb.service",
        { timeout: 30000 }
      );

      // Verify services are running
      const [smbStatus, nmbStatus] = await Promise.all([
        execAsync("systemctl is-active smb.service", { timeout: 5000 }),
        execAsync("systemctl is-active nmb.service", { timeout: 5000 }),
      ]);

      const isActive =
        smbStatus.stdout.trim() === "active" &&
        nmbStatus.stdout.trim() === "active";

      if (!isActive) {
        throw new ApiError(500, "Services restarted but not active", {
          smb: smbStatus.stdout.trim(),
          nmb: nmbStatus.stdout.trim(),
        });
      }

      res.json({
        success: true,
        message: "Samba services restarted successfully",
        services: {
          smb: smbStatus.stdout.trim(),
          nmb: nmbStatus.stdout.trim(),
        },
      });
    } catch (error: any) {
      throw new ApiError(500, `Failed to restart services: ${error.message}`, {
        stderr: error.stderr,
      });
    }
  })
);
