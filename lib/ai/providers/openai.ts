import { CommandProvider, ParsedCommand, ParserContext, SummaryInput, SummaryProvider, SummaryResult } from "./types";
import { buildParsePrompt, buildSummaryPrompt, coerceParsedCommand, coerceSummaryResult } from "./prompt";

const MODEL = "gpt-4o-mini";

async function chatJson(systemPrompt: string, userPrompt: string): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI request failed: ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI response missing content");
  return JSON.parse(content);
}

export const openaiCommandProvider: CommandProvider = {
  name: "openai",
  async parse(input: string, context: ParserContext): Promise<ParsedCommand> {
    const { system, user } = buildParsePrompt(input, context);
    const json = await chatJson(system, user);
    return coerceParsedCommand(json, input);
  },
};

export const openaiSummaryProvider: SummaryProvider = {
  name: "openai",
  async summarize(input: SummaryInput): Promise<SummaryResult> {
    const { system, user } = buildSummaryPrompt(input);
    const json = await chatJson(system, user);
    return coerceSummaryResult(json, "openai");
  },
};
