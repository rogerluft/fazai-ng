import { readFile } from "fs/promises";
import { logger } from "../logger";
import { getConfigValue } from "../config";

/**
 * Watchdog Service
 * Monitora recursos do processo e reinicia em caso de anomalia.
 */
export class ResourceWatchdog {
  private timer: NodeJS.Timeout | null = null;
  private readonly MAX_MEM_MB: number;
  private readonly CHECK_INTERVAL_MS = 2000;

  constructor() {
    const configValue = getConfigValue("FAZAI_WATCHDOG_MEM_MB");
    const envValue = process.env.FAZAI_WATCHDOG_MEM_MB;
    const parsedValue = parseInt(configValue || envValue || "8192", 10);
    this.MAX_MEM_MB = isNaN(parsedValue) ? 8192 : parsedValue; // Default 8GB minimum safe limit
  }

  start(pid: number) {
    logger.debug(`🐕 Watchdog started for PID ${pid} (Limit: ${this.MAX_MEM_MB}MB)`);
    this.timer = setInterval(() => this.check(pid), this.CHECK_INTERVAL_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    logger.debug("🐕 Watchdog stopped");
  }

  private async check(pid: number) {
    try {
      // Check memory usage via /proc (Linux specific, fast)
      const status = await readFile(`/proc/${pid}/status`, 'utf8');
      const rssLine = status.split('\n').find((l: string) => l.startsWith('VmRSS:'));

      if (rssLine) {
        const kb = parseInt(rssLine.split(':')[1].trim().replace('kB', ''));
        const mb = kb / 1024;

        if (mb > this.MAX_MEM_MB) {
          logger.error(`🚨 Watchdog: Process ${pid} exceeded memory limit (${mb.toFixed(0)}MB / ${this.MAX_MEM_MB}MB). Terminating.`);
          process.kill(pid, 'SIGKILL');
          process.exit(137); // OOM Kill standard code
        }
      }
    } catch (e) {
      // Process might have ended naturally
      this.stop();
    }
  }
}
