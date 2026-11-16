// The one request a sense without source English sends (#933): the prompt,
// its version, the model, and the reply's JSON shape. The prompt is stable
// text in `system`, so every request of a batch shares it as a cacheable
// prefix; the sense itself goes in the user turn.

import type Anthropic from "@anthropic-ai/sdk";
import type { Candidates, MeaningSense } from "./englishMeaning.js";
import { MAX_ENGLISH } from "./englishMeaning.js";

/** The model the test batch runs on, as Huey ruled on #933. */
export const MEANING_MODEL = "claude-sonnet-5-5";

/**
 * The prompt's version, stored on every meaning it made. Change it with any
 * change to `SYSTEM`, `userTurn` or `REPLY_FORMAT`, so a meaning says which
 * wording made it.
 */
export const PROMPT_VERSION = "english-meaning/v1";

/** A meaning is a few words; the reply is one small JSON object. */
const MAX_TOKENS = 1024;

const SYSTEM = `You give the English meaning of one sense of an Italian dictionary word, for a learner who taps the word while reading Italian.

You get the headword, its part of speech, the Italian definition of the one sense to explain, the word's other definitions (so you can tell this sense apart from them), and a numbered list of English candidates. The candidates are translations an Italian Wiktionary page lists for the word without saying which sense they belong to; they may fit this sense, another sense, or none.

Decide in this order:
1. If a candidate is a good English equivalent of this sense, pick it. Copy its text exactly as listed, character for character, and set "origin" to "picked". Prefer the candidate a learner would most expect for this sense. Never pick a candidate that fits only another sense.
2. If no candidate fits this sense, or there are none, write your own English equivalent and set "origin" to "written".

The English is a short dictionary gloss: the English word or a short phrase a bilingual dictionary would give, at most ${MAX_ENGLISH} characters, on one line. For a verb, start with "to" ("to go"). For a noun, give no article unless it is part of the meaning. Do not explain, do not add notes, quotes or parentheses unless a bilingual dictionary would. Do not translate the definition word for word; give the equivalent of the word in this sense.

Reply with only the JSON object.`;

/** The reply's shape, as structured output: the model can return nothing else. */
const REPLY_FORMAT = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: {
      origin: { type: "string", enum: ["picked", "written"] },
      english: { type: "string" },
    },
    required: ["origin", "english"],
    additionalProperties: false,
  },
} as const;

/** The user turn for one sense. */
export function userTurn(sense: MeaningSense, candidates: Candidates): string {
  const others = sense.otherDefinitions.length === 0 ? "(none)" : sense.otherDefinitions.map((text) => `- ${text}`).join("\n");
  const listed =
    candidates.list.length === 0
      ? "(none)"
      : candidates.list
          .map((candidate, at) => `${at + 1}. ${candidate.word}${candidate.labels.length === 0 ? "" : ` (Wiktionary label: ${candidate.labels.join("; ")})`}`)
          .join("\n");
  return [
    `Headword: ${sense.headword}`,
    `Part of speech: ${sense.pos}`,
    `Definition of this sense: ${sense.definition.text}`,
    `Other definitions of the word:\n${others}`,
    `English candidates:\n${listed}`,
  ].join("\n\n");
}

/** The Messages API request for one sense, as a batch request carries it. */
export function meaningRequest(sense: MeaningSense, candidates: Candidates): Anthropic.Messages.MessageCreateParamsNonStreaming {
  return {
    model: MEANING_MODEL,
    max_tokens: MAX_TOKENS,
    // A gloss needs no long reasoning; low effort keeps a full run's output small.
    output_config: { effort: "low", format: REPLY_FORMAT },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userTurn(sense, candidates) }],
  };
}
