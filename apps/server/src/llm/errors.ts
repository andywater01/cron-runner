/**
 * Maps provider SDK errors to short sentences a person can act on.
 *
 * Both SDKs export the same error class names, so each is matched by instance against its own
 * namespace rather than by string. Anything unrecognised falls back to the raw message.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { LlmProvider } from "@cronrunner/shared";
import OpenAI from "openai";

const HOSTS: Record<LlmProvider, string> = {
  anthropic: "api.anthropic.com",
  openai: "api.openai.com",
};

const LABELS: Record<LlmProvider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
};

export function friendlyLlmError(provider: LlmProvider, err: unknown): string {
  const label = LABELS[provider];
  const host = HOSTS[provider];

  if (err instanceof Anthropic.AuthenticationError || err instanceof OpenAI.AuthenticationError) {
    return `That ${label} API key was rejected. Check it and try again.`;
  }
  if (err instanceof Anthropic.RateLimitError || err instanceof OpenAI.RateLimitError) {
    return `${label} is rate limiting this key. Wait a moment and try again.`;
  }
  if (err instanceof Anthropic.APIConnectionError || err instanceof OpenAI.APIConnectionError) {
    return `Could not reach ${host}. Check your internet connection.`;
  }
  if (err instanceof Anthropic.NotFoundError || err instanceof OpenAI.NotFoundError) {
    return `${label} does not recognise that model name. Check the model in Settings.`;
  }
  if (
    err instanceof Anthropic.PermissionDeniedError ||
    err instanceof OpenAI.PermissionDeniedError
  ) {
    return `That ${label} key is not allowed to use this model.`;
  }
  if (err instanceof Anthropic.BadRequestError || err instanceof OpenAI.BadRequestError) {
    return `${label} rejected the request: ${err.message}`;
  }
  if (err instanceof Anthropic.InternalServerError || err instanceof OpenAI.InternalServerError) {
    return `${label} is having trouble right now. Try again shortly.`;
  }
  return err instanceof Error ? err.message : `Unknown ${label} error`;
}
