// The utility classes each part of the page is drawn with, named once.
//
// ADR 0010 makes Tailwind the styling language and role tokens the only colours
// a component may reach for. The classes live here rather than inline in the
// markup for two reasons: a part drawn the same way in three places is one
// string, not three that drift apart, and `web/test/page.test.tsx` imports these
// same constants, so a test asserting a rendered class asserts the string the
// component actually carries instead of a copy of it.
//
// Every colour here is a role from design-system-manifest.md § "Role tokens: the
// dark scheme" — `bg-surface`, `text-text-muted`, `border-border-strong` and so
// on — declared in `globals.css`. No literal colour appears in this file or in
// any component, and `web/test/tokens.test.ts` fails the build if one is added.
//
// The sizes follow the design boards in `lexema-design.pen` (boards 08 to 21)
// read at 1440 px. Three faces, three jobs: labels and controls are sans; the
// source's Italian prose — headword, definitions, examples, etymology,
// synonyms — is serif; word forms, articles and pronunciation are mono.
//
// Below Tailwind's `sm` breakpoint the page is laid out for a phone, as boards
// 19 to 21 draw it at 390 px. A phone-only rule is a `max-sm:` variant beside
// the wide one, so from `sm` up the page is the one the wide boards draw.

/**
 * The one column every page on both sites is laid out in, and the chrome lines
 * up with. At 1440 px its content starts at x = 120, where frames 10 to 34
 * draw the header name, the page's first row, the legal pages' Contents and
 * the footer (#581). On a phone it is 20 px in, where frames 19 to 21 draw the
 * word pages and frames 33m to 36m the legal pages (#588, #595).
 */
const COLUMN = "mx-auto w-full max-w-[78rem] px-5 sm:px-6";

/** The focus ring the manifest rules: `accent`, and never removed. */
const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** The dark scheme itself: `surface` under everything, `text` on top of it. */
export const BODY = "flex min-h-screen flex-col bg-surface font-serif text-base text-text";

export const LINK = `text-accent underline ${FOCUS_RING}`;

// Page chrome -------------------------------------------------------------

/**
 * C1: a full-width bar, the name at the left, a hairline under it. The bar is
 * 72 px from `sm` up, as frames 10 to 34 draw it (#593), and 61 px on a phone,
 * as frames 19 to 21, 33m and 34m draw it, with the name's ink 23 px from the
 * top (#595).
 */
export const TOP_BAR = "border-b border-border";
export const TOP_BAR_INNER = `${COLUMN} flex h-15.25 items-center pt-0.5 sm:h-18 sm:pt-0`;
/**
 * The name is 22px from `sm` up, as frames 33 and 34 draw it (#593). On a phone
 * the name, and the footer's name and links below, are drawn at the smaller
 * sizes frames 19 to 21, 33m and 34m give them, on every dictionary page
 * (#591, #595).
 */
export const TOP_BAR_NAME = `font-serif text-[1.375rem] text-text-strong no-underline max-sm:text-[1.1875rem] ${FOCUS_RING}`;

/**
 * C2: the name at the left, three small links at the right. Its rule sits
 * 45 px below the page from `sm` up, with the shell's own bottom padding, and
 * its name's ink 32 px under the rule, as frames 10 to 34 draw them. On a
 * phone the links stack under the name, both at the left, with the name's ink
 * 26 px under the rule, as frames 19 to 21, 33m and 34m draw it (#595).
 */
export const SITE_FOOTER = "mt-5 border-t border-border sm:mt-7.25";
export const SITE_FOOTER_INNER = `${COLUMN} flex flex-col items-start gap-0.75 pt-5 pb-5.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:pt-6.25 sm:pb-7.25`;
/** The footer's wordmark, a link home like the top bar's. */
export const SITE_FOOTER_NAME = `font-serif text-base text-text-strong no-underline max-sm:text-[0.90625rem] ${FOCUS_RING}`;
export const SITE_FOOTER_LINKS = "m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 max-sm:gap-x-4.5";
/** 12.5 px from `sm` up, as frames 33 and 34 draw it (#595); the link to the page being shown is drawn in `text-strong`. */
export const SITE_FOOTER_LINK = `font-sans text-[0.78125rem] text-text-muted no-underline hover:text-text aria-[current=page]:text-text-strong max-sm:text-[0.703125rem] ${FOCUS_RING}`;

/**
 * Frame 00: before a query the page is the name and the bar, centred on the
 * screen, with nothing else competing (design-system-manifest.md § "The page").
 */
export const SHELL_CENTRED = `${COLUMN} flex flex-1 flex-col items-center justify-center pt-22 pb-10 text-center`;
/** Frame 00 at 1440: the name 63 px. */
export const HOME_NAME = "m-0 font-serif text-[3.9375rem] leading-none font-normal text-text-strong";
/**
 * Under the wordmark on the home page: its pronunciation in mono, muted, then
 * what it is in italic serif, in `text`. Frame 00 draws both, at 13 px and
 * 19 px (#596).
 */
export const HOME_PRONUNCIATION = "m-0 mt-[1.9375rem] font-mono text-[0.8125rem] text-text-muted";
export const HOME_TAGLINE = "m-0 mt-[0.3125rem] mb-[2.5625rem] font-serif text-[1.1875rem] italic text-text";

/**
 * With a query: the bar at the top of the column, the word below it. The
 * column grows to fill the window, so on a short page the footer sits at the
 * bottom of the window and the extra room falls between Source and the
 * footer; the Source line's own gap below it (design-system-manifest.md §
 * "Layout") is the minimum, and a long page is unchanged. The first row sits
 * 28 px under the top bar's rule from `sm` up, as frames 10 to 32 draw it, and
 * 16 px on a phone, as frames 19 to 21 draw it (#595).
 */
export const SHELL_TOP = `${COLUMN} flex-1 pt-4 pb-3.25 sm:pt-7 sm:pb-4`;

// The search field --------------------------------------------------------

/**
 * Where the one field sits: `centred` on the home page before a query, `top`
 * above a result. Frame 00 draws the centred field larger than the result
 * frames draw the top one, so each part whose size differs is keyed by it
 * (#596).
 */
export type SearchPlacement = "centred" | "top";

/**
 * Border included: frame 00 at 1440 draws the centred box 642 x 61 px; frame
 * 10 draws the top box 561 x 57 px, and frame 19 at 390 draws it 49 px tall
 * (#596).
 */
export const SEARCH_FORM: Record<SearchPlacement, string> = {
  centred: "w-full max-w-[40.125rem]",
  top: "w-full max-w-[35.0625rem]",
};
const FIELD =
  "relative flex w-full items-center rounded-[4px] border border-border-strong bg-surface-raised focus-within:border-accent";
export const SEARCH_FIELD: Record<SearchPlacement, string> = {
  centred: `${FIELD} h-[3.8125rem]`,
  top: `${FIELD} h-[3.0625rem] sm:h-[3.5625rem]`,
};
export const SEARCH_ICON: Record<SearchPlacement, string> = {
  centred: "pointer-events-none absolute left-5 size-5 text-text-muted",
  top: "pointer-events-none absolute left-[0.8125rem] size-[0.9375rem] text-text-muted sm:left-[1.0625rem] sm:size-4",
};
/**
 * The browser's own clear button on a `type="search"` field is hidden: it is
 * drawn in the browser's blue, not a role, and sat on top of the field's own
 * `×` and `ENTER` hint once typing opened the suggestion list.
 */
export const SEARCH_INPUT: Record<SearchPlacement, string> = {
  centred:
    "w-full min-w-0 bg-transparent py-3 pr-24 pl-[3.375rem] font-serif text-lg text-text-strong outline-none placeholder:font-sans placeholder:text-[1.0625rem] placeholder:text-text-muted [&::-webkit-search-cancel-button]:appearance-none",
  top: "w-full min-w-0 bg-transparent py-3 pr-24 pl-[2.375rem] font-serif text-[1.0625rem] text-text-strong outline-none placeholder:font-sans placeholder:text-base placeholder:text-text-muted sm:pl-[2.875rem] sm:text-lg [&::-webkit-search-cancel-button]:appearance-none",
};
/**
 * The right end of the bar: the shortcut hint, the `ENTER` hint and the `×`,
 * in one row centred on the input. Each sits in a box of the same height with
 * its glyph centred in it, so their centres line up with each other and with
 * the typed text.
 */
export const SEARCH_TRAILING: Record<SearchPlacement, string> = {
  centred: "pointer-events-none absolute inset-y-0 right-4 flex items-center gap-1.5",
  top: "pointer-events-none absolute inset-y-0 right-1.5 flex items-center gap-1.5 sm:right-3",
};
const TRAILING_BOX = "flex h-7 items-center leading-none";
/**
 * Capitals and `⌘` are drawn higher in their line than `×`; measured, the
 * key hints' ink sat 1.5 px above the `×`'s, so they are nudged down by that.
 */
const KEY_NUDGE = "translate-y-[0.09375rem]";
export const SEARCH_CLEAR = `${TRAILING_BOX} pointer-events-auto w-7 justify-center font-sans text-lg text-text-muted no-underline hover:text-text ${FOCUS_RING}`;
export const SEARCH_HINT = `${TRAILING_BOX} ${KEY_NUDGE} px-1 font-sans text-[0.65rem] tracking-[0.12em] text-text-muted`;
/**
 * `⌘K` / `Ctrl K`, the shortcut back to the field, shown while it does not
 * have focus: in the hint's place, or left of the `×`. Hidden on a touch-only
 * screen, which has no keys to press.
 */
export const SEARCH_SHORTCUT = `${TRAILING_BOX} ${KEY_NUDGE} px-1 font-sans text-[0.7rem] tracking-[0.08em] text-text-muted [@media(hover:none)_and_(pointer:coarse)]:hidden`;

/**
 * The suggestion list under the field. No frame draws it, so it takes the
 * field's own parts: `surface-raised` with a hairline `border`, as wide as the
 * field, and the source's spellings in the serif the field is typed in. The
 * highlighted row is outlined in `accent`, and carries the field's own `ENTER`
 * hint in words, so it is never marked by colour alone. It is never taller than
 * the room left under the field — on a phone, the room above the open keyboard —
 * and scrolls within itself instead.
 */
export const SUGGEST_POPUP =
  "max-h-[var(--available-height)] w-[var(--anchor-width)] max-w-[var(--available-width)] overflow-y-auto rounded-[4px] border border-border bg-surface-raised p-1 text-left";
export const SUGGEST_LIST = "outline-none";
export const SUGGEST_ITEM =
  "group flex cursor-default items-baseline justify-between gap-4 rounded-[4px] border-2 border-transparent px-3 py-1 font-serif text-lg text-text select-none data-highlighted:border-accent data-highlighted:text-text-strong";
export const SUGGEST_ITEM_HINT =
  "invisible font-sans text-[0.65rem] tracking-[0.12em] text-accent group-data-highlighted:visible";
/** No suggestions, or none could be read: said in words, in the list's place. */
export const SUGGEST_NOTE = "px-3 py-2 font-sans text-[0.85rem] text-text-muted";

/**
 * Frame 00: `Try` and a row of chips under the field, 10 px apart. Each chip
 * is a 32 px tall hairline box on the page's own `surface` (#596).
 */
export const TRY_ROW = "mt-[2.5625rem] flex flex-wrap items-center justify-center gap-2.5";
export const TRY_LABEL = "font-sans text-[0.8125rem] text-text-muted";
export const TRY_CHIP = `inline-flex h-8 items-center rounded-[3px] border border-border px-2.5 font-serif text-sm text-text no-underline hover:border-border-strong ${FOCUS_RING}`;

// What the page says about itself ----------------------------------------

const MESSAGE = "my-6 font-sans text-[0.95rem]";

/** Every place the page says the source is silent. */
export const EMPTY = `${MESSAGE} text-text-muted`;
/** A lookup that could not run, or a query the page refused. */
export const ERROR = `${MESSAGE} text-warning`;
/** A small aside beside a value. */
export const MUTED = "font-sans text-[0.85rem] text-text-muted";

// The result ----------------------------------------------------------------
//
// design-system-manifest.md § "The result": one layout for every word type,
// no box around a reading, thin rules between readings. Serif for the source's
// prose, sans for labels and controls, mono for forms, articles and the IPA.

/**
 * A headword longer than a phone is wide breaks rather than pushing the page
 * sideways: `precipitevolissimevolmente` is one word.
 */
export const WORD_HEADING =
  "m-0 mt-[2.625rem] font-serif text-[3rem] leading-none font-normal break-words text-text-strong sm:mt-[3.6875rem] sm:text-[4.5rem]";
/** The IPA under the headword. */
export const PRONUNCIATION = "m-0 mt-[0.9375rem] font-mono text-[0.8125rem] text-text-muted sm:mt-[1.5625rem] sm:text-[0.9375rem] sm:leading-5";
export const PRONUNCIATION_NOTE = "ml-2 font-sans text-[0.75rem]";

/** Jump links, one per reading, for three readings or more. Numbers are tabular, as the frames set them. */
export const JUMP_LINKS = "m-0 mt-2.5 flex list-none flex-wrap gap-x-3.5 gap-y-1 p-0 sm:mt-[1.375rem] sm:gap-x-[1.125rem]";
export const JUMP_LINK = `font-sans text-[0.78125rem] text-text no-underline sm:text-[0.8125rem] ${FOCUS_RING}`;
export const JUMP_NUMBER = "mr-1.5 text-accent tabular-nums";

/**
 * The page's vertical rhythm, as frames 10 to 23 draw it at 1440 and frames 19
 * to 21 at 390 (wide / phone, #596). The first reading starts 57 / 37 px under
 * the headword, 39 / 24 under its pronunciation and 32 / 20 under the jump
 * links. A rule between readings, and the one before the word's own facts,
 * has 39 px above and below it on a wide screen, 27 and 26 on a phone. Blocks
 * inside a reading are 22 / 18 apart; the word's own blocks 28 / 24; Source
 * 48 / 36. Each gap is the top edge of the thing below it, so an empty section
 * adds nothing.
 */
export const READINGS = "mt-[2.3125rem] [p+&]:mt-6 [nav+&]:mt-5 sm:mt-[3.5625rem] sm:[p+&]:mt-[2.4375rem] sm:[nav+&]:mt-8";
/** A reading: a heading and its blocks, with a thin rule before every one after the first. */
export const READING =
  "scroll-mt-6 mt-[1.6875rem] border-t border-border pt-6.5 first:mt-0 first:border-t-0 first:pt-0 sm:mt-[2.4375rem] sm:pt-[2.4375rem]";
export const READING_HEADING =
  "m-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 font-sans text-[0.875rem] font-semibold text-text-strong sm:text-[0.95rem]";
export const READING_NUMBER = "font-normal text-accent tabular-nums";
export const READING_DOT = "font-normal text-text-muted";
/** The record's own gender and number after the part of speech, muted: `maschile, singolare`. */
export const READING_GRAMMAR = "font-normal text-text-muted";
export const READING_GRAMMAR_GROUP = "inline-flex items-baseline gap-2.5";

/** A small grey label over a block: Definitions, Forms, Etymology, Synonyms. */
export const BLOCK = "mt-[1.125rem] sm:mt-[1.375rem]";
/** A block of the word's own facts, after the readings; the first sits right under the rule. */
export const WORD_BLOCK = "mt-6 first:mt-0 sm:mt-7";
export const BLOCK_LABEL = "m-0 mb-[0.3125rem] font-sans text-[0.75rem] font-normal text-text-muted sm:mb-1.5 sm:text-[0.8rem]";
export const BLOCK_LABEL_WORD = "ml-2 font-semibold text-text-strong";

/** `Form of andare`: a lemma the gloss does not write, linked on a line of its own. */
export const FORM_OF_LINE = "m-0 mt-4 font-sans text-[0.85rem] text-text-muted";

export const DEFINITIONS = "m-0 flex list-none flex-col gap-4 p-0";
export const DEFINITION = "flex gap-[0.4375rem] sm:gap-3";
/** A definition after the first: in the document, shown once the reading's `+ more` is open. */
export const DEFINITION_EXTRA = "hidden gap-[0.4375rem] group-data-open/definitions:flex sm:gap-3";
export const DEFINITION_NUMBER = "w-5 shrink-0 pt-1 font-mono text-[0.85rem] text-text-muted sm:pt-0 sm:leading-[1.125rem]";
/**
 * A searched expression's form line numbers what shows (Phrase.tsx): closed,
 * it follows the first meaning; open, the folded meanings between them count.
 */
export const DEFINITION_NUMBER_CLOSED = "group-data-open/definitions:hidden";
export const DEFINITION_NUMBER_OPEN = "hidden group-data-open/definitions:inline";
export const DEFINITION_BODY = "min-w-0 flex-1";
export const GLOSS = "m-0 max-w-[48rem] font-serif text-[1.0625rem] leading-[1.625rem] text-text-strong wrap-anywhere sm:py-px sm:text-[1.1875rem] sm:leading-7";
export const SENSE_LABEL = "italic text-text-muted";
/** The word a form-of definition names, linked to its own search. */
export const GLOSS_LINK = `text-accent no-underline ${FOCUS_RING}`;
/** The items of a list a definition opens with a colon (#123), nested under it. */
export const SUB_ITEMS = "mt-2 mb-0 flex list-disc flex-col gap-2 pl-5 marker:text-text-muted";
export const EXAMPLE = "m-0 mt-1 max-w-[48rem] font-serif text-[0.9375rem] italic text-text-muted sm:mt-[0.3125rem] sm:text-base";
/** An example past the first definition's first: in the document, shown once `+ more` is open. */
export const EXAMPLE_EXTRA = `${EXAMPLE} hidden group-data-open/definitions:block`;
/** An example of a sense not shown as a definition, after the definitions, in line with their text. */
export const EXAMPLE_LOOSE = `${EXAMPLE_EXTRA} ml-[1.6875rem] sm:ml-8`;
/** A reading's definitions and the one `+ more` after them, which reveals everything else: `data-open` once open. */
export const DEFINITIONS_GROUP = "group/definitions";

/**
 * The one expand control, `+ more` closed and `less` open (More.tsx): small,
 * in the accent, in the flow of the text it ends. Base UI marks the open
 * trigger `data-panel-open`.
 */
export const MORE_TRIGGER = `group inline cursor-pointer font-sans text-[0.8rem] text-accent ${FOCUS_RING}`;
export const MORE_CLOSED = "group-data-panel-open:hidden";
export const MORE_OPEN = "hidden group-data-panel-open:inline";
/** Under the definitions, at the column's edge, where frames 10 to 23 and 19 to 21 draw it (#596). */
export const DEFINITIONS_MORE = "mt-[0.4375rem] block leading-4 sm:mt-[0.3125rem] sm:leading-[1.375rem]";

/**
 * Columns singolare and plurale with a gender column before them, at 120, 230
 * and 490 px as frames 10 to 23 draw them; on a phone two halves of the
 * column, with each gender's label over its pair (frames 19 to 21, #596). The
 * last row drops the row gap, so the reading's own gap follows it.
 */
export const GRID = "grid grid-cols-2 sm:gap-x-6 sm:grid-cols-[5.375rem_14.75rem_14.75rem]";
export const GRID_CORNER = "max-sm:hidden";
export const GRID_HEAD = "pb-2 font-sans text-[0.75rem] leading-5 text-text-muted sm:pb-[0.8125rem] sm:leading-[1.6]";
export const GRID_GENDER = "pt-1 font-sans text-[0.75rem] text-text-muted max-sm:col-span-2 max-sm:pt-0 max-sm:pb-0.5 max-sm:font-semibold";
export const GRID_CELL = "min-w-0 pb-4 sm:pb-[0.9375rem] [[role=row]:last-child>&]:pb-0 sm:[[role=row]:last-child>&]:pb-px";
/** One spelling of a cell and its article line; a second spelling sits under the first. */
export const GRID_SPELLING = "[&+&]:mt-2";
export const GRID_FORM = "m-0 font-mono text-[1.05rem] text-text-strong wrap-anywhere";
export const GRID_ARTICLES = "m-0 mt-px font-mono text-[0.75rem] leading-4 text-text-muted sm:mt-[0.1875rem]";
export const GRID_ARTICLE = "max-sm:block";
export const GRID_ARTICLE_DOT = "px-2 max-sm:hidden";
/** A form the source does not give: a dash, with no note. */
export const DASH = "font-mono text-text-muted";
export const GRID_LABEL = "m-0 mt-4 mb-3 sm:mt-6 font-sans text-[0.75rem] font-semibold text-text-muted";

/** A form in a conjugation: a link to its own search, the pointer the only cue. */
export const FORM_LINK = `cursor-pointer font-mono text-text-strong no-underline ${FOCUS_RING}`;
/** The searched form, underlined in the accent where it sits. */
export const FORM_LINK_SEARCHED = `cursor-pointer font-mono text-accent underline decoration-accent decoration-1 underline-offset-[0.3em] ${FOCUS_RING}`;

/** Gerundio · participio · ausiliare: one line, three short rows on a phone. */
export const NON_FINITE = "m-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 max-sm:flex-col";
export const NON_FINITE_ITEM = "flex items-baseline gap-2 max-sm:grid max-sm:grid-cols-[8.5rem_1fr]";
export const NON_FINITE_LABEL = "m-0 font-sans text-[0.75rem] text-text-muted";
export const NON_FINITE_LABEL_SEARCHED = "m-0 font-sans text-[0.75rem] font-semibold text-accent";
export const NON_FINITE_FORMS = "m-0 font-mono text-[1.05rem]";
export const NON_FINITE_DOT = "font-sans text-[0.75rem] text-text-muted max-sm:hidden";

/** The mood tabs: one line, the open one underlined in `text-strong`. */
export const TABS = "mt-6";
/** The four tabs stay on one line: on the narrowest phones they spread across it at a smaller size. */
export const TAB_LIST = "flex gap-5 border-border max-sm:gap-3 max-sm:border-b max-[24rem]:justify-between max-[24rem]:gap-1";
export const TAB = `-mb-px cursor-pointer border-b-2 border-transparent pb-1.5 font-sans text-[0.9rem] text-text-muted data-active:border-text-strong data-active:font-semibold data-active:text-text-strong max-sm:text-[0.8rem] max-[24rem]:text-[0.72rem] ${FOCUS_RING}`;
export const TAB_PANEL = `mt-6 ${FOCUS_RING}`;

/**
 * Tenses two at a time: pairs side by side on a wide screen, reading as one
 * table under one person column; on a phone each pair under its own.
 */
export const TENSE_PAIRS = "flex flex-col gap-5 sm:flex-row sm:gap-0";
/** On a phone a pair fills the width with fixed columns, so a long form wraps rather than scrolls. */
export const TENSE_TABLE = "border-collapse text-left max-sm:w-full max-sm:table-fixed";
export const PERSON_HEAD = "w-[5.5rem] p-0 sm:w-28";
/** A second table's person column: drawn on a phone, kept for screen readers on a wide screen. */
export const PERSON_HEAD_REPEAT = `${PERSON_HEAD} sm:sr-only`;
export const TENSE_HEAD = "p-0 pb-2 pr-4 font-sans text-[0.75rem] font-normal text-text-muted sm:w-48";
export const TENSE_HEAD_SEARCHED = "p-0 pb-2 pr-4 font-sans text-[0.75rem] font-semibold text-accent sm:w-48";
export const PERSON = "p-0 py-1 pr-3 align-baseline whitespace-nowrap font-sans text-[0.8rem] font-normal text-text-muted";
export const PERSON_SEARCHED = "p-0 py-1 pr-3 align-baseline whitespace-nowrap font-sans text-[0.8rem] font-semibold text-accent";
export const PERSON_REPEAT = "sm:sr-only";
export const TENSE_CELL = "p-0 py-1 pr-4 align-baseline font-mono text-[1rem] text-text-strong wrap-anywhere max-sm:pr-2 max-sm:text-[0.8rem]";
export const CELL_SEPARATOR = "text-text-muted";

/** One mood's tables, and the `+ more` after the simple tenses that shows the compound ones: `data-open` once open. */
export const MOOD_PANEL = "group/panel";
/** *Tempi semplici* / *Tempi composti*, named only while the compound tenses are open. */
export const TENSE_SET = "m-0 mb-2 font-sans text-[0.8rem] font-semibold text-text-strong";
export const TENSE_SET_SIMPLE = `${TENSE_SET} hidden group-data-open/panel:block`;
/** Base UI's panel: hidden until the `+ more` after it opens. */
export const COMPOUND_TABLES = "pt-4";
export const COMPOUND_MORE = "mt-2 block";

export const WORD_FACTS = "mt-[1.6875rem] border-t border-border pt-6.5 sm:mt-[2.4375rem] sm:pt-[2.4375rem]";
export const ETYMOLOGY = "m-0 max-w-[48rem] font-serif text-[1.1rem] text-text sm:text-[1.0625rem]";
/**
 * An etymology on one line, cut with an ellipsis, and `+ more` right after the
 * ellipsis; open, the whole text wraps and `less` follows its last word. The
 * text takes only its own width, so the control follows it, not the edge.
 */
export const ONE_LINE = "group/line flex max-w-[48rem] items-baseline gap-1.5 [&+&]:mt-3 data-open:block";
export const ONE_LINE_TEXT = `${ETYMOLOGY} min-w-0 truncate group-data-open/line:inline group-data-open/line:whitespace-normal`;
export const ONE_LINE_MORE = "inline shrink-0 group-data-open/line:ml-1.5";
/** A text that fits on its line needs no control. */
export const ONE_LINE_MORE_UNNEEDED = "hidden";
export const WORD_LIST = "group/words m-0 flex list-none flex-wrap items-baseline gap-x-3 gap-y-2 p-0";
export const WORD_LIST_ITEM = "flex items-baseline gap-3";
/**
 * A word past the first line: in the document, shown once `+ more` is open,
 * and while the list measures which words fit (WordList.tsx).
 */
export const WORD_LIST_ITEM_REST = "hidden items-baseline gap-3 group-data-open/words:flex group-data-measuring/words:flex";
/** The `+ more` item of a list whose words all fit: laid out only to be measured. */
export const WORD_LIST_MORE_UNNEEDED = "hidden group-data-measuring/words:flex";
export const WORD_LINK = `cursor-pointer font-serif text-[1.1rem] text-text-strong no-underline ${FOCUS_RING}`;
/** A note the source wrote inside a word list: its text, muted, and no link. */
export const WORD_NOTE = "font-serif text-[1.1rem] italic text-text-muted";
export const WORD_DOT = "font-sans text-[0.75rem] text-text-muted";
/** The dot after the last word that shows closed: `+ more` follows the word itself. */
export const WORD_DOT_BEFORE_REST = "hidden font-sans text-[0.75rem] text-text-muted group-data-open/words:inline";
export const WORD_MORE = "inline";

/**
 * *Expressions* (#213; boards 10x–12x, 17x, E1–E6). Closed, one row, the
 * meaning 16 px after its phrase on one baseline (layout A); open, every row,
 * the phrases in a column about 190 px wide and the meanings lined up after it
 * (layout B); on a phone each meaning under its phrase (E5). The block is Base
 * UI's collapsible, `data-open` while open.
 */
export const EXPRESSIONS = "group/expressions";
export const EXPRESSION_LIST = "m-0 flex list-none flex-col gap-4 p-0";
const EXPRESSION_ROW_LAYOUT =
  "gap-x-4 gap-y-1 max-sm:flex-col sm:items-baseline group-data-open/expressions:sm:grid-cols-[11.875rem_minmax(0,1fr)]";
export const EXPRESSION_ROW = `flex ${EXPRESSION_ROW_LAYOUT} group-data-open/expressions:sm:grid`;
/** A row past the first: in the document, shown once `+ more` is open. */
export const EXPRESSION_ROW_EXTRA = `hidden ${EXPRESSION_ROW_LAYOUT} group-data-open/expressions:max-sm:flex group-data-open/expressions:sm:grid`;
/** A row *Find an expression* does not match. */
export const EXPRESSION_ROW_FILTERED = "hidden";
const EXPRESSION_TEXT = "font-serif text-[1.0625rem] leading-snug";
/** A phrase that is its own headword: bright, and a link to its entry. */
export const EXPRESSION_LINK = `${EXPRESSION_TEXT} max-w-full shrink-0 cursor-pointer text-text-strong no-underline wrap-anywhere ${FOCUS_RING}`;
/** A phrase with no entry of its own: dimmer, and plain text. */
export const EXPRESSION_PHRASE = `${EXPRESSION_TEXT} max-w-full shrink-0 text-text wrap-anywhere`;
export const EXPRESSION_MEANING = `${EXPRESSION_TEXT} m-0 min-w-0 max-w-[48rem] text-text-muted`;
export const EXPRESSIONS_MORE = "mt-3 block";
/** *Find an expression*, over a list longer than thirty rows, shown once it is open. */
export const EXPRESSION_FILTER =
  "relative mb-4 hidden h-9 w-full max-w-[22.5rem] items-center rounded-[4px] border border-border-strong bg-surface-raised focus-within:border-accent group-data-open/expressions:flex";
export const EXPRESSION_FILTER_ICON = "pointer-events-none absolute left-3 size-4 text-text-muted";
export const EXPRESSION_FILTER_INPUT =
  "w-full min-w-0 bg-transparent py-2 pr-3 pl-9 font-sans text-[0.9rem] text-text-strong outline-none placeholder:text-text-muted [&::-webkit-search-cancel-button]:appearance-none";

/** `Source ↗`, with the same space above and below it. */
export const SOURCE_LINE = "mt-9 sm:mt-12 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[0.8rem] text-text-muted";
export const SOURCE_LINK = `inline-flex items-center gap-1.5 text-text-muted no-underline hover:text-text ${FOCUS_RING}`;
export const ICON = "size-3.5";

// A search that found nothing (board 24) ---------------------------------

export const NOT_FOUND_HEADING =
  "m-0 mt-12 font-serif text-[2.25rem] leading-tight font-normal break-words text-text-strong sm:mt-[3.3125rem] sm:text-[2.5rem]";
export const NOT_FOUND_TEXT = "m-0 mt-6 max-w-[42rem] font-sans text-[0.95rem] text-text sm:mt-4.5";
/** "Did you mean città?": the word in the accent, larger, and a link to its search. */
export const NOT_FOUND_LEAD = "m-0 mt-6 font-sans text-[0.95rem] text-text sm:mt-4.5";
export const NOT_FOUND_LINK = `ml-1.5 mr-2.5 font-serif text-[1.5rem] text-accent no-underline ${FOCUS_RING}`;

// A word found whose query an accented or apostrophe headword also writes (board 32, #478)

/** "Did you mean città?" under the search bar: the not-found offer's form, smaller and muted. */
export const WRITTEN_OFFER_LEAD = "m-0 mt-3 font-sans text-[0.8125rem] text-text-muted";
export const WRITTEN_OFFER_LINK = `mx-1 font-serif text-[0.9375rem] text-accent no-underline ${FOCUS_RING}`;

// The report box (board 22, #51) ----------------------------------------------

/** "Report a mistake", beside Source and in the same small muted type. */
export const REPORT_TRIGGER = `cursor-pointer border-0 bg-transparent p-0 font-sans text-[0.8rem] text-text-muted hover:text-text ${FOCUS_RING}`;
export const REPORT_BACKDROP = "fixed inset-0 bg-surface/70";
/** A small box in the middle of the screen; on a phone, the width of the screen less its margin. */
export const REPORT_POPUP =
  "fixed top-1/2 left-1/2 w-[32.5rem] max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[6px] border border-border-strong bg-surface-raised p-7 outline-none max-sm:p-5";
export const REPORT_X = `absolute top-11 right-[1.375rem] flex size-7 cursor-pointer items-center justify-center border-0 bg-transparent font-sans text-2xl text-text-muted hover:text-text max-sm:top-4 max-sm:right-4 ${FOCUS_RING}`;
export const REPORT_TITLE = "m-0 flex items-center gap-3 pr-10 font-serif text-[1.5rem] font-normal text-text-strong";
export const REPORT_SUBTITLE = "m-0 mt-0.5 font-sans text-[0.8125rem] text-text-muted";
export const REPORT_SUBTITLE_WORD = "ml-1 font-serif text-[0.9375rem] text-text-strong";
export const REPORT_FIELD = "m-0 mt-[1.1875rem] border-0 p-0";
export const REPORT_FIELD_LABEL = "mb-1.25 block p-0 font-sans text-[0.78125rem] font-semibold text-text-strong";
export const REPORT_OPTIONAL = "ml-1.5 font-normal text-text-muted";
export const REPORT_CHIPS = "flex max-w-80 flex-wrap gap-x-1.5 gap-y-[0.4375rem]";
/** A choice: a native radio, drawn as a chip; the chosen one is outlined in the accent. */
export const REPORT_CHIP =
  "inline-flex h-8 cursor-pointer items-center rounded-[3px] border border-border-strong px-3 font-sans text-[0.8125rem] text-text hover:border-text-muted has-[:checked]:border-accent has-[:checked]:font-semibold has-[:checked]:text-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent";
export const REPORT_DETAILS =
  "block min-h-[7.125rem] w-full resize-y rounded-[4px] border border-border-strong bg-surface px-3.5 py-3 font-sans text-[0.875rem] text-text-strong outline-none placeholder:text-text-muted focus:border-accent";
export const REPORT_ERROR = "m-0 mt-4 font-sans text-[0.8rem] text-warning";
/** Try again, after the box could not get its opening token. */
export const REPORT_RETRY = `ml-2 cursor-pointer border-0 bg-transparent p-0 font-sans text-[0.8rem] text-accent underline ${FOCUS_RING}`;
/** "No account needed." on its own line on a phone, Cancel and Send together on the right. */
export const REPORT_FOOTER = "mt-[1.5625rem] flex flex-wrap items-center justify-end gap-x-6 gap-y-3";
export const REPORT_NOTE = "m-0 mr-auto font-sans text-[0.75rem] text-text-muted max-sm:w-full";
export const REPORT_CANCEL = `cursor-pointer border-0 bg-transparent p-0 font-sans text-[0.875rem] text-text hover:text-text-strong ${FOCUS_RING}`;
export const REPORT_SEND = `cursor-pointer rounded-[3px] border-0 bg-accent px-4 py-1.5 font-sans text-[0.875rem] leading-[1.375rem] font-semibold text-surface disabled:cursor-not-allowed disabled:bg-border disabled:font-normal disabled:text-text-muted ${FOCUS_RING}`;
export const REPORT_SENT_CHECK = "font-sans text-base text-accent";
export const REPORT_SENT_TEXT = "m-0 mt-4 font-sans text-[0.9rem] text-text";
export const REPORT_CLOSE = `mt-5 cursor-pointer rounded-[3px] border border-border-strong bg-transparent px-4 py-2 font-sans text-[0.9rem] text-text-strong hover:border-text-muted ${FOCUS_RING}`;

// The legal pages (#139, frames 33 to 34m; #162, frames 35 to 36m) ----------
//
// The dictionary's `/licence` and `/privacy`, and the developer site's
// `/terms` and `/privacy` (LegalPage.tsx): a kicker, the title in serif, the
// date the text took effect, the lede with a rule under it, then numbered
// sections. On a wide screen a Contents list of the sections sits in a column
// on the left; on a phone there is none, and the text is the whole column.

// Frames 33 and 35 at 1440 px: the Contents column 120 px in, 220 px wide, a
// 96 px gap, then the 720 px text column at 436 px (#581). The shell is the
// one `COLUMN`, so on every width the text starts on the same edge as its
// site's header: 120 px at 1440 px, and 20 px on a phone (#585, #588). Under
// the text, the frames leave 110 px to the footer's rule, 56 px on a
// phone, on both sites (#596). The dictionary's footer brings its own margin
// (`SITE_FOOTER`), so its shell pads the rest; the developer footer has none,
// so its shell pads it all.
const LEGAL_SHELL_TOP = "flex-1 pt-18 max-sm:pt-9";
/** The site a legal page belongs to, which picks its shell's column. */
export type LegalSite = "dictionary" | "developers";
export const LEGAL_SHELL: Readonly<Record<LegalSite, string>> = {
  dictionary: `${COLUMN} ${LEGAL_SHELL_TOP} pb-20.25 max-sm:pb-9`,
  developers: `${COLUMN} ${LEGAL_SHELL_TOP} pb-27.5 max-sm:pb-14`,
};
/**
 * How many digits a page's highest section number has. It sets the width of
 * the number's slot, in the headings and in the Contents, so every title on
 * the page starts on one edge (#585) and that edge sits where the frames draw
 * it (#596): frames 33, 34 and 36 have one-digit numbers and set titles 1 to 9
 * close; frame 35 has eleven sections, and its titles start where "10." ends.
 */
export type LegalNumberDigits = 1 | 2;
const LEGAL_GRID =
  "sm:grid sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-x-12 lg:grid-cols-[13.75rem_minmax(0,45rem)] lg:gap-x-24";
/**
 * The two columns, and the slots their numbers take on a wide screen.
 * `--legal-hang` is how far a section title sits from the text column's edge:
 * the heading's number takes it as its width and the section's text as its
 * indent, so the text starts under the title (#585). One digit: 30 px, the
 * titles' and the text's edge in frames 33, 34 and 36. Two digits: as wide as
 * "11." and the 14 px after it. `--legal-contents-slot` is the Contents
 * number's: one digit, 20 px, where frames 33, 34 and 36 start the titles;
 * two digits, as wide as "11." and the 8 px after it.
 */
export const LEGAL_LAYOUT: Readonly<Record<LegalNumberDigits, string>> = {
  1: `${LEGAL_GRID} [--legal-hang:1.875rem] [--legal-contents-slot:1.25rem]`,
  2: `${LEGAL_GRID} [--legal-hang:2.5rem] [--legal-contents-slot:1.625rem]`,
};
/**
 * The Contents column, hidden on a phone. It starts level with the lede and,
 * once the page scrolls, stays in view.
 */
export const LEGAL_CONTENTS = "hidden sm:block";
export const LEGAL_CONTENTS_INNER = "sticky top-8 mt-37";
export const LEGAL_CONTENTS_LABEL = "m-0 font-sans text-[0.6875rem] leading-[1.7] font-semibold tracking-[0.1em] text-text-muted uppercase";
export const LEGAL_CONTENTS_LIST = "m-0 mt-2.5 flex list-none flex-col gap-2.5 p-0";
/**
 * A Contents entry; the one for the section being read is drawn strong
 * (LegalContents.tsx). Frames 33 to 36 set the entries 30 px apart: a 20 px
 * line and the list's 10 px gap.
 */
export const LEGAL_CONTENTS_LINK = `flex font-sans text-[0.84375rem] leading-5 text-text-muted no-underline hover:text-text-strong aria-[current=location]:text-text-strong ${FOCUS_RING}`;
/** A Contents entry's number, in the page's slot (`LEGAL_LAYOUT`), so every title starts on one edge (#585). */
export const LEGAL_CONTENTS_NUMBER = "w-(--legal-contents-slot) shrink-0";
export const LEGAL_TEXT = "min-w-0";
export const LEGAL_KICKER = "m-0 font-sans text-[0.6875rem] leading-[1.7] font-semibold tracking-[0.1em] text-accent";
export const LEGAL_TITLE = "m-0 mt-3.5 font-serif text-[2.75rem] leading-[1.15] font-normal text-text-strong max-sm:text-[2.125rem]";
export const LEGAL_EFFECTIVE = "m-0 mt-3.5 font-sans text-[0.8125rem] leading-[1.7] text-text-muted";
/** The lede, and the rule that closes the page's head: lines 28 px apart, and on a phone 26 px apart with the rule 2 px closer (frames 33 to 36m). */
export const LEGAL_LEDE =
  "m-0 mt-3.5 border-b border-border pb-8 font-sans text-[1.0625rem] leading-7 text-text-strong max-sm:pb-7.5 max-sm:text-base max-sm:leading-6.5";
/**
 * A section; the gap above its heading is kept when a Contents link scrolls to
 * it. Its heading is a 28 px line, and on a phone a 24 px line 34 px under the
 * text before it (frames 33 to 36m, #596).
 */
export const LEGAL_SECTION = "mt-10 scroll-mt-8 max-sm:mt-8.5";
export const LEGAL_SECTION_HEADING =
  "m-0 flex items-baseline font-serif text-[1.3125rem] leading-7 font-normal text-text-strong max-sm:text-[1.1875rem] max-sm:leading-6";
/**
 * On a phone there is no slot: the number is its own width and a fixed gap,
 * so titles 1 to 9 start 30 px in and 10 and 11 start 40 px in, as frames 33m
 * to 36m draw them, and the text has no indent (#588).
 */
export const LEGAL_SECTION_NUMBER = "w-(--legal-hang) shrink-0 text-accent max-sm:w-auto max-sm:mr-4";
/**
 * The section's text, set in under the heading's words on a wide screen.
 * Frames 33 to 36m draw its lines 26 px apart on every width (#596).
 */
const LEGAL_BODY = "font-sans text-[0.96875rem] leading-6.5 text-text sm:pl-(--legal-hang) max-sm:text-[0.9375rem]";
export const LEGAL_PARAGRAPH = `m-0 mt-3 ${LEGAL_BODY}`;
/** The lettered items, `(a)` and `(b)`, each mark hanging beside its text. */
export const LEGAL_ITEMS = `m-0 mt-3 flex list-none flex-col gap-1.5 p-0 ${LEGAL_BODY}`;
export const LEGAL_ITEM = "flex gap-2.5";
export const LEGAL_ITEM_MARK = "shrink-0 text-text-muted";
/** A release id, a date or "one-way", kept on one line: a phone broke `it-78385b62` at its hyphen. */
export const LEGAL_UNBROKEN = "whitespace-nowrap";
/** The privacy mailbox, on its own line. */
export const LEGAL_ADDRESS = `m-0 mt-1.5 ${LEGAL_BODY}`;

// The developer site (#166) -------------------------------------------------
//
// developers.lexema.fyi, boards 25 (landing), 26 (pricing) and 31 (docs) in
// `lexema-design.pen`, drawn at 1440 px, and their phone boards at 390 px
// (25m, 26m, 31m, the ☰ menu and the docs contents). Below `sm` (640 px) a
// page takes its phone board; from `sm` up, its wide board. Sizes and spacing
// are the boards' own, as the manifest's closing rule has them. The
// dictionary's roles and faces: serif for page and section headings, sans for
// prose and controls, mono for code, paths and parameter names.

/** The docs lay out edge to edge, the sidebar against the window's left edge. */
const WIDE = "w-full px-5 sm:px-10";

/** The bar: 56 px on a phone, 68 on a wide screen. `relative` holds the ☰ button above its open menu. */
export const DEV_BAR = "border-b border-border";
const BAR_ROW = "flex h-14 items-center sm:h-[4.25rem]";
export const DEV_BAR_INNER = `${COLUMN} ${BAR_ROW}`;
export const DEV_BAR_INNER_WIDE = `${WIDE} ${BAR_ROW}`;
/** `Lexema Developers`: the name in serif, the site in small muted sans beside it. */
export const DEV_NAME = `flex shrink-0 items-center gap-2 font-serif text-[1.1875rem] leading-none text-text-strong no-underline sm:gap-3 sm:pt-[3px] sm:text-[1.375rem] ${FOCUS_RING}`;
export const DEV_NAME_SITE = "font-sans text-[0.75rem] text-text-muted sm:text-[0.8125rem]";
/** Docs and Pricing in the bar, on a wide screen only: on a phone they are in the ☰ menu. */
export const DEV_NAV = "m-0 ml-[3.25rem] hidden list-none gap-6 p-0 pt-[3px] text-[0.875rem] leading-5 sm:flex";
export const DEV_NAV_LINK = `font-sans text-text no-underline hover:text-text-strong aria-[current=page]:font-semibold aria-[current=page]:text-text-strong ${FOCUS_RING}`;

/** A page's one leading action: accent, filled. */
export const BUTTON_PRIMARY = `inline-flex h-10 items-center justify-center rounded-[4px] border border-accent bg-accent px-5 font-sans text-[0.875rem] font-semibold whitespace-nowrap text-surface no-underline disabled:cursor-not-allowed ${FOCUS_RING}`;
/** An action beside it: outlined. */
export const BUTTON_SECONDARY = `inline-flex h-10 items-center justify-center rounded-[4px] border border-border-strong bg-transparent px-5 font-sans text-[0.875rem] font-semibold whitespace-nowrap text-text-strong no-underline hover:border-text-muted ${FOCUS_RING}`;
/** Sign in, at the right of the bar. */
export const DEV_SIGN_IN = `ml-auto inline-flex h-[1.8125rem] shrink-0 items-center rounded-[4px] border border-border-strong px-[0.6875rem] font-sans text-[0.875rem] whitespace-nowrap text-text-strong no-underline hover:border-text-muted sm:h-[2.0625rem] sm:px-[0.9375rem] ${FOCUS_RING}`;

/**
 * The ☰ menu, on a phone only (DeveloperMenu.tsx): the ☰ in the bar opens
 * Base UI's dialog, which fills the screen; its × is pinned where the ☰ was.
 */
const DEV_MENU_BUTTON = `flex size-10 cursor-pointer items-center justify-center text-text-strong ${FOCUS_RING}`;
export const DEV_MENU_TOGGLE = `${DEV_MENU_BUTTON} ml-0.5 -mr-[0.5625rem] sm:hidden`;
export const DEV_MENU_CLOSE = `${DEV_MENU_BUTTON} fixed top-2 right-[0.6875rem] z-50`;
export const DEV_MENU_ICON = "block";
export const DEV_MENU_PANEL = "fixed inset-0 z-40 overflow-y-auto bg-surface sm:hidden";
/** The menu's own copy of the bar, the same 57 px with its rule. */
export const DEV_MENU_BAR = `${WIDE} flex h-[3.5625rem] items-center border-b border-border`;
/** Boards `VDNSE` and `j6UaW`: 57 px from the bar's rule to the first link's, then 49 px a link, at 17 px. */
export const DEV_MENU_LINKS = "m-0 list-none p-0 pt-2";
export const DEV_MENU_LINK = `flex h-[3.0625rem] items-start border-b border-border px-5 pt-[0.6875rem] font-sans text-[1.0625rem] leading-[1.625rem] text-text no-underline aria-[current=page]:text-text-strong ${FOCUS_RING}`;
/** Under the links: what the visitor can do next, full width. */
export const DEV_MENU_ACTIONS = "flex flex-col gap-3.5 px-5 pt-[1.6875rem] pb-10";
const MENU_BUTTON = `flex w-full items-center justify-center rounded-[4px] border font-sans text-[0.9375rem] no-underline ${FOCUS_RING}`;
export const DEV_MENU_OUTLINE = `${MENU_BUTTON} h-[2.6875rem] border-border-strong text-text-strong`;
export const DEV_MENU_FILLED = `${MENU_BUTTON} h-[2.625rem] border-accent bg-accent text-surface`;

export const DEV_FOOTER = "border-t border-border";
const FOOTER_ROW = "flex flex-col gap-[0.28125rem] py-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:pt-7 sm:pb-[1.625rem]";
export const DEV_FOOTER_INNER = `${COLUMN} ${FOOTER_ROW}`;
export const DEV_FOOTER_INNER_WIDE = `${WIDE} ${FOOTER_ROW}`;
export const DEV_FOOTER_NAME = `self-start font-serif text-[0.9375rem] leading-6 text-text-strong no-underline ${FOCUS_RING}`;
/**
 * On a phone the links take two rows, Terms and Privacy on the second (frames
 * 35m and 36m): the list's `::after` is a full-width break ordered between the
 * other links and the legal ones. With no row gap the rows sit 24 px apart,
 * as the frames draw them.
 */
export const DEV_FOOTER_LINKS =
  "m-0 flex list-none flex-wrap gap-x-[1.125rem] gap-y-2 p-0 sm:gap-x-6 max-sm:gap-y-0 max-sm:after:order-1 max-sm:after:basis-full max-sm:after:content-['']";
export const DEV_FOOTER_LEGAL = "max-sm:order-2";
export const DEV_FOOTER_LINK = `font-sans text-[0.78125rem] text-text-muted no-underline hover:text-text aria-[current=page]:text-text-strong ${FOCUS_RING}`;

/** A landing or pricing page: the column, with room above the heading. */
export const DEV_SHELL = `${COLUMN} flex-1 pt-[2.875rem] pb-[3.4375rem] sm:pt-20 sm:pb-[5.9375rem]`;
/** A page's heading: `Pricing`. */
export const DEV_HEADING = "m-0 font-serif text-[2.125rem] leading-[1.2] font-normal text-text-strong sm:text-[3rem]";
/** A section's heading under the page's: `Endpoints`, `What a call costs`. */
export const DEV_SECTION_HEADING = "m-0 font-serif text-[1.375rem] leading-[1.3] font-normal text-text-strong sm:text-[1.625rem]";

// Landing (boards 25 and 25m)

export const LANDING_HEADING = "m-0 font-serif text-[2.25rem] leading-[1.2] font-normal text-text-strong sm:text-[3.5rem]";
export const LANDING_LEAD = "m-0 mt-6 max-w-[50rem] font-sans text-[1.125rem] leading-[1.5] text-text sm:mt-7";
export const LANDING_ACTIONS = "mt-[1.6rem] flex gap-3";
/** The request and an excerpt of its answer; on a phone the lines run on, and scroll inside the box. */
export const LANDING_CODE =
  "m-0 mt-[2.4375rem] max-w-[56.25rem] overflow-x-auto rounded-[6px] border border-border bg-surface-raised px-4 py-[0.84375rem] font-mono text-[0.703125rem] leading-[1.1875rem] text-text sm:mt-[3.4375rem] sm:px-6 sm:py-[1.1rem] sm:text-[0.84375rem] sm:leading-[1.375rem]";
export const LANDING_CODE_STRONG = "text-text-strong";
export const LANDING_CODE_MUTED = "text-text-muted";
export const LANDING_FEATURES = "m-0 mt-[2.5625rem] grid list-none gap-[1.5625rem] p-0 sm:mt-[3.5625rem] sm:grid-cols-3 sm:gap-12";
export const LANDING_FEATURE_HEADING = "m-0 font-serif text-[1.25rem] leading-[1.4] font-normal text-text-strong";
export const LANDING_FEATURE_TEXT = "m-0 mt-[0.5625rem] font-sans text-[0.90625rem] leading-[1.5] text-text";
export const LANDING_ENDPOINTS = "mt-[2.78125rem] sm:mt-[3.78125rem]";
export const LANDING_ENDPOINT_LIST = "m-0 mt-[1.1875rem] list-none p-0 sm:mt-[1.09375rem]";
export const LANDING_ENDPOINT_ROW =
  "grid grid-cols-1 border-b border-border pt-2 pb-[0.5625rem] sm:grid-cols-[20rem_1fr] sm:items-baseline sm:py-[0.65625rem]";
export const LANDING_ENDPOINT_PATH = `font-mono text-[0.875rem] leading-[1.40625rem] text-text-strong no-underline sm:leading-5 ${FOCUS_RING}`;
export const LANDING_ENDPOINT_TEXT = "font-sans text-[0.875rem] leading-[1.40625rem] text-text sm:leading-5";

// Pricing (boards 26 and 26m)

/** Three cards side by side on a wide screen; stacked below `lg`, where three would squeeze their lines. */
export const PLANS = "mt-[3.78125rem] grid gap-5 sm:mt-[3.90625rem] sm:gap-6 lg:grid-cols-3";
const PLAN = "flex flex-col rounded-[6px] bg-surface-raised px-8 pt-[1.875rem] pb-[1.96875rem]";
/** The featured plan (Pro): a 2 px accent border, as board 26 draws it. */
export const PLAN_FEATURED = `${PLAN} border-2 border-accent`;
export const PLAN_OTHER = `${PLAN} border border-border`;
/** The plan's name, and on the featured plan its "Most popular" tag beside it. */
export const PLAN_HEAD = "flex h-5 items-center gap-3";
export const PLAN_TAG = "rounded-full bg-accent px-2 font-sans text-[0.75rem] leading-5 font-semibold text-surface";
export const PLAN_NAME_FEATURED = "m-0 font-sans text-[0.8125rem] leading-5 font-semibold text-accent";
export const PLAN_NAME_OTHER = "m-0 font-sans text-[0.8125rem] leading-5 font-semibold text-text-muted";
/** `$15 / month`: the period sits low, its foot below the price's. */
export const PLAN_PRICE = "m-0 mt-4 flex items-end gap-1.5 font-serif text-[1.9375rem] leading-[1.6] font-normal text-text-strong sm:text-[2.75rem]";
export const PLAN_PERIOD = "font-sans text-[0.875rem] leading-5 text-text-muted";
export const PLAN_FEATURES = "m-0 mt-[0.78125rem] flex list-none flex-col p-0 pb-[0.8125rem] sm:mt-[0.71875rem]";
export const PLAN_FEATURE = "flex h-[1.625rem] items-center gap-3 font-sans text-[0.875rem] text-text";
export const PLAN_CHECK = "w-3 shrink-0 text-accent";
export const PLAN_ACTION = "mt-auto flex";
// What counts as a call: `Any endpoint` in the sans, an endpoint's path in the mono.
export const CALLS = "mt-[3.6875rem] max-w-[38.75rem]";
export const CALLS_HEADING = "m-0 font-serif text-[1.5rem] leading-[1.3] font-normal text-text-strong";
export const CALL_TABLE = "mt-4 w-full border-collapse text-left";
export const CALL_ROW = "border-b border-border";
const CALL_WHAT = "p-0 pt-2 pr-6 pb-[0.5625rem] text-[0.875rem] leading-5 font-normal text-text-strong";
export const CALL_ANY = `${CALL_WHAT} font-sans`;
export const CALL_ENDPOINT = `${CALL_WHAT} font-mono`;
export const CALL_COUNT = "p-0 pt-2 pb-[0.5625rem] text-right font-sans text-[0.875rem] leading-5 whitespace-nowrap text-text";

// Docs (boards 31, 31m and the open contents)

export const DOCS_LAYOUT = "flex flex-1 flex-col sm:flex-row";
/** The sidebar, from `sm` up: its rule runs the page's height. */
export const DOCS_SIDEBAR = "hidden shrink-0 border-r border-border sm:block sm:w-[16.5rem]";
/** Inside it, the pages: their own scroll, held in view beside the page. */
export const DOCS_SIDEBAR_INNER = "sticky top-0 max-h-screen overflow-y-auto pt-8 pr-5 pb-8 pl-10";
/**
 * On a phone the sidebar is this bar under the header, naming the page's group
 * and the page (DocsContents.tsx): Base UI's collapsible, `data-open` while
 * open, and open it holds the sidebar's search and pages.
 */
export const DOCS_CONTENTS = "group/contents border-b border-border sm:hidden";
/** Open, the bar keeps its rule, and the list under it has its own. */
export const DOCS_CONTENTS_TRIGGER = `flex h-10 w-full cursor-pointer items-center gap-[0.5625rem] border-border px-5 text-left font-sans text-[0.8125rem] text-text-muted group-data-open/contents:border-b ${FOCUS_RING}`;
export const DOCS_CONTENTS_PAGE = "min-w-0 truncate text-text-strong";
export const DOCS_CONTENTS_ICON = "ml-auto size-[1.0625rem] shrink-0 text-text-muted group-data-open/contents:rotate-180";
export const DOCS_CONTENTS_PANEL = "px-5 pt-[0.9375rem] pb-[1.375rem]";
export const DOCS_SEARCH = "relative flex h-9 items-center sm:mb-px rounded-[4px] border border-border bg-surface focus-within:border-accent";
export const DOCS_SEARCH_INPUT =
  "w-full min-w-0 bg-transparent py-2 pr-12 pl-3 font-sans text-[0.8125rem] text-text-strong outline-none placeholder:text-text-muted [&::-webkit-search-cancel-button]:appearance-none";
export const DOCS_SEARCH_HINT = `${SEARCH_SHORTCUT} pointer-events-none absolute right-2`;
export const DOCS_NAV_GROUP = "mt-[1.125rem] sm:mt-[1.5625rem]";
export const DOCS_NAV_LABEL = "m-0 mb-[0.5625rem] font-sans text-[0.6875rem] leading-4 font-semibold tracking-[0.08em] text-text-muted uppercase";
export const DOCS_NAV_LIST = "m-0 flex list-none flex-col p-0";
/** A page in the sidebar; the page being read is raised, and its name strong. */
export const DOCS_NAV_LINK = `group/link flex h-[1.9375rem] items-center rounded-[4px] px-2.5 font-sans text-[0.84375rem] text-text no-underline hover:bg-surface-raised hover:text-text-strong aria-[current=page]:bg-surface-raised aria-[current=page]:font-semibold aria-[current=page]:text-text-strong ${FOCUS_RING}`;
export const DOCS_NAV_METHOD =
  "w-11 shrink-0 font-mono text-[0.65625rem] font-normal text-text-muted group-aria-[current=page]/link:text-accent";
export const DOCS_NAV_ENDPOINT = "font-mono text-[0.8125rem]";

export const DOCS_MAIN = "min-w-0 flex-1 px-5 pt-[2.65625rem] pb-[2.9375rem] sm:pt-12 sm:pr-10 sm:pb-[3.9375rem] sm:pl-14";
/** A page's topic: its text, and beside it on a wide screen the code it shows. */
export const DOCS_SECTION =
  "xl:grid xl:grid-cols-[minmax(0,33.125rem)_minmax(0,1fr)] xl:grid-rows-[auto_1fr] xl:gap-x-[3.125rem]";
/**
 * A guide's topic has no code beside it: its text, tables and Previous / Next
 * take the column to 120 px from the window's edge (board 31b).
 */
export const DOCS_GUIDE = "xl:pr-20";
export const DOCS_TEXT = "min-w-0";
/**
 * A guide page's text under its heading. Board 31b sets it lower than an
 * endpoint's box, one paragraph 16 px after another.
 */
export const DOCS_GUIDE_BODY = "sm:pt-5 sm:[&>p+p]:mt-4";
/**
 * The code beside a topic, never taller than the window: a response longer
 * than the room left scrolls inside its own panel. On a phone it follows the
 * topic's text, and a response scrolls inside a box about 360 px tall.
 */
export const DOCS_CODE =
  "mt-[4.4375rem] flex min-w-0 flex-col gap-[0.9375rem] sm:max-h-[80svh] sm:gap-5 xl:sticky xl:top-6 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:mt-0 xl:max-h-[calc(100svh-3rem)] xl:self-start";
/** `Endpoints`, over a topic's heading: which part of the docs it is in. On a phone the contents bar says it. */
export const DOCS_EYEBROW = "m-0 hidden font-sans text-[0.8125rem] leading-4 font-medium text-accent sm:block";
export const DOCS_HEADING = "m-0 font-serif text-[1.875rem] leading-[1.2] font-normal text-text-strong sm:mt-[1.09375rem] sm:text-[2.5rem]";
/** `GET https://api.lexema.fyi/v1/lookup`, in a hairline box: the column's width on a phone. */
export const DOCS_ENDPOINT = "mt-[1.15625rem] flex h-9 max-w-full items-center gap-2.5 rounded-[4px] border border-border bg-surface-raised pr-3.5 pl-3 sm:inline-flex";
export const DOCS_METHOD =
  "inline-flex h-5 w-[2.125rem] shrink-0 items-center justify-center rounded-[3px] border border-accent font-mono text-[0.6875rem] text-accent";
export const DOCS_URL = "min-w-0 truncate font-mono text-[0.75rem] text-text-strong sm:text-[0.8125rem]";
export const DOCS_PARAGRAPH = "m-0 mt-[1.28125rem] font-sans text-[0.96875rem] leading-[1.6] text-text";
export const DOCS_SUBHEADING = "m-0 mt-[2.6875rem] border-b border-border pb-[0.8125rem] font-serif text-[1.375rem] leading-[1.3] font-normal text-text-strong";
export const DOCS_ROWS = "m-0 list-none p-0";
export const DOCS_ROW = "border-b border-border pt-[0.9375rem] pb-[0.96875rem]";
export const DOCS_ROW_HEAD = "m-0 flex flex-wrap items-baseline gap-x-2.5 leading-5";
export const DOCS_ROW_NAME = "font-mono text-[0.8125rem] font-semibold text-text-strong";
export const DOCS_ROW_TYPE = "font-sans text-[0.75rem] text-text-muted";
export const DOCS_ROW_REQUIRED = "font-sans text-[0.75rem] font-medium text-warning";
export const DOCS_ROW_TEXT = "m-0 mt-[0.28125rem] font-sans text-[0.875rem] leading-[1.375rem] text-text";
/** A response: its status in a small box, then what it means. */
export const DOCS_ANSWER = "flex gap-4 border-b border-border pt-[0.9375rem] pb-4";
const STATUS = "inline-flex h-[1.3125rem] w-10 shrink-0 items-center justify-center rounded-[3px] border border-border bg-surface-raised font-mono text-[0.75rem]";
export const DOCS_STATUS_OK = `${STATUS} text-accent`;
export const DOCS_STATUS_OTHER = `${STATUS} text-text-strong`;
export const DOCS_ANSWER_TEXT = "m-0 font-sans text-[0.875rem] leading-[1.375rem] text-text";
export const DOCS_TABLE = "mt-6 w-full border-collapse text-left";
export const DOCS_TABLE_HEAD = "border-b border-border p-0 pr-6 pb-2 font-sans text-[0.75rem] font-normal text-text-muted";
export const DOCS_TABLE_CELL = "border-b border-border p-0 py-2 pr-6 align-baseline font-sans text-[0.875rem] text-text";
export const DOCS_TABLE_CODE = "border-b border-border p-0 py-2 pr-6 align-baseline font-mono text-[0.8125rem] text-text-strong";
/** Previous / Next at the foot of a page, under its text: two hairline cards, Next on the right. */
export const DOCS_NEIGHBOURS = "mt-[1.9375rem] grid grid-cols-2 gap-2.5 self-start sm:mt-[2.875rem] sm:gap-4 xl:col-start-1";
/** Under a guide's text, which has no code beside it: board 31b sets it 39 px below. */
export const DOCS_NEIGHBOURS_GUIDE = "mt-[1.9375rem] grid grid-cols-2 gap-2.5 sm:mt-[2.4375rem] sm:gap-4";
export const DOCS_NEIGHBOUR = `flex min-w-0 flex-col gap-[0.1875rem] rounded-[6px] border border-border px-[1.125rem] pt-3 pb-[0.8125rem] no-underline hover:border-border-strong ${FOCUS_RING}`;
export const DOCS_NEIGHBOUR_NEXT = `${DOCS_NEIGHBOUR} col-start-2 items-end text-right`;
export const DOCS_NEIGHBOUR_LABEL = "font-sans text-[0.75rem] leading-4 text-text-muted";
/** On a phone a long title runs past the card's padding rather than wrap, as board 31m draws `Lemmatize a form →`. */
export const DOCS_NEIGHBOUR_TITLE = "font-sans text-[0.859375rem] leading-5 font-semibold whitespace-nowrap text-text-strong sm:text-[0.90625rem]";

/**
 * A request or a response panel beside a topic. Board 31 fills it darker than
 * the page, a value no role holds; it takes the page's own `surface` until the
 * manifest names one.
 */
const CODE_PANEL = "min-w-0 overflow-hidden rounded-[6px] border border-border bg-surface";
export const CODE_PANEL_REQUEST = `${CODE_PANEL} shrink-0`;
/** The response takes the room the request leaves, and no more than its answer needs. */
export const CODE_PANEL_RESPONSE = `${CODE_PANEL} flex min-h-0 flex-col`;
export const CODE_PANEL_HEAD = "flex h-[2.1875rem] shrink-0 items-center gap-4 border-b border-border px-4";
export const CODE_PANEL_TITLE = "m-0 mr-auto font-sans text-[0.75rem] font-semibold text-text-strong";
/** The tabs sit apart as the head's own items do; Base UI marks the open one `data-active`. */
export const CODE_PANEL_TABS = "flex items-center gap-4";
export const CODE_PANEL_TAB = `cursor-pointer border-0 bg-transparent p-0 font-sans text-[0.75rem] text-text-muted hover:text-text data-active:font-semibold data-active:text-accent ${FOCUS_RING}`;
export const CODE_PANEL_STATUS = "font-sans text-[0.75rem] font-semibold text-accent";
export const CODE_PANEL_COPY = `cursor-pointer border-0 bg-transparent p-0 font-sans text-[0.75rem] text-text-muted hover:text-text ${FOCUS_RING}`;
export const CODE_PANEL_BODY =
  "m-0 overflow-x-auto px-3.5 py-3 font-mono text-[0.6875rem] leading-[1.125rem] text-text sm:px-4 sm:py-3.5 sm:text-[0.75rem] sm:leading-[1.1875rem]";
/** A request's tab panel, which holds that language's request for every example. */
export const CODE_PANEL_CODE = FOCUS_RING;
export const CODE_PANEL_RESPONSE_BODY = `${CODE_PANEL_BODY} min-h-0 overflow-y-auto overscroll-contain max-sm:max-h-[22.5rem]`;
/** A line of code: the command's first line strong, the address it calls in the accent, a bracket on its own muted. */
export const CODE_LINE_STRONG = "text-text-strong";
export const CODE_LINE_ADDRESS = "text-accent";
export const CODE_LINE_MUTED = "text-text-muted";

/** Code inside a sentence. */
export const CODE_INLINE = "font-mono text-[0.9em] text-text-strong";

// Signed in (#169, #187): sign-in (board 27), the dashboard (board 28), its
// key dialogs and toasts (boards 28b to 28f) and the delete confirmation
// (board 30).

/** The bar's right-hand side when signed in: the account menu's avatar (#190). On a phone the ☰ menu stands in for it. */
export const DEV_ACCOUNT = "ml-auto flex items-center sm:pl-6";

/** The avatar (board 28h): 32 px, round, filled `accent`, the initial in `surface`. It opens the account menu. */
export const ACCOUNT_TRIGGER = `flex shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 max-sm:hidden ${FOCUS_RING}`;
export const ACCOUNT_AVATAR = "flex size-8 items-center justify-center overflow-hidden rounded-full bg-accent select-none";
export const ACCOUNT_AVATAR_INITIAL = "font-sans text-[0.875rem] leading-none font-semibold text-surface";
/** The account menu under the avatar, its right edge on the avatar's: 240 px, raised, in a strong hairline. */
export const ACCOUNT_MENU_POSITIONER = "z-50 outline-none";
export const ACCOUNT_MENU = "w-60 rounded-[6px] border border-border-strong bg-surface-raised p-1.5 outline-none";
/** The name in `text-strong`, the email muted under it; without a name, the email alone in the name's place. */
export const ACCOUNT_MENU_HEAD = "px-2.5 pt-1.5 pb-2";
export const ACCOUNT_MENU_NAME = "m-0 truncate font-sans text-[0.875rem] leading-5 font-semibold text-text-strong";
export const ACCOUNT_MENU_EMAIL = "m-0 truncate font-sans text-[0.8125rem] leading-[1.125rem] text-text-muted";
export const ACCOUNT_MENU_RULE = "mb-1 h-px bg-border";
/** Dashboard and Settings; the highlighted one sits on the page's own `surface`. */
const ACCOUNT_MENU_ROW =
  "flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-[4px] border-0 bg-transparent px-2.5 font-sans text-[0.9375rem] leading-5 no-underline outline-none data-highlighted:bg-surface";
export const ACCOUNT_MENU_ITEM = `${ACCOUNT_MENU_ROW} text-text data-highlighted:text-text-strong`;
/** Sign out, in the accent, as it was in the bar. */
export const ACCOUNT_MENU_SIGN_OUT = `${ACCOUNT_MENU_ROW} text-accent`;
export const ACCOUNT_MENU_ICON = "size-4 shrink-0";
/** The signed-in ☰ menu's foot (board `j6UaW`): the email, muted, then Sign out in the accent. */
export const DEV_MENU_ACCOUNT = "flex flex-col items-start gap-[0.6875rem] px-5 pt-[1.6875rem] pb-10";
export const DEV_MENU_EMAIL = "font-sans text-[0.875rem] leading-5 text-text-muted wrap-anywhere";
export const DEV_MENU_SIGN_OUT = `cursor-pointer border-0 bg-transparent p-0 font-sans text-[0.9375rem] leading-6 text-accent ${FOCUS_RING}`;

/** Sign-in (boards 27 and 27m): a raised card, 120 px under the bar (40 on a phone), ending on the Terms line (#162). */
export const SIGN_IN_SHELL = `${COLUMN} flex-1 pt-10 pb-14 sm:pt-[7.5rem] sm:pb-40`;
export const SIGN_IN_CARD = "mx-auto w-full rounded-[8px] border border-border bg-surface-raised px-[2.4375rem] pt-[2.625rem] pb-[2.4375rem] text-center sm:max-w-[27.5rem]";
export const SIGN_IN_HEADING = "m-0 font-serif text-[2rem] leading-[2.75rem] font-normal text-text-strong";
export const SIGN_IN_LEAD = "m-0 mt-[1.1875rem] font-sans text-[0.875rem] leading-5 text-text-muted";
export const SIGN_IN_PROVIDERS = "m-0 mt-10 flex list-none flex-col gap-[1.125rem] p-0";
/** "By continuing you agree to the Terms.", small and muted under the providers. */
export const SIGN_IN_TERMS = "m-0 mt-7 font-sans text-[0.75rem] leading-5 text-text-muted";
/** A provider: outlined, on the page's own surface; unconfigured, muted and not clickable. */
export const SIGN_IN_PROVIDER = `flex h-[2.625rem] w-full cursor-pointer items-center justify-center gap-2.5 rounded-[4px] border border-border-strong bg-surface px-5 font-sans text-[0.9375rem] font-medium text-text-strong no-underline hover:border-text-muted disabled:cursor-not-allowed disabled:border-border disabled:text-text-muted ${FOCUS_RING}`;
export const SIGN_IN_ICON = "size-4 shrink-0";
/** Google's mark as the board draws it: a bold `G` in the button's colour. */
export const SIGN_IN_G = "w-4 shrink-0 text-center font-sans text-[0.8125rem] font-bold leading-none";

/** The dashboard's column, as the landing's: the heading, the tab bar, then each section a heading with its content under it. */
export const DASH_SHELL = `${COLUMN} flex-1 pt-[2.375rem] pb-[3.1875rem] sm:pt-20 sm:pb-[5.9375rem]`;
/** `Dashboard`: 44 px on a wide screen, as board 28 draws it; the phone size is the landing's. */
export const DASH_HEADING = "m-0 font-serif text-[2rem] leading-[1.2] font-normal text-text-strong sm:text-[2.75rem]";
/** Keys and usage, and Settings (#190, boards 28 and 28g): links under the heading on a hairline, the current one underlined in the accent. */
export const DASH_TABS = "mt-[2.875rem] border-b border-border sm:mt-[3.4375rem]";
export const DASH_TABS_LIST = "m-0 flex list-none gap-[1.3125rem] p-0 sm:gap-7";
export const DASH_TAB = `-mb-px block border-b-2 border-transparent pb-2.5 font-sans text-[0.9375rem] leading-5 whitespace-nowrap text-text-muted no-underline hover:text-text aria-[current=page]:border-accent aria-[current=page]:font-semibold aria-[current=page]:text-text-strong ${FOCUS_RING}`;
/** The first section under the tab bar: API keys, or Plan. */
export const DASH_FIRST_SECTION = "mt-11 sm:mt-[3.125rem]";
export const DASH_SECTION = "mt-11 sm:mt-[3.25rem]";
export const DASH_SECTION_HEADING = DEV_SECTION_HEADING;
/** API keys, with Create key at the right, on a phone too. */
export const DASH_SECTION_HEAD = "flex items-center justify-between gap-6";
/** Usage, with its total at the right; on a phone the total goes under the heading. */
export const DASH_USAGE_HEAD = "flex flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-6";
export const DASH_USAGE_NOTE = "m-0 font-sans text-[0.8125rem] leading-5 text-text-muted";
/** Create key, the board's own 39 px. */
export const DASH_CREATE_BUTTON = `inline-flex h-[2.4375rem] cursor-pointer items-center justify-center rounded-[4px] border border-accent bg-accent px-[1.1875rem] font-sans text-[0.875rem] font-semibold whitespace-nowrap text-surface ${FOCUS_RING}`;

/** The live keys: a table in a hairline box; on a phone one card per key, with no column heads. */
export const DASH_KEYS_CARD = "mt-[1.0625rem] rounded-[6px] border border-border sm:mt-[0.9375rem]";
export const KEYS_TABLE = "w-full border-collapse text-left max-sm:block";
export const KEYS_HEAD_ROW = "max-sm:hidden";
export const KEYS_HEAD = "h-[2.4375rem] border-b border-border px-0 font-sans text-[0.78125rem] font-normal text-text-muted first:w-[13.75rem] first:pl-5 [&:nth-child(2)]:w-[9.375rem] [&:nth-child(3)]:w-[16.25rem] [&:nth-child(4)]:w-[8.125rem] [&:nth-child(5)]:w-[8.125rem]";
export const KEYS_BODY = "max-sm:block";
export const KEYS_ROW =
  "border-b border-border last:border-b-0 max-sm:flex max-sm:flex-wrap max-sm:items-baseline max-sm:px-4 max-sm:pt-3 max-sm:pb-[0.65625rem] sm:h-[2.875rem] sm:last:h-[2.8125rem]";
const KEYS_TEXT = "p-0 font-sans text-[0.9375rem] leading-5 sm:text-[0.875rem]";
export const KEYS_NAME = `${KEYS_TEXT} text-text-strong wrap-anywhere max-sm:block max-sm:min-w-0 max-sm:flex-1 sm:pl-5`;
export const KEYS_PREFIX = "p-0 font-mono text-[0.8125rem] leading-5 sm:text-[0.875rem] whitespace-nowrap text-text max-sm:order-2 max-sm:-mt-0.5 max-sm:block max-sm:w-full";
const KEYS_WHEN = `${KEYS_TEXT} whitespace-nowrap text-text max-sm:order-3 max-sm:mt-[0.1875rem] max-sm:inline max-sm:text-[0.75rem] max-sm:text-text-muted`;
export const KEYS_CREATED = KEYS_WHEN;
export const KEYS_LAST_USED = KEYS_WHEN;
/** What a key may call and when it expires (#187): on a phone, a line each under Created and Last used. */
export const KEYS_ENDPOINTS =
  "py-0 pr-4 pl-0 font-sans text-[0.9375rem] leading-5 text-text max-sm:order-5 max-sm:mt-[0.1875rem] max-sm:block max-sm:w-full max-sm:pr-0 max-sm:text-[0.75rem] max-sm:text-text-muted sm:py-3 sm:text-[0.875rem]";
/** Only some: the endpoints' names, as the checklist writes them. */
export const KEYS_ENDPOINT_NAMES = "font-mono text-[0.8125rem] max-sm:text-[0.75rem]";
export const KEYS_EXPIRES = `${KEYS_TEXT} whitespace-nowrap text-text max-sm:order-6 max-sm:mt-[0.1875rem] max-sm:block max-sm:w-full max-sm:text-[0.75rem] max-sm:text-text-muted`;
/** Ends a phone card's Created line, so the endpoints start their own. */
export const KEYS_PHONE_BREAK = "hidden p-0 max-sm:order-4 max-sm:block max-sm:h-0 max-sm:basis-full";
/** "Created " and " · Last used ": a phone's card names what the table's heads name. */
export const KEYS_PHONE_LABEL = "sm:hidden";
export const KEYS_ACTION = "p-0 text-right max-sm:order-1 max-sm:block sm:pr-5 sm:pl-4";
export const KEYS_REVOKE = `cursor-pointer border-0 bg-transparent p-0 font-sans text-[0.8125rem] leading-5 text-warning ${FOCUS_RING}`;

/** Usage: the account's 30 days as bars, today in the accent. */
export const USAGE_CARD =
  "mt-[0.84375rem] h-[8.75rem] rounded-[6px] border border-border bg-surface-raised p-[0.6875rem] sm:mt-[1.125rem] sm:h-[11.25rem] sm:px-[1.1875rem] sm:pt-[1.8125rem] sm:pb-[0.9375rem]";
export const USAGE_CHART = "flex h-full w-full items-end gap-[3px] sm:gap-1.5";
export const USAGE_DAY = "block h-full min-w-0 flex-1";
export const USAGE_BAR = "fill-border-strong";
export const USAGE_BAR_TODAY = "fill-accent";
/** This period's calls against the plan's allowance (board 28i): a 6 px track the width of the column, filled in the accent. */
export const USAGE_METER = "mt-[1.125rem] sm:mt-4";
export const USAGE_METER_TRACK = "block h-1.5 w-full overflow-hidden rounded-full bg-border";
export const USAGE_METER_FILL = "block h-full rounded-full bg-accent";

/** The plan and account cards: what they say on the left, the action on the right; on a phone, under it. */
const ROW_CARD = "flex flex-col items-start rounded-[6px] border border-border bg-surface-raised sm:flex-row sm:items-center sm:justify-between sm:gap-6";
/** The Plan card (board 28i): its title and line on the left, its buttons on the right; on a phone, under them. */
export const PLAN_CARD = `${ROW_CARD} mt-4 gap-4 sm:mt-[1.125rem] px-4 pt-[1.125rem] pb-[1.1875rem] sm:px-6 sm:py-5`;
export const DASH_ROW_CARD = `${ROW_CARD} mt-4 sm:mt-[1.125rem] px-4 pt-[1.125rem] pb-[1.0625rem] sm:h-[4.875rem] sm:px-6 sm:py-0`;
/** `No plan yet`, `Pro · $49 / month`. */
export const PLAN_TITLE = "m-0 font-serif text-[1.375rem] leading-8 font-normal text-text-strong";
/** What the plan allows and when it renews or ends, under the title. */
export const PLAN_LINE = "m-0 mt-[0.1875rem] font-sans text-[0.875rem] leading-5 text-text-muted";
/** Past due: the payment warning in the line's place. */
export const PLAN_WARNING = "m-0 mt-[0.1875rem] font-sans text-[0.875rem] leading-5 text-warning";
export const PLAN_BUTTONS = "flex shrink-0 flex-wrap gap-4";
const PLAN_BUTTON = `inline-flex h-[2.3125rem] cursor-pointer items-center justify-center rounded-[4px] border px-[1.1875rem] font-sans text-[0.875rem] font-semibold whitespace-nowrap no-underline ${FOCUS_RING}`;
/** Choose Pro, and Manage billing when a payment failed: filled in the accent. */
export const PLAN_BUTTON_PRIMARY = `${PLAN_BUTTON} border-accent bg-accent text-surface`;
/** Choose Starter, and Manage billing otherwise: outlined. */
export const PLAN_BUTTON_OUTLINE = `${PLAN_BUTTON} border-border-strong bg-transparent text-text-strong hover:border-text-muted`;
/**
 * A suspended account's one card (#573), with no board of its own: the Plan
 * card's box, title and line, with Delete account where the plan's buttons go.
 * Nothing sits above it, so it starts where the dashboard's heading would.
 */
export const SUSPENDED_CARD = `${ROW_CARD} px-4 pt-[1.125rem] pb-[1.1875rem] sm:px-6 sm:py-5`;
export const SUSPENDED_TITLE = PLAN_TITLE;
export const SUSPENDED_LINE = PLAN_LINE;
/** The account card's words, 2.5 px under the card's middle on a wide screen (board 28). */
export const ACCOUNT_TEXT = "sm:pt-[0.3125rem]";
export const ACCOUNT_TITLE = "m-0 font-sans text-[0.9375rem] leading-5 font-semibold text-text-strong";
export const ACCOUNT_DETAIL = "m-0 font-sans text-[0.84375rem] leading-5 text-text-muted wrap-anywhere";
/** Delete account: outlined in `warning`, the one destructive action; a link, since it opens the confirmation. */
export const BUTTON_DANGER_OUTLINE = `inline-flex h-[2.3125rem] shrink-0 cursor-pointer items-center rounded-[4px] border border-warning bg-transparent px-[1.0625rem] font-sans text-[0.875rem] font-semibold whitespace-nowrap text-warning no-underline max-sm:mt-3 ${FOCUS_RING}`;
export const BUTTON_DANGER = `inline-flex h-[2.3125rem] cursor-pointer items-center rounded-[4px] border border-warning bg-warning px-[1.0625rem] font-sans text-[0.875rem] font-semibold whitespace-nowrap text-surface ${FOCUS_RING}`;

/**
 * A dialog over the dashboard (boards 28b to 28e and 30), Base UI's (ADR 0010):
 * the page behind dimmed, the box in the middle of the screen, scrolling when
 * it is taller than the screen; on a phone, the width of the screen less 20 px a side.
 */
export const MODAL_BACKDROP = "fixed inset-0 z-50 bg-surface/70";
export const MODAL_VIEWPORT = "fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-5 py-5";
const MODAL_BOX = "relative w-full rounded-[8px] border border-border-strong bg-surface-raised p-[1.4375rem] outline-none sm:p-[1.9375rem]";
/** The revoke and delete confirmations (boards 28d and 30). */
export const CONFIRM_BOX = `${MODAL_BOX} sm:max-w-[32.5rem]`;
export const MODAL_TITLE = "m-0 font-serif text-[1.5rem] leading-[2.375rem] font-normal text-text-strong sm:text-[1.625rem] sm:leading-[2.5625rem]";

/**
 * Board 28e: the create dialog once the key is made. The title; the key's
 * name, endpoints and expiry in one muted line; its secret with Copy under it;
 * the once-only note; Done.
 */
export const KEY_CREATED_SUMMARY = "m-0 mt-3.5 sm:mt-[1.125rem] font-sans text-[0.8125rem] leading-5 text-text-muted wrap-anywhere";
export const KEY_SECRET = "mt-3 flex flex-col items-start gap-2 rounded-[4px] border border-border bg-surface px-3.5 pt-3 pb-2.5 sm:mt-[1.125rem]";
export const KEY_SECRET_TEXT = "m-0 min-w-0 flex-1 font-mono text-[0.84375rem] leading-5 break-all text-text-strong";
export const KEY_COPY = `inline-flex shrink-0 cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 font-sans text-[0.8125rem] leading-5 text-accent ${FOCUS_RING}`;
export const KEY_COPY_ICON = "size-4";
export const KEY_CREATED_NOTE = "m-0 mt-3.5 sm:mt-[1.125rem] font-sans text-[0.84375rem] leading-5 text-text";
export const KEY_CREATED_ACTIONS = "mt-5 flex justify-end sm:mt-[1.625rem]";
/** Done: the board's 76 × 37 px. */
export const KEY_DONE = `inline-flex h-[2.3125rem] cursor-pointer items-center rounded-[4px] border border-accent bg-accent px-[1.1875rem] font-sans text-[0.875rem] font-semibold whitespace-nowrap text-surface ${FOCUS_RING}`;

/**
 * Board 28b: the title; Name, its field and hint; Endpoints, All endpoints or
 * Only some, and its hint; Expires, its select and hint; Cancel and Create
 * key. Board 28c: Only some ticked, the hint gives way to the checklist of
 * endpoints. The same on a phone (28bm), where the Endpoints hint wraps.
 */
export const CREATE_KEY_BOX = `${MODAL_BOX} sm:max-w-[37.5rem]`;
const CREATE_KEY_LABEL_TEXT = "block font-sans text-[0.84375rem] leading-[1.0625rem] font-semibold text-text-strong";
export const CREATE_KEY_LABEL = `${CREATE_KEY_LABEL_TEXT} mt-[1.1875rem] mb-2`;
/** Name, under the title. */
export const CREATE_KEY_LABEL_FIRST = `${CREATE_KEY_LABEL_TEXT} mt-[1.125rem] mb-2`;
const CREATE_KEY_CONTROL =
  "block h-[2.375rem] w-full rounded-[4px] border border-border-strong bg-surface px-3.5 font-sans text-[0.9375rem] text-text-strong outline-none focus:border-accent";
export const CREATE_KEY_INPUT = `${CREATE_KEY_CONTROL} placeholder:text-text-muted`;
export const CREATE_KEY_HINT = "m-0 mt-2 font-sans text-[0.78125rem] leading-[1.1875rem] text-text-muted";

/** All endpoints and Only some, side by side at every width. */
export const CREATE_KEY_SCOPES = "grid grid-cols-2 gap-2";
/** One choice: outlined; ticked, on the page's own surface with an accent outline and bright text. */
export const CREATE_KEY_SCOPE =
  "flex h-[2.3125rem] cursor-pointer items-center gap-[0.5625rem] rounded-[4px] border border-border-strong pl-2.5 font-sans text-[0.875rem] text-text has-[[data-checked]]:border-accent has-[[data-checked]]:bg-surface has-[[data-checked]]:text-text-strong has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent";
/** Base UI's radio (ADR 0010), its circle: 18 px in `border-strong`; ticked, a 20 px accent ring round the surface. */
export const CREATE_KEY_RADIO =
  "m-px size-[1.125rem] shrink-0 cursor-pointer rounded-full border-[1.5px] border-border-strong outline-none data-checked:m-0 data-checked:size-5 data-checked:border-[5px] data-checked:border-accent";

/** Board 28c's checklist: the 8 endpoints in two columns, shown only while Only some is ticked. */
export const CREATE_KEY_CHECKLIST = "m-0 mt-2 grid grid-cols-2 gap-x-2.5 gap-y-3.5 rounded-[4px] border border-border px-2.5 py-3";
export const CREATE_KEY_CHECK = "flex cursor-pointer items-center gap-3 font-mono text-[0.8125rem] leading-[1.125rem] text-text has-[[data-checked]]:text-text-strong";
/** Base UI's checkbox (ADR 0010): an 18 px box; ticked, filled with the accent. */
export const CREATE_KEY_CHECKBOX = `flex size-[1.125rem] shrink-0 cursor-pointer items-center justify-center rounded-[4px] border border-border-strong data-checked:border-accent data-checked:bg-accent ${FOCUS_RING}`;
/** The tick, drawn in a ticked box in the page's surface colour. */
export const CREATE_KEY_TICK = "h-auto w-2.5 text-surface";

/** Expires: the select, its value muted while it says Never, and a chevron where the native arrow was. */
export const CREATE_KEY_SELECT_WRAP = "relative";
export const CREATE_KEY_SELECT = `${CREATE_KEY_CONTROL} cursor-pointer appearance-none pr-10 has-[option[value=never]:checked]:text-text-muted`;
export const CREATE_KEY_CHEVRON = "pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-text-muted";

/** A field's problem, under it: the hint's size, in `warning` (#187). */
export const CREATE_KEY_PROBLEM = "m-0 mt-2 font-sans text-[0.78125rem] leading-[1.1875rem] text-warning";
/** Why a dialog's form was refused when no one field is at fault (an expired form, the key-creation limit, an outage): as a field's problem, above the buttons. */
export const DIALOG_FAILURE = CREATE_KEY_PROBLEM;

export const CREATE_KEY_ACTIONS = "mt-7 flex justify-end gap-2.5";
/** Create key; disabled while the form cannot be sent, as the report box's Send is. */
export const CREATE_KEY_SUBMIT = `inline-flex h-[2.3125rem] cursor-pointer items-center rounded-[4px] border border-accent bg-accent px-[1.0625rem] font-sans text-[0.875rem] font-semibold whitespace-nowrap text-surface disabled:cursor-not-allowed disabled:border-border disabled:bg-border disabled:text-text-muted ${FOCUS_RING}`;

/** Boards 28d and 30: the question, what it does, Cancel and the destructive action. */
export const CONFIRM_ACTIONS = "mt-6 flex justify-end gap-2.5";
export const CONFIRM_TEXT = "m-0 mt-[0.9375rem] sm:mt-4 font-sans text-[0.90625rem] leading-[1.375rem] text-text";
/** Cancel in every dashboard dialog: outlined, secondary. */
export const DIALOG_CANCEL = `inline-flex h-[2.3125rem] cursor-pointer items-center rounded-[4px] border border-border-strong bg-transparent px-[1.0625rem] font-sans text-[0.875rem] whitespace-nowrap text-text-strong no-underline hover:border-text-muted ${FOCUS_RING}`;

/**
 * Board 28f: the dashboard's toasts, Base UI's (ADR 0010), stacked at the
 * screen's bottom right, the newest lowest; on a phone, the width of the
 * screen less 20 px a side. Each is a 42 px bar: a tick in `accent` for a
 * success or an alert in `warning` for an error, the message, and ×.
 */
export const TOAST_VIEWPORT = "fixed right-5 bottom-5 left-5 z-[60] flex flex-col-reverse gap-3 outline-none sm:right-8 sm:bottom-8 sm:left-auto sm:w-[22.5rem]";
export const TOAST = "flex items-center gap-2.5 rounded-[6px] border border-border-strong bg-surface-raised py-2.5 pr-3.5 pl-4 outline-none data-limited:hidden";
export const TOAST_SUCCESS_ICON = "h-auto w-3.5 shrink-0 text-accent";
export const TOAST_ERROR_ICON = "size-4 shrink-0 text-warning";
export const TOAST_TEXT = "m-0 min-w-0 flex-1 font-sans text-[0.875rem] leading-5 text-text-strong";
/** × on a toast: an 11 px cross in an 18 px box. */
export const TOAST_X = `flex size-[1.125rem] shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-text-muted hover:text-text ${FOCUS_RING}`;
export const TOAST_X_ICON = "size-[0.6875rem]";
