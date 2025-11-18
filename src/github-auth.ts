import { Octokit } from "@octokit/rest";
import chalk from "chalk";
import { logger } from "./logger";
import { getConfigValue, setConfigValue } from "./config";

export interface GitHubAuthConfig {
  token: string;
  username?: string;
  email?: string;
  isAuthenticated: boolean;
}

/**
 * GitHub Authentication Manager
 * Follows the same pattern as Cloudflare, OpenAI, and Anthropic integrations
 *
 * Configuration sources (priority):
 * 1. Environment variable: GITHUB_TOKEN
 * 2. Config file (~/.config/fazai/fazai.conf or /etc/fazai/fazai.conf)
 * 3. Interactive prompt with password input
 */
export class GitHubAuth {
  private token: string | null = null;
  private octokit: Octokit | null = null;
  private username: string | null = null;
  private email: string | null = null;

  constructor() {
    this.loadToken();
  }

  /**
   * Load GitHub token from config or environment
   */
  private loadToken(): void {
    // Priority 1: Environment variable
    if (process.env.GITHUB_TOKEN) {
      this.token = process.env.GITHUB_TOKEN;
      logger.debug("GitHub token loaded from environment (GITHUB_TOKEN)");
      return;
    }

    // Priority 2: Config file
    const configToken = getConfigValue("GITHUB_TOKEN");
    if (configToken && configToken.trim()) {
      this.token = configToken.trim();
      process.env.GITHUB_TOKEN = this.token;
      logger.debug("GitHub token loaded from config file");
      return;
    }

    logger.debug("GitHub token not found in environment or config");
  }

  /**
   * Check if GitHub token is configured
   */
  isConfigured(): boolean {
    return !!this.token;
  }

  /**
   * Get GitHub token (loads from config if not already loaded)
   */
  getToken(): string {
    if (!this.token) {
      this.loadToken();
    }
    return this.token || "";
  }

  /**
   * Set GitHub token to config
   */
  async setToken(token: string): Promise<void> {
    this.token = token;
    process.env.GITHUB_TOKEN = token;
    setConfigValue("GITHUB_TOKEN", token);
    logger.info(chalk.green("✅ GitHub token saved to config"));
  }

  /**
   * Initialize Octokit client
   */
  private initializeClient(): Octokit {
    if (this.octokit) {
      return this.octokit;
    }

    if (!this.token) {
      throw new Error("GitHub token not configured. Run 'fazai github auth' first.");
    }

    this.octokit = new Octokit({
      auth: this.token,
    });

    return this.octokit;
  }

  /**
   * Verify GitHub token is valid
   */
  async verifyToken(): Promise<boolean> {
    try {
      const client = this.initializeClient();
      const user = await client.auth.getUser();
      this.username = user.data.login;
      this.email = user.data.email || undefined;
      logger.debug(`Authenticated as: ${this.username}`);
      return true;
    } catch (error: any) {
      logger.error(chalk.red(`❌ GitHub token verification failed: ${error.message}`));
      return false;
    }
  }

  /**
   * Get authenticated user info
   */
  async getUserInfo(): Promise<any> {
    const client = this.initializeClient();
    return await client.auth.getUser();
  }

  /**
   * List user repositories
   */
  async listRepositories(options?: { per_page?: number; page?: number }): Promise<any[]> {
    const client = this.initializeClient();
    const response = await client.repos.listForAuthenticatedUser({
      per_page: options?.per_page || 30,
      page: options?.page || 1,
      sort: "updated",
      direction: "desc",
    });
    return response.data;
  }

  /**
   * Get repository details
   */
  async getRepository(owner: string, repo: string): Promise<any> {
    const client = this.initializeClient();
    const response = await client.repos.get({ owner, repo });
    return response.data;
  }

  /**
   * List issues in a repository
   */
  async listIssues(owner: string, repo: string, options?: { state?: "open" | "closed" | "all"; per_page?: number }): Promise<any[]> {
    const client = this.initializeClient();
    const response = await client.issues.listForRepo({
      owner,
      repo,
      state: options?.state || "open",
      per_page: options?.per_page || 30,
    });
    return response.data;
  }

  /**
   * Create an issue
   */
  async createIssue(owner: string, repo: string, title: string, body?: string): Promise<any> {
    const client = this.initializeClient();
    const response = await client.issues.create({
      owner,
      repo,
      title,
      body,
    });
    return response.data;
  }

  /**
   * Fork a repository
   */
  async forkRepository(owner: string, repo: string): Promise<any> {
    const client = this.initializeClient();
    const response = await client.repos.createFork({
      owner,
      repo,
    });
    return response.data;
  }

  /**
   * Star a repository
   */
  async starRepository(owner: string, repo: string): Promise<void> {
    const client = this.initializeClient();
    await client.activity.starRepoForAuthenticatedUser({
      owner,
      repo,
    });
  }

  /**
   * List starred repositories
   */
  async listStarred(options?: { per_page?: number }): Promise<any[]> {
    const client = this.initializeClient();
    const response = await client.activity.listReposStarredByAuthenticatedUser({
      per_page: options?.per_page || 30,
    });
    return response.data;
  }

  /**
   * Create a pull request
   */
  async createPullRequest(owner: string, repo: string, title: string, head: string, base: string, body?: string): Promise<any> {
    const client = this.initializeClient();
    const response = await client.pulls.create({
      owner,
      repo,
      title,
      head,
      base,
      body,
    });
    return response.data;
  }

  /**
   * Get GitHub user info (username, email)
   */
  getAuthenticatedUser(): { username: string | null; email: string | null } {
    return { username: this.username, email: this.email };
  }

  /**
   * Clear GitHub token (logout)
   */
  async logout(): Promise<void> {
    this.token = null;
    this.username = null;
    this.email = null;
    this.octokit = null;
    delete process.env.GITHUB_TOKEN;
    setConfigValue("GITHUB_TOKEN", "");
    logger.info(chalk.green("✅ GitHub logged out"));
  }
}

// Singleton instance
let githubAuthInstance: GitHubAuth | null = null;

/**
 * Get or create GitHub auth instance
 */
export function getGitHubAuth(): GitHubAuth {
  if (!githubAuthInstance) {
    githubAuthInstance = new GitHubAuth();
  }
  return githubAuthInstance;
}
