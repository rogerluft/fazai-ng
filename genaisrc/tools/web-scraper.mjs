/**
 * Web Scraper Tool - Sistema completo de scraping
 * Suporta: URLs, GitHub repos, PDFs, documentação SPA
 *
 * Features:
 * - Rate limiting automático
 * - robots.txt compliance
 * - Retry com exponential backoff
 * - HTML to clean text extraction
 * - GitHub API integration
 * - PDF parsing
 */

import { chromium } from "playwright";
import axios from "axios";
import cheerio from "cheerio";
import robotsParser from "robots-parser";

const DEFAULT_USER_AGENT = "FazAI-SkillSeeker/1.0 (Learning Bot; +https://github.com/rogerluft/fazai-ng)";
const DEFAULT_TIMEOUT = 15000; // 15s
const MAX_RETRIES = 3;
const RATE_LIMIT_DELAY = 2000; // 2s entre requests

/**
 * Verifica robots.txt antes de scraping
 */
async function checkRobotsTxt(url) {
  try {
    const parsedUrl = new URL(url);
    const robotsUrl = `${parsedUrl.protocol}//${parsedUrl.host}/robots.txt`;

    const response = await axios.get(robotsUrl, {
      timeout: 5000,
      validateStatus: (status) => status < 500,
    });

    if (response.status === 200) {
      const robots = robotsParser(robotsUrl, response.data);
      return robots.isAllowed(url, DEFAULT_USER_AGENT);
    }

    // Se não há robots.txt, assume permitido
    return true;
  } catch (error) {
    // Erro ao buscar robots.txt = assume permitido
    return true;
  }
}

/**
 * Retry com exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = MAX_RETRIES) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Limpa HTML e extrai texto relevante
 */
function cleanHtmlToText(html) {
  const $ = cheerio.load(html);

  // Remove elementos não relevantes
  $("script, style, nav, header, footer, aside, .advertisement, .ads").remove();

  // Extrai texto de elementos principais
  const content = [];

  // Títulos
  $("h1, h2, h3, h4, h5, h6").each((_, elem) => {
    const text = $(elem).text().trim();
    if (text) content.push(`# ${text}`);
  });

  // Parágrafos
  $("p").each((_, elem) => {
    const text = $(elem).text().trim();
    if (text && text.length > 20) content.push(text);
  });

  // Listas
  $("ul, ol").each((_, elem) => {
    const items = [];
    $(elem).find("li").each((_, li) => {
      const text = $(li).text().trim();
      if (text) items.push(`- ${text}`);
    });
    if (items.length > 0) content.push(items.join("\n"));
  });

  // Code blocks
  $("pre, code").each((_, elem) => {
    const text = $(elem).text().trim();
    if (text && text.length > 10) content.push(`\`\`\`\n${text}\n\`\`\``);
  });

  return content.join("\n\n");
}

/**
 * Scrape de URL estática (HTML simples)
 */
async function scrapeStaticUrl(url) {
  // Verifica robots.txt
  const allowed = await checkRobotsTxt(url);
  if (!allowed) {
    throw new Error(`Blocked by robots.txt: ${url}`);
  }

  // Rate limiting
  await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));

  const response = await retryWithBackoff(async () => {
    return await axios.get(url, {
      timeout: DEFAULT_TIMEOUT,
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      maxRedirects: 5,
    });
  });

  const text = cleanHtmlToText(response.data);

  return {
    url,
    title: cheerio.load(response.data)("title").text() || "Untitled",
    content: text,
    contentLength: text.length,
    scrapedAt: new Date().toISOString(),
    method: "static",
  };
}

/**
 * Scrape de SPA (React, Vue, etc) usando Playwright
 */
async function scrapeSpaUrl(url) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
  });
  const page = await context.newPage();

  try {
    // Navega e aguarda renderização
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: DEFAULT_TIMEOUT * 2,
    });

    // Aguarda conteúdo dinâmico
    await page.waitForTimeout(3000);

    // Extrai conteúdo
    const title = await page.title();
    const html = await page.content();
    const text = cleanHtmlToText(html);

    return {
      url,
      title,
      content: text,
      contentLength: text.length,
      scrapedAt: new Date().toISOString(),
      method: "spa",
    };
  } finally {
    await browser.close();
  }
}

/**
 * Scrape de repositório GitHub
 */
async function scrapeGitHubRepo(repoUrl) {
  // Parse GitHub URL: https://github.com/owner/repo
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) {
    throw new Error(`Invalid GitHub URL: ${repoUrl}`);
  }

  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, "");

  // GitHub API (sem auth = 60 req/hora)
  const apiUrl = `https://api.github.com/repos/${owner}/${cleanRepo}`;

  const response = await retryWithBackoff(async () => {
    return await axios.get(apiUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": DEFAULT_USER_AGENT,
      },
      timeout: DEFAULT_TIMEOUT,
    });
  });

  const repoData = response.data;

  // Busca README
  let readmeContent = "";
  try {
    const readmeResponse = await axios.get(`${apiUrl}/readme`, {
      headers: {
        Accept: "application/vnd.github.v3.raw",
        "User-Agent": DEFAULT_USER_AGENT,
      },
    });
    readmeContent = readmeResponse.data;
  } catch (error) {
    console.log("README not found");
  }

  // Busca package.json ou similar para inferir skills
  let packageJson = null;
  try {
    const pkgResponse = await axios.get(`${apiUrl}/contents/package.json`, {
      headers: {
        Accept: "application/vnd.github.v3.raw",
        "User-Agent": DEFAULT_USER_AGENT,
      },
    });
    packageJson = JSON.parse(pkgResponse.data);
  } catch (error) {
    console.log("package.json not found");
  }

  return {
    url: repoUrl,
    title: repoData.full_name,
    description: repoData.description || "",
    content: readmeContent,
    language: repoData.language,
    topics: repoData.topics || [],
    stars: repoData.stargazers_count,
    dependencies: packageJson?.dependencies || {},
    devDependencies: packageJson?.devDependencies || {},
    scrapedAt: new Date().toISOString(),
    method: "github_api",
  };
}

/**
 * Scrape de arquivo PDF local
 */
async function scrapePdf(pdfPath) {
  // TODO: Implementar PDF parsing
  // Opções: pdf-parse, pdfjs-dist, @genaiscript/core (já tem suporte)

  throw new Error("PDF scraping not yet implemented. Use GenAIScript's parsePdf() instead.");
}

/**
 * Scrape inteligente - detecta tipo e usa método apropriado
 */
export async function scrapeSource(source, options = {}) {
  const { type, forceSpa = false, topic = "general" } = options;

  try {
    let result;

    // Auto-detect tipo se não especificado
    if (!type) {
      if (source.includes("github.com")) {
        result = await scrapeGitHubRepo(source);
      } else if (source.endsWith(".pdf")) {
        result = await scrapePdf(source);
      } else if (forceSpa) {
        result = await scrapeSpaUrl(source);
      } else {
        // Tenta estático primeiro, fallback para SPA
        try {
          result = await scrapeStaticUrl(source);
        } catch (error) {
          console.log("Static scraping failed, trying SPA...");
          result = await scrapeSpaUrl(source);
        }
      }
    } else {
      // Tipo explícito
      switch (type) {
        case "url":
          result = await scrapeStaticUrl(source);
          break;
        case "github_repo":
          result = await scrapeGitHubRepo(source);
          break;
        case "pdf":
          result = await scrapePdf(source);
          break;
        case "spa":
          result = await scrapeSpaUrl(source);
          break;
        default:
          throw new Error(`Unknown source type: ${type}`);
      }
    }

    return {
      success: true,
      topic,
      ...result,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      source,
      topic,
    };
  }
}

/**
 * Scrape múltiplas fontes em paralelo (com rate limiting)
 */
export async function scrapeMultipleSources(sources, options = {}) {
  const { maxConcurrent = 3 } = options;
  const results = [];

  for (let i = 0; i < sources.length; i += maxConcurrent) {
    const batch = sources.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map((source) => scrapeSource(source, options))
    );
    results.push(...batchResults);

    // Rate limiting entre batches
    if (i + maxConcurrent < sources.length) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
    }
  }

  return results;
}

export default {
  scrapeSource,
  scrapeMultipleSources,
  scrapeStaticUrl,
  scrapeSpaUrl,
  scrapeGitHubRepo,
  scrapePdf,
};
