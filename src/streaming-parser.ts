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

export interface ParseStats {
  totalCommands: number;
  validCommands: number;
  invalidCommands: number;
  parseErrors: number;
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
  const tokenStream = new Readable({ read() { } });
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

  // Track parsing statistics
  const stats: ParseStats = {
    totalCommands: 0,
    validCommands: 0,
    invalidCommands: 0,
    parseErrors: 0,
  };

  // Setup timeout detection for stalled streams
  let lastChunkTime = Date.now();
  const STREAM_TIMEOUT_MS = 30000; // 30 seconds without data = stalled

  // Setup oboe parser for incremental JSON parsing
  const parsePromise = new Promise<void>((resolve, reject) => {
    oboe(jsonStream)
      .node("commands.*", (command: any) => {
        stats.totalCommands++;
        try {
          const validatedCommand = LinuxCommandSchema.parse(command);
          collectedCommands.push(validatedCommand);
          stats.validCommands++;
          logger.debug(`✓ Command parsed: ${validatedCommand.command.substring(0, 50)}...`);
        } catch (error) {
          stats.invalidCommands++;
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
        stats.parseErrors++;
        // Oboe may fail if JSON is incomplete, try to salvage what we have
        if (collectedCommands.length > 0) {
          logger.debug(`Parsing ended with ${collectedCommands.length} commands collected`);
          resolve();
        } else {
          logger.warn("⚠️  JSON parsing failed:", error.thrown?.message || "stream ended");
          reject(new Error(`JSON parsing failed: ${error.thrown?.message || "unknown error"}`));
        }
      });
  });

  // Stream tokens from AI provider to oboe parser
  try {
    for await (const chunk of streamSource) {
      if (!chunk) continue;

      // Update timeout tracker
      lastChunkTime = Date.now();

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
          // Clean markdown code blocks that wrap JSON (e.g., ```json\n{...}\n```)
          let cleanedChunk = chunk;

          // Strip opening markdown code blocks
          if (!jsonStarted && cleanedChunk.includes("```")) {
            // Remove ```json or ``` prefix
            cleanedChunk = cleanedChunk.replace(/```(?:json|JSON)?\s*\n?/g, "");
          }

          // Strip closing markdown code blocks
          if (cleanedChunk.includes("```")) {
            cleanedChunk = cleanedChunk.replace(/\n?```\s*$/g, "");
          }

          if (!jsonStarted) {
            const jsonStart = cleanedChunk.search(/[{[]/);
            if (jsonStart !== -1) {
              jsonStarted = true;
              tokenStream.push(Buffer.from(cleanedChunk.substring(jsonStart), "utf-8"));
            }
          } else {
            // Also clean any stray closing backticks in subsequent chunks
            cleanedChunk = cleanedChunk.replace(/```\s*$/g, "");
            tokenStream.push(Buffer.from(cleanedChunk, "utf-8"));
          }
          break;
      }

      // Check for stream timeout
      if (Date.now() - lastChunkTime > STREAM_TIMEOUT_MS) {
        logger.warn("⚠️  Stream timeout: No data received for 30s");
        throw new Error("Stream timeout: No data received for 30 seconds");
      }
    }
  } catch (error) {
    logger.error("❌ Stream error:", error);
    // Try to salvage partial results if we have any commands
    if (collectedCommands.length === 0) {
      throw error; // Re-throw if we have nothing
    }
    logger.info(`Continuing with ${collectedCommands.length} partially parsed commands`);
  }

  // Signal end of stream
  tokenStream.push(null);

  // Wait for oboe to finish parsing
  try {
    await parsePromise;
  } catch (error) {
    // If parsing failed but we have some commands, continue with warnings
    if (collectedCommands.length > 0) {
      logger.warn(`⚠️  Parsing incomplete, but recovered ${collectedCommands.length} commands`);
    } else {
      logger.error("❌ Parsing failed with no commands recovered");
      throw error;
    }
  }

  // Log parsing statistics
  logger.debug(`[DEBUG] Full JSON received (${fullJSON.length} chars):`, fullJSON.substring(0, 500));
  logger.info(`✓ Commands: ${stats.validCommands} valid, ${stats.invalidCommands} invalid, ${stats.parseErrors} errors`);

  // Warn if validation failure rate is high
  if (stats.totalCommands > 0) {
    const failureRate = (stats.invalidCommands / stats.totalCommands) * 100;
    if (failureRate > 50) {
      logger.warn(`⚠️  High validation failure rate: ${failureRate.toFixed(1)}%`);
    }
  }

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
