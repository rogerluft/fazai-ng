/**
 * FazAI Voice STT/TTS Skill
 * 
 * Provides Speech-to-Text via whisper.cpp
 * and Text-to-Speech via gTTS or Coqui TTS
 * 
 * @module skills/voice-stt
 */

import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../logger.js";
import { getConfigValue } from "../config.js";
import { SkillDefinition } from "./registry.js";
import * as path from "path";
import * as fs from "fs/promises";

const execAsync = promisify(exec);

export const voiceSttSkill: SkillDefinition = {
  id: "voice-stt",
  name: "Voice Processing (STT/TTS)",
  description: "Transcribes audio to text (Whisper) or synthesizes text to audio (TTS)",
  category: "system",
  permissionLevel: "medium",
  source: "runtime",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["stt", "tts"],
        description: "Action to perform: 'stt' (audio->text) or 'tts' (text->audio)",
      },
      fileLimit: {
        type: "string",
        description: "Path to input file (for STT) or output file (for TTS)",
      },
      text: {
        type: "string",
        description: "Text to synthesize (only used if action=tts)",
      },
    },
    required: ["action", "fileLimit"],
  },
  handler: async (input: Record<string, unknown>) => {
    const action = input.action as "stt" | "tts";
    const fileArg = input.fileLimit as string;
    const textArg = input.text as string || "";

    if (!fileArg) {
      return { success: false, output: "", duration: 0, error: "fileLimit (path) is required" };
    }

    try {
      if (action === "stt") {
        // Speech-to-Text using Whisper.cpp
        const whisperBin = getConfigValue("WHISPER_CPP_PATH") || "/opt/whisper.cpp/main";
        const whisperModel = getConfigValue("WHISPER_MODEL_PATH") || "/opt/whisper.cpp/models/ggml-base.bin";
        
        // Ensure file exists
        const fileExists = await fs.stat(fileArg).then(() => true).catch(() => false);
        if (!fileExists) {
          return { success: false, output: "", duration: 0, error: `Audio file not found: ${fileArg}` };
        }

        // whisper.cpp needs 16kHz WAV. We can use ffmpeg to convert on the fly if needed,
        // but for simplicity we assume the caller provided a valid format or we pass to whisper directly.
        // Whisper.cpp usually outputs to stdout with timestamps.
        
        logger.info(`[VoiceSTT] Transcribing: ${fileArg}`);
        
        // -m = model, -f = file, -nt = no timestamps
        const cmd = `"${whisperBin}" -m "${whisperModel}" -f "${fileArg}" -nt`;
        const { stdout, stderr } = await execAsync(cmd);
        
        if (stderr && stderr.toLowerCase().includes("error")) {
          logger.warn(`[VoiceSTT] Whisper stderr: ${stderr}`);
        }

        const transcription = stdout.trim();
        
        return {
          success: true,
          output: transcription || "No speech detected.",
          duration: 0,
        };
      } 
      else if (action === "tts") {
        // Text-to-Speech using gTTS (easy fallback) or coqui
        if (!textArg) {
          return { success: false, output: "", duration: 0, error: "Text is required for TTS" };
        }

        logger.info(`[VoiceSTT] Synthesizing text to: ${fileArg}`);

        // Escape double quotes
        const safeText = textArg.replace(/"/g, '\\"');
        const lang = getConfigValue("TTS_LANG") || "pt-br";
        
        // Command requires gtts-cli to be installed natively
        const cmd = `gtts-cli "${safeText}" -l ${lang} -o "${fileArg}"`;
        
        await execAsync(cmd);
        
        const fileExists = await fs.stat(fileArg).then(() => true).catch(() => false);
        if (fileExists) {
          return {
            success: true,
            output: `Successfully saved TTS audio to ${fileArg}`,
            duration: 0,
          };
        } else {
          return {
            success: false,
            output: "",
            duration: 0,
            error: "TTS command succeeded but output file was not created.",
          };
        }
      }

      return { success: false, output: "", duration: 0, error: `Invalid action: ${action}` };
      
    } catch (error: any) {
      logger.error(`[VoiceSTT] Error executing voice skill: ${error.message}`);
      return { success: false, output: "", duration: 0, error: error.message };
    }
  }
};
