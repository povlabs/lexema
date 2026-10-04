// What the developer site states about the JSON API (#153, #166), as data, so
// its pages and their tests read one copy.
//
// Whatever the API already names is imported, never restated: the endpoints and
// how each counts calls (src/api/calls.ts), the filter vocabularies
// (web/worker/api/lookupFilters.ts), the batch and query bounds. Every example
// response is what the handler answers for its request over the development
// fixture, which holds lines of release it-0c432803; `id` numbers are the lines
// those records sit on in that release's archive. web/test/developers.test.tsx
// runs every example through `handleApi` and fails when an answer drifts.
//
// Text in backticks renders as code.

import { API_PREFIX, countedPerWord, ENDPOINTS, type CallBasis, type Endpoint, type EndpointCountedPer } from "@lexema/api/calls.ts";
import { MAX_QUERY_LENGTH } from "@lexema/lookup/lookup.ts";
import { MIN_PREFIX_LENGTH, SUGGESTION_LIMIT } from "@lexema/lookup/suggest.ts";
import { SECTION_KEY } from "@/worker/api/lookupAnswer.ts";
import { GRAMMAR_CODES, MATCHES, PARTS_OF_SPEECH, POS_ALIASES, SECTIONS, type Match } from "@/worker/api/lookupFilters.ts";
import type { SiteOrigins } from "@/worker/shared/hosts.ts";

/** Where every endpoint lives, on the API host the page names (#266): `https://api.lexema.fyi/v1` live. */
export const apiBaseOf = (origins: SiteOrigins): string => `${origins.api}${API_PREFIX.slice(0, -1)}`;

/** A key as the examples write it. */
export const EXAMPLE_KEY = "lx_…";

/** What a parameter's value is, as the docs name it. */
export type ParameterType = "string" | "integer" | "string[]";

/** A parameter whose values are a closed list, each listed in full on the Grammar values page. */
export type ValueList = "pos" | "match" | "fields";

export interface Parameter {
  name: string;
  type: ParameterType;
  required: boolean;
  description: string;
  /** The list `description`'s `...` continues: the docs link the `...` to it. */
  continued?: ValueList;
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

/**
 * The first of a vocabulary's values, as board 31 names a list too long for
 * its line. The docs follow it with `...`, linked to the whole list.
 */
const opening = (values: readonly string[], count: number) => `${values.slice(0, count).join(", ")},`;

const POS: Parameter = {
  name: "pos",
  type: "string",
  required: false,
  description: `Only this part of speech: ${opening(PARTS_OF_SPEECH, 3)}`,
  continued: "pos",
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

/** `andare`'s expressions, which the source lists on both its records, in its order. */
const ANDARE_EXPRESSIONS = [
  { phrase: "a lungo andare", meaning: "col trascorrere del tempo", has_entry: false },
  { phrase: "andare a bottega", meaning: "andare ad imparare un lavoro presso un artigiano", has_entry: false },
  { phrase: "andare a catafascio", meaning: "andare in rovina", has_entry: false },
  { phrase: "andare a Canossa", meaning: "umiliarsi, invocare un perdono mortificante", has_entry: false },
  { phrase: "andare a dama", meaning: "damare, segnare un punto, arrivare con una pedina sull'ultima linea ella scacchiera", has_entry: false },
  { phrase: "andare addosso", meaning: "(di veicoli o natanti) cozzare contro qualcosa", has_entry: false },
  { phrase: "andare a fare in culo", meaning: "mandare qualcuno al diavolo", has_entry: false },
  { phrase: "andare a farsi benedire", meaning: "offendere ingiuriosamente chi ci assilla", has_entry: false },
  { phrase: "andare a fondo", meaning: "(di proposito) non avere successo", has_entry: false },
  { phrase: "andare a genio", meaning: null, has_entry: false },
  { phrase: "andare a ingrassare i vermi", meaning: "morire", has_entry: false },
  { phrase: "andare a monte", meaning: "(di piano) non avere successo", has_entry: false },
  { phrase: "andare a parare", meaning: "avvicinarsi a una determinata caratteristica", has_entry: false },
  { phrase: "andare a rogito", meaning: "stipulare un contratto", has_entry: false },
  { phrase: "andare a ruota", meaning: "conseguire un successo di poco inferiore a quello di un altro,", has_entry: false },
  { phrase: "andare a spasso", meaning: "fare due passi, andare a passeggio", has_entry: false },
  { phrase: "andare a tempo", meaning: "ballare, cantare o suonare correttamente", has_entry: false },
  { phrase: "andare a trovare", meaning: "visitare", has_entry: false },
  { phrase: "andare a zonzo", meaning: "andare in giro senza una meta precisa", has_entry: false },
  { phrase: "andare al diavolo", meaning: "offesa ingiuriosa pronunciata contro chi ci assilla", has_entry: false },
  { phrase: "andare alla deriva", meaning: "andare alla malora", has_entry: false },
  { phrase: "andare alla radice", meaning: "cercare il vero motivo", has_entry: false },
  { phrase: "andare alle urne", meaning: "sottoporre a votazione", has_entry: false },
  { phrase: "andare all’altare", meaning: "sposarsi", has_entry: false },
  { phrase: "andare all'aria", meaning: "non avere successo", has_entry: false },
  { phrase: "andare avanti", meaning: "(militare) entrare nello spazio nemico per occuparlo", has_entry: false },
  { phrase: "andare bene", meaning: "(di azienda) essere molto produttiva", has_entry: false },
  { phrase: "andare di conserva", meaning: "andare d'accordo", has_entry: false },
  { phrase: "andare di lusso", meaning: "(familiare) avere un risultato superiore alle previsioni", has_entry: false },
  { phrase: "andare di traverso", meaning: "compiere un'azione dagli esiti negativi", has_entry: false },
  { phrase: "andare di corpo", meaning: "cacare", has_entry: false },
  { phrase: "andare di moda", meaning: "fare tendenza", has_entry: false },
  { phrase: "andare in briciole", meaning: "rompersi", has_entry: false },
  { phrase: "andare in camporella", meaning: "andare ad intrattenere un rapporto amoroso epidermico e in un posto appartato fuori dalla città, in un praticello", has_entry: false },
  { phrase: "andare in cenere", meaning: "(di edificio) essere demolito dalle fiamme", has_entry: false },
  { phrase: "andare in collera", meaning: "adirarsi violentemente", has_entry: false },
  { phrase: "andare in estasi", meaning: "(di persona) essere estasiato", has_entry: false },
  { phrase: "andare in fumo", meaning: "svanire, dissolversi", has_entry: false },
  { phrase: "andare in giro", meaning: "andare a zonzo senza meta", has_entry: false },
  { phrase: "andare in piazza", meaning: "partecipare a manifestazioni pubbliche", has_entry: false },
  { phrase: "andare in rovina", meaning: "(di qualcuno) affrontare tracollo finanziario", has_entry: false },
  { phrase: "andare in tilt", meaning: "essere turbato, andare in confusione", has_entry: false },
  { phrase: "andare in visibilio", meaning: "strabiliarsi, trasecolare; andare in estasi", has_entry: false },
  { phrase: "andare liscio", meaning: "andare avanti senza trovare intralci", has_entry: false },
  { phrase: "andare nel pallone", meaning: "impallarsi, impacciarsi", has_entry: false },
  { phrase: "andare oltre", meaning: "avere una prospettiva più ampia di quello solita", has_entry: false },
  { phrase: "andare per il sottile", meaning: "operare con accuratezza o sensibilità", has_entry: false },
  { phrase: "andare sotto", meaning: "avere più uscite che entrate", has_entry: false },
  { phrase: "non andare per il sottile", meaning: "comportarsi in modo privo di tatto", has_entry: false },
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
        expressions: ANDARE_EXPRESSIONS,
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
        expressions: ANDARE_EXPRESSIONS,
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

/** Every endpoint, keyed as src/api/calls.ts names it, so none goes undocumented. */
export const ENDPOINT_REFERENCE: Readonly<Record<Endpoint, EndpointReference>> = {
  lookup: {
    method: "GET",
    title: "Look up a word",
    tagline: "Everything about a word",
    summary:
      "Every candidate for q, in full: the record the word heads, the lemma it is a form of, and any record that lists it among its forms. When nothing spells q and it has several words, each word is read as its lemmas, and every multi-word headword those lemmas spell in order is a candidate with `match.via` `phrase`: `vado via` finds `andare via`.",
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
        continued: "fields",
      },
      { name: "limit_definitions", type: "integer", required: false, description: "At most this many definitions per result." },
      ...VERB_GRAMMAR,
      ...AGREEMENT_GRAMMAR,
    ],
    answers: [
      { status: "200", description: "The word is in the release. results holds every candidate the filters keep." },
      { status: "404", description: "The word is not in the release. results is empty and suggestions lists close spellings, as `/nearby` does: the query corrected so that it spells a multi-word headword is kind `phrase` (`vadoo via` offers `vado via`)." },
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
    summary: `Up to ${SUGGESTION_LIMIT} words that begin with \`q\`, as the search field suggests them. When \`q\` has several words, the words that begin with it are followed by \`q\` completed as a multi-word headword its words spell as their lemmas: \`vado v\` offers \`vado via\`, which finds \`andare via\`. Such a word's \`attribution\` is the headword's page.`,
    parameters: [{ name: "q", type: "string", required: true, description: `The beginning of a word, ${MIN_PREFIX_LENGTH} to ${MAX_QUERY_LENGTH} characters.` }],
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
      "Spellings close to `q`, in the not-found page's order: the same letters with accents or a final apostrophe (`accent`), one edit away (`edit`), `q` corrected so that its words spell a multi-word headword as their lemmas, with one word misspelled, the last word unfinished, or only some of the words (`phrase`: `tiro fouri` offers `tiro fuori`, which finds `tirare fuori`), or words that begin with `q` (`prefix`). Phrases also follow an `accent` or `edit` offer. A `phrase`'s `attribution` is the page of the headword it finds.",
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
    tagline: "Many words at once",
    summary: "Up to as many words at once as the key may make calls in a minute, each answered light: one entry per candidate with its lemma and part of speech, or one `found: false` entry for a word not in the release.",
    parameters: [
      {
        name: "q",
        type: "string[]",
        required: true,
        description: `In the JSON body, \`{"q": [...]}\`: from 1 word up to the key's calls a minute, each 1 to ${MAX_QUERY_LENGTH} characters. Each word is a call, toward the minute as toward the month.`,
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

/** The endpoints in the order the page lists them: the order of the call map. */
export const ENDPOINTS_IN_ORDER: readonly Endpoint[] = ENDPOINTS;

/** A list of values as the docs write it: each in backticks, comma separated. */
const codeList = (values: readonly string[]) => values.map((value) => `\`${value}\``).join(", ");

/** Every `pos` the API takes, and the spellings it reads as one of them. */
export const POS_TEXT = [
  `\`/lookup\` and \`/random\` take one part of speech: ${codeList(PARTS_OF_SPEECH)}.`,
  ...[...POS_ALIASES].map(([alias, value]) => `\`${alias}\` is read as \`${value}\`.`),
].join(" ");

/** What each `match` keeps: every value the API takes, and none it does not. */
const MATCH_MEANING: Readonly<Record<Match, string>> = {
  exact: "Only the records `q` heads.",
  form: "Only the lemma `q` is a form of, any record that lists `q` among its forms, and a multi-word headword `q`'s words spell (`match.via` `phrase`).",
  any: "Both. The default when `match` is absent.",
};

/** Every `match` the API takes, and what it keeps. */
export const MATCH_VALUES: readonly { value: Match; meaning: string }[] = MATCHES.map((value) => ({
  value,
  meaning: MATCH_MEANING[value],
}));

/** Every section `fields` takes, and the key a section returns under another name. */
export const FIELDS_TEXT = [
  `\`/lookup\` takes a comma list of sections: ${codeList(SECTIONS)}.`,
  ...SECTIONS.filter((section) => SECTION_KEY[section] !== section).map(
    (section) => `\`${section}\` returns \`${SECTION_KEY[section]}\`.`,
  ),
  "`expressions` lists the phrases the source gives with the record's word, one each, in the page's order: each is `{ phrase, meaning, has_entry }`, where `meaning` joins the source's meanings for the phrase with `; ` and is `null` when it gives none, and `has_entry` is `true` when the phrase is an Italian headword of its own.",
  "The rest of a result is always returned.",
].join(" ");

/** The grammar parameters, each Italian label with the English codes also accepted for it. */
export const GRAMMAR_VALUES = (Object.entries(GRAMMAR_CODES) as [string, Readonly<Record<string, readonly string[]>>][]).map(
  ([parameter, codes]) => ({ parameter, values: Object.entries(codes).map(([label, english]) => ({ label, english })) }),
);

export interface ErrorReference {
  status: 400 | 401 | 402 | 403 | 404 | 405 | 429 | 503;
  code: string;
  when: string;
}

/** Every `error.code` the API answers with. */
export const ERRORS: readonly ErrorReference[] = [
  {
    status: 400,
    code: "invalid_query",
    when: `\`q\` or \`lemma\` is missing, empty, or too long; on \`/suggest\`, \`q\` is shorter than ${MIN_PREFIX_LENGTH} characters.`,
  },
  {
    status: 400,
    code: "invalid_parameter",
    when: "A parameter's value is not one it takes, or the parameter is sent empty or more than once.",
  },
  {
    status: 400,
    code: "invalid_body",
    when: "The batch body is not `{\"q\": [...]}` with at least 1 non-empty word and no more words than the key's calls a minute.",
  },
  { status: 401, code: "missing_key", when: "No `X-API-Key` header." },
  { status: 401, code: "invalid_key", when: "The key is not one Lexema issued." },
  { status: 401, code: "revoked_key", when: "The key has been revoked." },
  { status: 401, code: "expired_key", when: "The key is past the expiry it was made with." },
  { status: 402, code: "plan_required", when: "The key's account has no active plan: none yet, one whose payment failed, or one that has ended." },
  { status: 403, code: "account_suspended", when: "The key's account is suspended. Its keys answer again if the suspension is lifted." },
  { status: 403, code: "endpoint_not_allowed", when: "The key is limited to other endpoints." },
  { status: 404, code: "unknown_lemma", when: "`/inflect`: `lemma` heads no record." },
  { status: 404, code: "not_found", when: "No endpoint at this path." },
  { status: 405, code: "method_not_allowed", when: "The endpoint takes another method, named in the `Allow` header." },
  { status: 429, code: "rate_limited", when: "The key's account has used its calls for this minute, across all its keys." },
  {
    status: 429,
    code: "allowance_exceeded",
    when: "The key's account has used its plan's calls for this billing period. The message names when they reset.",
  },
  { status: 503, code: "unavailable", when: "The request could not be answered. Try again later." },
];

/** The rate-limit headers, and what each says (#200 R1.5, #261, #263). */
export const HEADERS: readonly { name: string; description: string }[] = [
  { name: "RateLimit-Limit", description: "The calls a minute the key's account may make, shared by all its keys." },
  {
    name: "Retry-After",
    description: "On a `429` only: seconds to wait before trying again, 60 past the minute's limit, or until the billing period resets past its calls.",
  },
];

/** The widest line the examples are printed to, in characters. */
const WIDTH = 76;

/**
 * The request an example sends, as a command, the way board 31 writes it: a
 * query as `-G` with one `--data-urlencode` per parameter, a body as `-d`,
 * then the address.
 */
export function curlOf(example: Example, origins: SiteOrigins): string {
  const [path, query = ""] = example.path.split("?");
  const parameters = [...new URLSearchParams(query)];
  const lines = [`curl ${parameters.length > 0 ? "-G " : ""}-H "X-API-Key: ${EXAMPLE_KEY}" \\`];
  if (example.body !== undefined) {
    lines.push(`  -H "content-type: application/json" \\`, `  -d '${JSON.stringify(example.body)}' \\`);
  }
  for (const [name, value] of parameters) lines.push(`  --data-urlencode "${name}=${value}" \\`);
  lines.push(`  "${apiBaseOf(origins)}/${path}"`);
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

/** How an endpoint counts calls, as the docs and the pricing page write it: `1 call`, `1 call per word`. */
export const callText = (basis: CallBasis): string => (basis === "word" ? "1 call per word" : "1 call");

/**
 * One row of the pricing page's "What counts as a call" table (board 26): any
 * endpoint at 1 call, then each endpoint counted per word on its own row.
 */
export type CallRow = { endpoint: "any"; basis: "request" } | { endpoint: EndpointCountedPer<"word">; basis: "word" };

export const CALL_ROWS: readonly CallRow[] = [
  { endpoint: "any", basis: "request" },
  ...ENDPOINTS.filter(countedPerWord).map((endpoint): CallRow => ({ endpoint, basis: "word" })),
];

/** The languages the docs print each request in. */
export const LANGUAGES = ["curl", "JavaScript", "Python"] as const;
export type Language = (typeof LANGUAGES)[number];

/** An example's query, as name and value pairs. */
const queryOf = (example: Example): [string, string][] => [...new URLSearchParams(example.path.split("?")[1] ?? "")];
const urlOf = (example: Example, origins: SiteOrigins): string => `${apiBaseOf(origins)}/${example.path.split("?")[0]}`;
/** Pairs as a one-line object literal both JavaScript and Python read. */
const objectOf = (pairs: [string, string][]): string =>
  `{ ${pairs.map(([name, value]) => `${JSON.stringify(name)}: ${JSON.stringify(value)}`).join(", ")} }`;

/**
 * The request an example sends, as JavaScript: `fetch`, then the answer's
 * JSON. It is the same request `curlOf` prints.
 */
export function javascriptOf(example: Example, origins: SiteOrigins): string {
  const query = queryOf(example);
  const lines: string[] = [];
  if (query.length > 0) lines.push(`const params = new URLSearchParams(${objectOf(query)});`);
  const url = query.length > 0 ? `\`${urlOf(example, origins)}?\${params}\`` : JSON.stringify(urlOf(example, origins));
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
export function pythonOf(example: Example, origins: SiteOrigins): string {
  const query = queryOf(example);
  const method = example.body === undefined ? "get" : "post";
  const lines = [`import requests`, ``, `response = requests.${method}(`, `    ${JSON.stringify(urlOf(example, origins))},`];
  if (query.length > 0) lines.push(`    params=${objectOf(query)},`);
  if (example.body !== undefined) lines.push(`    json=${oneLine(example.body)},`);
  lines.push(`    headers={ "X-API-Key": ${JSON.stringify(EXAMPLE_KEY)} },`, `)`, `data = response.json()`);
  return lines.join("\n");
}

/** An example's request in every language the docs print. */
export const requestsOf = (example: Example, origins: SiteOrigins): Readonly<Record<Language, string>> => ({
  curl: curlOf(example, origins),
  JavaScript: javascriptOf(example, origins),
  Python: pythonOf(example, origins),
});
