// Records whose first gloss says "plurale di <lemma>" but whose tags say
// singular (#483). On release it-0c432803, 292 noun and adjective records
// gloss themselves that way and carry `singular`, not `plural`. Nearly all come
// from it.wiktionary form pages with a singular `{{Pn}}` label (`''f sing''`),
// so the source page cannot tell a real plural from a real singular whose
// gloss is wrong. A plural tagged singular reaches its own page as singular:
// `la costruttrici` before #449.
//
// Huey ruled on 2026-10-03
// (https://github.com/hueypov/lexema/issues/483#issuecomment-5970891514) to fix
// them with one rule, not by hand, and only where en.wiktionary confirms: this
// file is that rule, `it-plural-gloss-number/v1`. It judges each record from
// two things only, the record's own line and pinned Wiktionary revisions
// (`PLURAL_GLOSS_EVIDENCE` in pluralGlossEvidence.ts), so the same release and
// the same revisions always give the same corrections.
//
// - **A real plural** is a record whose en.wiktionary page, in a section for
//   its part of speech (`Noun` for a noun; `Adjective` or `Participle` for an
//   adjective), states it a plural of the very lemma its gloss names:
//   `{{plural of|it|costruttrice}}`, `{{feminine plural of|it|curdo}}`,
//   `{{adj form of|it|curvo||f|p}}`. Its number is corrected to plural. Its
//   gender is corrected too, but only where that same revision states one
//   gender (the template's gender, or the section's head line, `g=m`), the
//   record carries one gender tag, and the two differ.
// - **A real singular noun** whose gloss wrongly says "plurale di" (`mima`
//   says "femminile plurale di mimo") is corrected in the shape #420 gave
//   `ammaliatrice`: number singular, overriding the gloss. A page has to name
//   it a singular of the gloss's lemma: en.wiktionary's own page for it
//   (`{{female equivalent of|it|sociologo}}`), en.wiktionary's page for the
//   lemma (`{{it-noun|m|f=cantiniera}}`), the lemma's it.wiktionary table of
//   forms (`{{Tabs|mimo|mimi|mima|mime}}`), or, when the gloss names the word
//   itself (`condensa`, "plurale di condensa"), en.wiktionary's singular noun
//   head for it (`{{it-noun|f}}`). A page's noun section decides; only when
//   it says nothing of the word do its adjective and participle sections,
//   since a singular is no plural whatever part of speech files it
//   (`nevrotica`). No page read may name it a plural. Its gender stays as
//   tagged: these pages are not all en.wiktionary, which alone may set one.
// - **Everything else is left as the source states it**, with the reason the
//   rule gives: another language's record, one a hand correction already
//   covers (#420, #449), a singular adjective (no ruling covers them), or no
//   en.wiktionary confirmation.
//
// The corrections join the curated list (curatedCorrections.ts) and travel the
// same layer: a `corrected_claim` row beside the record, whose line stays byte
// for byte (ADR 0027).

import type { CorrectedFacts, CorrectedRecord, Evidence, OverriddenText, RecordCorrection } from "./curatedCorrections.js";
import { enBlocks, type EnBlock, type FetchedPage, type Gender, headGenders, headSaysSingular, isPinned, type PinnedPage, tabsPlaces, templatesOn } from "./wiktionaryEvidence.js";

/** The rule's name and version. A change to what it confirms or writes is a new version. */
export const PLURAL_GLOSS_NUMBER_RULE = "it-plural-gloss-number/v1" as const;

/** The gloss openings the scan matches: "plurale di", "femminile plurale di", "plurale maschile di"… */
export const PLURAL_GLOSS_OPENING = /^(maschile |femminile )?plurale( maschile| femminile)? di /;

/** What the rule reads of one archive record, each field as the line states it. */
export interface ScannedRecord {
  lineNo: number;
  lineSha256: string;
  word: string;
  pos: "noun" | "adj";
  langCode: string;
  /** The record's top-level `tags`, in order: a correction overrides one by its index. */
  tags: readonly string[];
  /** `senses[0].glosses[0]`. */
  firstGloss: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The record on `line` if the scan takes it: a noun or adjective whose
 * top-level tags include `singular` and not `plural`, and whose first gloss
 * opens "plurale di", in any of its gendered spellings.
 */
export function scanRecord(line: string, lineNo: number, lineSha256: string): ScannedRecord | undefined {
  const record: unknown = JSON.parse(line);
  if (!isRecord(record) || (record.pos !== "noun" && record.pos !== "adj")) return undefined;
  const tags = Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === "string") : [];
  if (!tags.includes("singular") || tags.includes("plural")) return undefined;
  const sense = Array.isArray(record.senses) ? record.senses[0] : undefined;
  const firstGloss = isRecord(sense) && Array.isArray(sense.glosses) ? sense.glosses[0] : undefined;
  if (typeof firstGloss !== "string" || !PLURAL_GLOSS_OPENING.test(firstGloss)) return undefined;
  if (typeof record.word !== "string" || typeof record.lang_code !== "string") return undefined;
  return { lineNo, lineSha256, word: record.word, pos: record.pos, langCode: record.lang_code, tags, firstGloss };
}

/** The lemma a plural gloss names: the letters after the opening. "plurale di lettone (letto grande)" names `lettone`. */
export function glossLemma(firstGloss: string): string | undefined {
  return /^[\p{L}\p{M}]+/u.exec(firstGloss.replace(PLURAL_GLOSS_OPENING, ""))?.[0];
}

/** The scan of one release and the page revisions the rule reads, pinned. */
export interface PluralGlossEvidence {
  releaseId: string;
  /** Every record the scan takes, in archive order. */
  records: readonly ScannedRecord[];
  /** Every page the rule reads: en.wiktionary for each word, and for each noun's lemma en.wiktionary and it.wiktionary. */
  pages: readonly FetchedPage[];
}

/** The pages the rule reads for `record`: by wiki and title. */
export function pagesFor(record: ScannedRecord): { wiki: PinnedPage["wiki"]; title: string }[] {
  const lemma = glossLemma(record.firstGloss);
  if (record.langCode !== "it" || lemma === undefined) return [];
  const own = { wiki: "en.wiktionary.org" as const, title: record.word };
  if (record.pos !== "noun") return [own];
  return [own, { wiki: "en.wiktionary.org", title: lemma }, { wiki: "it.wiktionary.org", title: lemma }];
}

// --- What a page states ------------------------------------------------------

/** One definition template stating the word a form of a lemma. */
interface FormStatement {
  number: "singular" | "plural";
  gender: Gender | undefined;
  lemma: string;
}

const NAMED_FORMS: Readonly<Record<string, Omit<FormStatement, "lemma">>> = {
  "plural of": { number: "plural", gender: undefined },
  "masculine plural of": { number: "plural", gender: "masculine" },
  "feminine plural of": { number: "plural", gender: "feminine" },
  "masculine singular of": { number: "singular", gender: "masculine" },
  "feminine singular of": { number: "singular", gender: "feminine" },
  "feminine of": { number: "singular", gender: "feminine" },
  "female equivalent of": { number: "singular", gender: "feminine" },
};

/** Templates whose inflection tags follow the lemma and an empty display slot: `{{adj form of|it|curvo||f|p}}`. */
const TAGGED_FORMS = new Set(["adj form of", "inflection of", "infl of"]);

/** What a definition line states about the word, template by template. Only Italian (`|it|`) templates count. */
function statementsOn(definition: string): FormStatement[] {
  return templatesOn(definition).flatMap((template): FormStatement[] => {
    const [lang, lemma] = template.positional;
    if (lang !== "it" || lemma === undefined || lemma === "") return [];
    const named = NAMED_FORMS[template.name];
    if (named !== undefined) return [{ ...named, lemma }];
    if (!TAGGED_FORMS.has(template.name)) return [];
    const tags = template.positional.slice(3);
    // `;` joins several tag sets (a verb form's persons); none of them is one noun or adjective form.
    if (tags.includes(";")) return [];
    const number = tags.includes("p") ? "plural" : tags.includes("s") ? "singular" : undefined;
    if (number === undefined || (tags.includes("p") && tags.includes("s"))) return [];
    const gender = tags.includes("m") && !tags.includes("f") ? "masculine" : tags.includes("f") && !tags.includes("m") ? "feminine" : undefined;
    return [{ number, gender, lemma }];
  });
}

/** The sections a record's part of speech is read from. */
const SECTIONS: Readonly<Record<ScannedRecord["pos"], ReadonlySet<string>>> = {
  noun: new Set(["Noun"]),
  adj: new Set(["Adjective", "Participle"]),
};

/** Every section a noun or adjective form is filed under. */
const ANY_SECTION: ReadonlySet<string> = new Set(["Noun", "Adjective", "Participle"]);

/** it.wiktionary's noun headings: `{{-sost-|it}}`, `{{-sost form-|it}}`. */
const NOUN_HEADINGS: ReadonlySet<string> = new Set(["sost", "sost form"]);

/** What the record's own part of speech states, or, when it states nothing, what every part of speech does. */
const ownSectionFirst = <T>(own: readonly T[], any: readonly T[]): readonly T[] => (own.length > 0 ? own : any);

/** One statement found in a section, and the lines that show it. */
interface Found {
  statement: FormStatement;
  block: EnBlock;
  shows: string;
}

const showLines = (block: EnBlock, definition: string): string => [block.headingLine, block.head, definition].filter((line) => line !== undefined).join(" ");

function statementsIn(page: PinnedPage, sections: ReadonlySet<string>): Found[] {
  return enBlocks(page.lines)
    .filter((block) => sections.has(block.heading))
    .flatMap((block) => block.definitions.flatMap((definition) => statementsOn(definition).map((statement) => ({ statement, block, shows: showLines(block, definition) }))));
}

// --- The verdict -------------------------------------------------------------

/** Why the rule leaves a record as the source states it. */
export type Exclusion =
  /** The record's `lang_code` is not `it`. */
  | "not-italian"
  /** A hand correction already names this record (#420, #449). */
  | "already-corrected"
  /** A real singular adjective whose gloss is wrong: no ruling covers them. */
  | "singular-adjective"
  /** en.wiktionary has no page for the word. */
  | "no-en-page"
  /** The page has no Italian section. */
  | "no-italian-entry"
  /** The Italian section has no section for the record's part of speech. */
  | "no-section-for-pos"
  /** The section states a plural, but of another lemma than the gloss names. */
  | "other-lemma"
  /** The section states no plural of the gloss's lemma. */
  | "no-plural-statement"
  /** The pages read name it both a plural and a singular. */
  | "sources-disagree";

/** A record correction the rule made: the revisions that confirm it, never none. */
export interface RuleMadeCorrection extends RecordCorrection {
  rule: typeof PLURAL_GLOSS_NUMBER_RULE;
}

/** A real plural tagged singular: the one en.wiktionary revision that confirms it is the evidence. */
export interface PluralCorrection extends RuleMadeCorrection {
  evidence: readonly [Evidence & { wiki: "en.wiktionary.org" }];
}

export type Verdict =
  | { kind: "plural"; record: ScannedRecord; correction: PluralCorrection; genderCorrected: boolean }
  | { kind: "singular"; record: ScannedRecord; correction: RuleMadeCorrection }
  | { kind: "excluded"; record: ScannedRecord; reason: Exclusion };

/** The pinned pages of `evidence`, by wiki and title. */
export class PageIndex {
  readonly #pages: ReadonlyMap<string, FetchedPage>;

  constructor(pages: readonly FetchedPage[]) {
    this.#pages = new Map(pages.map((page) => [`${page.wiki}:${page.title}`, page]));
  }

  get(wiki: PinnedPage["wiki"], title: string): FetchedPage | undefined {
    return this.#pages.get(`${wiki}:${title}`);
  }
}

const evidenceOf = (page: PinnedPage, shows: string): Evidence => ({ wiki: page.wiki, title: page.title, revisionId: page.revisionId, shows });

/** The one gender tag a record carries, and its index; undefined when it carries none or both. */
function recordGender(record: ScannedRecord): { value: Gender; index: number } | undefined {
  const found = record.tags.flatMap((tag, index) => (tag === "masculine" || tag === "feminine" ? [{ value: tag as Gender, index }] : []));
  return found.length === 1 ? found[0] : undefined;
}

const tagText = (record: ScannedRecord, index: number): OverriddenText => ({ pointer: `/tags/${index}`, text: record.tags[index] });

/**
 * Judge one record of the scan of `releaseId`. `handCorrected` holds the
 * archive lines a hand correction of that release names. `pages` holds every
 * page `pagesFor(record)` names; a page it lacks is a fetch that was never
 * made, and throws.
 */
export function judge(record: ScannedRecord, releaseId: string, pages: PageIndex, handCorrected: ReadonlySet<number>): Verdict {
  const excluded = (reason: Exclusion): Verdict => ({ kind: "excluded", record, reason });
  if (record.langCode !== "it") return excluded("not-italian");
  if (handCorrected.has(record.lineNo)) return excluded("already-corrected");
  const lemma = glossLemma(record.firstGloss);
  if (lemma === undefined) throw new Error(`${record.word} at line ${record.lineNo}: its gloss names no lemma`);
  const read = (wiki: PinnedPage["wiki"], title: string): FetchedPage => {
    const page = pages.get(wiki, title);
    if (page === undefined) throw new Error(`no ${wiki} page ${title} is pinned for ${record.word} at line ${record.lineNo}`);
    return page;
  };
  const key: CorrectedRecord = { releaseId, lineNo: record.lineNo, lineSha256: record.lineSha256, word: record.word, pos: record.pos };

  const own = read("en.wiktionary.org", record.word);
  const found = isPinned(own) ? statementsIn(own, SECTIONS[record.pos]) : [];
  const ofLemma = found.filter((entry) => entry.statement.lemma === lemma);
  const plurals = ofLemma.filter((entry) => entry.statement.number === "plural" && !headSaysSingular(entry.block.head));
  const singulars = ofLemma.filter((entry) => entry.statement.number === "singular");

  if (plurals.length > 0 && isPinned(own)) {
    if (singulars.length > 0) return excluded("sources-disagree");
    const stated = new Set<Gender>();
    for (const { statement, block } of plurals) {
      if (statement.gender !== undefined) stated.add(statement.gender);
      for (const gender of headGenders(block.head)) stated.add(gender);
    }
    const number = { overrides: tagText(record, record.tags.indexOf("singular")), value: "plural" as const };
    const source = recordGender(record);
    const [gender] = stated.size === 1 ? [...stated] : [];
    const genderCorrected = gender !== undefined && source !== undefined && source.value !== gender;
    const facts: CorrectedFacts = genderCorrected ? { gender: { overrides: tagText(record, source.index), value: gender }, number } : { number };
    const shows = [...new Set(plurals.map((entry) => entry.shows))].join("; ");
    const correction: PluralCorrection = {
      record: key,
      facts,
      evidence: [{ wiki: "en.wiktionary.org", title: own.title, revisionId: own.revisionId, shows }],
      rule: PLURAL_GLOSS_NUMBER_RULE,
    };
    return { kind: "plural", record, correction, genderCorrected };
  }

  if (record.pos === "noun") {
    // A page's noun section decides. Only when it says nothing of the word do its other sections:
    // a gloss calling a singular "plurale di" is wrong whatever part of speech the form is filed under.
    const stated = isPinned(own) ? ownSectionFirst(ofLemma, statementsIn(own, ANY_SECTION).filter((entry) => entry.statement.lemma === lemma)) : [];
    const confirming: Evidence[] = [];
    let contradicted = stated.some((entry) => entry.statement.number === "plural");
    if (isPinned(own)) {
      for (const entry of stated.filter((found) => found.statement.number === "singular")) confirming.push(evidenceOf(own, entry.shows));
      // A gloss naming the word itself: en.wiktionary's own singular noun head for it.
      if (lemma === record.word) {
        for (const block of enBlocks(own.lines).filter((entry) => entry.heading === "Noun")) {
          const [head] = templatesOn(block.head ?? "");
          if (head?.name === "it-noun" && head.positional.length === 1 && (head.positional[0] === "m" || head.positional[0] === "f") && Object.keys(head.named).length === 0) {
            confirming.push(evidenceOf(own, [block.headingLine, block.head].join(" ")));
          }
        }
      }
    }
    const lemmaEn = read("en.wiktionary.org", lemma);
    if (isPinned(lemmaEn)) {
      for (const block of enBlocks(lemmaEn.lines).filter((entry) => entry.heading === "Noun")) {
        const [head] = templatesOn(block.head ?? "");
        if (head?.name === "it-noun" && Object.entries(head.named).some(([name, value]) => /^f\d*$/.test(name) && value === record.word)) {
          confirming.push(evidenceOf(lemmaEn, [block.headingLine, block.head].join(" ")));
        }
      }
    }
    const lemmaIt = read("it.wiktionary.org", lemma);
    if (isPinned(lemmaIt)) {
      const all = tabsPlaces(lemmaIt.lines, record.word);
      const places = ownSectionFirst(all.filter((place) => NOUN_HEADINGS.has(place.pos)), all);
      if (places.some((place) => place.number === "plural")) contradicted = true;
      for (const shows of new Set(places.filter((place) => place.number === "singular").map((place) => place.shows))) confirming.push(evidenceOf(lemmaIt, shows));
    }
    const [first, ...rest] = confirming;
    if (first !== undefined) {
      if (contradicted) return excluded("sources-disagree");
      const correction: RuleMadeCorrection = {
        record: key,
        facts: { number: { overrides: { pointer: "/senses/0/glosses/0", text: record.firstGloss }, value: "singular" } },
        evidence: [first, ...rest],
        rule: PLURAL_GLOSS_NUMBER_RULE,
      };
      return { kind: "singular", record, correction };
    }
  } else if (singulars.length > 0) {
    return excluded("singular-adjective");
  }

  if (!isPinned(own)) return excluded("no-en-page");
  if (own.lines.length === 0) return excluded("no-italian-entry");
  if (!enBlocks(own.lines).some((block) => SECTIONS[record.pos].has(block.heading))) return excluded("no-section-for-pos");
  if (found.some((entry) => entry.statement.number === "plural")) return excluded("other-lemma");
  return excluded("no-plural-statement");
}

/** Every record of `evidence`, judged, in archive order. */
export function judgeAll(evidence: PluralGlossEvidence, handCorrections: readonly RecordCorrection[]): Verdict[] {
  const pages = new PageIndex(evidence.pages);
  const handCorrected = new Set(handCorrections.filter((correction) => correction.record.releaseId === evidence.releaseId).map((correction) => correction.record.lineNo));
  return evidence.records.map((record) => judge(record, evidence.releaseId, pages, handCorrected));
}

/** The corrections the rule makes from `evidence`, in archive order. */
export const pluralGlossCorrections = (evidence: PluralGlossEvidence, handCorrections: readonly RecordCorrection[]): RuleMadeCorrection[] =>
  judgeAll(evidence, handCorrections).flatMap((verdict) => (verdict.kind === "excluded" ? [] : [verdict.correction]));
