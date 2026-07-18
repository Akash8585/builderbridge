import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { env } from "@/lib/env";

export class AssistantNotConfiguredError extends Error {}

let provider: ReturnType<typeof createOpenAICompatible> | null = null;

export function openRouterModelOrder(primaryModel: string, fallbackModels: string) {
  return [primaryModel, ...fallbackModels.split(",")]
    .map((model) => model.trim())
    .filter((model, index, models) => Boolean(model) && models.indexOf(model) === index);
}

export function getOpenRouterModelOrder(
  primaryModel = env.OPENROUTER_MODEL,
  fallbackModels = env.OPENROUTER_FALLBACK_MODELS
) {
  return openRouterModelOrder(primaryModel, fallbackModels);
}

export function getOpenRouterProviderOptions(
  primaryModel = env.OPENROUTER_MODEL,
  configuredFallbackModels = env.OPENROUTER_FALLBACK_MODELS
) {
  const [, ...fallbackModels] = getOpenRouterModelOrder(primaryModel, configuredFallbackModels);
  return {
    openrouter: {
      ...(fallbackModels.length ? { models: fallbackModels } : {}),
      provider: { allow_fallbacks: true },
    },
  };
}

export function getOpenRouterRequestOptions(
  primaryModel = env.OPENROUTER_MODEL,
  fallbackModels = env.OPENROUTER_FALLBACK_MODELS,
  maxRetries = env.OPENROUTER_MAX_RETRIES
) {
  return {
    maxRetries,
    providerOptions: getOpenRouterProviderOptions(primaryModel, fallbackModels),
  };
}

function errorDetails(error: unknown, seen = new Set<unknown>()): string[] {
  if (!error || seen.has(error)) return [];
  seen.add(error);

  if (typeof error === "string") return [error];
  if (!(error instanceof Error)) return [];

  const details = [error.message];
  const extended = error as Error & { cause?: unknown; errors?: unknown[]; statusCode?: number; status?: number };
  if (extended.statusCode) details.push(String(extended.statusCode));
  if (extended.status) details.push(String(extended.status));
  if (extended.cause) details.push(...errorDetails(extended.cause, seen));
  if (Array.isArray(extended.errors)) {
    for (const nestedError of extended.errors) details.push(...errorDetails(nestedError, seen));
  }
  return details;
}

export type OpenRouterErrorKind =
  | "not-configured"
  | "authentication"
  | "credits"
  | "busy"
  | "aborted"
  | "invalid-request"
  | "unknown";

export function classifyOpenRouterError(error: unknown): OpenRouterErrorKind {
  if (error instanceof AssistantNotConfiguredError) return "not-configured";
  if (error instanceof Error && error.name === "AbortError") return "aborted";

  const detail = errorDetails(error).join(" ").toLowerCase();
  if (/\b(401|403)\b|api[ -]?key|unauthori[sz]ed|authentication/.test(detail)) {
    return "authentication";
  }
  if (/\b402\b|credit|payment required|insufficient balance/.test(detail)) return "credits";
  if (/\b(408|409|425|429|500|502|503|504)\b|rate.?limit|timeout|timed out|overload|capacity|temporar/.test(detail)) {
    return "busy";
  }
  if (/\b400\b|invalid (request|prompt)|context length|too many tokens/.test(detail)) {
    return "invalid-request";
  }
  return "unknown";
}

export function openRouterErrorMessage(error: unknown) {
  switch (classifyOpenRouterError(error)) {
    case "not-configured":
      return "Agent isn't configured yet. Add an OpenRouter API key to continue.";
    case "authentication":
      return "Agent configuration needs attention. Please contact your workspace administrator.";
    case "credits":
      return "The OpenRouter account has no available credits. Please contact your workspace administrator.";
    case "busy":
      return "OpenRouter's models are busy right now. The Agent retried automatically; please try again in a moment.";
    case "aborted":
      return "The response was stopped before it finished.";
    case "invalid-request":
      return "The model could not process this request. Try shortening the conversation or starting a new chat.";
    default:
      return "OpenRouter could not complete this response after retrying. Please try again.";
  }
}

export function getOpenRouterModel() {
  if (!env.OPENROUTER_API_KEY) {
    throw new AssistantNotConfiguredError(
      "Agent isn't configured yet - add OPENROUTER_API_KEY to the environment."
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
