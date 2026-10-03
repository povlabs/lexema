// Reading the definitions an Italian Wiktionary page states, from its wikitext.
//
// Wiktextract reads a `#` line as a sense and sends every `#*` or `#:` line below
// it to its example reader, which keeps italic runs only (reports/
// 2026-09-18-definition-loss.md §2). Italian Wiktionary writes usage sentences in
// italics and definitions in plain prose, so a definition written one level down
// is dropped. This module reads the page the way its structure says it should be
// read, and keeps four kinds of line apart:
//
//   sense line   a `#` line that states a meaning. The extraction keeps it.
//   page control a `#` line with no prose of its own: the headword template,
//                a gender/number stamp in italics, a link to the plural, a
//                no-definition marker. It is page furniture, and the lines one
//                level below it are the definitions (`casa`, `pianoforte`,
//                `manuale`) — except below `{{Nodef}}`, where the page says it
//                has none.
//   definition   a line below `#` the structure marks as a meaning — under a
//                page control; opened by a bold sub-term that a comma, colon
//                or bracket marks off from the prose defining it
//                (`#*'''liceo classico''', indirizzo…`); or an item of a list a
//                definition introduces with a colon. Also the prose line right
//                after a page control, outside the list: the page wrapped the
//                `#` item's definition onto the next physical line, where no
//                list reader looks (`verde`'s heraldic sense).
//   example      a line whose visible text is all italic, below a definition;
//                a closing attribution in brackets does not count.
//
// Anything else below a sense line — a plain usage sentence, a quotation, a
// line ending in `!` or `?`, the items after `Esempi:` — is left exactly where
// the extraction left it. The rules read markup and punctuation only: no
// headword, page or title list decides anything here, and the one phrase read
// is the page's own `Esempi:` label.

import type { RawPage, RawPageRef } from "../source/rawPage.js";
import type { PosTitle } from "./partOfSpeech.js";

// --- Page layout ------------------------------------------------------------

/** `== {{-it-}} ==` opens the Italian section; any other `== {{-xx-}} ==` closes it. */
export const LANGUAGE_HEADING = /^==\s*\{\{-([A-Za-z-]+)-\}\}\s*==\s*$/;
/** `{{-sost-|it}}`: a part-of-speech heading inside the Italian section. */
const POS_HEADING = /^\{\{-([a-z][a-z \-]*?)-\|it\}\}\s*$/;
/** Any other `{{-sill-}}`-style heading ends the list above it. */
const OTHER_HEADING = /^\{\{-/;
/** A list line under a part of speech: `#`, `#*`, `#**`, `#:`, `##`… */
const LIST_LINE = /^(#[#*:]*)\s*(.*)$/;

/**
 * The part-of-speech title the extraction gives the section a template opens.
 *
 * This is how a record (`pos_title: "Sostantivo"`) finds its section of the page.
 * It is the table `tools/definition_loss.py` measured with, unchanged; a heading
 * missing from it leaves its section unmatched and counted, never guessed at.
 */
export const POS_TITLE_BY_TEMPLATE: Readonly<Record<string, PosTitle>> = {
  sost: "Sostantivo", agg: "Aggettivo", adj: "Aggettivo",
  verb: "Verbo", nome: "Nome proprio", avv: "Avverbio",
  acron: "Acronimo / Abbreviazione", chat: "Abbreviazione in uso nelle chat",
  card: "Aggettivo numerale", inter: "Interiezione", cong: "Congiunzione",
  prep: "Preposizione", pronome: "Pronome", art: "Articolo",
  pref: "Prefisso", prefissoide: "Prefissoide", suff: "Suffisso",
  confisso: "Confisso", lettera: "Lettera", sigla: "Codice / Simbolo",
  cifra: "Cifra", part: "Particella", espr: "Espressione",
  "loc nom": "Locuzione nominale", "loc verb": "Locuzione verbale",
  "loc avv": "Locuzione avverbiale", "loc agg": "Locuzione aggettivale",
  "loc cong": "Locuzione congiuntiva", "loc prep": "Locuzione prepositiva",
  "loc inter": "Locuzione interiettiva",
  "agg poss": "Aggettivo possessivo", "agg dim": "Aggettivo dimostrativo",
  "pronome poss": "Pronome possessivo",
  "sost form": "Sostantivo, forma flessa", "agg form": "Aggettivo, forma flessa",
  "verb form": "Voce verbale", "nome form": "Nome proprio, forma flessa",
  "pronome form": "Pronome, forma flessa",
  "loc nom form": "Locuzione nominale, forma flessa",
  "card form": "Aggettivo numerale, forma flessa",
};

// --- Inline markup ----------------------------------------------------------

/** One run of visible text and the emphasis the markup put on it. */
export interface Run {
  text: string;
  italic: boolean;
  bold: boolean;
}

/**
 * Templates whose whole job on a definition line is a usage label, and the label
 * each one prints. `{{Term|architettura|it}}` labels its line `architettura`,
 * which the page shows the way it shows the extraction's labels.
 */
const LABEL_TEMPLATES: Readonly<Record<string, (args: readonly string[]) => string | undefined>> = {
  term: (args) => args[0],
  glossa: (args) => args[0],
  fig: () => "figurato",
  est: () => "per estensione",
};

/**
 * Language-name templates, printed the way it.wiktionary prints them. Only the
 * ones a recovered line uses today; a line using any other template is not
 * rendered at all (see `renderInline`).
 */
const LANGUAGE_TEMPLATES: Readonly<Record<string, string>> = {
  la: "latino",
  grc: "greco antico",
  en: "inglese",
};

/**
 * Templates that print fixed words around their arguments, printed the way
 * it.wiktionary prints them, with the markup kept so emphasis toggles the way
 * it does on the page. A picture the template shows is left out, as
 * `withoutNoise` leaves out every picture. `undefined` is a call that prints no
 * definition, and leaves the line unrendered like an unknown template.
 */
const PRINTING_TEMPLATES: Readonly<Record<string, (args: readonly string[]) => string | undefined>> = {
  // Template:Taxon (raw source read 2026-10-03, #495) prints
  // `la sua classificazione scientifica è '''''{{{1}}}''''' ([[File:WikiSpecies.svg|…]] '''[[wikispecies:{{{1}}}|tassonomia]]''')`.
  // With no first argument it prints an error and a maintenance category.
  taxon: ([name]) =>
    name === undefined || name === "" ? undefined : `la sua classificazione scientifica è '''''${name}''''' ( '''tassonomia''')`,
};

/** `{{name|arg|…}}` with no template inside it. Replaced innermost first. */
const TEMPLATE = /\{\{([^{}]*)\}\}/g;
/** `[[File:…]]` and friends, which can nest links in their captions. */
const FILE_LINK = /\[\[\s*(?:File|Image|Immagine|Categoria|Category)\s*:[^[\]]*(?:\[\[[^[\]]*\]\][^[\]]*)*\]\]/gi;
const LINK = /\[\[([^[\]|]*)(?:\|([^[\]]*))?\]\]/g;
const MARKUP_NOISE = /<!--[\s\S]*?-->|<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>|<[^>]+>/g;

function templateParts(inner: string): { name: string; args: string[] } {
  const [name = "", ...args] = inner.split("|").map((part) => part.trim());
  return { name: name.toLowerCase(), args: args.filter((arg) => !arg.includes("=")) };
}

/** Remove the markup no reader sees: comments, references, tags, pictures. */
function withoutNoise(body: string): string {
  let text = body.replace(MARKUP_NOISE, " ");
  for (let previous = ""; previous !== text; ) {
    previous = text;
    text = text.replace(FILE_LINK, " ");
  }
  return text;
}

/** Every template removed, whatever it prints. For judging structure only. */
function withoutTemplates(body: string): string {
  let text = withoutNoise(body);
  for (let previous = ""; previous !== text; ) {
    previous = text;
    text = text.replace(TEMPLATE, " ");
  }
  return text.replace(LINK, (_, target: string, label?: string) => label ?? target);
}

/**
 * Split text into runs by MediaWiki's apostrophe toggles: `'''''` both, `'''`
 * bold, `''` italic. A run left open at the end of the line still counts, as it
 * does on the page.
 */
function runsOf(text: string): Run[] {
  const runs: Run[] = [];
  let italic = false;
  let bold = false;
  for (const piece of text.split(/('{5}|'{3}|'{2})/)) {
    if (piece === "'''''") {
      italic = !italic;
      bold = !bold;
    } else if (piece === "'''") {
      bold = !bold;
    } else if (piece === "''") {
      italic = !italic;
    } else if (piece !== "") {
      runs.push({ text: piece, italic, bold });
    }
  }
  return runs;
}

const hasLetters = (text: string): boolean => /\p{L}/u.test(text);

/** True when the line shows prose outside italics, once templates are gone. */
function hasPlainProse(body: string): boolean {
  return runsOf(withoutTemplates(body)).some((run) => !run.italic && hasLetters(run.text));
}

/**
 * True when every visible letter on the line is italic, and there is one. A
 * closing attribution in brackets does not count against it: an italic
 * quotation followed by `(Deledda)` is still a quotation.
 */
function isWhollyItalic(body: string): boolean {
  const runs = runsOf(withoutTemplates(body).replace(/\s*\([^()]*\)[\s.;,]*$/, ""));
  return runs.some((run) => run.italic && hasLetters(run.text)) && !runs.some((run) => !run.italic && hasLetters(run.text));
}

/**
 * A line that opens with a quotation mark is a quotation, whatever list it sits
 * in: `acqua di cedro`'s sense ends in a colon and introduces
 * `«La marchesa si ritirò…» Antonio Fogazzaro`, not a list of meanings.
 */
const opensQuotation = (text: string): boolean => /^[«“„"]/.test(text);

/**
 * A line that ends in `!` or `?` is something a person says, not a meaning:
 * `'''Eppure''', me l'avevano detto!`, `'''qual''' è la tua stanza?`.
 */
const endsAsUtterance = (text: string): boolean => /[!?]$/.test(text);

/** `#Esempi:` — the page announcing that examples follow, not meanings. */
const EXAMPLES_LEAD_IN = /^(?:esempi|esempio|ad esempio|per esempio|es\.)\s*:$/i;

/** Whether a line's text opens a list of meanings: it ends in a colon and does not announce examples. */
const leadsIn = (text: string): boolean => text.endsWith(":") && !EXAMPLES_LEAD_IN.test(text);

/** Collapse whitespace the way a browser does, and trim. */
const collapse = (text: string): string => text.replace(/\s+/g, " ").trim();

/** A line rendered to the words a reader sees, or the template that stopped it. */
export type Rendered =
  | { rendered: true; text: string; labels: string[]; runs: Run[] }
  | { rendered: false; template: string };

/**
 * Replace every template on a line, innermost first: a label by a space, noted
 * in `labels`; the headword, a printing template and a language name by what
 * they print; any other by what `unknown` returns for its name.
 */
function expandTemplates(
  body: string,
  headword: string,
  unknown: (name: string) => string,
): { text: string; labels: string[] } {
  const labels: string[] = [];
  let text = withoutNoise(body);
  for (let previous = ""; previous !== text; ) {
    previous = text;
    text = text.replace(TEMPLATE, (_, inner: string) => {
      const { name, args } = templateParts(inner);
      if (name === "pn") return headword;
      const label = LABEL_TEMPLATES[name];
      if (label !== undefined) {
        const printed = label(args);
        if (printed !== undefined && printed !== "") labels.push(printed);
        return " ";
      }
      return PRINTING_TEMPLATES[name]?.(args) ?? LANGUAGE_TEMPLATES[name] ?? unknown(name);
    });
  }
  return { text: text.replace(LINK, (_, target: string, label?: string) => label ?? target), labels };
}

/**
 * Render one line of wikitext to plain text.
 *
 * Every template on the line is either a label, the headword, a printing
 * template, a language name, or unknown. An unknown template stops the line: printing it wrong, or
 * dropping words it prints, would put text on the page that the page upstream
 * does not say. The line is reported instead.
 */
export function renderInline(body: string, headword: string): Rendered {
  let unknown: string | undefined;
  const { text, labels } = expandTemplates(body, headword, (name) => {
    unknown ??= name;
    return " ";
  });
  if (unknown !== undefined) return { rendered: false, template: unknown };
  const runs = runsOf(text);
  return { rendered: true, text: collapse(runs.map((run) => run.text).join("")), labels, runs };
}

/**
 * What `{{Nodef}}` prints, as the archive has it: 9,370 of its glosses are
 * exactly this, and the others hold it beside the words around the template.
 */
const NODEF_PRINTS = "definizione mancante; se vuoi, aggiungila tu";

/** Stands where a template the renderer does not know prints. XML cannot carry it, so no page holds it. */
const GAP = "\u0000";

/**
 * A `#` line's text as far as it is known, to tell it from another line's. It
 * is never shown. `{{Nodef}}` prints its fixed words here; any other template
 * the renderer does not know leaves a gap, which may hold any text.
 */
function readSenseLine(body: string, headword: string): SenseLineText {
  const { text } = expandTemplates(body, headword, (name) => (name === "nodef" ? NODEF_PRINTS : GAP));
  const [first, ...rest] = runsOf(text).map((run) => run.text).join("").split(GAP).map(collapse);
  return rest.length === 0 ? { known: "whole", text: first } : { known: "around-gaps", parts: [first, ...rest] };
}

/**
 * The bold sub-term a line opens with, when it opens with one and then goes on
 * in plain prose: `'''liceo classico''', indirizzo della scuola…`.
 *
 * A line that is bold and italic from the start (`'''''posto''' in classifica''`)
 * is a usage sentence, not a sub-term, and a bold run with nothing plain after
 * it defines nothing.
 */
function boldSubTerm(runs: readonly Run[]): string | undefined {
  const firstVisible = runs.findIndex((run) => run.text.trim() !== "");
  const first = runs[firstVisible];
  if (first === undefined || !first.bold || first.italic) return undefined;
  let end = firstVisible;
  while (runs[end + 1]?.bold && !runs[end + 1]?.italic) end += 1;
  const term = collapse(runs.slice(firstVisible, end + 1).map((run) => run.text).join(""));
  const rest = runs.slice(end + 1);
  if (term === "" || !rest.some((run) => !run.italic && !run.bold && hasLetters(run.text))) return undefined;
  // The definition is marked off from its term: a comma or a colon after it, or
  // a gloss in brackets first (`'''apparato genitale''' (maschile o femminile):`).
  // A bold word that runs straight on into a sentence is the headword used in a
  // usage sentence, not a term being defined (`'''Discordia''' tra familiari.`).
  const after = collapse(rest.map((run) => run.text).join(""));
  if (!/^\(|[:,]/.test(after)) return undefined;
  return term;
}

// --- The list as a tree -----------------------------------------------------

/** A physical line of the page, outside the list. */
interface ProseLine {
  /** 1-based line in the revision's wikitext. */
  line: number;
  /** The line exactly as the page has it. */
  wikitext: string;
}

interface ListLine {
  /** 1-based line in the revision's wikitext. */
  line: number;
  marker: string;
  body: string;
  /** The line exactly as the page has it. */
  wikitext: string;
  /**
   * The line right after it, when that line is prose outside the list: a
   * `#` item the page wrapped onto the next physical line. Null otherwise.
   */
  wrapped: ProseLine | null;
  children: ListLine[];
}

/**
 * A physical line that may carry the rest of the list item above it: it opens
 * with no list, heading, table, tag or indent mark, is not a behaviour switch
 * like `__NOTOC__`, and shows prose outside italics. A picture or a category
 * link shows none.
 */
const continuesItem = (line: string): boolean =>
  /^[^#*:;={|!<\s_]/.test(line) && hasPlainProse(line) && !isWhollyItalic(line);

/** Build the list under one part-of-speech heading into a tree by marker depth. */
function listTree(lines: readonly Omit<ListLine, "children">[]): ListLine[] {
  const roots: ListLine[] = [];
  const stack: ListLine[] = [];
  for (const line of lines) {
    const node: ListLine = { ...line, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].marker.length >= node.marker.length) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent === undefined) roots.push(node);
    else parent.children.push(node);
    stack.push(node);
  }
  return roots;
}

/** `{{Nodef|it}}`: the page's own mark that it gives no definition. */
const NO_DEFINITION = /\{\{\s*nodef\s*[|}]/i;

/** A line the extraction reads as a sense: its marker is `#`, `##`, … only. */
const isSenseMarker = (marker: string): boolean => /^#+$/.test(marker);

// --- What the page states ---------------------------------------------------

/** Why the structure marks a line below `#` as a definition. */
export type DefinitionRoute =
  | { route: "sense-line" }
  | { route: "numbered-prose" }
  /**
   * A plain prose line between the language heading and the part-of-speech
   * heading: the page wrote its definition above the heading (`fidelizzare`).
   */
  | { route: "above-heading-prose" }
  /** One level below a `#` line that carries only the headword and its grammar. */
  | { route: "below-page-control" }
  /** Opened by a bold sub-term and then plain prose; `term` is that sub-term. */
  | { route: "sub-term"; term: string }
  /** An item of the list a definition introduces with a closing colon. */
  | { route: "lead-in-item" }
  /**
   * The prose line right after a `#` line that carries only page controls and
   * usage labels: the page wrapped that item's definition onto the next
   * physical line (`verde`: `# {{Term|araldica|it}} {{Pn|w=…}}`, then
   * `[[smalto|smalto araldico]] di colore verde intenso…`).
   */
  | { route: "wrapped-prose" };

/**
 * The line whose closing colon opens the list a definition is an item of:
 * `# attributo araldico che si applica a:` above `accollato`'s `#*` items. The
 * item belongs inside it.
 */
export interface LeadIn {
  ref: RawPageRef;
  /** Its text as a reader sees it, to find it among the record's glosses. */
  text: string;
  /** A `#` line, which the record may keep as a sense, or a definition below one. */
  on: "sense-line" | "definition";
}

/** A usage sentence the page attaches to a definition. */
export interface PageExample {
  text: string;
  ref: RawPageRef;
  wikitext: string;
}

/** A definition the page states on a line below `#`. */
export type PageDefinition = DefinitionRoute & {
  /** The definition as a reader sees it: templates printed, links as their labels. */
  text: string;
  /** Usage labels its templates print — `architettura`, `figurato` — in page order. */
  labels: string[];
  ref: RawPageRef;
  /** The line exactly as the page has it. */
  wikitext: string;
  /** The italic lines one level below it, in page order. */
  examples: PageExample[];
  /**
   * The line above it that ends in a colon, when it sits in that line's list.
   * Layout decides it, not wording: an item that defines itself in full
   * (`nozze d'oro`) is still in its lead-in's list. Null for a definition at
   * the top of its section's list.
   */
  leadIn: LeadIn | null;
};

/** A line the structure marks as a definition but that could not be rendered. */
export interface UnrenderedLine {
  ref: RawPageRef;
  wikitext: string;
  /** The template the renderer does not know. */
  template: string;
}

/**
 * A `#` line's text, as far as the renderer can print it: the whole of it, or
 * the parts around the places where a template it does not know prints, each
 * of which may hold any text. Two or more parts.
 */
export type SenseLineText = { known: "whole"; text: string } | { known: "around-gaps"; parts: string[] };

/** One `#` line of a part-of-speech section: one sense of the extraction's record. */
export type PageSenseLine =
  | {
      /** It states a meaning, and the extraction keeps it as a gloss. */
      kind: "sense";
      ref: RawPageRef;
      wikitext: string;
      text: SenseLineText;
      /** Definitions below it the extraction cannot read. */
      below: PageDefinition[];
    }
  | {
      /**
       * No prose of its own — headword, grammar stamp, plural link, or
       * `{{Nodef}}`: furniture, not a meaning. The extraction still makes it a
       * sense, whose gloss is the furniture (`casa ( approfondimento) f sing`).
       */
      kind: "page-control";
      ref: RawPageRef;
      wikitext: string;
      text: SenseLineText;
          /** The definitions one level below it. Empty when the page gives none. */
      below: PageDefinition[];
    };

/** One part of speech in the page's Italian section. */
export interface PageSection {
  /** The heading template's name: `sost`, `agg`, `verb form`. */
  posTemplate: string;
  /** The extraction's title for it, when the table knows the template. */
  posTitle: string | undefined;
  senseLines: PageSenseLine[];
  unrendered: UnrenderedLine[];
}

class SectionReader {
  readonly unrendered: UnrenderedLine[] = [];

  constructor(private readonly page: RawPage) {}

  ref(line: number): RawPageRef {
    return { wiki: this.page.wiki, title: this.page.title, revisionId: this.page.revisionId, line };
  }

  /**
   * A line below `#` that the structure has already marked as a definition.
   * `leadIn` is the colon-ended line whose list it is in, if any. `labels` are
   * printed on another line of the same item and come first.
   */
  definition(node: ListLine, route: DefinitionRoute, leadIn: LeadIn | null, labels: readonly string[] = []): PageDefinition[] {
    const rendered = renderInline(node.body, this.page.title);
    if (rendered.rendered && (opensQuotation(rendered.text) || endsAsUtterance(rendered.text))) return [];
    if (!rendered.rendered) {
      this.unrendered.push({ ref: this.ref(node.line), wikitext: node.wikitext, template: rendered.template });
      return [];
    }
    const definition: PageDefinition = {
      ...route,
      text: rendered.text,
      labels: [...labels, ...rendered.labels],
      ref: this.ref(node.line),
      wikitext: node.wikitext,
      examples: [],
      leadIn,
    };
    const opens = leadsIn(rendered.text) ? { ref: definition.ref, text: definition.text, on: "definition" as const } : null;
    return [definition, ...this.below(node, opens, definition.examples)];
  }

  /**
   * The definitions below a line that states a meaning. `leadIn` is the line
   * itself when it ends in a colon, which makes its plain children items of its
   * list. Italic children are its examples, collected into `examples` when the
   * caller keeps them — a sense line's examples are the extraction's already.
   */
  below(node: ListLine, leadIn: LeadIn | null, examples: PageExample[] | undefined): PageDefinition[] {
    return node.children.flatMap((child) => {
      if (isSenseMarker(child.marker)) return [];
      if (isWhollyItalic(child.body)) {
        const rendered = renderInline(child.body, this.page.title);
        if (examples !== undefined && rendered.rendered && rendered.text !== "") {
          examples.push({ text: rendered.text, ref: this.ref(child.line), wikitext: child.wikitext });
        }
        return [];
      }
      const rendered = renderInline(child.body, this.page.title);
      const term = rendered.rendered ? boldSubTerm(rendered.runs) : undefined;
      if (term !== undefined) return this.definition(child, { route: "sub-term", term }, leadIn);
      if (leadIn !== null && hasPlainProse(child.body)) return this.definition(child, { route: "lead-in-item" }, leadIn);
      return [];
    });
  }

  senseLine(node: ListLine): PageSenseLine {
    const ref = this.ref(node.line);
    const text = readSenseLine(node.body, this.page.title);
    if (hasPlainProse(node.body)) {
      const rendered = renderInline(node.body, this.page.title);
      const leadIn: LeadIn | null =
        rendered.rendered && leadsIn(rendered.text) ? { ref, text: rendered.text, on: "sense-line" } : null;
      return { kind: "sense", ref, wikitext: node.wikitext, text, below: this.below(node, leadIn, undefined) };
    }
    // `{{Nodef}}` says the page gives no definition here, so a line below it is
    // not one by position: `fondarsi` puts a plain usage sentence there. Only a
    // bold sub-term that goes on to define itself is still a definition
    // (`colorito`: `'''espressione colorita''': utilizzo di termini volgari…`).
    if (NO_DEFINITION.test(node.body)) {
      return { kind: "page-control", ref, wikitext: node.wikitext, text, below: this.below(node, null, undefined) };
    }
    const below = node.children.flatMap((child) =>
      !isSenseMarker(child.marker) && hasPlainProse(child.body) && !isWhollyItalic(child.body)
        ? this.definition(child, { route: "below-page-control" }, null)
        : [],
    );
    return { kind: "page-control", ref, wikitext: node.wikitext, text, below: [...this.wrapped(node), ...below] };
  }

  /**
   * The definition a page control's item wrapped onto the next physical line.
   * The usage labels on the `#` line label it: they open the same item. Only
   * a page control's item is read this way. After a `#` line that states a
   * meaning, the next line is the rest of a gloss the record already holds,
   * or a note, and after `{{Nodef}}` the page says it has no definition.
   */
  wrapped(node: ListLine): PageDefinition[] {
    if (node.wrapped === null) return [];
    const { line, wikitext } = node.wrapped;
    const { labels } = expandTemplates(node.body, this.page.title, () => " ");
    const prose: ListLine = { line, marker: "", body: wikitext, wikitext, wrapped: null, children: [] };
    return this.definition(prose, { route: "wrapped-prose" }, null, labels);
  }
}

/**
 * Every part-of-speech section of the page's Italian section, with its `#`
 * lines read as senses or page controls and the definitions below them.
 */
export function readItalianSections(page: RawPage): PageSection[] {
  const lines = page.wikitext.split("\n");
  const sections: { posTemplate: string; list: Omit<ListLine, "children">[] }[] = [];
  let inItalian = false;
  let current: (typeof sections)[number] | undefined;
  /** The `#` line on the physical line just read, which the next line may continue. */
  let open: Omit<ListLine, "children"> | undefined;
  lines.forEach((raw, index) => {
    const before = open;
    open = undefined;
    const line = raw.replace(/\s+$/, "");
    const language = LANGUAGE_HEADING.exec(line);
    if (language !== null) {
      inItalian = language[1].toLowerCase() === "it";
      current = undefined;
      return;
    }
    if (!inItalian) return;
    const pos = POS_HEADING.exec(line.trim());
    if (pos !== null) {
      current = { posTemplate: pos[1], list: [] };
      sections.push(current);
      return;
    }
    if (OTHER_HEADING.test(line.trim())) {
      current = undefined;
      return;
    }
    if (current === undefined) return;
    const item = LIST_LINE.exec(line);
    if (item !== null) {
      const entry: Omit<ListLine, "children"> = { line: index + 1, marker: item[1], body: item[2], wikitext: raw, wrapped: null };
      current.list.push(entry);
      if (isSenseMarker(entry.marker)) open = entry;
    } else if (before !== undefined && continuesItem(line)) {
      before.wrapped = { line: index + 1, wikitext: raw };
    }
  });

  return sections.map(({ posTemplate, list }) => {
    const reader = new SectionReader(page);
    const senseLines = listTree(list)
      .filter((node) => isSenseMarker(node.marker))
      .map((node) => reader.senseLine(node));
    return {
      posTemplate,
      posTitle: POS_TITLE_BY_TEMPLATE[posTemplate],
      senseLines,
      unrendered: reader.unrendered,
    };
  });
}

/**
 * The usage labels in the lead-in before a numbered meaning, written the way a
 * printed dictionary writes them: `v. tr. (dismago, dismaghi, ecc.), arc.`.
 * The first comma-separated part is the grammar and the bracket holds forms;
 * every part after the grammar is a label, as the page writes it (`arc.`).
 */
function leadInLabels(leadIn: string): string[] {
  const [, ...labels] = collapse(withoutTemplates(leadIn).replace(/\([^()]*\)/g, " ")).split(",").map(collapse);
  return labels.filter((label) => hasLetters(label));
}

/**
 * The definitions a page-only section's `#` list states, in page order: a `#`
 * line with prose is one, and below a page control the lines it marks are.
 */
function listDefinitions(reader: SectionReader, list: readonly Omit<ListLine, "children">[]): PageDefinition[] {
  return listTree(list).flatMap((node) => {
    if (!isSenseMarker(node.marker)) return [];
    if (NO_DEFINITION.test(node.body)) return [];
    if (hasPlainProse(node.body)) return reader.definition(node, { route: "sense-line" }, null);
    return reader.senseLine(node).below;
  });
}

/** The three verb layouts ruled in ADR 0024, without changing record-backed recovery. */
export function readRuledVerbSections(page: RawPage): { ref: RawPageRef; wikitext: string; definitions: PageDefinition[] }[] {
  const sections: { line: number; wikitext: string; handwritten: boolean; list: Omit<ListLine, "children">[]; prose: ProseLine[]; aboveHeading: ProseLine[] }[] = [];
  let italian = false;
  let current: (typeof sections)[number] | undefined;
  let hasPos = false;
  let hasLanguageHeading = false;
  /** Plain prose between the language heading and the first heading or section after it. */
  let aboveHeading: ProseLine[] = [];
  let aboveHeadingOpen = false;
  const hasStandardLanguageHeading = page.wikitext.split("\n").some((line) => /^==[^=]/.test(line.trim()));
  const open = (index: number, raw: string, handwritten: boolean) => {
    current = { line: index + 1, wikitext: raw, handwritten, list: [], prose: [], aboveHeading };
    sections.push(current);
    aboveHeading = [];
    aboveHeadingOpen = false;
  };
  for (const [index, raw] of page.wikitext.split("\n").entries()) {
    const line = raw.trim();
    // A bare part-of-speech template (`{{-verb-}}`) is a part-of-speech heading, never a language (piallare).
    const barePos = /^\{\{-([a-z][a-z ]*?)-\}\}$/.exec(line);
    if (barePos !== null && POS_TITLE_BY_TEMPLATE[barePos[1]] !== undefined) {
      hasPos = true;
      current = undefined;
      aboveHeadingOpen = false;
      continue;
    }
    const language = LANGUAGE_HEADING.exec(line) ?? /^\{\{-([A-Za-z-]+)-\}\}$/.exec(line);
    if (language !== null || /^==[^=].*[^=]==$/.test(line)) {
      hasLanguageHeading = true;
      italian = language?.[1].toLowerCase() === "it";
      current = undefined;
      hasPos = false;
      aboveHeading = [];
      aboveHeadingOpen = italian;
      continue;
    }
    const pos = POS_HEADING.exec(line);
    if (pos !== null) {
      // A language-qualified POS can state Italian even when the language heading is absent (fornire).
      if (!hasLanguageHeading && pos[1] === "verb") italian = true;
      hasPos = true;
      current = undefined;
      aboveHeadingOpen = false;
      continue;
    }
    const transitivity = /^\{\{(?:Transitivo|Intransitivo)\|it\}\}$/.test(line);
    const handwritten = line === "'''''Verbo'''''";
    if (italian && ((transitivity && !hasPos) || handwritten)) {
      open(index, raw, handwritten);
      continue;
    }
    // The explicit Italian verb heading with no language section is itself unreadable by the extraction.
    if (italian && transitivity && hasPos && !hasStandardLanguageHeading) {
      open(index, raw, false);
      hasPos = false;
      continue;
    }
    if (aboveHeadingOpen && continuesItem(line)) {
      aboveHeading.push({ line: index + 1, wikitext: raw });
      continue;
    }
    if (OTHER_HEADING.test(line) || /^={3,}/.test(line)) {
      current = undefined;
      continue;
    }
    if (current === undefined) continue;
    const item = LIST_LINE.exec(raw);
    if (item !== null) current.list.push({ line: index + 1, marker: item[1], body: item[2], wikitext: raw, wrapped: null });
    else if (current.handwritten && line !== "") current.prose.push({ line: index + 1, wikitext: raw });
  }
  return sections.map((section) => {
    const reader = new SectionReader(page);
    const ref = reader.ref(section.line);
    if (section.aboveHeading.length > 0) {
      // The page wrote its definition above the heading; the `#` list under it then holds something else.
      const definitions = section.aboveHeading.flatMap((prose) =>
        reader.definition({ ...prose, marker: "", body: prose.wikitext, wrapped: null, children: [] }, { route: "above-heading-prose" }, null));
      return { ref, wikitext: section.wikitext, definitions: definitions.filter((definition) => definition.text !== "") };
    }
    const definitions = listDefinitions(reader, section.list);
    for (const prose of section.prose) {
      // Bold ordinal markers delimit meanings; the bracketed etymology is not a definition.
      const numbered = [...prose.wikitext.matchAll(/'''\d+\.'''\s*([\s\S]*?)(?='''\d+\.'''|$)/g)];
      const labels = numbered.length > 0 ? leadInLabels(prose.wikitext.slice(0, numbered[0].index)) : [];
      for (const match of numbered) {
        const body = match[1].replace(/\s*\[[^\]]*\]\.?\s*$/, "").trim();
        definitions.push(...reader.definition({ ...prose, marker: "", body, wrapped: null, children: [] }, { route: "numbered-prose" }, null, labels));
      }
    }
    return { ref, wikitext: section.wikitext, definitions: definitions.filter((definition) => definition.text !== "") };
  });
}

// --- Every measured layout (ADR 0028) ---------------------------------------
//
// The page-only rule reads layout the way the 2026-10-03 measurement's
// detector does (src/import/measureUnrecordedPages.ts), so the pages it admits
// are the pages that report counted. It reads no definition text to decide a
// part of speech: only the markers and headings below.

/** How a page marks its Italian section. */
export type LanguageMark =
  | "standard" // `== {{-it-}} ==`
  | "malformed" // `{{-it-}}` in a heading line of another shape: `= {{-it-}} =`, `[[]]== {{-it-}} ==`
  | "bare" // `{{-it-}}` alone on a line
  | "none"; // no Italian marker; a `{{-sost-|it}}`-style heading states the language

/** What opens a part-of-speech section. */
export type PosSignal =
  | "template" // `{{-sost-|it}}`
  | "spaced-template" // `{{-sost  form-|it}}`, ` {{-sost-|it}}`: a known template with stray spaces
  | "added-template" // `{{-loc veb-|it}}`, `{{-pron-|it}}`: the two ADR 0028 adds to the table
  | "bare-template" // `{{-sost-}}`
  | "verb-label" // `{{Transitivo|it}}`, `{{Intransitivo|it}}`, `{{Riflessivo|it}}` with no section open
  | "italian-heading" // `=== Verbo transitivo ===`, `'''''Verbo'''''`
  | "english-heading" // `===Verb===`: states no Italian part of speech
  | "unknown-template"; // a template no table knows: states none

/** One section holding Italian definitions, and the part of speech it states, if any. */
export interface StatedSection {
  signal: PosSignal;
  posTitle: PosTitle | null;
  /** The line that opened the section. */
  ref: RawPageRef;
  wikitext: string;
  /** Its definitions in page order. */
  definitions: PageDefinition[];
}

/** A page's Italian part-of-speech sections, read from its layout alone. */
export interface StatedLayout {
  language: LanguageMark;
  /** Every section holding an Italian `#` line that states a meaning, in page order. */
  sections: StatedSection[];
  /** Italian `#` lines that state a meaning and sit in no section. */
  unplaced: number;
  /** The page carries `{{Trasfen}}`: copied from English Wiktionary. */
  englishCopy: boolean;
}

/**
 * The two templates ADR 0028 reads beyond `POS_TITLE_BY_TEMPLATE`, only in the
 * `{{-x-|it}}` form: a bare `{{-pron-}}` opens the pronunciation section.
 */
const ADDED_POS_TITLE_BY_TEMPLATE: Readonly<Record<string, PosTitle>> = { "loc veb": "Locuzione verbale", pron: "Pronome" };

/** Section templates that are not a language: `{{-sill-}}`, `{{-trad-}}`… */
const SECTION_TEMPLATES = new Set([
  "sill", "pron", "etim", "trad", "ref", "sin", "ant", "rel", "der", "var", "alter", "prov", "quote",
  "uso", "noconf", "decl", "coni", "iperon", "ipon", "example", "hyph", "cod",
]);

const titleIn = (table: Readonly<Record<string, PosTitle>>, name: string): PosTitle | undefined =>
  Object.hasOwn(table, name) ? table[name] : undefined;
/** `loc  verb` and `agg  form` are written with doubled spaces; the table spells them single. */
const spacedOnce = (name: string): string => name.trim().replace(/\s+/g, " ");
/** A language code as a `{{-xx-}}` marker spells it. */
const isLanguageCode = (name: string): boolean =>
  /^[a-z]{2,3}(?:-[a-z]{2,3})?$/.test(name) && !SECTION_TEMPLATES.has(name) && titleIn(POS_TITLE_BY_TEMPLATE, spacedOnce(name)) === undefined;

const ITALIAN_POS_TITLES = new Map(Object.values(POS_TITLE_BY_TEMPLATE).map((title) => [title.toLowerCase(), title]));
const ENGLISH_POS_HEADING = /^(?:verb|noun|adjective|adverb|adverbial phrase|preposition|conjunction|conjunction phrase|interjection|pronoun|phrase|proper noun)$/i;
const REDIRECT = /^#\s*(?:rinvia|redirect)\b/i;
const STATED_SENSE_LINE = /^(#+)(?![#*:])\s*(.*)$/;

/**
 * Whether a `#` line states something in plain text beyond the headword: not
 * only templates (`{{Nodef|it}}`), italics (a gender stamp, `''m''`) and the
 * bold headword (`'''carciofino''' ''m'';`).
 */
function statesMeaning(body: string, title: string): boolean {
  let text = body.replace(/<!--[\s\S]*?-->|<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>|<[^>]+>/g, " ");
  for (let previous = ""; previous !== text; ) {
    previous = text;
    text = text.replace(/\{\{[^{}]*\}\}/g, " ");
  }
  text = text
    .replace(/\[\[(?:[^[\]|]*\|)?([^[\]]*)\]\]/g, "$1")
    .replace(/'{5}[^']*'{5}/g, " ")
    .replace(/'{3}([^']*)'{3}/g, "$1")
    .replace(/'{2}[^']*'{2}/g, " ")
    .replace(/'{2,}/g, "");
  return /\p{L}/u.test(text.split(title).join(" "));
}

/** What a line opens. `italian` is the language the opener itself states, if any. */
type Opener = { signal: PosSignal; posTitle: PosTitle | null; italian: boolean | undefined };

/** `{{-sost-|it}}`, with or without stray spaces, or one of the two added templates. */
function templateOpener(raw: string, line: string): Opener | undefined {
  const match = /^\{\{-([a-z][a-z \-]*?)-\|(\s*)([a-z-]+)(\s*)\}\}$/.exec(line);
  if (match === null) return undefined;
  const name = spacedOnce(match[1]);
  const italian = match[3] === "it";
  const known = titleIn(POS_TITLE_BY_TEMPLATE, name);
  if (known !== undefined) {
    const spaced = /^\s/.test(raw) || match[1] !== name || match[2] !== "" || match[4] !== "";
    return { signal: spaced ? "spaced-template" : "template", posTitle: known, italian };
  }
  const added = titleIn(ADDED_POS_TITLE_BY_TEMPLATE, name);
  if (added !== undefined) return { signal: "added-template", posTitle: added, italian };
  return { signal: "unknown-template", posTitle: null, italian };
}

/** `{{-verb-}}` with no language: a part-of-speech heading, never a language (`piallare`). */
function bareTemplateOpener(line: string): Opener | undefined {
  const match = /^\{\{-([a-z][a-z ]*?)-\}\}$/.exec(line);
  const posTitle = match === null ? undefined : titleIn(POS_TITLE_BY_TEMPLATE, spacedOnce(match[1]));
  return posTitle === undefined ? undefined : { signal: "bare-template", posTitle, italian: undefined };
}

/** `{{Transitivo|it}}` where no section is open states a verb (`raccontare`, `accerchiarsi`). */
function verbLabelOpener(line: string, sectionOpen: boolean): Opener | undefined {
  return !sectionOpen && /^\{\{(?:Transitivo|Intransitivo|Riflessivo)\|it\}\}$/.test(line)
    ? { signal: "verb-label", posTitle: "Verbo", italian: true }
    : undefined;
}

/** A written title: `=== Verbo transitivo ===`, `'''''Verbo'''''`, or an English `===Verb===`. */
function writtenTitleOpener(line: string): Opener | undefined {
  const heading = /^(={1,6})\s*(.*?)\s*\1$/.exec(line)?.[2];
  const written = heading ?? /^'''''([^']+)'''''$/.exec(line)?.[1];
  if (written === undefined || written.includes("{{")) return undefined;
  const posTitle = ITALIAN_POS_TITLES.get(written.toLowerCase().replace(/\s+(?:transitivo|intransitivo|riflessivo)$/, ""));
  if (posTitle !== undefined) return { signal: "italian-heading", posTitle, italian: undefined };
  if (ENGLISH_POS_HEADING.test(written)) return { signal: "english-heading", posTitle: null, italian: undefined };
  return undefined;
}

/**
 * The page's Italian part-of-speech sections and how it marks Italian. A
 * section is Italian when its language marker or its opener says so and
 * neither names another language.
 */
export function readStatedSections(page: RawPage): StatedLayout {
  type Open = Opener & { line: number; wikitext: string; isItalian: boolean; stated: number; list: Omit<ListLine, "children">[] };
  /** The language the latest marker opened; `undefined` before any marker, `""` after a heading that ends it. */
  let language: string | undefined;
  let mark: LanguageMark = "none";
  let section: Open | undefined;
  const sections: Open[] = [];
  let unplaced = 0;
  for (const [index, raw] of page.wikitext.split("\n").entries()) {
    const line = raw.trim();
    const marker = /\{\{-([a-z][a-z-]*)-\}\}/.exec(line);
    if (marker !== null && isLanguageCode(marker[1]) && (line === marker[0] || line.includes("="))) {
      language = marker[1];
      if (language === "it" && mark === "none") {
        mark = line === marker[0] ? "bare" : /^==\s*\{\{-it-\}\}\s*==$/.test(line) ? "standard" : "malformed";
      }
      section = undefined;
      continue;
    }
    if (/^==[^=].*[^=]==$/.test(line)) {
      // A level-two heading with no language marker (`== Altri progetti ==`) ends every section.
      language = language === undefined ? undefined : "";
      section = undefined;
      continue;
    }
    const opener = templateOpener(raw, line) ?? bareTemplateOpener(line) ?? verbLabelOpener(line, section !== undefined) ?? writtenTitleOpener(line);
    if (opener !== undefined) {
      const scope = language === undefined ? undefined : language === "it";
      const isItalian = scope === false || opener.italian === false ? false : scope === true || opener.italian === true;
      section = { ...opener, line: index + 1, wikitext: raw, isItalian, stated: 0, list: [] };
      sections.push(section);
      continue;
    }
    if (/^\{\{-/.test(line) || /^=/.test(line)) {
      section = undefined;
      continue;
    }
    const sense = STATED_SENSE_LINE.exec(line);
    if (sense !== null && !REDIRECT.test(line) && statesMeaning(sense[2], page.title)) {
      if (section === undefined && language === "it") unplaced += 1;
      if (section !== undefined) section.stated += 1;
    }
    const item = section === undefined ? null : LIST_LINE.exec(line);
    if (section !== undefined && item !== null) {
      section.list.push({ line: index + 1, marker: item[1], body: item[2], wikitext: raw, wrapped: null });
    }
  }
  const held = sections.filter((item) => item.isItalian && item.stated > 0);
  return {
    language: mark,
    sections: held.map((item) => {
      const reader = new SectionReader(page);
      return {
        signal: item.signal,
        posTitle: item.posTitle,
        ref: reader.ref(item.line),
        wikitext: item.wikitext,
        definitions: listDefinitions(reader, item.list).filter((definition) => definition.text !== ""),
      };
    }),
    unplaced,
    englishCopy: /\{\{\s*Trasfen\s*[|}]/i.test(page.wikitext),
  };
}
