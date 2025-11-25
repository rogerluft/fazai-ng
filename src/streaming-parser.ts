/**
 * Unified JSON Streaming Parser using oboe
 * Professional implementation for parsing streaming JSON from AI providers
 * Author: Roger Luft (Roginho)
 * License: MIT
 */

import { Readable, Transform } from "stream";
import oboe from "oboe";
import { z } from "zod";
import { LinuxCommand, LinuxCommandSchema } from "./types-linux";
import { logger } from "./logger";

export type StreamSourceType = "anthropic" | "openai" | "google" | "ollama";

export interface StreamResult {
  type: "command" | "allcommands";
  command?: LinuxCommand;
  commands?: LinuxCommand[];
}

/**
 * Unified streaming JSON parser that works with all AI providers
 * Uses oboe for incremental JSON parsing from streaming responses
 * 
 * @param streamSource - AsyncIterable providing text chunks from AI provider
 * @param sourceType - Provider type for format-specific handling
 * @returns AsyncGenerator yielding validated commands as they're parsed
 */
export async function* parseStreamingJSON(
  streamSource: AsyncIterable<string>,
  sourceType: StreamSourceType = "openai"
): AsyncGenerator<StreamResult> {
  // Create Node.js streams for oboe
  const tokenStream = new Readable({ read() {} });
  const jsonStream = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      this.push(chunk);
      callback();
    },
  });

  tokenStream.pipe(jsonStream);

  const collectedCommands: LinuxCommand[] = [];
  let jsonStarted = false;
  let fullJSON = "";

  // Setup oboe parser for incremental JSON parsing
  const parsePromise = new Promise<void>((resolve) => {
    oboe(jsonStream)
      .node("commands.*", (command: any) => {
        try {
          const validatedCommand = LinuxCommandSchema.parse(command);
          collectedCommands.push(validatedCommand);
          logger.debug(`✓ Command parsed: ${validatedCommand.command.substring(0, 50)}...`);
        } catch (error) {
          if (error instanceof z.ZodError) {
            logger.warn("⚠️  Invalid command skipped:", error.issues[0]?.message);
          }
        }
        return oboe.drop; // Don't keep in memory
      })
      .on("done", () => {
        logger.debug("✓ JSON parsing completed");
        resolve();
      })
      .on("fail", (error: any) => {
        // Oboe often fires 'fail' at end of stream, which is normal
        logger.debug("Parsing finished:", error.thrown?.message || "stream ended");
        resolve();
      });
  });

  // Stream tokens from AI provider to oboe parser
  try {
    for await (const chunk of streamSource) {
      if (!chunk) continue;

      fullJSON += chunk;

      // Handle different provider response formats
      switch (sourceType) {
        case "anthropic":
          // Claude sends clean text chunks
          tokenStream.push(Buffer.from(chunk, "utf-8"));
          break;

        case "google":
          // Gemini may have prefix text before JSON
          if (!jsonStarted) {
            const jsonStart = chunk.search(/[{[]/);
            if (jsonStart !== -1) {
              jsonStarted = true;
              tokenStream.push(Buffer.from(chunk.substring(jsonStart), "utf-8"));
            }
          } else {
            tokenStream.push(Buffer.from(chunk, "utf-8"));
          }
          break;

        case "openai":
        case "ollama":
        default:
          // OpenAI/Ollama/OpenRouter may have markdown or text prefix
          if (!jsonStarted) {
            const jsonStart = chunk.search(/[{[]/);
            if (jsonStart !== -1) {
              jsonStarted = true;
              tokenStream.push(Buffer.from(chunk.substring(jsonStart), "utf-8"));
            }
          } else {
            tokenStream.push(Buffer.from(chunk, "utf-8"));
          }
          break;
      }
    }
  } catch (error) {
    logger.error("❌ Stream error:", error);
  }

  // Signal end of stream
  tokenStream.push(null);

  // Wait for oboe to finish parsing
  await parsePromise;

  // Log complete JSON for debugging
  logger.debug(`[DEBUG] Full JSON received (${fullJSON.length} chars):`, fullJSON.substring(0, 500));
  logger.info(`[DEBUG] Commands collected: ${collectedCommands.length}`);

  // Yield all collected and validated commands
  for (const command of collectedCommands) {
    yield { type: "command", command };
  }

  yield { type: "allcommands", commands: collectedCommands };
}

/**
 * Helper to create async iterator from AI provider responses
 */
export async function* iterateAnthropicStream(stream: AsyncIterable<any>): AsyncIterable<string> {
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

export async function* iterateOpenAIStream(stream: AsyncIterable<any>): AsyncIterable<string> {
  logger.debug("[DEBUG] iterateOpenAIStream: Starting stream iteration");
  let chunkCount = 0;
  
  for await (const chunk of stream) {
    chunkCount++;
    logger.debug(`[DEBUG] Chunk #${chunkCount} received:`, JSON.stringify(chunk).substring(0, 200));
    
    // Handle OpenAI-style streaming (choices array with delta)
    const delta = chunk.choices?.[0]?.delta;
    if (delta) {
      // Some models use "reasoning" instead of "content"
      const content = delta.content || delta.reasoning;
      if (content) {
        logger.debug(`[DEBUG] Content (OpenAI): ${content.substring(0, 100)}...`);
        yield content;
      }
      continue;
    }
    
    // Handle Ollama-style streaming (direct response/thinking fields)
    // Ollama returns NDJSON with "response" or "thinking" fields
    const ollamaContent = chunk.response || chunk.thinking;
    if (ollamaContent) {
      logger.debug(`[DEBUG] Content (Ollama): ${ollamaContent.substring(0, 100)}...`);
      yield ollamaContent;
    }
  }
  
  logger.debug(`[DEBUG] Stream iteration complete. Total chunks: ${chunkCount}`);
}

export async function* iterateGoogleStream(stream: AsyncIterable<any>): AsyncIterable<string> {
  for await (const chunk of stream) {
    const text = chunk.text();
    if (text) {
      yield text;
    }
  }
}
