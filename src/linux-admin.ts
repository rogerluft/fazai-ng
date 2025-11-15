import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { z } from "zod";
import { Readable, Transform } from "stream";
import oboe from "oboe";
import { linuxAdminPrompt } from "./linux-prompt";
import { LinuxCommandGenerator, LinuxCommandSchema, LinuxCommand } from "./types-linux";
import { logger } from "./logger";

export async function* getLinuxCommandsFromAI(
  systemInfo: string,
  task: string,
  model: string,
  provider: "anthropic" | "openai" | "openrouter" | "ollama"
): LinuxCommandGenerator {
  if (provider === "anthropic") {
    yield* getLinuxCommandsFromClaude(systemInfo, task, model);
  } else if (provider === "openai") {
    yield* getLinuxCommandsFromOpenAI(systemInfo, task, model);
  } else if (provider === "openrouter") {
    yield* getLinuxCommandsFromOpenRouter(systemInfo, task, model);
  } else if (provider === "ollama") {
    yield* getLinuxCommandsFromOllama(systemInfo, task, model);
  } else {
    throw new Error(`Provider não suportado: ${provider}`);
  }
}

async function* getLinuxCommandsFromClaude(
  systemInfo: string,
  task: string,
  model: string
): LinuxCommandGenerator {
  const anthropic = new Anthropic();

  const jsonStart = "[";

  const messages = [
    {
      role: "user" as const,
      content: linuxAdminPrompt(task),
    },
    {
      role: "assistant" as const,
      content: jsonStart,
    },
  ];

  logger.info("\n\n🖥️  Gerando comandos Linux com Claude...");

  const tokens = model.includes("sonnet") ? 8192 : 4096;

  const stream = await anthropic.messages.create({
    messages,
    model,
    max_tokens: tokens,
    stream: true,
    temperature: 0,
    system: `INFORMAÇÕES DO SISTEMA:\n${systemInfo}\n\nVocê é um administrador de sistemas Linux. Sempre priorize segurança e inclua verificações apropriadas.`,
  });

  const tokenStream = new Readable({
    read() {},
  });

  const jsonStream = new Transform({
    transform(chunk: any, encoding: any, callback: any) {
      this.push(chunk);
      callback();
    },
  });

  tokenStream.pipe(jsonStream);

  let fullJSON = jsonStart;
  let collectedCommands: LinuxCommand[] = [];
  let streamStatus: string = "notStarted";

  const parsePromise = new Promise<void>((resolve, reject) => {
    oboe(jsonStream)
      .node("!.*", (command: any) => {
        try {
          const validatedCommand = LinuxCommandSchema.parse(command);
          collectedCommands.push(validatedCommand);
        } catch (error) {
          if (error instanceof z.ZodError) {
            logger.warn("⚠️  Comando Linux inválido encontrado:", error.issues);
          }
        }
      })
      .on("done", () => {
        streamStatus = "completed";
        resolve();
      })
      .on("fail", (error: any) => {
        logger.error("❌ Erro ao fazer parse dos comandos:", error);
        reject(error);
      });
  });

  try {
    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta") {
        const token = chunk.delta.text;
        fullJSON += token;
        tokenStream.push(token);
      }
    }
  } catch (error) {
    logger.error("❌ Erro no stream:", error);
  }

  tokenStream.push(null);

  try {
    await parsePromise;
  } catch (error) {
    // Ignorar erros de parse e continuar com comandos coletados
  }

  // Yield dos comandos coletados
  for (const command of collectedCommands) {
    yield { type: "command", command };
  }

  yield { type: "allcommands", commands: collectedCommands };
}

async function* getLinuxCommandsFromOpenAI(
  systemInfo: string,
  task: string,
  model: string
): LinuxCommandGenerator {
  const openai = new OpenAI();

  logger.info("\n\n🖥️  Gerando comandos Linux com OpenAI...");

  const systemMessage = `INFORMAÇÕES DO SISTEMA:\n${systemInfo}\n\nVocê é um administrador de sistemas Linux. Sempre priorize segurança e inclua verificações apropriadas.

IMPORTANTE: Você DEVE responder APENAS com um objeto JSON válido no formato:
{"commands": [array de comandos]}

Cada comando deve ter a estrutura exata definida no prompt do usuário.`;

  const stream = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: linuxAdminPrompt(task) }
    ],
    stream: true,
    temperature: 0,
    response_format: { type: "json_object" },
  });

  const tokenStream = new Readable({
    read() {},
  });

  const jsonStream = new Transform({
    transform(chunk: any, encoding: any, callback: any) {
      this.push(chunk);
      callback();
    },
  });

  tokenStream.pipe(jsonStream);

  let fullJSON = "";
  let collectedCommands: LinuxCommand[] = [];

  const parsePromise = new Promise<void>((resolve, reject) => {
    oboe(jsonStream)
      .node("commands.*", (command: any) => {
        try {
          const validatedCommand = LinuxCommandSchema.parse(command);
          collectedCommands.push(validatedCommand);
        } catch (error) {
          if (error instanceof z.ZodError) {
            logger.warn("⚠️  Comando Linux inválido encontrado:", error.issues);
          }
        }
      })
      .on("done", () => resolve())
      .on("fail", (error: any) => {
        logger.error("❌ Erro ao fazer parse dos comandos:", error);
        reject(error);
      });
  });

  try {
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || "";
      if (token) {
        fullJSON += token;
        tokenStream.push(token);
      }
    }
  } catch (error) {
    logger.error("❌ Erro no stream:", error);
  }

  tokenStream.push(null);

  try {
    await parsePromise;
  } catch (error) {
    // Ignorar erros de parse e continuar com comandos coletados
  }

  // Yield dos comandos coletados
  for (const command of collectedCommands) {
    yield { type: "command", command };
  }

  yield { type: "allcommands", commands: collectedCommands };
}

async function* getLinuxCommandsFromOpenRouter(
  systemInfo: string,
  task: string,
  model: string
): LinuxCommandGenerator {
  const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": "https://github.com/rogerluft/fazai-ng",
      "X-Title": "FazAI Terminal Assistant",
    },
  });

  logger.info(`\n\n🖥️  Gerando comandos Linux com OpenRouter (${model})...`);

  const systemMessage = `INFORMAÇÕES DO SISTEMA:\n${systemInfo}\n\nVocê é um administrador de sistemas Linux. Sempre priorize segurança e inclua verificações apropriadas.

IMPORTANTE: Você DEVE responder APENAS com um objeto JSON válido no formato:
{"commands": [array de comandos]}

Cada comando deve ter a estrutura exata definida no prompt do usuário.`;

  const stream = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: linuxAdminPrompt(task) }
    ],
    stream: true,
    temperature: 0,
  });

  const tokenStream = new Readable({
    read() {},
  });

  const jsonStream = new Transform({
    transform(chunk: any, encoding: any, callback: any) {
      this.push(chunk);
      callback();
    },
  });

  tokenStream.pipe(jsonStream);

  let fullJSON = "";
  let collectedCommands: LinuxCommand[] = [];

  const parsePromise = new Promise<void>((resolve, reject) => {
    oboe(jsonStream)
      .node("commands.*", (command: any) => {
        try {
          const validatedCommand = LinuxCommandSchema.parse(command);
          collectedCommands.push(validatedCommand);
        } catch (error) {
          if (error instanceof z.ZodError) {
            logger.warn("⚠️  Comando Linux inválido encontrado:", error.issues);
          }
        }
      })
      .on("done", () => resolve())
      .on("fail", (error: any) => {
        logger.error("❌ Erro ao fazer parse dos comandos:", error);
        reject(error);
      });
  });

  (async () => {
    try {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        fullJSON += content;

        if (content) {
          tokenStream.push(Buffer.from(content, "utf-8"));
        }
      }

      tokenStream.push(null);
      await parsePromise;
    } catch (error) {
      logger.error("❌ Erro ao processar stream OpenRouter:", error);
      tokenStream.push(null);
    }
  })();

  let lastYieldedIndex = 0;

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (collectedCommands.length > lastYieldedIndex) {
      for (let i = lastYieldedIndex; i < collectedCommands.length; i++) {
        yield collectedCommands[i];
      }
      lastYieldedIndex = collectedCommands.length;
    }

    if (tokenStream.readableEnded && collectedCommands.length === lastYieldedIndex) {
      break;
    }
  }
}

async function* getLinuxCommandsFromOllama(
  systemInfo: string,
  task: string,
  model: string
): LinuxCommandGenerator {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const openai = new OpenAI({
    baseURL: `${baseUrl}/v1`,
    apiKey: "ollama", // Ollama não precisa de API key real
  });

  logger.info(`\n\n🖥️  Gerando comandos Linux com Ollama (${model})...`);

  const systemMessage = `INFORMAÇÕES DO SISTEMA:\n${systemInfo}\n\nVocê é um administrador de sistemas Linux. Sempre priorize segurança e inclua verificações apropriadas.

IMPORTANTE: Você DEVE responder APENAS com um objeto JSON válido no formato:
{"commands": [array de comandos]}

Cada comando deve ter a estrutura exata definida no prompt do usuário.`;

  const stream = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: linuxAdminPrompt(task) }
    ],
    stream: true,
    temperature: 0,
  });

  const tokenStream = new Readable({
    read() {},
  });

  const jsonStream = new Transform({
    transform(chunk: any, encoding: any, callback: any) {
      this.push(chunk);
      callback();
    },
  });

  tokenStream.pipe(jsonStream);

  let fullJSON = "";
  let collectedCommands: LinuxCommand[] = [];

  const parsePromise = new Promise<void>((resolve, reject) => {
    oboe(jsonStream)
      .node("commands.*", (command: any) => {
        try {
          const validatedCommand = LinuxCommandSchema.parse(command);
          collectedCommands.push(validatedCommand);
        } catch (error) {
          if (error instanceof z.ZodError) {
            logger.warn("⚠️  Comando Linux inválido encontrado:", error.issues);
          }
        }
      })
      .on("done", () => resolve())
      .on("fail", (error: any) => {
        logger.error("❌ Erro ao fazer parse dos comandos:", error);
        reject(error);
      });
  });

  try {
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || "";
      if (token) {
        fullJSON += token;
        tokenStream.push(token);
      }
    }
  } catch (error) {
    logger.error("❌ Erro no stream:", error);
  }

  tokenStream.push(null);

  try {
    await parsePromise;
  } catch (error) {
    // Ignorar erros de parse e continuar com comandos coletados
  }

  // Yield dos comandos coletados
  for (const command of collectedCommands) {
    yield { type: "command", command };
  }

  yield { type: "allcommands", commands: collectedCommands };
}
