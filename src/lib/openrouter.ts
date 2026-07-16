import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { env } from "@/lib/env";

export class AssistantNotConfiguredError extends Error {}

let provider: ReturnType<typeof createOpenAICompatible> | null = null;

export function getOpenRouterModel() {
  if (!env.OPENROUTER_API_KEY) {
    throw new AssistantNotConfiguredError(
      "The AI Assistant isn't configured yet - add OPENROUTER_API_KEY to the environment."
    );
  }

  if (!provider) {
    provider = createOpenAICompatible({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: env.OPENROUTER_API_KEY,
      headers: {
        "HTTP-Referer": env.BETTER_AUTH_URL,
        "X-Title": "BuilderBridge",
      },
    });
  }

  return provider.chatModel(env.OPENROUTER_MODEL);
}
