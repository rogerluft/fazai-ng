/**
 * FazAI Telegram Bot Skill
 * 
 * Provides an alternate input gateway via Telegram.
 * Starts a polling bot that receives messages, routes them to
 * the AgenticLoop, and replies with the agent's output.
 * 
 * Depends on: node-telegram-bot-api
 * 
 * @module skills/telegram-bot
 */

import { logger } from "../logger.js";
import { getConfigValue } from "../config.js";
import { SkillDefinition } from "./registry.js";
import { AgenticLoop } from "../agentic/agentic-loop.js";

interface TelegramBotContext {
  bot: any; // TelegramBot instance
  isRunning: boolean;
}

const context: TelegramBotContext = {
  bot: null,
  isRunning: false,
};

export const telegramBotSkill: SkillDefinition = {
  id: "telegram-bot",
  name: "Telegram Gateway Bot",
  description: "Starts a Telegram bot to act as a chat interface for FazAI",
  category: "system",
  permissionLevel: "medium",
  source: "runtime",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["start", "stop", "status"],
        description: "Action to perform (start, stop, status)",
        default: "status",
      },
    },
    required: ["action"],
  },
  handler: async (input: Record<string, unknown>) => {
    const action = input.action as string || "status";
    
    if (action === "status") {
      return {
        success: true,
        output: `Telegram Bot Status: ${context.isRunning ? "Running" : "Stopped"}`,
        duration: 0,
      };
    }

    if (action === "stop") {
      if (!context.isRunning || !context.bot) {
        return { success: true, output: "Bot is already stopped.", duration: 0 };
      }
      
      try {
        await context.bot.stopPolling();
        context.isRunning = false;
        context.bot = null;
        logger.info("[TelegramBot] Stopped listening");
        return { success: true, output: "Telegram bot stopped successfully.", duration: 0 };
      } catch (error: any) {
        return { success: false, output: "", duration: 0, error: `Failed to stop bot: ${error.message}` };
      }
    }

    if (action === "start") {
      if (context.isRunning) {
        return { success: true, output: "Bot is already running.", duration: 0 };
      }

      const token = getConfigValue("TELEGRAM_BOT_TOKEN");
      const allowedUsersId = getConfigValue("TELEGRAM_ALLOWED_USERS")?.split(",").map(id => id.trim()) || [];

      if (!token) {
        return { 
          success: false, 
          output: "", 
          duration: 0, 
          error: "TELEGRAM_BOT_TOKEN not configured in fazai.conf" 
        };
      }

      try {
        // Dynamic import to allow running without the dependency if unused
        const TelegramBot = (await import("node-telegram-bot-api")).default;
        
        context.bot = new TelegramBot(token, { polling: true });
        context.isRunning = true;

        logger.info("[TelegramBot] Started polling for messages");

        context.bot.on("message", async (msg: any) => {
          const chatId = msg.chat.id;
          const text = msg.text;
          const userId = msg.from?.id?.toString() || "";

          logger.debug(`[TelegramBot] Received message from ${userId}: ${text}`);

          // Security check
          if (allowedUsersId.length > 0 && !allowedUsersId.includes(userId)) {
            logger.warn(`[TelegramBot] Unauthorized user attempted access: ${userId}`);
            await context.bot.sendMessage(chatId, "Unauthorized user.");
            return;
          }

          if (!text) return;

          // Process commands
          if (text === "/start") {
            await context.bot.sendMessage(chatId, "Hello! I am FazAI. Send me a prompt to begin.");
            return;
          }

          // Let the user know we are thinking
          const typingMsg = await context.bot.sendMessage(chatId, "🤔 Pensando...");

          try {
            // Run standard Agentic Loop
            const loop = new AgenticLoop({
              maxIterations: 5,
              enableReflection: true,
              enableLearning: true,
            });

            const state = await loop.run(text);
            const rawOutput = loop.formatOutput(state);
            
            // Extract just the final assistant text to avoid overwhelming chat
            const lines = rawOutput.split("\\n");
            let cleanOut = lines.find((l: string) => l.includes("AgenticLoop Final Output:")) 
              ? rawOutput.split("AgenticLoop Final Output:")[1].trim() 
              : rawOutput;
            
            // Telegram has a 4096 char limit
            if (cleanOut.length > 4000) {
              cleanOut = cleanOut.substring(0, 4000) + "... [Truncated]";
            }

            // Edit "thinking" message with the final result
            await context.bot.editMessageText(cleanOut, {
              chat_id: chatId,
              message_id: typingMsg.message_id,
            });

          } catch (err: any) {
            logger.error(`[TelegramBot] Error processing message: ${err.message}`);
            await context.bot.editMessageText(`❌ Error completing request: ${err.message}`, {
              chat_id: chatId,
              message_id: typingMsg.message_id,
            });
          }
        });

        // Error handling
        context.bot.on("polling_error", (error: any) => {
          logger.error(`[TelegramBot] Polling error: ${error.message}`);
        });

        return { 
          success: true, 
          output: "Telegram bot started successfully and is now listening for messages.", 
          duration: 0 
        };
      } catch (error: any) {
        context.isRunning = false;
        context.bot = null;
        return { 
          success: false, 
          output: "", 
          duration: 0, 
          error: `Failed to start bot. Is node-telegram-bot-api installed? Error: ${error.message}` 
        };
      }
    }

    return { success: false, output: "", duration: 0, error: `Unknown action: ${action}` };
  }
};
