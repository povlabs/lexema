// Which form-of records the archive tags Italian are another language's word
// form, by what the archive itself says (#389, ADR 0023).
//
// Some pages file a foreign plural under an Italian heading with nothing else
// on them: `zapateros` is `== {{-it-}} ==`, `{{-sost form-|it}}`, `#plurale di
// [[zapatero]]`. The section-language rule (sectionLanguage.ts) reads page
// structure, so it has nothing to see there. The archive gives them away
// instead: the record's every form-of target has no Italian record, only a
// record in another language, and that record lists this exact word among its
// own `forms` (`zapatero` [es] has `forms: [{form: "zapateros"}]`).
//
// All three conditions are needed. A target with no Italian record alone takes
// in every Italian verb form whose infinitive the archive skipped (#326); a
// target with only a foreign record takes in Italian verb forms whose
// infinitive is also a Latin word (`amaricasti` -> `amaricare` [la]). Only a
// foreign entry claiming the word as its own form is precise. No spelling,
// script or word list is read.

/**
 * The rule's name and version, stored on every record it hides. A change to
 * what `ForeignLemmaIndex` decides is a new version.
 */
export const FORM_OF_FOREIGN_LEMMA_RULE = "form-of-foreign-lemma/v1" as const;

/** Why the rule hides a record: the foreign lemma lists it among its forms. */
export const LEMMA_LISTS_FORM = "lemma-lists-form" as const;

/** A record the rule finds to be another language's form, and the archive line that says so. */
export interface ForeignForm {
  /** 1-based archive line of the Italian-tagged record. */
  lineNo: number;
  /** Its headword, `zapateros`. */
  word: string;
  /** The language code of the record that claims it: `es`, `hu`, `en`. */
  code: string;
  /** 1-based archive line of that record. */
  lemmaLine: number;
  /** Its word, the record's first form-of target. */
  lemma: string;
}

/** An archive record in another language that lists forms of its own. */
interface ForeignLemma {
  lineNo: number;
  code: string;
  forms: ReadonlySet<string>;
}

/** An Italian-tagged record whose senses name form-of targets. */
interface FormOfRecord {
  lineNo: number;
  word: string;
  targets: readonly string[];
}

const strings = (values: unknown): string[] =>
  Array.isArray(values) ? values.flatMap((value) => (typeof value === "string" ? [value] : [])) : [];

const members = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item)) : [];

/**
 * The archive read once, in line order, for what the rule needs: every Italian
 * word, every Italian record's form-of targets, and every other-language
 * record's own forms. `found` then judges every Italian record at once, since
 * a target's records can sit anywhere in the archive.
 */
export class ForeignLemmaIndex {
  private readonly italianWords = new Set<string>();
  private readonly formOf: FormOfRecord[] = [];
  private readonly lemmas = new Map<string, ForeignLemma[]>();

  /** One admitted Italian record. */
  addItalian(lineNo: number, record: { word: string; senses: readonly { form_of: readonly { word?: unknown }[] }[] }): void {
    this.italianWords.add(record.word);
    const named = record.senses.flatMap((sense) => sense.form_of.map((target) => target.word));
    if (named.length === 0) return;
    // A target that is not a string cannot be checked, so such a record is never judged foreign.
    if (!named.every((target): target is string => typeof target === "string")) return;
    this.formOf.push({ lineNo, word: record.word, targets: [...new Set(named)] });
  }

  /** One archive line in another language, as parsed. */
  addOtherLanguage(lineNo: number, record: Readonly<Record<string, unknown>>): void {
    const { word, lang_code: code } = record;
    if (typeof word !== "string" || typeof code !== "string" || code === "" || code === "it") return;
    const forms = new Set(members(record.forms).flatMap((form) => strings([form.form])));
    if (forms.size === 0) return;
    const held = this.lemmas.get(word);
    const lemma = { lineNo, code, forms };
    if (held === undefined) this.lemmas.set(word, [lemma]);
    else held.push(lemma);
  }

  /** The other-language record of `target` that lists `word` among its forms, first in the archive. */
  private claimant(target: string, word: string): ForeignLemma | undefined {
    if (this.italianWords.has(target)) return undefined;
    return this.lemmas.get(target)?.find((lemma) => lemma.forms.has(word));
  }

  /**
   * Every Italian record whose every form-of target has no Italian record and
   * a record in another language listing the record's word among its forms. In
   * archive order. The evidence named is the first target's claimant.
   */
  found(): ForeignForm[] {
    return this.formOf.flatMap(({ lineNo, word, targets }): ForeignForm[] => {
      const claimants = targets.map((target) => this.claimant(target, word));
      if (!claimants.every((claimant) => claimant !== undefined)) return [];
      const [first] = claimants as ForeignLemma[];
      return [{ lineNo, word, code: first.code, lemmaLine: first.lineNo, lemma: targets[0] }];
    });
  }
}
