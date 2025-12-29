import fs from "fs";
import { execSync, spawnSync } from "child_process";
import { logger } from "./logger";

export interface SystemInfo {
  os: string;
  kernel: string;
  architecture: string;
  distribution: string;
  packageManager: string;
  services: string[];
  diskUsage: string;
  memory: string;
  cpu: string;
  network: string[];
  firewall: string;
  users: string[];
  essentialPackages: Record<string, boolean>;
}

export async function collectSystemInfo(): Promise<string> {
  const systemInfo: Partial<SystemInfo> = {};

  try {
    // Informações básicas do sistema
    systemInfo.os = execSync("uname -s", { encoding: "utf8" }).trim();
    systemInfo.kernel = execSync("uname -r", { encoding: "utf8" }).trim();
    systemInfo.architecture = execSync("uname -m", { encoding: "utf8" }).trim();

    // Distribuição Linux
    systemInfo.distribution = detectDistribution();

    // Gerenciador de pacotes
    const packageManagers = ["apt", "yum", "dnf", "pacman", "zypper", "emerge"];
    for (const pm of packageManagers) {
      try {
        execSync(`which ${pm}`, { stdio: "pipe" });
        systemInfo.packageManager = pm;
        break;
      } catch {}
    }

    // Serviços em execução (principais)
    try {
      const services = execSync("systemctl list-units --type=service --state=running --no-pager --no-legend | head -10 | awk '{print $1}'", { encoding: "utf8" })
        .split("\n")
        .filter(line => line.trim())
        .map(line => line.replace(".service", ""));
      systemInfo.services = services;
    } catch {
      systemInfo.services = ["systemctl não disponível"];
    }

    // Uso de disco
    try {
      systemInfo.diskUsage = execSync("df -h / | tail -1", { encoding: "utf8" }).trim();
    } catch {
      systemInfo.diskUsage = "Não disponível";
    }

    // Memória
    try {
      systemInfo.memory = execSync("free -h | grep Mem", { encoding: "utf8" }).trim();
    } catch {
      systemInfo.memory = "Não disponível";
    }

    // CPU
    try {
      systemInfo.cpu = execSync("nproc", { encoding: "utf8" }).trim() + " cores";
    } catch {
      systemInfo.cpu = "Não disponível";
    }

    // Interfaces de rede
    try {
      const interfaces = execSync("ip -brief addr show | awk '{print $1 \": \" $3}'", { encoding: "utf8" })
        .split("\n")
        .filter(line => line.trim() && !line.includes("lo:"));
      systemInfo.network = interfaces;
    } catch {
      systemInfo.network = ["Não disponível"];
    }

    // Firewall Detection
    const fws = ["ufw", "firewalld", "iptables", "nft"];
    systemInfo.firewall = "None";
    for (const fw of fws) {
      if (findExecutable([fw])) {
        systemInfo.firewall = fw;
        break;
      }
    }

    // Users with shell
    try {
      systemInfo.users = execSync("grep -E '/bin/(bash|zsh|sh)$' /etc/passwd | cut -d: -f1", { encoding: "utf8" })
        .split("\n").filter(u => u && !u.startsWith("_") && u !== "root");
    } catch { systemInfo.users = []; }

    // Essential Packages Check (Service vs Binary)
    systemInfo.essentialPackages = {};
    const services = ["nginx", "apache2", "docker", "cron", "ssh"];
    const binaries = ["python3", "node", "git", "curl", "wget"];

    for (const svc of services) {
      try {
        execSync(`systemctl is-active --quiet ${svc}`, { stdio: "ignore" });
        systemInfo.essentialPackages[svc] = true;
      } catch { systemInfo.essentialPackages[svc] = false; }
    }
    for (const bin of binaries) {
      try {
        execSync(`which ${bin}`, { stdio: "ignore" });
        systemInfo.essentialPackages[bin] = true;
      } catch { systemInfo.essentialPackages[bin] = false; }
    }

  } catch (error) {
    logger.warn("Erro ao coletar informações do sistema:", error);
  }

  // Formatar como texto legível
  return `
SISTEMA OPERACIONAL: ${systemInfo.os || "Desconhecido"}
DISTRIBUIÇÃO: ${systemInfo.distribution || "Desconhecida"}
KERNEL: ${systemInfo.kernel || "Desconhecido"}
ARQUITETURA: ${systemInfo.architecture || "Desconhecida"}
GERENCIADOR DE PACOTES: ${systemInfo.packageManager || "Desconhecido"}

RECURSOS:
CPU: ${systemInfo.cpu || "Desconhecido"}
MEMÓRIA: ${systemInfo.memory || "Desconhecido"}
DISCO (/): ${systemInfo.diskUsage || "Desconhecido"}

SERVIÇOS PRINCIPAIS ATIVOS:
${(systemInfo.services || []).slice(0, 5).map(s => `- ${s}`).join("\n")}

INTERFACES DE REDE:
${(systemInfo.network || []).slice(0, 3).map(n => `- ${n}`).join("\n")}

FIREWALL ATIVO: ${systemInfo.firewall}
PACOTES ESSENCIAIS: ${Object.entries(systemInfo.essentialPackages || {}).filter(([,v]) => v).map(([k]) => k).join(", ")}
USUÁRIOS: ${(systemInfo.users || []).join(", ")}
`.trim();
}

function detectDistribution(): string {
  try {
    const commandPath = findExecutable(["/usr/bin/lsb_release", "/bin/lsb_release", "/sbin/lsb_release", "lsb_release"]);
    if (commandPath) {
      const result = spawnSync(commandPath, ["-d", "-s"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      const output = result.stdout?.trim();
      if (result.status === 0 && output) {
        return output;
      }
    }
  } catch {
    // Ignora ENOENT / erros do spawnSync e avança para fallback
  }

  try {
    const contents = fs.readFileSync("/etc/os-release", "utf8");
    for (const line of contents.split("\n")) {
      if (line.startsWith("PRETTY_NAME=")) {
        return line.split("=")[1]?.replace(/^"+|"+$/g, "").trim() || "Unknown";
      }
    }
  } catch {
    // Ignora e usa valor padrão
  }

  return "Unknown";
}

function findExecutable(candidates: string[]): string | null {
  for (const candidate of candidates) {
    try {
      if (candidate.includes("/") && fs.existsSync(candidate) && isExecutable(candidate)) {
        return candidate;
      }
      if (!candidate.includes("/")) {
        const whichResult = spawnSync("which", [candidate], { encoding: "utf8" });
        const resolved = whichResult.stdout?.trim();
        if (whichResult.status === 0 && resolved && fs.existsSync(resolved) && isExecutable(resolved)) {
          return resolved;
        }
      }
    } catch {
      // Ignora candidato inválido
    }
  }
  return null;
}

function isExecutable(path: string): boolean {
  try {
    const stats = fs.statSync(path);
    if (!stats.isFile()) {
      return false;
    }
    fs.accessSync(path, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
