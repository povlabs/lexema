// What `/developers` states about the JSON API (#153), as data, so the page
// and its test read one copy.
//
// Whatever the API already names is imported, never restated: the endpoints and
// their unit weights (src/api/units.ts), the filter vocabularies
// (web/worker/api/lookupFilters.ts), the batch and query bounds. Every example
// response is what the handler answers for its request over the development
// fixture, which holds lines of release it-0c432803; `id` numbers are the lines
// those records sit on in that release's archive. web/test/developers.test.tsx
// runs every example through `handleApi` and fails when an answer drifts.
//
// Text in backticks renders as code.

import { API_PREFIX, UNIT_WEIGHT, type Endpoint, type UnitWeight } from "@lexema/api/units.ts";
import { MAX_QUERY_LENGTH } from "@lexema/lookup/lookup.ts";
import { SUGGESTION_LIMIT } from "@lexema/lookup/suggest.ts";
import { MAX_BATCH_WORDS } from "../worker/api/endpoints.ts";
import { GRAMMAR_CODES, MATCHES, PARTS_OF_SPEECH, SECTIONS } from "../worker/api/lookupFilters.ts";
import type { ResultCoreJson, SectionsJson } from "../worker/api/lookupAnswer.ts";

export const API_ORIGIN = "https://lexema.fyi";
export const API_BASE = `${API_ORIGIN}${API_PREFIX.slice(0, -1)}`;

/** A key as the examples write it. */
export const EXAMPLE_KEY = "lx_…";

export interface Parameter {
  name: string;
  required: boolean;
  description: string;
}

/** One request and what the API answers it with. */
export interface Example {
  /** The path and query, from `/api/v1/`. */
  path: string;
  /** The JSON body a POST sends. */
  body?: unknown;
  status: 200 | 400 | 404;
  response: unknown;
}

export interface EndpointReference {
  method: "GET" | "POST";
  summary: string;
  parameters: readonly Parameter[];
  /** What each status this endpoint answers with means. */
  answers: readonly { status: string; description: string }[];
  example: Example;
}

const ATTRIBUTION = (word: string) => ({
  licence: "CC BY-SA 4.0",
  licence_url: "https://creativecommons.org/licenses/by-sa/4.0/",
  source: "Wikizionario",
  source_url: `https://it.wiktionary.org/wiki/${encodeURIComponent(word)}`,
});

const RELEASE = "it-0c432803";

const Q: Parameter = {
  name: "q",
  required: true,
  description: `The word, 1 to ${MAX_QUERY_LENGTH} characters.`,
};

const code = (values: readonly string[]) => values.map((value) => `\`${value}\``).join(", ");

const POS: Parameter = {
  name: "pos",
  required: false,
  description: `Only this part of speech: ${code(PARTS_OF_SPEECH)}. \`adjective\` and \`adverb\` are read as \`adj\` and \`adv\`.`,
};

const VERB_GRAMMAR: readonly Parameter[] = [
  { name: "mood", required: false, description: "Only a verb's forms of this mood." },
  { name: "tense", required: false, description: "Only a verb's forms of this tense." },
  { name: "person", required: false, description: "Only a verb's forms of this person." },
];

const AGREEMENT_GRAMMAR: readonly Parameter[] = [
  { name: "gender", required: false, description: "Only the grid's row of this gender." },
  { name: "number", required: false, description: "Only the grid's column of this number." },
];

/**
 * A `/lookup` result's fields, split as web/worker/api/lookupAnswer.ts splits
 * them: what every result carries, and the sections `fields` chooses among.
 */
export const LOOKUP_RESULT: {
  always: Readonly<Record<keyof ResultCoreJson, string>>;
  sections: Readonly<Record<keyof SectionsJson, string>>;
} = {
  always: {
    id: "The record: its release and its line in that release's archive.",
    word: "The record's headword.",
    pos: "The part of speech, as `pos` takes it.",
    pos_title: "The part of speech as Wikizionario titles it.",
    match:
      "How `q` reached the record: `surface`, the spelling matched; `via`, `headword`, `form` or `form_of`; `grammar`, each place `q` fills in the record's forms.",
    attribution: "The credit for the record's text; see Attribution.",
  },
  sections: {
    pronunciations: "`ipa` and `note` for each pronunciation.",
    definitions: "`definition`, its `labels`, its `examples`, and the `items` of a list it opens.",
    examples: "Examples of senses that are not definitions.",
    forms:
      "A verb's `conjugation`: those of `infinito`, `gerundio`, `participio presente`, `participio` and `ausiliare` it has, then `moods` by mood, tense and person. A noun's or adjective's `gender_number`: `grid`, and `superlativo` or `null`, by gender and number. `null` when the record has no forms. Each cell is a list of spellings.",
    etymology: "The etymology, or `null`.",
    synonyms: "Words.",
    antonyms: "Words.",
    derived: "Words.",
  },
};

/** Every endpoint, keyed as src/api/units.ts names it, so none goes undocumented. */
export const ENDPOINT_REFERENCE: Readonly<Record<Endpoint, EndpointReference>> = {
  lookup: {
    method: "GET",
    summary:
      "Every candidate for `q`, in full: the record the word heads, the lemma it is a form of, and any record that lists it among its forms.",
    parameters: [
      Q,
      POS,
      {
        name: "match",
        required: false,
        description: `${code(MATCHES)}; \`any\` when absent. \`exact\`: headword matches only. \`form\`: form matches only.`,
      },
      {
        name: "fields",
        required: false,
        description: `A comma list of ${code(SECTIONS)}. Only these sections are returned; \`pronunciation\` returns \`pronunciations\`. ${code(Object.keys(LOOKUP_RESULT.always))} are always returned.`,
      },
      { name: "limit_definitions", required: false, description: "At most this many definitions per result, a positive integer." },
      ...VERB_GRAMMAR,
      ...AGREEMENT_GRAMMAR,
    ],
    answers: [
      { status: "200", description: "The word is in the release. `results` holds every candidate the filters keep, in the lookup's order, and is empty when they keep none." },
      { status: "404", description: "The word is not in the release. `results` is empty and `suggestions` lists spellings of kind `accent`, `edit` or `prefix`." },
    ],
    example: {
      path: "lookup?q=andavano&fields=definitions,forms&limit_definitions=1&mood=indicativo&tense=imperfetto",
      status: 200,
      response: {
        query: "andavano",
        release_id: RELEASE,
        results: [
          {
            id: `${RELEASE}:2345`,
            word: "andare",
            pos: "verb",
            pos_title: "Verbo",
            match: {
              surface: "andavano",
              via: "form_of",
              grammar: [{ mood: "indicativo", tense: "imperfetto", person: "loro" }],
            },
            definitions: [
              {
                definition: "muoversi da un luogo verso un altro luogo",
                labels: [],
                examples: ["ogni mattina devo andare a scuola"],
                items: [],
              },
            ],
            forms: {
              type: "conjugation",
              moods: {
                indicativo: {
                  imperfetto: {
                    io: ["andavo"],
                    tu: ["andavi"],
                    "lui, lei": ["andava"],
                    noi: ["andavamo"],
                    voi: ["andavate"],
                    loro: ["andavano"],
                  },
                },
              },
            },
            attribution: ATTRIBUTION("andare"),
          },
        ],
      },
    },
  },
  lemmatize: {
    method: "GET",
    summary: "The lemma of each `/lookup` candidate, and where `q` sits in its forms.",
    parameters: [Q],
    answers: [{ status: "200", description: "`results` holds one lemma per candidate." }, { status: "404", description: "The word is not in the release; `results` is empty." }],
    example: {
      path: "lemmatize?q=andavano",
      status: 200,
      response: {
        query: "andavano",
        release_id: RELEASE,
        results: [
          {
            id: `${RELEASE}:2345`,
            lemma: "andare",
            pos: "verb",
            pos_title: "Verbo",
            match: {
              surface: "andavano",
              via: "form_of",
              grammar: [{ mood: "indicativo", tense: "imperfetto", person: "loro" }],
            },
            attribution: ATTRIBUTION("andare"),
          },
        ],
      },
    },
  },
  exists: {
    method: "GET",
    summary: "Whether `/lookup` finds `q`.",
    parameters: [Q],
    answers: [{ status: "200", description: "`exists` is `true` with the word's `attribution`, or `false` with `attribution` `null`." }],
    example: {
      path: "exists?q=sale",
      status: 200,
      response: { query: "sale", release_id: RELEASE, exists: true, attribution: ATTRIBUTION("sale") },
    },
  },
  inflect: {
    method: "GET",
    summary: "The forms of `lemma` at the places the grammar parameters name; every form when none is sent.",
    parameters: [
      { name: "lemma", required: true, description: `A headword, 1 to ${MAX_QUERY_LENGTH} characters.` },
      ...VERB_GRAMMAR,
      ...AGREEMENT_GRAMMAR,
    ],
    answers: [
      { status: "200", description: "One result per record headed by `lemma` with a form that fits, each form with its `grammar`." },
      { status: "404 unknown_lemma", description: "`lemma` heads no record of the release." },
    ],
    example: {
      path: "inflect?lemma=andare&mood=congiuntivo&tense=presente&person=noi",
      status: 200,
      response: {
        lemma: "andare",
        release_id: RELEASE,
        results: [
          {
            id: `${RELEASE}:2345`,
            word: "andare",
            pos: "verb",
            pos_title: "Verbo",
            inflections: [{ grammar: { mood: "congiuntivo", tense: "presente", person: "noi" }, forms: ["andiamo"] }],
            attribution: ATTRIBUTION("andare"),
          },
        ],
      },
    },
  },
  suggest: {
    method: "GET",
    summary: `Up to ${SUGGESTION_LIMIT} words that begin with \`q\`, as the search field suggests them.`,
    parameters: [{ name: "q", required: true, description: `The beginning of a word, 1 to ${MAX_QUERY_LENGTH} characters.` }],
    answers: [{ status: "200", description: "`results` holds the words, and is empty when none begins with `q`." }],
    example: {
      path: "suggest?q=sal",
      status: 200,
      response: {
        query: "sal",
        release_id: RELEASE,
        results: ["sala", "salare", "sale", "salire"].map((word) => ({ word, attribution: ATTRIBUTION(word) })),
      },
    },
  },
  nearby: {
    method: "GET",
    summary:
      "Spellings close to `q`, in the not-found page's order: the same letters with accents (`accent`), one edit away (`edit`), or words that begin with `q` (`prefix`).",
    parameters: [Q],
    answers: [{ status: "200", description: "`results` holds the spellings, and is empty when none is close." }],
    example: {
      path: "nearby?q=mangare",
      status: 200,
      response: {
        query: "mangare",
        release_id: RELEASE,
        results: [{ word: "mangiare", kind: "edit", attribution: ATTRIBUTION("mangiare") }],
      },
    },
  },
  random: {
    method: "GET",
    summary: "One random headword.",
    parameters: [POS],
    answers: [{ status: "200", description: "`results` holds one headword, or none when the release has none of `pos`." }],
    example: {
      path: "random?pos=noun",
      status: 200,
      response: {
        release_id: RELEASE,
        results: [{ id: `${RELEASE}:1`, word: "casa", pos: "noun", pos_title: "Sostantivo", attribution: ATTRIBUTION("casa") }],
      },
    },
  },
  "lookup/batch": {
    method: "POST",
    summary: `Up to ${MAX_BATCH_WORDS} words at once, each answered light: one entry per candidate with its lemma and part of speech, or one \`found: false\` entry for a word not in the release.`,
    parameters: [
      {
        name: "q",
        required: true,
        description: `In the JSON body, \`{"q": [...]}\`: 1 to ${MAX_BATCH_WORDS} words, each 1 to ${MAX_QUERY_LENGTH} characters.`,
      },
    ],
    answers: [{ status: "200", description: "`results` holds the entries, word by word in the order sent." }],
    example: {
      path: "lookup/batch",
      body: { q: ["sale", "mangare"] },
      status: 200,
      response: {
        release_id: RELEASE,
        results: [
          {
            query: "sale",
            found: true,
            id: `${RELEASE}:21651`,
            lemma: "sale",
            pos: "noun",
            pos_title: "Sostantivo",
            attribution: ATTRIBUTION("sale"),
          },
          {
            query: "sale",
            found: true,
            id: `${RELEASE}:41460`,
            lemma: "sala",
            pos: "noun",
            pos_title: "Sostantivo",
            attribution: ATTRIBUTION("sala"),
          },
          {
            query: "sale",
            found: true,
            id: `${RELEASE}:49483`,
            lemma: "salire",
            pos: "verb",
            pos_title: "Verbo",
            attribution: ATTRIBUTION("salire"),
          },
          { query: "mangare", found: false, lemma: null, pos: null, pos_title: null },
        ],
      },
    },
  },
};

/** The endpoints in the order the page lists them: the order of the unit map. */
export const ENDPOINTS_IN_ORDER = Object.keys(UNIT_WEIGHT) as Endpoint[];

/** A unit weight as the page writes it. */
export const unitsText = (weight: UnitWeight): string => (weight.per === "word" ? `${weight.units} per word` : String(weight.units));

/** The grammar parameters, each Italian label with the English codes also accepted for it. */
export const GRAMMAR_VALUES = (Object.entries(GRAMMAR_CODES) as [string, Readonly<Record<string, readonly string[]>>][]).map(
  ([parameter, codes]) => ({ parameter, values: Object.entries(codes).map(([label, english]) => ({ label, english })) }),
);

export interface ErrorReference {
  status: 400 | 401 | 404 | 405 | 429 | 503;
  code: string;
  when: string;
}

/** Every `error.code` the API answers with. */
export const ERRORS: readonly ErrorReference[] = [
  { status: 400, code: "invalid_query", when: "`q` or `lemma` is missing, empty, or too long." },
  {
    status: 400,
    code: "invalid_parameter",
    when: "A parameter's value is not one it takes, or the parameter is sent empty or more than once.",
  },
  { status: 400, code: "invalid_body", when: `The batch body is not \`{"q": [...]}\` with 1 to ${MAX_BATCH_WORDS} non-empty words.` },
  { status: 401, code: "missing_key", when: "No `X-API-Key` header." },
  { status: 401, code: "invalid_key", when: "The key is not one Lexema issued." },
  { status: 401, code: "revoked_key", when: "The key has been revoked." },
  { status: 404, code: "unknown_lemma", when: "`/inflect`: `lemma` heads no record." },
  { status: 404, code: "not_found", when: "No endpoint at this path." },
  { status: 405, code: "method_not_allowed", when: "The endpoint takes another method, named in the `Allow` header." },
  { status: 429, code: "rate_limited", when: "The key has used its requests for this minute." },
  { status: 503, code: "unavailable", when: "The request could not be answered. Try again later." },
];

/** The not-found answer of `/lookup`, which is a result, not an error. */
export const NOT_FOUND_EXAMPLE: Example = {
  path: "lookup?q=citta",
  status: 404,
  response: { query: "citta", release_id: RELEASE, results: [], suggestions: [{ word: "città", kind: "accent" }] },
};

/** An error, as every error is answered. */
export const ERROR_EXAMPLE: Example = {
  path: "lookup?q=sale&limit_definitions=0",
  status: 400,
  response: { error: { code: "invalid_parameter", message: 'limit_definitions must be a positive integer; got "0".' } },
};

/** The rate-limit headers, and what each says. */
export const HEADERS: readonly { name: string; description: string }[] = [
  { name: "RateLimit-Limit", description: "The key's requests per minute." },
  { name: "RateLimit-Remaining", description: "Requests left in this minute." },
  { name: "RateLimit-Reset", description: "Seconds until this minute ends." },
  { name: "Retry-After", description: "On a `429` only: seconds until this minute ends." },
];

/** The widest line the examples are printed to, in characters. */
const WIDTH = 76;

/**
 * The request an example sends, as a command. A query too long for one line
 * is sent as `-G` with one `--data-urlencode` per parameter, which is the same
 * request.
 */
export function curlOf(example: Example): string {
  const [path, query = ""] = example.path.split("?");
  const url = `${API_BASE}/${example.path}`;
  const lines = [`curl -H "X-API-Key: ${EXAMPLE_KEY}" \\`];
  if (example.body !== undefined) {
    lines.push(`  -H "content-type: application/json" \\`, `  -d '${JSON.stringify(example.body)}' \\`);
  }
  if (url.length + 4 <= WIDTH) {
    lines.push(`  "${url}"`);
  } else {
    lines[0] = `curl -G -H "X-API-Key: ${EXAMPLE_KEY}" \\`;
    for (const [name, value] of new URLSearchParams(query)) lines.push(`  --data-urlencode "${name}=${value}" \\`);
    lines.push(`  "${API_BASE}/${path}"`);
  }
  return lines.join("\n");
}

/**
 * JSON as the page prints it: a value that fits on its line stays on it, and
 * anything longer opens one member per line. It parses back to the same value.
 */
export function formatJson(value: unknown): string {
  return format(value, "", 0);
}

/** `value` printed at `indent`, its first line already `lead` characters in. */
function format(value: unknown, indent: string, lead: number): string {
  const inline = oneLine(value);
  if (value === null || typeof value !== "object" || indent.length + lead + inline.length <= WIDTH) return inline;
  const inner = `${indent}  `;
  const members = Array.isArray(value)
    ? value.map((item) => inner + format(item, inner, 0))
    : Object.entries(value).map(([key, item]) => {
        const head = `${JSON.stringify(key)}: `;
        return inner + head + format(item, inner, head.length);
      });
  const [open, close] = Array.isArray(value) ? ["[", "]"] : ["{", "}"];
  return `${open}\n${members.join(",\n")}\n${indent}${close}`;
}

function oneLine(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(oneLine).join(", ")}]`;
  const members = Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}: ${oneLine(item)}`);
  return members.length === 0 ? "{}" : `{ ${members.join(", ")} }`;
}
