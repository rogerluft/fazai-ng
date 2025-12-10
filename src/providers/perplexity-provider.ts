import OpenAI from "openai";
import { withRetry } from "../utils/retry";
import { API_TIMEOUTS } from "../config/timeouts";
import { apiCache } from "../services/api-cache";

export async function* perplexityProvider(
  prompt: string,
  model: string,
  systemMessage: string
): AsyncGenerator<string, void, undefined> {
  const cachedResponse = apiCache.get("perplexity", model, prompt);
  if (cachedResponse) {
    yield cachedResponse;
    return;
  }

  const perplexity = new OpenAI({
    baseURL: "https://api.perplexity.ai",
    apiKey: process.env.PERPLEXITY_API_KEY,
    timeout: API_TIMEOUTS.perplexity,
    defaultHeaders: {
      "User-Agent": "FazAI-ng",
    },
  });

  const stream = await withRetry(
    () =>
      perplexity.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: prompt },
        ],
        stream: true,
      }),
    { provider: "perplexity" }
  );

  let fullResponse = "";
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    fullResponse += content;
    yield content;
  }

  if (fullResponse) {
    apiCache.set("perplexity", model, prompt, fullResponse);
    await apiCache.save();
  }
}
