export const models: {
  name: string;
  provider: "anthropic" | "openai" | "openrouter" | "ollama";
  nickName: string;
}[] = [
  // OpenRouter models (DEFAULT - Free tier available)
  {
    name: "qwen/qwen3-coder:free",
    provider: "openrouter",
    nickName: "qwen",
  },
  {
    name: "google/gemini-2.0-flash-exp:free",
    provider: "openrouter",
    nickName: "gemini",
  },
  {
    name: "meta-llama/llama-3.3-70b-instruct",
    provider: "openrouter",
    nickName: "llama33",
  },
  // Ollama models (local)
  {
    name: "gptoss-20b",
    provider: "ollama",
    nickName: "gptoss",
  },
  {
    name: "llama3.2",
    provider: "ollama",
    nickName: "llama32",
  },
  {
    name: "qwen2.5:7b",
    provider: "ollama",
    nickName: "qwen25",
  },
  // OpenAI models (optional - requires API key)
  {
    name: "gpt-4o-mini",
    provider: "openai",
    nickName: "gpt4mini",
  },
  {
    name: "gpt-4o",
    provider: "openai",
    nickName: "gpt4o",
  },
  // Anthropic Claude models (optional - requires API key)
  {
    name: "claude-3-5-sonnet-latest",
    provider: "anthropic",
    nickName: "sonnet35",
  },
  {
    name: "claude-3-haiku-20240307",
    provider: "anthropic",
    nickName: "haiku",
  },
];
