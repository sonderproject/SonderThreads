import { CommandProvider, ParsedCommand, ParserContext, SummaryInput, SummaryProvider, SummaryResult } from "./types";
import { buildParsePrompt, buildSummaryPrompt, coerceParsedCommand, coerceSummaryResult } from "./prompt";

const MODEL = "claude-haiku-4-5-20251001";

async function completeJson(systemPrompt: string, userPrompt: string): Promise<unknown> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: `${systemPrompt}\n\nRespond with ONLY valid JSON, no prose, no markdown fences.`,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic request failed: ${res.status}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error("Anthropic response missing content");

  const jsonText = text.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
  return JSON.parse(jsonText);
}

export const anthropicCommandProvider: CommandProvider = {
  name: "anthropic",
  async parse(input: string, context: ParserContext): Promise<ParsedCommand> {
    const { system, user } = buildParsePrompt(input, context);
    const json = await completeJson(system, user);
    return coerceParsedCommand(json, input);
  },
};

export const anthropicSummaryProvider: SummaryProvider = {
  name: "anthropic",
  async summarize(input: SummaryInput): Promise<SummaryResult> {
    const { system, user } = buildSummaryPrompt(input);
    const json = await completeJson(system, user);
    return coerceSummaryResult(json, "anthropic");
  },
};
