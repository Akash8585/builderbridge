import { describe, expect, it } from "vitest";
import {
  AssistantNotConfiguredError,
  classifyOpenRouterError,
  getOpenRouterProviderOptions,
  getOpenRouterRequestOptions,
  openRouterErrorMessage,
  openRouterModelOrder,
} from "@/lib/openrouter";

describe("OpenRouter routing", () => {
  it("keeps the primary first and de-duplicates ordered fallbacks", () => {
    expect(
      openRouterModelOrder(
        "google/gemini-primary",
        " openrouter/free, google/gemini-primary, meta/llama-fallback, openrouter/free "
      )
    ).toEqual(["google/gemini-primary", "openrouter/free", "meta/llama-fallback"]);
  });

  it("passes fallback models and provider failover to OpenRouter", () => {
    expect(
      getOpenRouterProviderOptions(
        "google/gemini-primary",
        "meta/llama-fallback,openrouter/free"
      )
    ).toEqual({
      openrouter: {
        models: ["meta/llama-fallback", "openrouter/free"],
        provider: { allow_fallbacks: true },
      },
    });
  });

  it("uses provider failover without repeating openrouter/free", () => {
    expect(getOpenRouterProviderOptions("openrouter/free", "openrouter/free")).toEqual({
      openrouter: { provider: { allow_fallbacks: true } },
    });
  });

  it("applies the configured retry budget together with fallback routing", () => {
    expect(getOpenRouterRequestOptions("primary/model", "fallback/model", 3)).toEqual({
      maxRetries: 3,
      providerOptions: {
        openrouter: {
          models: ["fallback/model"],
          provider: { allow_fallbacks: true },
        },
      },
    });
  });
});

describe("OpenRouter errors", () => {
  it("finds retryable failures nested inside an exhausted retry error", () => {
    const rateLimit = Object.assign(new Error("Upstream rate limit exceeded"), { statusCode: 429 });
    const exhausted = Object.assign(new Error("Retries exhausted"), { errors: [rateLimit] });

    expect(classifyOpenRouterError(exhausted)).toBe("busy");
    expect(openRouterErrorMessage(exhausted)).toMatch(/retried automatically/i);
  });

  it("does not describe authentication and credit failures as temporary", () => {
    expect(classifyOpenRouterError(Object.assign(new Error("Unauthorized"), { statusCode: 401 }))).toBe(
      "authentication"
    );
    expect(classifyOpenRouterError(Object.assign(new Error("Payment required"), { statusCode: 402 }))).toBe(
      "credits"
    );
  });

  it("provides a useful message when the Agent is not configured", () => {
    expect(openRouterErrorMessage(new AssistantNotConfiguredError("missing key"))).toMatch(
      /isn't configured yet/i
    );
  });

  it("distinguishes invalid requests from unknown provider failures", () => {
    expect(classifyOpenRouterError(Object.assign(new Error("Context length exceeded"), { status: 400 }))).toBe(
      "invalid-request"
    );
    expect(classifyOpenRouterError(new Error("Socket disappeared"))).toBe("unknown");
  });
});
