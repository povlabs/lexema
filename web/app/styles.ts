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

/** The one column every page is laid out in, and the chrome lines up with. */
const COLUMN = "mx-auto w-full max-w-[75rem] px-4 sm:px-6";

/** The focus ring the manifest rules: `accent`, and never removed. */
const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** The dark scheme itself: `surface` under everything, `text` on top of it. */
export const BODY = "flex min-h-screen flex-col bg-surface font-serif text-base text-text";

export const LINK = `text-accent underline ${FOCUS_RING}`;

// Page chrome -------------------------------------------------------------

/** C1: a full-width bar, the name at the left, a hairline under it. */
export const TOP_BAR = "border-b border-border";
export const TOP_BAR_INNER = `${COLUMN} flex h-16 items-center`;
export const TOP_BAR_NAME = `font-serif text-xl text-text-strong no-underline ${FOCUS_RING}`;

/** C2: the name at the left, four small links at the right. */
/**
 * The site footer's rule sits the Source line's gap below the page: the
 * shell's `pb-4` plus this margin make 48px, 36px on a phone.
 */
export const SITE_FOOTER = "mt-5 border-t border-border sm:mt-8";
export const SITE_FOOTER_INNER = `${COLUMN} flex flex-wrap items-center justify-between gap-4 py-8`;
/** The footer's wordmark, a link home like the top bar's. */
export const SITE_FOOTER_NAME = `font-serif text-base text-text-strong no-underline ${FOCUS_RING}`;
export const SITE_FOOTER_LINKS = "m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0";
export const SITE_FOOTER_LINK = `font-sans text-[0.8rem] text-text-muted no-underline hover:text-text ${FOCUS_RING}`;

/**
 * Frame 00: before a query the page is the name and the bar, centred on the
 * screen, with nothing else competing (design-system-manifest.md § "The page").
 */
export const SHELL_CENTRED = `${COLUMN} flex flex-1 flex-col items-center justify-center py-16 text-center`;
export const HOME_NAME = "m-0 font-serif text-[3.75rem] leading-none font-normal text-text-strong";
/** Under the wordmark on the home page: its pronunciation, as a word's is drawn, then what it is. */
export const HOME_PRONUNCIATION = "m-0 mt-4 font-mono text-base text-text-muted sm:text-lg";
export const HOME_TAGLINE = "m-0 mt-1 mb-10 font-serif text-[1.1rem] italic text-text-muted";

/**
 * With a query: the bar at the top of the column, the word below it. The
 * column grows to fill the window, so on a short page the footer sits at the
 * bottom of the window and the extra room falls between Source and the
 * footer; the Source line's own gap below it (design-system-manifest.md §
 * "Layout") is the minimum, and a long page is unchanged.
 */
export const SHELL_TOP = `${COLUMN} flex-1 pt-6 pb-4`;

// The search field --------------------------------------------------------

export const SEARCH_FORM = "w-full max-w-[40rem]";
export const SEARCH_FIELD =
  "relative flex w-full items-center rounded-[4px] border border-border-strong bg-surface-raised focus-within:border-accent";
export const SEARCH_ICON = "pointer-events-none absolute left-4 size-4 text-text-muted";
/**
 * The browser's own clear button on a `type="search"` field is hidden: it is
 * drawn in the browser's blue, not a role, and sat on top of the field's own
 * `×` and `ENTER` hint once typing opened the suggestion list.
 */
export const SEARCH_INPUT =
  "w-full min-w-0 bg-transparent py-3 pr-24 pl-11 font-serif text-lg text-text-strong outline-none placeholder:font-sans placeholder:text-base placeholder:text-text-muted [&::-webkit-search-cancel-button]:appearance-none";
/**
 * The right end of the bar: the shortcut hint, the `ENTER` hint and the `×`,
 * in one row centred on the input. Each sits in a box of the same height with
 * its glyph centred in it, so their centres line up with each other and with
 * the typed text.
 */
export const SEARCH_TRAILING = "pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1.5";
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
 * highlighted row is outlined in `accent` the way the searched form is outlined
 * in a paradigm box, and carries the field's own `ENTER` hint in words, so it is
 * never marked by colour alone. It is never taller than the room left under the
 * field — on a phone, the room above the open keyboard — and scrolls within
 * itself instead.
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

/** Frame 00: `Try` and a row of bordered chips under the field. */
export const TRY_ROW = "mt-8 flex flex-wrap items-center justify-center gap-2";
export const TRY_LABEL = "mr-1 font-sans text-[0.8rem] text-text-muted";
export const TRY_CHIP = `rounded-[3px] border border-border bg-surface-raised px-2.5 py-1 font-serif text-[0.9rem] text-text no-underline hover:border-border-strong ${FOCUS_RING}`;

// What the page says about itself ----------------------------------------

const MESSAGE = "my-6 font-sans text-[0.95rem]";

/** The loading line, and every place the page says the source is silent. */
export const PENDING = `${MESSAGE} text-text-muted`;
export const EMPTY = `${MESSAGE} text-text-muted`;
/** A lookup that could not run, or a query the page refused. */
export const ERROR = `${MESSAGE} text-warning`;
/** A small aside beside a value. */
export const MUTED = "font-sans text-[0.85rem] text-text-muted";
/** Something the source left open, said plainly and never in colour alone. */
export const AMBIGUOUS = "font-sans text-[0.85rem] text-text-muted";

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
  "m-0 mt-12 font-serif text-[3.25rem] leading-none font-normal break-words text-text-strong sm:mt-16 sm:text-[4.5rem]";
/** The IPA under the headword. */
export const PRONUNCIATION = "m-0 mt-4 font-mono text-base text-text-muted sm:mt-6 sm:text-lg";
export const PRONUNCIATION_NOTE = "ml-2 font-sans text-[0.75rem]";

/** Jump links, one per reading, for three readings or more. */
export const JUMP_LINKS = "m-0 mt-4 flex list-none flex-wrap gap-x-5 gap-y-1 p-0";
export const JUMP_LINK = `font-sans text-[0.85rem] text-text no-underline ${FOCUS_RING}`;
export const JUMP_NUMBER = "mr-1.5 text-accent";

/** A reading: a heading and its blocks, with a thin rule before every one after the first. */
/**
 * The page's vertical rhythm, one value per kind of gap (desktop / phone):
 * 40 / 28 on either side of a rule between readings and before the first
 * reading; 28 / 22 between blocks inside a reading; 32 / 24 between the word's
 * own blocks; 48 / 36 above and below Source. Each gap is the top edge of the
 * thing below it, so an empty section adds nothing.
 */
export const READINGS = "mt-7 sm:mt-10";
export const READING =
  "scroll-mt-6 mt-7 border-t border-border pt-7 first:mt-0 first:border-t-0 first:pt-0 sm:mt-10 sm:pt-10";
export const READING_HEADING =
  "m-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 font-sans text-[0.95rem] font-semibold text-text-strong";
export const READING_NUMBER = "font-normal text-accent";
export const READING_DOT = "font-normal text-text-muted";
/** The record's own gender and number after the part of speech, muted: `maschile, singolare`. */
export const READING_GRAMMAR = "font-normal text-text-muted";
export const READING_GRAMMAR_GROUP = "inline-flex items-baseline gap-2.5";

/** A small grey label over a block: Definitions, Forms, Etymology, Synonyms. */
export const BLOCK = "mt-[1.375rem] sm:mt-7";
/** A block of the word's own facts, after the readings; the first sits right under the rule. */
export const WORD_BLOCK = "mt-6 first:mt-0 sm:mt-8";
export const BLOCK_LABEL = "m-0 mb-3 font-sans text-[0.8rem] font-normal text-text-muted";
export const BLOCK_LABEL_WORD = "ml-2 font-semibold text-text-strong";

/** A record that lists the searched form without defining it, said plainly. */
export const MENTION = "m-0 mt-4 font-sans text-[0.85rem] text-text-muted";

/**
 * A claim later research disputes: the source's text stays as written, and
 * the dispute is said beside it. `warning` is the manifest's "disputed-claim mark".
 */
export const DISPUTED = "mt-6 mb-0 font-sans text-[0.85rem] text-text-muted";
export const DISPUTED_MARK = "font-semibold text-warning";
export const DISPUTED_LIST = "mt-2 mb-0 list-disc pl-5";

export const DEFINITIONS = "m-0 flex list-none flex-col gap-4 p-0";
export const DEFINITION = "flex gap-4";
export const DEFINITION_NUMBER = "w-5 shrink-0 pt-1 font-mono text-[0.85rem] text-text-muted";
export const DEFINITION_BODY = "min-w-0 flex-1";
export const GLOSS = "m-0 max-w-[48rem] font-serif text-[1.2rem] leading-snug text-text-strong wrap-anywhere sm:text-[1.3rem]";
export const SENSE_LABEL = "italic text-text-muted";
/** The word a form-of definition names, linked to its own search. */
export const GLOSS_LINK = `text-accent no-underline ${FOCUS_RING}`;
/** The items of a list a definition opens with a colon (#123), nested under it. */
export const SUB_ITEMS = "mt-2 mb-0 flex list-disc flex-col gap-2 pl-5 marker:text-text-muted";
export const EXAMPLE = "m-0 mt-2 max-w-[48rem] font-serif text-[1.05rem] italic text-text-muted";
/** The first definition's other examples: in the document, shown once the reading's `more` control is open. */
export const EXAMPLE_EXTRA = `${EXAMPLE} hidden group-has-[details[open]]/definitions:block`;
/** The first definition and the reading's one `more` control, which reveals everything else. */
export const DEFINITIONS_GROUP = "group/definitions";
export const EXAMPLE_FROM = "ml-2.5 whitespace-nowrap font-sans text-[0.75rem] not-italic text-text-muted";

/** `N more definitions`: a native `<details>`, so every definition is in the document. */
export const MORE = "group mt-4";
export const MORE_SUMMARY = `inline-block cursor-pointer list-none font-sans text-[0.85rem] text-accent [&::-webkit-details-marker]:hidden ${FOCUS_RING}`;
export const MORE_CLOSED = "group-open:hidden";
export const MORE_OPEN = "hidden group-open:inline";
export const MORE_LIST = "mt-4";

/**
 * Columns singolare and plurale with a gender column before them; on a phone
 * two columns, with each gender's label over its pair.
 */
export const GRID = "grid grid-cols-2 gap-x-6 sm:grid-cols-[7rem_15rem_15rem]";
export const GRID_CORNER = "max-sm:hidden";
export const GRID_HEAD = "pb-3 font-sans text-[0.75rem] text-text-muted";
export const GRID_GENDER = "pt-1 font-sans text-[0.75rem] text-text-muted max-sm:col-span-2 max-sm:pt-0 max-sm:pb-1.5 max-sm:font-semibold";
export const GRID_CELL = "min-w-0 pb-4";
/** One spelling of a cell and its article line; a second spelling sits under the first. */
export const GRID_SPELLING = "[&+&]:mt-2";
export const GRID_FORM = "m-0 font-mono text-[1.05rem] text-text-strong wrap-anywhere";
export const GRID_ARTICLES = "m-0 mt-1 font-mono text-[0.75rem] text-text-muted";
export const GRID_ARTICLE = "max-sm:block";
export const GRID_ARTICLE_DOT = "px-2 max-sm:hidden";
/** A form the source does not give: a dash, with no note. */
export const DASH = "font-mono text-text-muted";
export const GRID_LABEL = "m-0 mt-4 mb-3 font-sans text-[0.75rem] font-semibold text-text-muted";

/** Forms that fit no cell, verbatim, in one last group. */
export const OTHER_FORMS = "m-0 mt-4 flex flex-col gap-1.5";
export const OTHER_FORM = "flex flex-wrap items-baseline gap-x-3";
export const OTHER_FORM_LABEL = "font-sans text-[0.75rem] text-text-muted";

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

/** The compound tenses, behind a `compound tenses` link. */
/** Open, the link sits under the compound tables it hides; the HTML keeps it first. */
export const COMPOUND = "group mt-4 flex flex-col-reverse";
export const MOOD_PANEL = "group/panel";
/** *Tempi semplici* / *Tempi composti*, named only while the compound tenses are open. */
export const TENSE_SET = "m-0 mb-2 font-sans text-[0.8rem] font-semibold text-text-strong";
export const TENSE_SET_SIMPLE = `${TENSE_SET} hidden group-has-[details[open]]/panel:block`;
export const COMPOUND_SUMMARY = `inline-block cursor-pointer list-none font-sans text-[0.85rem] text-accent [&::-webkit-details-marker]:hidden ${FOCUS_RING}`;
export const COMPOUND_TABLES = "mb-4 pt-3";

export const WORD_FACTS = "mt-7 border-t border-border pt-7 sm:mt-10 sm:pt-10";
export const ETYMOLOGY = "m-0 max-w-[48rem] font-serif text-[1.1rem] text-text";
/**
 * An etymology on one line, cut with an ellipsis, and a small accent `+ more`
 * right after the ellipsis; open, the whole text wraps and `less` sits under it.
 * The text takes only its own width, so the control follows it, not the edge.
 */
export const ONE_LINE =
  "group/line flex max-w-[48rem] items-baseline gap-1.5 [&+&]:mt-3 has-[details[open]]:flex-col has-[details[open]]:gap-1";
export const ONE_LINE_TEXT = `${ETYMOLOGY} min-w-0 truncate group-has-[details[open]]/line:whitespace-normal`;
export const ONE_LINE_TOGGLE = "group shrink-0";
export const ONE_LINE_TOGGLE_SUMMARY = `cursor-pointer list-none font-sans text-[0.8rem] text-accent [&::-webkit-details-marker]:hidden ${FOCUS_RING}`;
export const WORD_LIST = "m-0 flex list-none flex-wrap items-baseline gap-x-3 gap-y-2 p-0";
export const WORD_LIST_ITEM = "flex items-baseline gap-3";
/** The words past the first eight: in the document, shown once `+ N more` is open. */
export const WORD_LIST_REST = "hidden group-has-[details[open]]/words:contents";
export const WORD_LINK = `cursor-pointer font-serif text-[1.1rem] text-text-strong no-underline ${FOCUS_RING}`;
export const WORD_DOT = "font-sans text-[0.75rem] text-text-muted";
export const WORD_DOT_BEFORE_REST = "hidden font-sans text-[0.75rem] text-text-muted group-has-[details[open]]/words:inline";
export const WORD_MORE = "group inline";
export const WORD_MORE_SUMMARY = `inline cursor-pointer list-none font-sans text-[0.8rem] text-accent [&::-webkit-details-marker]:hidden ${FOCUS_RING}`;

/** `Source ↗`, with the same space above and below it. */
export const SOURCE_LINE = "mt-9 sm:mt-12 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[0.8rem] text-text-muted";
export const SOURCE_LINK = `inline-flex items-center gap-1.5 text-text-muted no-underline hover:text-text ${FOCUS_RING}`;
export const ICON = "size-3.5";

// The report box (board 22, #51) ----------------------------------------------

/** "Report a mistake", beside Source and in the same small muted type. */
export const REPORT_TRIGGER = `cursor-pointer border-0 bg-transparent p-0 font-sans text-[0.8rem] text-text-muted hover:text-text ${FOCUS_RING}`;
export const REPORT_BACKDROP = "fixed inset-0 bg-surface/70";
/** A small box in the middle of the screen; on a phone, the width of the screen less its margin. */
export const REPORT_POPUP =
  "fixed top-1/2 left-1/2 w-[32.5rem] max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[6px] border border-border-strong bg-surface-raised p-7 outline-none max-sm:p-5";
export const REPORT_X = `absolute top-6 right-6 flex size-7 cursor-pointer items-center justify-center border-0 bg-transparent font-sans text-lg text-text-muted hover:text-text max-sm:top-4 max-sm:right-4 ${FOCUS_RING}`;
export const REPORT_TITLE = "m-0 flex items-center gap-3 pr-10 font-serif text-[1.5rem] font-normal text-text-strong";
export const REPORT_SUBTITLE = "m-0 mt-1 font-sans text-[0.85rem] text-text-muted";
export const REPORT_SUBTITLE_WORD = "ml-1 font-serif text-[1.05rem] text-text-strong";
export const REPORT_FIELD = "m-0 mt-6 border-0 p-0";
export const REPORT_FIELD_LABEL = "mb-2.5 block p-0 font-sans text-[0.85rem] font-semibold text-text-strong";
export const REPORT_OPTIONAL = "ml-1.5 font-normal text-text-muted";
export const REPORT_CHIPS = "flex flex-wrap gap-2";
/** A choice: a native radio, drawn as a chip; the chosen one is outlined in the accent. */
export const REPORT_CHIP =
  "inline-flex cursor-pointer items-center rounded-[3px] border border-border-strong px-3 py-1.5 font-sans text-[0.85rem] text-text hover:border-text-muted has-[:checked]:border-accent has-[:checked]:font-semibold has-[:checked]:text-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent";
export const REPORT_DETAILS =
  "block min-h-28 w-full resize-y rounded-[4px] border border-border-strong bg-surface px-3.5 py-3 font-sans text-[0.9rem] text-text-strong outline-none placeholder:text-text-muted focus:border-accent";
export const REPORT_ERROR = "m-0 mt-4 font-sans text-[0.8rem] text-warning";
/** Try again, after the box could not get its opening token. */
export const REPORT_RETRY = `ml-2 cursor-pointer border-0 bg-transparent p-0 font-sans text-[0.8rem] text-accent underline ${FOCUS_RING}`;
/** "No account needed." on its own line on a phone, Cancel and Send together on the right. */
export const REPORT_FOOTER = "mt-7 flex flex-wrap items-center justify-end gap-x-6 gap-y-3";
export const REPORT_NOTE = "m-0 mr-auto font-sans text-[0.75rem] text-text-muted max-sm:w-full";
export const REPORT_CANCEL = `cursor-pointer border-0 bg-transparent p-0 font-sans text-[0.9rem] text-text hover:text-text-strong ${FOCUS_RING}`;
export const REPORT_SEND = `cursor-pointer rounded-[3px] border-0 bg-accent px-4 py-2 font-sans text-[0.9rem] font-semibold text-surface disabled:cursor-not-allowed disabled:bg-border disabled:font-normal disabled:text-text-muted ${FOCUS_RING}`;
export const REPORT_SENT_CHECK = "font-sans text-base text-accent";
export const REPORT_SENT_TEXT = "m-0 mt-4 font-sans text-[0.9rem] text-text";
export const REPORT_CLOSE = `mt-5 cursor-pointer rounded-[3px] border border-border-strong bg-transparent px-4 py-2 font-sans text-[0.9rem] text-text-strong hover:border-text-muted ${FOCUS_RING}`;

// The attribution page ---------------------------------------------------

/** Prose on the attribution page, where the browser's own margins used to do it. */
export const PARAGRAPH = "my-4";
export const PAGE_HEADING = "m-0 mt-6 font-serif text-[2.5rem] font-normal text-text-strong";
export const SECTION_HEADING = "my-[0.83em] text-2xl font-bold text-text-strong";
export const PROSE_LIST = "my-4 list-disc pl-10";

/** The release identity's rows, which the page omits when it cannot read one. */
export const RELEASE_FIELDS = "my-[0.8rem]";
/** The fields the attribution draft leaves open, which are always shown. */
export const OPEN_FIELDS = RELEASE_FIELDS;
export const FIELD = "my-[0.6rem]";
export const FIELD_LABEL =
  "text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-text-muted";
export const FIELD_VALUE = "mt-[0.15rem] mb-0";
/**
 * The "— open" mark inside a field label. It reads as a sentence rather than
 * as a tag, so it drops the label's own upper-casing and letter-spacing.
 */
export const OPEN_MARK = `${AMBIGUOUS} normal-case tracking-normal`;

/**
 * A release identity: long, and broken wherever it has to be to fit. Every
 * `<code>` already renders in `--font-mono` through Tailwind's base layer.
 */
export const CODE_IDENTITY = "text-[0.85em] break-all";
