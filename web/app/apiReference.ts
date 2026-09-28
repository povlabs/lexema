// What the developer site states about the JSON API (#153, #166), as data, so
// its pages and their tests read one copy.
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
import { ORIGIN } from "../worker/hosts.ts";

export const API_ORIGIN = ORIGIN.api;
export const API_BASE = `${API_ORIGIN}${API_PREFIX.slice(0, -1)}`;

/** A key as the examples write it. */
export const EXAMPLE_KEY = "lx_…";

/** What a parameter's value is, as the docs name it. */
export type ParameterType = "string" | "integer" | "string[]";

export interface Parameter {
  name: string;
  type: ParameterType;
  required: boolean;
  description: string;
}

/** One request and what the API answers it with. */
export interface Example {
  /** The path and query, from `/v1/`. */
  path: string;
  /** The JSON body a POST sends. */
  body?: unknown;
  status: 200 | 400 | 404;
  /** What sets the example apart from another of its status, as its tab names it. */
  label?: string;
  response: unknown;
}

export interface EndpointReference {
  method: "GET" | "POST";
  /** The endpoint's heading in the docs: what a call does, as a verb phrase. */
  title: string;
  /** The endpoint in a few words, on the landing page's list. */
  tagline: string;
  summary: string;
  parameters: readonly Parameter[];
  /** What each status this endpoint answers with means. */
  answers: readonly { status: string; description: string }[];
  /** The examples the docs show, the first the one they open on. */
  examples: readonly [Example, ...Example[]];
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
  type: "string",
  required: true,
  description: `The word, 1 to ${MAX_QUERY_LENGTH} characters.`,
};

/** The first of a vocabulary's values, then `...`: as board 31 names a list too long for its line. */
const opening = (values: readonly string[], count: number) => `${values.slice(0, count).join(", ")}, ...`;

const POS: Parameter = {
  name: "pos",
  type: "string",
  required: false,
  description: `Only this part of speech: ${opening(PARTS_OF_SPEECH, 3)}`,
};

/** The sections `fields`' row names before `...`, as board 31 does. */
const FIELDS_NAMED: readonly (typeof SECTIONS)[number][] = ["definitions", "forms", "etymology", "synonyms"];

const VERB_GRAMMAR: readonly Parameter[] = [
  { name: "mood", type: "string", required: false, description: "Only a verb's forms of this mood." },
  { name: "tense", type: "string", required: false, description: "Only a verb's forms of this tense." },
  { name: "person", type: "string", required: false, description: "Only a verb's forms of this person." },
];

const AGREEMENT_GRAMMAR: readonly Parameter[] = [
  { name: "gender", type: "string", required: false, description: "Only the grid's row of this gender." },
  { name: "number", type: "string", required: false, description: "Only the grid's column of this number." },
];

/** `/lookup` unfiltered: every candidate for `andare`, with every section. */
export const LOOKUP_EXAMPLE: Example = {
  path: "lookup?q=andare",
  status: 200,
  response: {
    query: "andare",
    release_id: RELEASE,
    results: [
      {
        id: `${RELEASE}:2344`,
        word: "andare",
        pos: "noun",
        pos_title: "Sostantivo",
        match: {
          surface: "andare",
          via: "headword",
          grammar: [{ gender: "maschile", number: "singolare" }],
        },
        pronunciations: [{ ipa: "/anˈda.re/", note: null }],
        definitions: [
          {
            definition: "incedere, modo di incedere",
            labels: [],
            examples: ["il suo andare con alterigia"],
            items: [],
          },
          {
            definition: "passaggio del tempo",
            labels: [],
            examples: [
              "con l'andare degli anni, la pressione sale, soprattutto la sistolica la \"massima\"",
            ],
            items: [],
          },
          {
            definition: "espressione che indica il continuo realizzarsi del tempo, in particolare nella consapevolezza precedente oppure successiva ad un'azione o a qualcosa che deve succedere oppure appena accaduto",
            labels: ["figuratively"],
            examples: ["una sigaretta... e andare"],
            items: [],
          },
        ],
        examples: [],
        forms: {
          type: "gender_number",
          grid: { maschile: { singolare: ["andare"], plurale: [] } },
          superlativo: null,
        },
        etymology: "Devoto/Oli: dal latino ambitare, forma intensiva di ambire, andare in giro\nTreccani: etimo incerto; nella coniugazione, il tema and- si alterna in alcune forme con il tema vad- del latino vadere\ndal latino \"vadere\" ossia \"andare\" derivano le forme suppletive della coniugazione del verbo.\nIncerto l'etimo delle altre forme:\nc'è chi propone \"aditare\" (frequentativo) o un volgare \"*adare\" come varianti di \"adīre\" ossia \"andare verso\", proponendo come similitudine il modo in cui \"aditu(m)\" (anche questo derivato da \"adīre\") ha dato origine a \"andito\";\naltri propongono il latino \"ambitāre\" (frequentativo) o un volgare \"*ambare\" derivati di \"ambīre\" ossia \"andare intorno\";\naltri suggeriscono il latino \"* ad- nare\" ossia \"nuotare verso\", proponendo come similitudine \"arrivare\" derivato da \"* ad- ripare\" ossia \"giungere a riva\"",
        synonyms: [
          "andata", "andatura", "camminata", "portamento", "viaggio", "avanzare", "avviarsi", "camminare",
          "dirigersi", "incamminarsi", "procedere", "recarsi", "allontanarsi", "andarsene", "emigrare",
          "espatriare", "partire", "uscire", "consumarsi", "fluire", "fuggire", "passare", "scorrere",
          "trascorrere", "volare", "continuare", "funzionare", "progredire", "proseguire", "svolgere",
          "condursi", "inoltrarsi", "marciare", "muoversi", "penetrare", "peregrinare", "portarsi",
          "spostarsi", "trasferirsi", "traslocare", "aggirarsi", "circolare", "errare", "gironzolare",
          "passeggiare", "vagabondare", "vagare", "condurre", "confluire", "portare", "sboccare",
          "sfociare", "avere successo", "essere di moda", "essere venduto", "avere corso", "valere",
          "essere necessario", "occorrere", "essere gradito", "gustare", "piacere", "essere destinato",
          "essere collocato",
        ],
        antonyms: [
          "fermarsi", "restare fermo", "restare immobile", "sostare", "trattenersi", "entrare",
          "rientrare", "ritornare", "tornare", "arrestarsi", "bloccarsi", "essere guasto", "venire",
          "arrivare", "stare", "rimanere", "restare", "ire", "gire", "essere fuori corso", "dispiacere",
          "disgustare",
        ],
        derived: ["andato", "riandare", "andarsene"],
        attribution: ATTRIBUTION("andare"),
      },
      {
        id: `${RELEASE}:2345`,
        word: "andare",
        pos: "verb",
        pos_title: "Verbo",
        match: { surface: "andare", via: "headword", grammar: [] },
        pronunciations: [{ ipa: "/anˈda.re/", note: null }],
        definitions: [
          {
            definition: "muoversi da un luogo verso un altro luogo",
            labels: [],
            examples: ["ogni mattina devo andare a scuola"],
            items: [],
          },
          { definition: "partire", labels: [], examples: ["\"Coraggio, vai!\""], items: [] },
          {
            definition: "essere destinato a esser messo in una data posizione",
            labels: [],
            examples: ["quell'elettrodomestico va in cucina"],
            items: [],
          },
          {
            definition: "dover essere (con un participio passato), dover subire una certa azione (usato prevalentemente alla terza persona, singolare o plurale)",
            labels: [],
            examples: ["quel documento va portato dall'avvocato", "quei furfanti andrebbero acciuffati"],
            items: [],
          },
          {
            definition: "necessità fisiche naturali, in particolare con riferimento all'evacuazione",
            labels: ["rare"],
            examples: [
              "Molto mestamente ma con rispetto, disse al medico: \"Vado regolarmente, non è un problema\"",
            ],
            items: [],
          },
        ],
        examples: [],
        forms: {
          type: "conjugation",
          gerundio: ["andando"],
          "participio presente": ["andante"],
          participio: ["andato"],
          ausiliare: ["essere"],
          moods: {
            indicativo: {
              presente: {
                io: ["vado", "vo"],
                tu: ["vai"],
                "lui, lei": ["va"],
                noi: ["andiamo"],
                voi: ["andate"],
                loro: ["vanno"],
              },
              imperfetto: {
                io: ["andavo"],
                tu: ["andavi"],
                "lui, lei": ["andava"],
                noi: ["andavamo"],
                voi: ["andavate"],
                loro: ["andavano"],
              },
              "passato remoto": {
                io: ["andai"],
                tu: ["andasti"],
                "lui, lei": ["annò"],
                noi: ["andammo"],
                voi: ["andaste"],
                loro: ["andarono"],
              },
              "futuro semplice": {
                io: ["anderò"],
                tu: ["andrai"],
                "lui, lei": ["andrà"],
                noi: ["andremo"],
                voi: ["andrete"],
                loro: ["andranno"],
              },
              "passato prossimo": {
                io: ["sono andato"],
                tu: ["sei andato"],
                "lui, lei": ["è andato"],
                noi: ["siamo andati"],
                voi: ["siete andati"],
                loro: ["sono andati"],
              },
              "trapassato prossimo": {
                io: ["ero andato"],
                tu: ["eri andato"],
                "lui, lei": ["era andato"],
                noi: ["eravamo andati"],
                voi: ["eravate andati"],
                loro: ["erano andati"],
              },
              "trapassato remoto": {
                io: ["fui andato"],
                tu: ["fosti andato"],
                "lui, lei": ["fu andato"],
                noi: ["fummo andati"],
                voi: ["foste andati"],
                loro: ["furono andati"],
              },
              "futuro anteriore": {
                io: ["sarò andato"],
                tu: ["sarai andato"],
                "lui, lei": ["sarà andato"],
                noi: ["saremo andati"],
                voi: ["sarete andati"],
                loro: ["saranno andati"],
              },
            },
            congiuntivo: {
              presente: {
                io: ["vada"],
                tu: ["vada"],
                "lui, lei": ["vada"],
                noi: ["andiamo"],
                voi: ["andiate"],
                loro: ["vadano"],
              },
              imperfetto: {
                io: ["andassi"],
                tu: ["andassi"],
                "lui, lei": ["andasse"],
                noi: ["andassimo"],
                voi: ["andaste"],
                loro: ["andassero"],
              },
              passato: {
                io: ["sia andato"],
                tu: ["sia andato"],
                "lui, lei": ["sia andato"],
                noi: ["siamo andati"],
                voi: ["siate andati"],
                loro: ["siano andati"],
              },
              trapassato: {
                io: ["fossi andato"],
                tu: ["fossi andato"],
                "lui, lei": ["fosse andato"],
                noi: ["fossimo andati"],
                voi: ["foste andati"],
                loro: ["fossero andati"],
              },
            },
            condizionale: {
              presente: {
                io: ["andrei"],
                tu: ["andresti"],
                "lui, lei": ["andrebbe"],
                noi: ["andremmo"],
                voi: ["andreste"],
                loro: ["andrebbero"],
              },
              passato: {
                io: ["sarei andato"],
                tu: ["saresti andato"],
                "lui, lei": ["sarebbe andato"],
                noi: ["saremmo andati"],
                voi: ["sareste andati"],
                loro: ["sarebbero andati"],
              },
            },
            imperativo: {
              presente: {
                tu: ["va'", "va", "vai", "non andare"],
                "lui, lei": ["vada"],
                noi: ["andiamo"],
                voi: ["andate"],
                loro: ["vadano"],
              },
            },
          },
        },
        etymology: "Devoto/Oli: dal latino ambitare, forma intensiva di ambire, andare in giro\nTreccani: etimo incerto; nella coniugazione, il tema and- si alterna in alcune forme con il tema vad- del latino vadere\ndal latino \"vadere\" ossia \"andare\" derivano le forme suppletive della coniugazione del verbo.\nIncerto l'etimo delle altre forme:\nc'è chi propone \"aditare\" (frequentativo) o un volgare \"*adare\" come varianti di \"adīre\" ossia \"andare verso\", proponendo come similitudine il modo in cui \"aditu(m)\" (anche questo derivato da \"adīre\") ha dato origine a \"andito\";\naltri propongono il latino \"ambitāre\" (frequentativo) o un volgare \"*ambare\" derivati di \"ambīre\" ossia \"andare intorno\";\naltri suggeriscono il latino \"* ad- nare\" ossia \"nuotare verso\", proponendo come similitudine \"arrivare\" derivato da \"* ad- ripare\" ossia \"giungere a riva\"",
        synonyms: [
          "andata", "andatura", "camminata", "portamento", "viaggio", "avanzare", "avviarsi", "camminare",
          "dirigersi", "incamminarsi", "procedere", "recarsi", "allontanarsi", "andarsene", "emigrare",
          "espatriare", "partire", "uscire", "consumarsi", "fluire", "fuggire", "passare", "scorrere",
          "trascorrere", "volare", "continuare", "funzionare", "progredire", "proseguire", "svolgere",
          "condursi", "inoltrarsi", "marciare", "muoversi", "penetrare", "peregrinare", "portarsi",
          "spostarsi", "trasferirsi", "traslocare", "aggirarsi", "circolare", "errare", "gironzolare",
          "passeggiare", "vagabondare", "vagare", "condurre", "confluire", "portare", "sboccare",
          "sfociare", "avere successo", "essere di moda", "essere venduto", "avere corso", "valere",
          "essere necessario", "occorrere", "essere gradito", "gustare", "piacere", "essere destinato",
          "essere collocato",
        ],
        antonyms: [
          "fermarsi", "restare fermo", "restare immobile", "sostare", "trattenersi", "entrare",
          "rientrare", "ritornare", "tornare", "arrestarsi", "bloccarsi", "essere guasto", "venire",
          "arrivare", "stare", "rimanere", "restare", "ire", "gire", "essere fuori corso", "dispiacere",
          "disgustare",
        ],
        derived: ["andato", "riandare", "andarsene"],
        attribution: ATTRIBUTION("andare"),
      },
    ],
  },
};

/** `/lookup` narrowed by `fields`, `limit_definitions`, `mood` and `tense`. */
export const LOOKUP_FILTERED_EXAMPLE: Example = {
  path: "lookup?q=andavano&fields=definitions,forms&limit_definitions=1&mood=indicativo&tense=imperfetto",
  status: 200,
  label: "filtered",
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
};

/** The not-found answer of `/lookup`, which is a result, not an error. */
export const NOT_FOUND_EXAMPLE: Example = {
  path: "lookup?q=citta",
  status: 404,
  response: { query: "citta", release_id: RELEASE, results: [], suggestions: [{ word: "città", kind: "accent" }] },
};

/** Every endpoint, keyed as src/api/units.ts names it, so none goes undocumented. */
export const ENDPOINT_REFERENCE: Readonly<Record<Endpoint, EndpointReference>> = {
  lookup: {
    method: "GET",
    title: "Look up a word",
    tagline: "Everything about a word",
    summary:
      "Every candidate for q, in full: the record the word heads, the lemma it is a form of, and any record that lists it among its forms.",
    parameters: [
      Q,
      POS,
      {
        name: "match",
        type: "string",
        required: false,
        description: `${MATCHES.slice(0, -1).join(", ")} or ${MATCHES[MATCHES.length - 1]}; any when absent.`,
      },
      {
        name: "fields",
        type: "string",
        required: false,
        description: `A comma list of sections to return: ${opening(FIELDS_NAMED, FIELDS_NAMED.length)}`,
      },
      { name: "limit_definitions", type: "integer", required: false, description: "At most this many definitions per result." },
      ...VERB_GRAMMAR,
      ...AGREEMENT_GRAMMAR,
    ],
    answers: [
      { status: "200", description: "The word is in the release. results holds every candidate the filters keep." },
      { status: "404", description: "The word is not in the release. results is empty and suggestions lists close spellings." },
    ],
    examples: [LOOKUP_EXAMPLE, LOOKUP_FILTERED_EXAMPLE, NOT_FOUND_EXAMPLE],
  },
  lemmatize: {
    method: "GET",
    title: "Lemmatize a form",
    tagline: "A form's lemma and grammar",
    summary: "The lemma of each `/lookup` candidate, and where `q` sits in its forms.",
    parameters: [Q],
    answers: [{ status: "200", description: "`results` holds one lemma per candidate." }, { status: "404", description: "The word is not in the release; `results` is empty." }],
    examples: [{
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
    }],
  },
  exists: {
    method: "GET",
    title: "Check a word",
    tagline: "Whether a word is in the dictionary",
    summary: "Whether `/lookup` finds `q`.",
    parameters: [Q],
    answers: [{ status: "200", description: "`exists` is `true` with the word's `attribution`, or `false` with `attribution` `null`." }],
    examples: [{
      path: "exists?q=sale",
      status: 200,
      response: { query: "sale", release_id: RELEASE, exists: true, attribution: ATTRIBUTION("sale") },
    }],
  },
  inflect: {
    method: "GET",
    title: "Inflect a lemma",
    tagline: "A lemma's form for a mood, tense and person",
    summary: "The forms of `lemma` at the places the grammar parameters name; every form when none is sent.",
    parameters: [
      { name: "lemma", type: "string", required: true, description: `A headword, 1 to ${MAX_QUERY_LENGTH} characters.` },
      ...VERB_GRAMMAR,
      ...AGREEMENT_GRAMMAR,
    ],
    answers: [
      { status: "200", description: "One result per record headed by `lemma` with a form that fits, each form with its `grammar`." },
      { status: "404 unknown_lemma", description: "`lemma` heads no record of the release." },
    ],
    examples: [{
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
    }],
  },
  suggest: {
    method: "GET",
    title: "Suggest words",
    tagline: "Words that begin with a prefix",
    summary: `Up to ${SUGGESTION_LIMIT} words that begin with \`q\`, as the search field suggests them.`,
    parameters: [{ name: "q", type: "string", required: true, description: `The beginning of a word, 1 to ${MAX_QUERY_LENGTH} characters.` }],
    answers: [{ status: "200", description: "`results` holds the words, and is empty when none begins with `q`." }],
    examples: [{
      path: "suggest?q=sal",
      status: 200,
      response: {
        query: "sal",
        release_id: RELEASE,
        results: ["sala", "salare", "sale", "salire"].map((word) => ({ word, attribution: ATTRIBUTION(word) })),
      },
    }],
  },
  nearby: {
    method: "GET",
    title: "Find close spellings",
    tagline: "Did you mean",
    summary:
      "Spellings close to `q`, in the not-found page's order: the same letters with accents (`accent`), one edit away (`edit`), or words that begin with `q` (`prefix`).",
    parameters: [Q],
    answers: [{ status: "200", description: "`results` holds the spellings, and is empty when none is close." }],
    examples: [{
      path: "nearby?q=mangare",
      status: 200,
      response: {
        query: "mangare",
        release_id: RELEASE,
        results: [{ word: "mangiare", kind: "edit", attribution: ATTRIBUTION("mangiare") }],
      },
    }],
  },
  random: {
    method: "GET",
    title: "Draw a random word",
    tagline: "One random headword",
    summary: "One random headword.",
    parameters: [POS],
    answers: [{ status: "200", description: "`results` holds one headword, or none when the release has none of `pos`." }],
    examples: [{
      path: "random?pos=noun",
      status: 200,
      response: {
        release_id: RELEASE,
        results: [{ id: `${RELEASE}:1`, word: "casa", pos: "noun", pos_title: "Sostantivo", attribution: ATTRIBUTION("casa") }],
      },
    }],
  },
  "lookup/batch": {
    method: "POST",
    title: "Look up many words",
    tagline: `Up to ${MAX_BATCH_WORDS} words at once`,
    summary: `Up to ${MAX_BATCH_WORDS} words at once, each answered light: one entry per candidate with its lemma and part of speech, or one \`found: false\` entry for a word not in the release.`,
    parameters: [
      {
        name: "q",
        type: "string[]",
        required: true,
        description: `In the JSON body, \`{"q": [...]}\`: 1 to ${MAX_BATCH_WORDS} words, each 1 to ${MAX_QUERY_LENGTH} characters.`,
      },
    ],
    answers: [{ status: "200", description: "`results` holds the entries, word by word in the order sent." }],
    examples: [{
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
    }],
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
 * The request an example sends, as a command, the way board 31 writes it: a
 * query as `-G` with one `--data-urlencode` per parameter, a body as `-d`,
 * then the address.
 */
export function curlOf(example: Example): string {
  const [path, query = ""] = example.path.split("?");
  const parameters = [...new URLSearchParams(query)];
  const lines = [`curl ${parameters.length > 0 ? "-G " : ""}-H "X-API-Key: ${EXAMPLE_KEY}" \\`];
  if (example.body !== undefined) {
    lines.push(`  -H "content-type: application/json" \\`, `  -d '${JSON.stringify(example.body)}' \\`);
  }
  for (const [name, value] of parameters) lines.push(`  --data-urlencode "${name}=${value}" \\`);
  lines.push(`  "${API_BASE}/${path}"`);
  return lines.join("\n");
}

/**
 * JSON as the page prints it: a value that fits in `width` characters stays on
 * its line, and anything longer opens one member per line. It parses back to
 * the same value.
 */
export function formatJson(value: unknown, width: number = WIDTH): string {
  return format(value, "", 0, width);
}

/** `value` printed at `indent`, its first line already `lead` characters in. */
function format(value: unknown, indent: string, lead: number, width: number): string {
  const inline = oneLine(value);
  if (value === null || typeof value !== "object" || indent.length + lead + inline.length <= width) return inline;
  const inner = `${indent}  `;
  const members = Array.isArray(value)
    ? value.map((item) => inner + format(item, inner, 0, width))
    : Object.entries(value).map(([key, item]) => {
        const head = `${JSON.stringify(key)}: `;
        return inner + head + format(item, inner, head.length, width);
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

/** An endpoint's cost as the docs and the pricing page write it: `2 units`, `1 unit per word`. */
export function costText(weight: UnitWeight): string {
  return `${weight.units} ${weight.units === 1 ? "unit" : "units"}${weight.per === "word" ? " per word" : ""}`;
}

/** One row of the pricing page's cost table: every endpoint that costs the same. */
export interface CostRow {
  endpoints: readonly Endpoint[];
  weight: UnitWeight;
}

/** Where each endpoint sits among those of its cost on the pricing page, as board 26 lists them. */
const PRICING_ORDER: Readonly<Record<Endpoint, number>> = {
  exists: 0,
  lemmatize: 1,
  lookup: 2,
  inflect: 3,
  random: 4,
  suggest: 5,
  nearby: 6,
  "lookup/batch": 7,
};

/**
 * The unit map grouped by cost: endpoints charged per request from cheapest
 * up, then those charged per word. Each endpoint sits in exactly one row.
 */
export const COST_ROWS: readonly CostRow[] = (() => {
  const rows = new Map<string, CostRow>();
  const inPricingOrder = [...ENDPOINTS_IN_ORDER].sort((a, b) => PRICING_ORDER[a] - PRICING_ORDER[b]);
  for (const endpoint of inPricingOrder) {
    const weight = UNIT_WEIGHT[endpoint];
    const key = `${weight.per} ${weight.units}`;
    const row = rows.get(key);
    rows.set(key, { weight, endpoints: [...(row?.endpoints ?? []), endpoint] });
  }
  const order = (row: CostRow) => (row.weight.per === "word" ? 1 : 0);
  return [...rows.values()].sort((a, b) => order(a) - order(b) || a.weight.units - b.weight.units);
})();

/** The languages the docs print each request in. */
export const LANGUAGES = ["curl", "JavaScript", "Python"] as const;
export type Language = (typeof LANGUAGES)[number];

/** An example's query, as name and value pairs. */
const queryOf = (example: Example): [string, string][] => [...new URLSearchParams(example.path.split("?")[1] ?? "")];
const urlOf = (example: Example): string => `${API_BASE}/${example.path.split("?")[0]}`;
/** Pairs as a one-line object literal both JavaScript and Python read. */
const objectOf = (pairs: [string, string][]): string =>
  `{ ${pairs.map(([name, value]) => `${JSON.stringify(name)}: ${JSON.stringify(value)}`).join(", ")} }`;

/**
 * The request an example sends, as JavaScript: `fetch`, then the answer's
 * JSON. It is the same request `curlOf` prints.
 */
export function javascriptOf(example: Example): string {
  const query = queryOf(example);
  const lines: string[] = [];
  if (query.length > 0) lines.push(`const params = new URLSearchParams(${objectOf(query)});`);
  const url = query.length > 0 ? `\`${urlOf(example)}?\${params}\`` : JSON.stringify(urlOf(example));
  lines.push(`const response = await fetch(${url}, {`);
  if (example.body !== undefined) lines.push(`  method: "POST",`);
  if (example.body === undefined) {
    lines.push(`  headers: { "X-API-Key": ${JSON.stringify(EXAMPLE_KEY)} },`);
  } else {
    lines.push(`  headers: { "X-API-Key": ${JSON.stringify(EXAMPLE_KEY)}, "content-type": "application/json" },`);
    lines.push(`  body: JSON.stringify(${oneLine(example.body)}),`);
  }
  lines.push(`});`, `const data = await response.json();`);
  return lines.join("\n");
}

/** The request an example sends, as Python with `requests`. */
export function pythonOf(example: Example): string {
  const query = queryOf(example);
  const method = example.body === undefined ? "get" : "post";
  const lines = [`import requests`, ``, `response = requests.${method}(`, `    ${JSON.stringify(urlOf(example))},`];
  if (query.length > 0) lines.push(`    params=${objectOf(query)},`);
  if (example.body !== undefined) lines.push(`    json=${oneLine(example.body)},`);
  lines.push(`    headers={ "X-API-Key": ${JSON.stringify(EXAMPLE_KEY)} },`, `)`, `data = response.json()`);
  return lines.join("\n");
}

/** An example's request in every language the docs print. */
export const requestsOf = (example: Example): Readonly<Record<Language, string>> => ({
  curl: curlOf(example),
  JavaScript: javascriptOf(example),
  Python: pythonOf(example),
});

/** The request the Authentication section shows the key header with. */
export const AUTH_EXAMPLE: Example = ENDPOINT_REFERENCE.exists.examples[0];
