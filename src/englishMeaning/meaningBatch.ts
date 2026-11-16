// One Message Batches run of English meanings (#933): which senses get a
// request, and what each result becomes. `planBatch` turns pages into
// requests and a manifest that names each request's sense; `readResults`
// turns the batch's results back into meanings to store, and counts the
// tokens they cost. Both are pure; src/englishMeaning/meaningBatchCli.ts
// reads the dictionary, sends the batch and writes the rows.

import type Anthropic from "@anthropic-ai/sdk";
import { Candidates, keyOf, keyText, needOf, readReply, type Candidate } from "./englishMeaning.js";
import type { MeaningPage } from "./meaningPages.js";
import { MEANING_MODEL, meaningRequest, PROMPT_VERSION } from "./meaningRequest.js";
import type { MeaningRow, StoredMeaning } from "./meaningStore.js";

/** One sense of the run, and what the run does with it. */
export type ManifestSense = {
  headword: string;
  recordId: number;
  pos: string;
  definition: string;
} & (
  | { definitionIndex: number; definitionSha256: string; need: "source"; english: string[] }
  | { definitionIndex: number; definitionSha256: string; need: "held"; english: string; origin: "picked" | "written" }
  | { definitionIndex: number; definitionSha256: string; need: "ask"; customId: string; candidates: Candidate[] }
  | { need: "form-of" }
);

/** What a run sent: enough to read its results without the dictionary. */
export interface Manifest {
  model: string;
  promptVersion: string;
  senses: ManifestSense[];
}

export interface BatchPlan {
  manifest: Manifest;
  requests: Anthropic.Messages.Batches.BatchCreateParams.Request[];
}

/**
 * The requests for `pages`: one per sense that has no source English and no
 * stored meaning under its key. A sense whose record has English for it sends
 * nothing, and neither does one already held.
 */
export function planBatch(pages: readonly MeaningPage[], held: ReadonlyMap<string, MeaningRow>): BatchPlan {
  const senses: ManifestSense[] = [];
  const requests: BatchPlan["requests"] = [];
  // Two senses with one key (one headword, one definition text) share one request.
  const askedFor = new Map<string, string>();
  for (const { page, senses: pageSenses, formOf } of pages) {
    for (const sense of pageSenses) {
      const base = { headword: sense.headword, recordId: sense.recordId, pos: sense.pos, definition: sense.definition.text, definitionIndex: sense.definitionIndex, definitionSha256: sense.definition.sha256 };
      const need = needOf(page, sense);
      if (need.kind === "source") {
        senses.push({ ...base, need: "source", english: [...new Set(need.meaning.translations.map((t) => t.word))] });
        continue;
      }
      const row = held.get(keyText(keyOf(sense)));
      if (row !== undefined) {
        senses.push({ ...base, need: "held", english: row.english, origin: row.origin });
        continue;
      }
      const key = keyText(keyOf(sense));
      let customId = askedFor.get(key);
      if (customId === undefined) {
        customId = `sense-${requests.length + 1}`;
        askedFor.set(key, customId);
        requests.push({ custom_id: customId, params: meaningRequest(sense, need.candidates) });
      }
      senses.push({ ...base, need: "ask", customId, candidates: [...need.candidates.list] });
    }
    for (const left of formOf) senses.push({ headword: page.headword, ...left, need: "form-of" });
  }
  return { manifest: { model: MEANING_MODEL, promptVersion: PROMPT_VERSION, senses }, requests };
}

/** Tokens a run used, summed over its succeeded requests, as the API counts them. */
export interface TokenUse {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/** What became of one request. */
export type SenseResult =
  | { customId: string; kind: "stored"; english: string; origin: "picked" | "written" }
  | { customId: string; kind: "refused"; reason: string; reply: string }
  | { customId: string; kind: "failed"; reason: string };

export interface ReadResults {
  stored: StoredMeaning[];
  results: SenseResult[];
  tokens: TokenUse;
}

/** The text of a succeeded message, or why there is none to read. */
function replyText(message: Anthropic.Messages.Message): string | { failed: string } {
  if (message.stop_reason !== "end_turn") return { failed: `stopped on ${message.stop_reason}` };
  const text = message.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  return text === "" ? { failed: "the reply has no text" } : text;
}

/**
 * The meanings `results` give the manifest's requests. A reply that picks no
 * candidate, or is not the reply's shape, is refused and stored as nothing.
 */
export function readResults(
  manifest: Manifest,
  batchId: string,
  results: readonly Anthropic.Messages.Batches.MessageBatchIndividualResponse[],
  generatedAt: string,
): ReadResults {
  const asked = new Map<string, Extract<ManifestSense, { need: "ask" }>>();
  for (const sense of manifest.senses) if (sense.need === "ask" && !asked.has(sense.customId)) asked.set(sense.customId, sense);
  const tokens: TokenUse = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const stored: StoredMeaning[] = [];
  const read: SenseResult[] = [];
  for (const { custom_id: customId, result } of results) {
    const sense = asked.get(customId);
    if (sense === undefined) throw new Error(`batch ${batchId} answers ${customId}, which the manifest never asked`);
    if (result.type !== "succeeded") {
      read.push({ customId, kind: "failed", reason: result.type === "errored" ? `errored: ${result.error.error.type}` : result.type });
      continue;
    }
    const { usage } = result.message;
    tokens.input += usage.input_tokens;
    tokens.output += usage.output_tokens;
    tokens.cacheRead += usage.cache_read_input_tokens ?? 0;
    tokens.cacheWrite += usage.cache_creation_input_tokens ?? 0;
    const text = replyText(result.message);
    if (typeof text !== "string") {
      read.push({ customId, kind: "failed", reason: text.failed });
      continue;
    }
    const reply = readReply(text, Candidates.of(sense.candidates));
    if (reply.kind === "refused") {
      read.push({ customId, kind: "refused", reason: reply.reason, reply: text });
      continue;
    }
    stored.push({
      key: { headword: sense.headword, definitionSha256: sense.definitionSha256 },
      meaning: reply.meaning,
      model: result.message.model,
      promptVersion: manifest.promptVersion,
      generatedAt,
      batchId,
    });
    read.push({ customId, kind: "stored", english: reply.meaning.english, origin: reply.meaning.origin });
  }
  return { stored, results: read, tokens };
}
