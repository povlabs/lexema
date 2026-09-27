// The filters on `GET /api/v1/lookup` (#151), each read once from the query
// string into a closed value. A value outside a filter's vocabulary is a
// refusal naming the parameter, never a filter that silently matches nothing.
//
// `pos` and `match` choose candidates. The rest shape each candidate that is
// kept: `fields` and `limit_definitions` choose what a result carries, and the
// grammar filters narrow its `forms`. No filter re-ranks.
//
// Grammar values are ADR 0015's Italian labels, as the answer itself writes
// them, or an English code for the same thing. A code can stand for more than
// one label where Italian names a tense apart by mood and English does not:
// `pluperfect` is both the indicativo's trapassato prossimo and the
// congiuntivo's trapassato.

/**
 * Every `pos` the Italian records of release it-0c432803 carry, counted over
 * `it-extract.jsonl.gz` on 2026-09-27. The importer admits any `pos`, so a
 * release that adds one adds it here.
 */
export const PARTS_OF_SPEECH = [
  "verb",
  "noun",
  "adj",
  "phrase",
  "name",
  "adv",
  "abbrev",
  "adv_phrase",
  "prefix",
  "suffix",
  "intj",
  "pron",
  "conj",
  "prep",
  "prep_phrase",
  "symbol",
  "character",
  "article",
  "num",
  "affix",
  "particle",
] as const;
export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number];

/**
 * The brief's spellings of the two codes the source abbreviates. A `Map`, so
 * a name every object inherits (`constructor`, `__proto__`) is no alias.
 */
const POS_ALIASES: ReadonlyMap<string, PartOfSpeech> = new Map([
  ["adjective", "adj"],
  ["adverb", "adv"],
]);

/** `exact`: headword matches only. `form`: inflected-form matches only. `any`: both. */
export const MATCHES = ["exact", "form", "any"] as const;
export type Match = (typeof MATCHES)[number];

/** The sections `fields` chooses among. The rest of a result is always returned. */
export const SECTIONS = [
  "definitions",
  "examples",
  "forms",
  "etymology",
  "synonyms",
  "antonyms",
  "derived",
  "pronunciation",
] as const;
export type Section = (typeof SECTIONS)[number];

/**
 * A grammar vocabulary: each Italian label, and the English codes that name
 * it. Both spell a set of labels, so one code may name two labels.
 */
class Vocabulary<Label extends string> {
  private readonly spellings = new Map<string, Set<Label>>();

  constructor(codes: Readonly<Record<Label, readonly string[]>>) {
    for (const [label, english] of Object.entries(codes) as [Label, readonly string[]][]) {
      for (const spelling of [label, ...english]) {
        const labels = this.spellings.get(spelling) ?? new Set<Label>();
        labels.add(label);
        this.spellings.set(spelling, labels);
      }
    }
  }

  /** The labels a value names, or undefined when it names none. */
  read(value: string): ReadonlySet<Label> | undefined {
    return this.spellings.get(value);
  }

  get accepted(): string[] {
    return [...this.spellings.keys()];
  }
}

const MOOD = new Vocabulary({
  indicativo: ["indicative"],
  congiuntivo: ["subjunctive"],
  condizionale: ["conditional"],
  imperativo: ["imperative"],
  infinito: ["infinitive"],
  gerundio: ["gerund"],
  participio: ["participle"],
});

const TENSE = new Vocabulary({
  presente: ["present"],
  imperfetto: ["imperfect"],
  "passato remoto": ["past-historic"],
  "futuro semplice": ["future"],
  "passato prossimo": ["present-perfect"],
  "trapassato prossimo": ["pluperfect"],
  "trapassato remoto": ["past-anterior"],
  "futuro anteriore": ["future-perfect"],
  passato: ["past"],
  trapassato: ["pluperfect"],
});

const PERSON = new Vocabulary({
  io: ["1sg"],
  tu: ["2sg"],
  "lui, lei": ["3sg"],
  noi: ["1pl"],
  voi: ["2pl"],
  loro: ["3pl"],
});

const GENDER = new Vocabulary({ maschile: ["masculine"], femminile: ["feminine"] });
const NUMBER = new Vocabulary({ singolare: ["singular"], plurale: ["plural"] });

type LabelOf<V> = V extends Vocabulary<infer Label> ? Label : never;

/** A verb's `forms` narrowed to the cells whose mood, tense and person are among these. */
export type VerbNarrowing = {
  mood?: ReadonlySet<LabelOf<typeof MOOD>>;
  tense?: ReadonlySet<LabelOf<typeof TENSE>>;
  person?: ReadonlySet<LabelOf<typeof PERSON>>;
};

/** A noun's or adjective's grids narrowed to the rows and columns among these. */
export type AgreementNarrowing = {
  gender?: ReadonlySet<LabelOf<typeof GENDER>>;
  number?: ReadonlySet<LabelOf<typeof NUMBER>>;
};

export interface LookupFilters extends GrammarNarrowing {
  /** Only candidates of this part of speech; every candidate when absent. */
  pos: PartOfSpeech | undefined;
  match: Match;
  /** The sections each result carries; every section when absent. */
  fields: ReadonlySet<Section> | undefined;
  /** At most this many definitions per result, a positive integer. */
  limitDefinitions: number | undefined;
}

/** No filter: the whole answer, as `/lookup` gives it with no parameter but `q`. */
export const UNFILTERED: LookupFilters = {
  pos: undefined,
  match: "any",
  fields: undefined,
  limitDefinitions: undefined,
  verb: {},
  agreement: {},
};

/** Why a request's filters were refused: the parameter, and a sentence for the client. */
export interface FilterRefusal {
  parameter: string;
  message: string;
}

export type FilterReading = { ok: true; filters: LookupFilters } | { ok: false; refusal: FilterRefusal };

const quoted = (values: readonly string[]) => values.map((value) => `"${value}"`).join(", ");

class Refused extends Error {
  constructor(readonly refusal: FilterRefusal) {
    super(refusal.message);
  }
}

/** A parameter's one value, or undefined when it is absent. Sent twice, or empty, it is refused. */
function single(params: URLSearchParams, parameter: string): string | undefined {
  const values = params.getAll(parameter);
  if (values.length === 0) return undefined;
  if (values.length > 1) throw new Refused({ parameter, message: `Send ${parameter} once; it was sent ${values.length} times.` });
  if (values[0] === "") throw new Refused({ parameter, message: `${parameter} is empty; leave it out to apply no filter.` });
  return values[0];
}

function oneOf<T extends string>(
  parameter: string,
  value: string,
  allowed: readonly T[],
  aliases: ReadonlyMap<string, T> = new Map(),
): T {
  const found = allowed.find((candidate) => candidate === value) ?? aliases.get(value);
  if (found !== undefined) return found;
  const accepted = [...allowed, ...aliases.keys()];
  throw new Refused({ parameter, message: `${parameter} must be one of ${quoted(accepted)}; got "${value}".` });
}

function grammar<Label extends string>(
  params: URLSearchParams,
  parameter: string,
  vocabulary: Vocabulary<Label>,
): ReadonlySet<Label> | undefined {
  const value = single(params, parameter);
  if (value === undefined) return undefined;
  const labels = vocabulary.read(value);
  if (labels !== undefined) return labels;
  throw new Refused({ parameter, message: `${parameter} must be one of ${quoted(vocabulary.accepted)}; got "${value}".` });
}

function fields(params: URLSearchParams): ReadonlySet<Section> | undefined {
  const value = single(params, "fields");
  return value === undefined ? undefined : new Set(value.split(",").map((name) => oneOf("fields", name, SECTIONS)));
}

function limitDefinitions(params: URLSearchParams): number | undefined {
  const value = single(params, "limit_definitions");
  if (value === undefined) return undefined;
  const limit = Number(value);
  if (/^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(limit)) return limit;
  throw new Refused({
    parameter: "limit_definitions",
    message: `limit_definitions must be a positive integer; got "${value}".`,
  });
}

function partOfSpeech(params: URLSearchParams): PartOfSpeech | undefined {
  const pos = single(params, "pos");
  return pos === undefined ? undefined : oneOf("pos", pos, PARTS_OF_SPEECH, POS_ALIASES);
}

/** The grammar filters: a verb's mood, tense and person, a noun's or adjective's gender and number. */
export interface GrammarNarrowing {
  verb: VerbNarrowing;
  agreement: AgreementNarrowing;
}

function grammarNarrowing(params: URLSearchParams): GrammarNarrowing {
  return {
    verb: {
      mood: grammar(params, "mood", MOOD),
      tense: grammar(params, "tense", TENSE),
      person: grammar(params, "person", PERSON),
    },
    agreement: {
      gender: grammar(params, "gender", GENDER),
      number: grammar(params, "number", NUMBER),
    },
  };
}

/** A parameter read into a closed value, or the refusal naming what was wrong with it. */
export type ParameterReading<T> = { ok: true; value: T } | { ok: false; refusal: FilterRefusal };

function reading<T>(read: () => T): ParameterReading<T> {
  try {
    return { ok: true, value: read() };
  } catch (failure) {
    if (failure instanceof Refused) return { ok: false, refusal: failure.refusal };
    throw failure;
  }
}

/** Every filter a `/lookup` query string sends, or the first one it gets wrong. */
export function readLookupFilters(params: URLSearchParams): FilterReading {
  const read = reading<LookupFilters>(() => {
    const match = single(params, "match");
    return {
      pos: partOfSpeech(params),
      match: match === undefined ? "any" : oneOf("match", match, MATCHES),
      fields: fields(params),
      limitDefinitions: limitDefinitions(params),
      ...grammarNarrowing(params),
    };
  });
  return read.ok ? { ok: true, filters: read.value } : read;
}

/** `pos` as `/lookup` reads it, for an endpoint that takes it alone (`/random`). */
export const readPartOfSpeech = (params: URLSearchParams): ParameterReading<PartOfSpeech | undefined> =>
  reading(() => partOfSpeech(params));

/** The grammar filters as `/lookup` reads them, for an endpoint that takes them alone (`/inflect`). */
export const readGrammarNarrowing = (params: URLSearchParams): ParameterReading<GrammarNarrowing> =>
  reading(() => grammarNarrowing(params));

/** Whether `pos` and `match` keep a candidate of this part of speech, reached this way. */
export function admits(filters: LookupFilters, candidate: { pos: string; via: "headword" | "form" | "form_of" }): boolean {
  if (filters.pos !== undefined && candidate.pos !== filters.pos) return false;
  if (filters.match === "exact") return candidate.via === "headword";
  if (filters.match === "form") return candidate.via !== "headword";
  return true;
}

/**
 * Whether a place in a table survives a narrowing: every dimension the
 * narrowing names is one the place has, with a value among the narrowing's.
 * A place without that dimension (the ausiliare has no mood) does not survive.
 */
export function fits(place: Partial<Record<string, string>>, narrowing: Partial<Record<string, ReadonlySet<string>>>): boolean {
  return Object.entries(narrowing).every(([dimension, labels]) => {
    if (labels === undefined) return true;
    const value = place[dimension];
    return value !== undefined && labels.has(value);
  });
}

/** Whether a narrowing names any dimension at all. */
export const narrows = (narrowing: Partial<Record<string, ReadonlySet<string>>>): boolean =>
  Object.values(narrowing).some((labels) => labels !== undefined);
