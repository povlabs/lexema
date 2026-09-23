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
// The sizes follow Huey's design frames (`ss for designs/`, frames 00–06 and
// C1–C2) read at 1440 px. Three faces, three jobs: the interface — labels,
// buttons, counts, header-bar values — is sans; the source's Italian —
// headword, glosses, examples, etymology, related-word chips — is serif; word
// forms, pronunciation and syllables are mono.

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
export const SITE_FOOTER = "mt-16 border-t border-border";
export const SITE_FOOTER_INNER = `${COLUMN} flex flex-wrap items-center justify-between gap-4 py-8`;
export const SITE_FOOTER_NAME = "font-serif text-base text-text-strong";
export const SITE_FOOTER_LINKS = "m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0";
export const SITE_FOOTER_LINK = `font-sans text-[0.8rem] text-text-muted no-underline hover:text-text ${FOCUS_RING}`;

/**
 * Frame 00: before a query the page is the name and the bar, centred on the
 * screen, with nothing else competing (design-system-manifest.md § "The page").
 */
export const SHELL_CENTRED = `${COLUMN} flex flex-1 flex-col items-center justify-center py-16 text-center`;
export const HOME_NAME = "m-0 mb-10 font-serif text-[3.75rem] leading-none font-normal text-text-strong";

/** With a query: the bar at the top of the column, the word below it. */
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
  "w-full min-w-0 bg-transparent py-3 pr-12 pl-11 font-serif text-lg text-text-strong outline-none placeholder:font-sans placeholder:text-base placeholder:text-text-muted [&::-webkit-search-cancel-button]:appearance-none";
export const SEARCH_CLEAR = `absolute right-3 flex size-7 items-center justify-center font-sans text-lg text-text-muted no-underline hover:text-text ${FOCUS_RING}`;
export const SEARCH_HINT =
  "pointer-events-none absolute right-4 font-sans text-[0.65rem] tracking-[0.12em] text-text-muted";

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

// The word ----------------------------------------------------------------

export const WORD_HEADING =
  "m-0 mt-10 font-serif text-[4rem] leading-none font-normal text-text-strong sm:text-[5.5rem]";

/** Pronunciation and syllables, between two hairlines. */
export const WORD_STRIP = "mt-10 flex flex-wrap border-y border-border py-4";
export const WORD_STRIP_FACT =
  "flex min-w-0 flex-col gap-1 border-l border-border px-8 first:border-l-0 first:pl-0";
export const WORD_STRIP_VALUE = "m-0 font-mono text-lg text-text-strong";
export const WORD_STRIP_NOTE = "ml-2 font-sans text-[0.75rem] text-text-muted";

/** The reading index: compact bordered chips, one per card. */
export const READING_INDEX = "mt-6 border-b border-border pb-8";
export const INDEX_LIST = "m-0 flex list-none flex-wrap gap-2 p-0";
export const INDEX_LINK = `flex max-w-full items-center gap-2 rounded-[3px] border border-border-strong px-3 py-1.5 font-sans text-[0.85rem] text-text-strong no-underline hover:border-accent ${FOCUS_RING}`;
export const INDEX_NUMBER = "font-mono text-[0.8rem] text-accent";
export const INDEX_GLOSS = "max-w-[16rem] truncate font-serif italic text-text-muted";

// Labels, counts and hairlines -------------------------------------------

/** Small caps grey sans: the header bar's labels and every section's name. */
export const LABEL = "font-sans text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

/** A section: its name, a count, and a hairline running to the right edge. */
export const SECTION = "mt-8 first:mt-0";
export const SECTION_HEADER = "mb-4 flex items-center gap-3";
export const SECTION_NAME = `m-0 ${LABEL}`;
export const SECTION_COUNT = "font-sans text-[0.75rem] text-text-muted";
export const SECTION_RULE = "h-px flex-1 bg-border";
/** A one-line note under a section's name: where a derived grouping came from. */
export const SECTION_NOTE = "-mt-1 mb-4 font-sans text-[0.8rem] text-text-muted";

/** A bordered button that reveals the rest of a set in place. */
export const MORE = "group mt-4";
const BUTTON = `inline-flex cursor-pointer list-none items-center gap-2 rounded-[4px] border border-border-strong px-3 py-1.5 font-sans text-[0.8rem] text-text-strong hover:border-accent [&::-webkit-details-marker]:hidden ${FOCUS_RING}`;
export const MORE_BUTTON = BUTTON;
export const MORE_BUTTON_WIDE = `${BUTTON} flex w-full justify-center py-2.5`;
export const MORE_CLOSED = "group-open:hidden";
export const MORE_OPEN = "hidden group-open:inline";
export const CHEVRON = "size-3.5 transition-transform group-open:rotate-180";

// The reading card --------------------------------------------------------

export const CARDS = "mt-8 flex flex-col gap-6";
export const CARD = "min-w-0 scroll-mt-6 overflow-hidden rounded-[6px] border border-border bg-surface-raised";

export const CARD_TITLE = "flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-6 sm:px-8";
export const CARD_NUMBER =
  "flex size-7 shrink-0 items-center justify-center rounded-full bg-accent font-sans text-[0.8rem] font-semibold text-surface";
export const HEADWORD = "m-0 font-serif text-[1.9rem] leading-tight font-normal text-text-strong";
export const POS_PILL = "rounded-[3px] bg-border px-2 py-0.5 font-sans text-[0.8rem] text-text-strong";
export const FORM_OF = "font-serif text-base italic text-text-muted";

/** The header bar: a darker band, facts in one row, hairlines between them. */
export const HEADLINE = "m-0 flex flex-wrap gap-y-3 border-y border-border bg-surface px-5 py-4 sm:px-8";
export const HEADLINE_FACT =
  "flex min-w-0 flex-col gap-1 border-l border-border px-6 first:border-l-0 first:pl-0";
export const HEADLINE_LABEL = LABEL;
export const HEADLINE_VALUE = "m-0 font-sans text-[1.1rem] text-text-strong";
/** A header-bar value that is a word form: mono, like every form. */
export const HEADLINE_FORM = "m-0 font-mono text-[1.05rem] text-text-strong";

export const CARD_BODY = "px-5 py-6 sm:px-8";

/** The line naming what this card does not have, said once. */
export const SILENCE = "mt-0 mb-6 font-sans text-[0.85rem] text-text-muted";
/** A card for a record that lists the searched form without defining it. */
export const MENTION = "mt-0 mb-6 font-sans text-[0.85rem] text-text-muted";

/**
 * A claim later research disputes: the source's text stays as written, and
 * the dispute is said beside it. The one mark in `warning` is the manifest's
 * own use of the role — "the disputed-claim mark".
 */
export const DISPUTED = "mt-0 mb-6 rounded-[4px] border border-border px-4 py-3 font-sans text-[0.85rem] text-text-muted";
export const DISPUTED_MARK = "font-semibold text-warning";
export const DISPUTED_LIST = "mt-2 mb-0 list-disc pl-5";

// What the source wrote --------------------------------------------------

export const DEFINITIONS = "m-0 flex list-none flex-col gap-3 p-0";
export const DEFINITION = "flex gap-5";
export const DEFINITION_NUMBER = "w-5 shrink-0 pt-1 font-mono text-[0.85rem] text-text-muted";
export const GLOSS = "m-0 font-serif text-[1.2rem] text-text";
export const SENSE_LABEL = "font-serif italic text-text-muted";

export const EXAMPLES = "m-0 flex list-none flex-col gap-3 p-0";
export const EXAMPLE =
  "border-l-2 border-border-strong bg-surface px-5 py-4 font-serif text-[1.1rem] italic text-text";

export const ENTRY_NOTE = "flex flex-col gap-2 border-l-2 border-border-strong pl-4 font-serif text-text-muted";

// Boxes -------------------------------------------------------------------

/**
 * The row the boxes sit in: three across on a wide screen, one on a phone.
 * A grid rather than a wrapping flex row, so three is the count at the wide
 * breakpoint rather than whatever the box widths happen to allow.
 */
export const BOX_ROW = "grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3";
export const BOX = "min-w-0 rounded-[4px] border border-border bg-surface";
/** A box that holds facts: Articles, Gender and number. */
export const BOX_HEADING =
  "m-0 border-b border-border px-4 py-2.5 font-sans text-[0.85rem] font-semibold text-text-strong";
/** A tense box's name: italic serif, as the conjugation frames draw it. */
export const TENSE_HEADING =
  "m-0 border-b border-border px-4 py-2.5 font-serif text-base italic font-normal text-text-strong";
export const BOX_ROWS = "m-0 flex flex-col gap-0.5 px-2 py-2";
const LINE = "flex items-baseline gap-4 rounded-[4px] border-2 px-2 py-0.5";
const ROW_LABEL = "m-0 w-[7.5rem] shrink-0 font-sans text-[0.75rem]";
const CELL = "m-0 min-w-0 break-words font-mono text-[0.95rem]";
export const BOX_LINE = `${LINE} border-transparent`;
export const BOX_ROW_LABEL = `${ROW_LABEL} text-text-muted`;
export const BOX_CELL = `${CELL} text-text`;
/** A note under a box's rows: where the derived articles came from. */
export const BOX_NOTE = "m-0 border-t border-border px-4 py-2 font-sans text-[0.72rem] text-text-muted";

/**
 * The searched form, outlined where it sits — by a border, never by colour
 * alone, and said in words beside it. `accent` rather than `border-strong`
 * because the border has to be seen: `border-strong` is under the 3:1 a
 * non-text indicator needs on this palette.
 */
export const SEARCHED = `${LINE} border-accent`;
export const SEARCHED_LABEL = `${ROW_LABEL} text-accent`;
export const SEARCHED_CELL = `${CELL} font-semibold text-accent`;
export const SEARCHED_NOTE = "ml-auto shrink-0 font-sans text-[0.7rem] text-accent";

// The lemma panel ---------------------------------------------------------

export const LEMMA_PANEL =
  "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[4px] border border-border-strong bg-surface px-5 py-4";
export const LEMMA_ARROW = "font-sans text-lg text-accent";
export const LEMMA_BODY = "flex min-w-0 flex-1 flex-col gap-1";
export const LEMMA_WORD = "m-0 font-serif text-[1.25rem] text-text-strong";
export const LEMMA_LINE = "m-0 font-sans text-[0.8rem] text-text-muted";
export const LEMMA_OPEN = `font-sans text-[0.85rem] text-accent no-underline hover:underline ${FOCUS_RING}`;

// The word-level section --------------------------------------------------

export const WORD_SECTION = "mt-10 border-t border-border-strong pt-8";
export const ETYMOLOGIES = "grid grid-cols-1 gap-4 md:grid-cols-2";
export const ETYMOLOGY_SINGLE = "grid grid-cols-1";
export const ETYMOLOGY =
  "m-0 rounded-[4px] border border-border bg-surface-raised px-5 py-4 font-serif text-[1.05rem] text-text";
export const ETYMOLOGY_LABEL = "mb-2 block font-sans text-[0.75rem] font-semibold text-warning";

export const CHIPS = "m-0 flex list-none flex-wrap gap-2 p-0";
export const CHIP = `block rounded-[3px] border border-border bg-surface-raised px-3 py-1 font-serif text-base text-text no-underline hover:border-border-strong ${FOCUS_RING}`;

export const SOURCE_LINE = "mt-10 border-t border-border pt-8 flex flex-wrap gap-6";
export const SOURCE_LINK = `inline-flex items-center gap-1.5 font-sans text-[0.85rem] text-text no-underline hover:text-accent ${FOCUS_RING}`;
export const ICON = "size-3.5";

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
