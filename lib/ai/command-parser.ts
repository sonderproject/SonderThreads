import { CommandProvider, ParsedCommand, ParserContext } from "./providers/types";
import { fallbackProvider } from "./providers/fallback";

/**
 * Provider-agnostic entry point for turning free text into a structured
 * command. The active provider is chosen by AI_PROVIDER ("openai" |
 * "anthropic" | "fallback"/unset). Provider failures (missing key, network
 * error, bad JSON) never break the app — they silently fall back to the
 * deterministic parser so the product works with zero AI configuration.
 */
async function resolveProvider(): Promise<CommandProvider> {
  const providerName = process.env.AI_PROVIDER;

  if (providerName === "openai") {
    const { openaiCommandProvider } = await import("./providers/openai");
    return openaiCommandProvider;
  }

  if (providerName === "anthropic") {
    const { anthropicCommandProvider } = await import("./providers/anthropic");
    return anthropicCommandProvider;
  }

  return fallbackProvider;
}

export async function parseCommand(
  input: string,
  context: ParserContext,
): Promise<ParsedCommand> {
  const provider = await resolveProvider();

  if (provider.name === "fallback") {
    return provider.parse(input, context);
  }

  try {
    return await provider.parse(input, context);
  } catch (err) {
    console.error(`[command-parser] ${provider.name} provider failed, using fallback parser`, err);
    return fallbackProvider.parse(input, context);
  }
}

export type { CommandIntent, ParsedCommand, ParserContext, KnownClient, KnownList } from "./providers/types";
