import { SummaryInput, SummaryProvider, SummaryResult } from "./providers/types";
import { fallbackSummaryProvider } from "./providers/fallback-summary";

/**
 * Provider-agnostic client summary generator. Same fallback contract as
 * command-parser.ts: an unset/failed AI provider degrades to a deterministic
 * summary built from recent notes and open tasks, so summaries always work.
 */
async function resolveProvider(): Promise<SummaryProvider> {
  const providerName = process.env.AI_PROVIDER;

  if (providerName === "openai") {
    const { openaiSummaryProvider } = await import("./providers/openai");
    return openaiSummaryProvider;
  }

  if (providerName === "anthropic") {
    const { anthropicSummaryProvider } = await import("./providers/anthropic");
    return anthropicSummaryProvider;
  }

  return fallbackSummaryProvider;
}

export async function generateClientSummary(input: SummaryInput): Promise<SummaryResult> {
  const provider = await resolveProvider();

  if (provider.name === "fallback") {
    return provider.summarize(input);
  }

  try {
    return await provider.summarize(input);
  } catch (err) {
    console.error(`[client-summary] ${provider.name} provider failed, using fallback summary`, err);
    return fallbackSummaryProvider.summarize(input);
  }
}

export type { SummaryInput, SummaryResult } from "./providers/types";
