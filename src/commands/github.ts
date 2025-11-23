import chalk from "chalk";
import { logger } from "../logger";
import { getGitHubAuth } from "../github-auth";
import { input, select, confirm } from "@inquirer/prompts";

/**
 * GitHub CLI Commands
 * Handles authentication, repository operations, issues, and pull requests
 */

export async function handleGitHubCommand(args: string[]): Promise<void> {
  const subcommand = args[0] || "help";

  switch (subcommand) {
    case "auth":
      await handleAuth(args.slice(1));
      break;
    case "user":
      await handleUserInfo();
      break;
    case "repos":
      await handleListRepos(args.slice(1));
      break;
    case "repo":
      await handleGetRepo(args.slice(1));
      break;
    case "issues":
      await handleListIssues(args.slice(1));
      break;
    case "issue":
      await handleIssueOps(args.slice(1));
      break;
    case "fork":
      await handleFork(args.slice(1));
      break;
    case "star":
      await handleStar(args.slice(1));
      break;
    case "starred":
      await handleListStarred();
      break;
    case "pr":
      await handlePullRequest(args.slice(1));
      break;
    case "help":
    default:
      displayHelp();
  }
}

/**
 * Authentication subcommand
 */
async function handleAuth(args: string[]): Promise<void> {
  const action = args[0];
  const github = getGitHubAuth();

  if (action === "logout") {
    if (github.isConfigured()) {
      const confirm = await confirm({
        message: "Are you sure you want to logout from GitHub?",
        default: false,
      });
      if (confirm) {
        await github.logout();
      }
    } else {
      logger.info(chalk.yellow("ℹ️  Not logged in to GitHub"));
    }
    return;
  }

  if (action === "status") {
    if (github.isConfigured()) {
      const isValid = await github.verifyToken();
      if (isValid) {
        const user = github.getAuthenticatedUser();
        logger.info(chalk.green("✅ Authenticated to GitHub"));
        logger.info(chalk.gray(`   Username: ${user.username}`));
        if (user.email) {
          logger.info(chalk.gray(`   Email: ${user.email}`));
        }
      } else {
        logger.error(chalk.red("❌ GitHub token is invalid or expired"));
      }
    } else {
      logger.info(chalk.yellow("ℹ️  Not configured. Run 'fazai github auth login'"));
    }
    return;
  }

  // Default: login
  logger.info(chalk.cyan("\n🔐 GitHub Authentication\n"));

  const token = await input({
    message: "Enter your GitHub Personal Access Token (or press Enter to generate one)",
    mask: "*",
    validate: (value) => {
      if (value.length < 20) {
        return "Token must be at least 20 characters";
      }
      return true;
    },
  });

  if (token) {
    await github.setToken(token);

    const isValid = await github.verifyToken();
    if (isValid) {
      const user = github.getAuthenticatedUser();
      logger.info(chalk.green(`\n✅ Successfully authenticated as ${user.username}\n`));
    } else {
      logger.error(chalk.red("❌ Token verification failed. Please check your token."));
    }
  } else {
    logger.info(chalk.cyan(`\nℹ️  Get a GitHub PAT at: https://github.com/settings/tokens\n`));
    logger.info("Create a token with these scopes:");
    logger.info("  • repo (full control of private repositories)");
    logger.info("  • read:user (read user profile data)");
    logger.info("  • public_repo (access public repositories)\n");
  }
}

/**
 * User info subcommand
 */
async function handleUserInfo(): Promise<void> {
  const github = getGitHubAuth();

  if (!github.isConfigured()) {
    logger.error(chalk.red("❌ Not authenticated. Run 'fazai github auth login'"));
    return;
  }

  try {
    const user = await github.getUserInfo();
    logger.info(chalk.cyan("\n👤 GitHub User Information\n"));
    logger.info(chalk.gray(`Name:        ${user.data.name || "N/A"}`));
    logger.info(chalk.gray(`Username:    ${user.data.login}`));
    logger.info(chalk.gray(`Email:       ${user.data.email || "N/A"}`));
    logger.info(chalk.gray(`Public repos: ${user.data.public_repos}`));
    logger.info(chalk.gray(`Followers:   ${user.data.followers}`));
    logger.info(chalk.gray(`Following:   ${user.data.following}`));
    logger.info(chalk.gray(`Created:     ${new Date(user.data.created_at).toLocaleDateString()}\n`));
  } catch (error: any) {
    logger.error(chalk.red(`❌ Error: ${error.message}`));
  }
}

/**
 * List repositories
 */
async function handleListRepos(args: string[]): Promise<void> {
  const github = getGitHubAuth();

  if (!github.isConfigured()) {
    logger.error(chalk.red("❌ Not authenticated. Run 'fazai github auth login'"));
    return;
  }

  try {
    const repos = await github.listRepositories({ per_page: 10 });
    logger.info(chalk.cyan(`\n📦 Your Repositories (${repos.length} most recent)\n`));
    repos.forEach((repo) => {
      logger.info(chalk.white(`  ${repo.name}`));
      logger.info(chalk.gray(`    ⭐ ${repo.stargazers_count} | 🍴 ${repo.forks_count} | Updated: ${new Date(repo.updated_at).toLocaleDateString()}`));
      if (repo.description) {
        logger.info(chalk.gray(`    ${repo.description}`));
      }
    });
    logger.info("");
  } catch (error: any) {
    logger.error(chalk.red(`❌ Error: ${error.message}`));
  }
}

/**
 * Get specific repository info
 */
async function handleGetRepo(args: string[]): Promise<void> {
  const github = getGitHubAuth();

  if (!github.isConfigured()) {
    logger.error(chalk.red("❌ Not authenticated. Run 'fazai github auth login'"));
    return;
  }

  const repoPath = args[0];
  if (!repoPath || !repoPath.includes("/")) {
    logger.error(chalk.red("❌ Usage: fazai github repo <owner>/<repo>"));
    return;
  }

  const [owner, repo] = repoPath.split("/");

  try {
    const repoInfo = await github.getRepository(owner, repo);
    logger.info(chalk.cyan(`\n📦 Repository: ${repoInfo.full_name}\n`));
    logger.info(chalk.gray(`Description: ${repoInfo.description || "N/A"}`));
    logger.info(chalk.gray(`Language: ${repoInfo.language || "N/A"}`));
    logger.info(chalk.gray(`Stars: ${repoInfo.stargazers_count}`));
    logger.info(chalk.gray(`Forks: ${repoInfo.forks_count}`));
    logger.info(chalk.gray(`Open Issues: ${repoInfo.open_issues_count}`));
    logger.info(chalk.gray(`URL: ${repoInfo.html_url}\n`));
  } catch (error: any) {
    logger.error(chalk.red(`❌ Error: ${error.message}`));
  }
}

/**
 * List issues
 */
async function handleListIssues(args: string[]): Promise<void> {
  const github = getGitHubAuth();

  if (!github.isConfigured()) {
    logger.error(chalk.red("❌ Not authenticated. Run 'fazai github auth login'"));
    return;
  }

  const repoPath = args[0];
  if (!repoPath || !repoPath.includes("/")) {
    logger.error(chalk.red("❌ Usage: fazai github issues <owner>/<repo>"));
    return;
  }

  const [owner, repo] = repoPath.split("/");

  try {
    const issues = await github.listIssues(owner, repo);
    logger.info(chalk.cyan(`\n🐛 Issues for ${owner}/${repo} (${issues.length} open)\n`));
    issues.slice(0, 5).forEach((issue) => {
      logger.info(chalk.white(`  #${issue.number} ${issue.title}`));
      logger.info(chalk.gray(`     Created: ${new Date(issue.created_at).toLocaleDateString()}`));
    });
    logger.info("");
  } catch (error: any) {
    logger.error(chalk.red(`❌ Error: ${error.message}`));
  }
}

/**
 * Create or manage issues
 */
async function handleIssueOps(args: string[]): Promise<void> {
  const github = getGitHubAuth();

  if (!github.isConfigured()) {
    logger.error(chalk.red("❌ Not authenticated. Run 'fazai github auth login'"));
    return;
  }

  const action = args[0];

  if (action === "create") {
    const repoPath = args[1];
    if (!repoPath || !repoPath.includes("/")) {
      logger.error(chalk.red("❌ Usage: fazai github issue create <owner>/<repo>"));
      return;
    }

    const [owner, repo] = repoPath.split("/");
    const title = await input({ message: "Issue title" });
    const body = await input({ message: "Issue description (optional)", default: "" });

    try {
      const issue = await github.createIssue(owner, repo, title, body || undefined);
      logger.info(chalk.green(`✅ Issue created: ${issue.html_url}`));
    } catch (error: any) {
      logger.error(chalk.red(`❌ Error: ${error.message}`));
    }
  }
}

/**
 * Fork a repository
 */
async function handleFork(args: string[]): Promise<void> {
  const github = getGitHubAuth();

  if (!github.isConfigured()) {
    logger.error(chalk.red("❌ Not authenticated. Run 'fazai github auth login'"));
    return;
  }

  const repoPath = args[0];
  if (!repoPath || !repoPath.includes("/")) {
    logger.error(chalk.red("❌ Usage: fazai github fork <owner>/<repo>"));
    return;
  }

  const [owner, repo] = repoPath.split("/");

  try {
    const forked = await github.forkRepository(owner, repo);
    logger.info(chalk.green(`✅ Forked to: ${forked.html_url}`));
  } catch (error: any) {
    logger.error(chalk.red(`❌ Error: ${error.message}`));
  }
}

/**
 * Star a repository
 */
async function handleStar(args: string[]): Promise<void> {
  const github = getGitHubAuth();

  if (!github.isConfigured()) {
    logger.error(chalk.red("❌ Not authenticated. Run 'fazai github auth login'"));
    return;
  }

  const repoPath = args[0];
  if (!repoPath || !repoPath.includes("/")) {
    logger.error(chalk.red("❌ Usage: fazai github star <owner>/<repo>"));
    return;
  }

  const [owner, repo] = repoPath.split("/");

  try {
    await github.starRepository(owner, repo);
    logger.info(chalk.green(`✅ Starred: ${owner}/${repo}`));
  } catch (error: any) {
    logger.error(chalk.red(`❌ Error: ${error.message}`));
  }
}

/**
 * List starred repositories
 */
async function handleListStarred(): Promise<void> {
  const github = getGitHubAuth();

  if (!github.isConfigured()) {
    logger.error(chalk.red("❌ Not authenticated. Run 'fazai github auth login'"));
    return;
  }

  try {
    const starred = await github.listStarred();
    logger.info(chalk.cyan(`\n⭐ Your Starred Repositories (${starred.length} shown)\n`));
    starred.slice(0, 10).forEach((repo) => {
      logger.info(chalk.white(`  ${repo.full_name}`));
      logger.info(chalk.gray(`    ⭐ ${repo.stargazers_count} | 🍴 ${repo.forks_count}`));
    });
    logger.info("");
  } catch (error: any) {
    logger.error(chalk.red(`❌ Error: ${error.message}`));
  }
}

/**
 * Create pull request
 */
async function handlePullRequest(args: string[]): Promise<void> {
  const github = getGitHubAuth();

  if (!github.isConfigured()) {
    logger.error(chalk.red("❌ Not authenticated. Run 'fazai github auth login'"));
    return;
  }

  logger.info(chalk.yellow("ℹ️  Pull request feature coming soon"));
}

/**
 * Display help text
 */
function displayHelp(): void {
  logger.info(chalk.cyan("\n🔗 GitHub Commands\n"));

  logger.info(chalk.white("Authentication:"));
  logger.info(chalk.gray("  fazai github auth login         # Login with PAT"));
  logger.info(chalk.gray("  fazai github auth logout        # Logout"));
  logger.info(chalk.gray("  fazai github auth status        # Check authentication\n"));

  logger.info(chalk.white("User & Repositories:"));
  logger.info(chalk.gray("  fazai github user               # Show user info"));
  logger.info(chalk.gray("  fazai github repos              # List your repositories"));
  logger.info(chalk.gray("  fazai github repo <owner>/<repo> # Get repo info\n"));

  logger.info(chalk.white("Issues:"));
  logger.info(chalk.gray("  fazai github issues <owner>/<repo>        # List issues"));
  logger.info(chalk.gray("  fazai github issue create <owner>/<repo>  # Create issue\n"));

  logger.info(chalk.white("Repository Operations:"));
  logger.info(chalk.gray("  fazai github fork <owner>/<repo>          # Fork repository"));
  logger.info(chalk.gray("  fazai github star <owner>/<repo>          # Star repository"));
  logger.info(chalk.gray("  fazai github starred                       # List starred repos\n"));

  logger.info(chalk.white("Get Started:"));
  logger.info(chalk.gray("  1. Create a GitHub PAT: https://github.com/settings/tokens"));
  logger.info(chalk.gray("  2. Scopes needed: repo, read:user, public_repo"));
  logger.info(chalk.gray("  3. Run: fazai github auth login\n"));
}
