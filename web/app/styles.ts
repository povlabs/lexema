// The utility classes each part of the page is drawn with, named once.
//
// ADR 0010 makes Tailwind the styling language and role tokens the only colours
// a component may reach for. The classes themselves live here rather than
// inline in the markup for two reasons: a part drawn the same way in three
// places is one string, not three that drift apart, and `web/test/page.test.tsx`
// imports these same constants, so a test asserting a rendered class asserts the
// string the component actually carries instead of a copy of it.
//
// Every colour here is a role from design-system-manifest.md § "Role tokens: the
// dark scheme" — `bg-surface`, `text-text-muted`, `border-border-strong` and so
// on — declared in `globals.css`. No literal colour appears in this file or in
// any component, and `web/test/tokens.test.ts` fails the build if one is added.
//
// The sizes are today's, to the value: the manifest still lists the type ramp,
// the font family and density under "Not yet ruled", so the move to Tailwind
// carries the existing numbers across rather than inventing a scale. That is why
// a size here is often an arbitrary value (`text-[0.82rem]`) where a rounded
// step of Tailwind's own scale would have changed it.

/** The one column every page is laid out in, 44rem wide and centred. */
const COLUMN = "mx-auto w-full max-w-[44rem] px-[1.1rem]";

/** The padding the page's `main` has carried since the first card. */
const COLUMN_PADDING = "pt-6 pb-16";

/**
 * The page before a query: the bar in the middle of the screen.
 *
 * "Before a query, the page is the search bar alone, centred on the screen with
 * the site name above it and nothing else competing" (design-system-manifest.md
 * § "The page", "Two states"). `min-h-screen` with `justify-center` is what
 * centres it vertically; the column above centres it horizontally.
 */
export const SHELL_CENTRED = `${COLUMN} ${COLUMN_PADDING} flex min-h-screen flex-col justify-center text-center`;

/** The page with a query: the same bar at the top, the results below it. */
export const SHELL_TOP = `mx-auto w-full max-w-[72rem] px-[1.1rem] ${COLUMN_PADDING}`;

/** The dark scheme itself: `surface` under everything, `text` on top of it. */
export const BODY = "min-h-screen bg-surface font-serif text-base text-text";

export const SITE_NAME = "m-0 text-[1.6rem] tracking-[-0.01em] text-text-strong";
export const TAGLINE = "mt-[0.2rem] mb-6 text-[0.95rem] text-text-muted";

/** The focus ring the manifest rules: `accent`, and never removed. */
const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const LINK = `text-accent underline ${FOCUS_RING}`;

// The search bar ----------------------------------------------------------

export const SEARCH_FORM = "flex max-w-[44rem] flex-wrap items-center justify-center gap-2";
export const SEARCH_LABEL =
  "basis-full text-[0.8rem] uppercase tracking-[0.06em] text-text-muted";
export const SEARCH_INPUT = `flex-[1_1_12rem] min-w-0 rounded-[6px] border border-border bg-surface-raised px-[0.7rem] py-[0.6rem] font-serif text-base text-text ${FOCUS_RING}`;
export const SEARCH_BUTTON = `cursor-pointer rounded-[6px] border border-text bg-text px-[1.1rem] py-[0.6rem] font-serif text-base text-surface ${FOCUS_RING}`;

// What the page says about itself ----------------------------------------

const MESSAGE = "my-[1.4rem]";

/**
 * The page's own quiet lines: the opening hint, the loading line, and every
 * place the page says the source is silent.
 *
 * One string for the three, because the stylesheet this replaces styled
 * `.hint`, `.empty` and `.pending` with one rule. What tells them apart on the
 * page is the words in them and the `role` they carry, which is what the tests
 * read them by.
 */
const QUIET_MESSAGE = `${MESSAGE} text-text-muted`;

export const HINT = QUIET_MESSAGE;
export const PENDING = QUIET_MESSAGE;
/** Said where the source says nothing: the card's silence line, and its kin. */
export const EMPTY = QUIET_MESSAGE;
/** A lookup that could not run, or a query the page refused. */
export const ERROR = `${MESSAGE} text-warning`;
export const COUNT = `${MESSAGE} text-[0.9rem] text-text-muted`;

/** Word identity sits above the index; source-only pronunciation waits for #20. */
export const WORD_LAYER = "mt-8 border-b border-border pb-6";
export const WORD_HEADING = "m-0 text-5xl font-semibold text-text-strong";
export const READING_INDEX = "mt-8";
export const INDEX_LIST = "mt-3 grid list-none grid-cols-1 gap-3 p-0 lg:grid-cols-3";
export const INDEX_LINK = `flex h-full flex-col gap-1 rounded-[6px] border border-border bg-surface-raised p-4 no-underline text-text hover:border-accent ${FOCUS_RING}`;
export const INDEX_GLOSS = "line-clamp-2 text-sm text-text-muted";
export const INDEX_NUMBER = "font-mono text-sm text-accent";
export const READING_NUMBER = "mt-8 mb-0 font-mono text-sm text-accent";
export const SECTION_COUNT = "my-2 text-sm text-text-muted";
export const MORE_DETAILS = "my-2";
export const MORE_SUMMARY = `w-fit cursor-pointer text-accent underline ${FOCUS_RING}`;
export const ENTRY_NOTE = "mt-4 border-l-2 border-border-strong pl-4 text-text-muted";

/** A small aside beside a value: a gender, an article's display form. */
export const MUTED = "text-[0.9rem] text-text-muted";
/** Something the source left open, or a spelling it did not split. */
export const AMBIGUOUS = "text-[0.9rem] text-warning";

// The card ---------------------------------------------------------------

/** A boxed, raised group — the shape `surface-raised` and `border` are for. */
const RAISED = "rounded-[6px] border border-border bg-surface-raised";

export const CARD = `${RAISED} mt-2 p-[1.1rem]`;
export const HEADWORD = "m-0 text-xl font-semibold text-text-strong";

export const HEADLINE = "m-0 mt-[0.45rem] flex flex-wrap gap-x-[1.4rem] gap-y-[0.2rem]";
export const HEADLINE_FACT = "flex flex-col";
export const HEADLINE_LABEL = "text-[0.7rem] uppercase tracking-[0.06em] text-text-muted";
export const HEADLINE_VALUE = "m-0 text-[1.05rem]";

/**
 * The row the card's boxes sit in: three across on a wide screen, wrapping to
 * fewer on narrow ones.
 *
 * "Paradigm boxes sit three across on a wide screen, in the order the source's
 * vocabulary gives, wrapping to fewer on narrow screens"
 * (design-system-manifest.md § "The result card", "Three boxes to a row"). A
 * grid rather than a wrapping flex row, so three is the count at the wide
 * breakpoint rather than whatever the box widths happen to allow: one column on
 * a phone, two from `sm`, three from `lg`.
 */
export const BOX_ROW = "mt-4 grid grid-cols-1 items-start gap-[0.9rem] sm:grid-cols-2 lg:grid-cols-3";

/**
 * One mood's own group on a verb card: a heading, and a row of tense boxes
 * under it.
 *
 * "Groups are ordered by the source's own vocabulary — moods, then tenses"
 * (design-system-manifest.md § "The result card"). A mood is a group of boxes
 * rather than a box, so it is not raised itself: what a reader sees raised is
 * the tense boxes inside it.
 */
export const MOOD_GROUP = "mt-4";
export const MOOD_HEADING =
  "m-0 text-[0.82rem] font-semibold uppercase tracking-[0.06em] text-text-strong";

export const BOX = `${RAISED} px-[0.8rem] pt-2 pb-[0.7rem]`;
export const BOX_HEADING =
  "mt-0 mb-[0.3rem] text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-text-muted";

/** A box's rows: `label value`, the label small and grey. */
export const BOX_TABLE = "m-0 border-collapse text-[0.9rem]";
/** A note under a box's rows: where the derived articles came from. */
export const BOX_NOTE = "mt-2 mb-0 text-[0.9rem] text-text-muted";
export const BOX_ROW_LABEL =
  "py-[0.2rem] pr-[0.9rem] text-left align-top text-[0.82rem] font-normal text-text-muted";
export const BOX_CELL = "py-[0.2rem] pr-[0.9rem] text-left align-top font-normal";

/**
 * The searched form, outlined where it sits — by a border, never by colour.
 *
 * The border is `accent` rather than `border-strong` because the rule is only
 * met if the border can be seen: on this palette `border-strong` sits at 1.97:1
 * against `surface-raised`, under the 3:1 a non-text indicator needs, while
 * `accent` is 8.53:1. `lexema-design.pen` marks the row the same way, at
 * `$accent` and two pixels.
 */
export const SEARCHED = "rounded-[4px] border-2 border-accent px-[0.3rem]";

/** A note the reader has to weigh: a mention, a dispute. */
const NOTE = `${RAISED} px-[0.7rem] py-2 text-[0.9rem] text-warning`;

export const MENTION = `${NOTE} mt-[0.4rem]`;
export const DISPUTED = `${NOTE} my-[0.7rem]`;
export const DISPUTED_LIST = "mt-[0.3rem] mb-0 list-disc pl-[1.1rem]";
export const DISPUTED_LINE = "m-0";

// What the source wrote --------------------------------------------------

export const DEFINITIONS = "my-[0.7rem] list-decimal pl-[1.3rem]";
export const DEFINITION = "my-[0.35rem]";
export const GLOSS = "my-[0.1rem]";
export const LABELS = "my-[0.2rem] flex flex-wrap gap-[0.4rem] text-[0.85rem] italic text-text-muted";

export const FORM_LIST = "my-[0.3rem] list-none p-0";
export const FORM_ITEM = "my-[0.3rem]";
export const FORM_SOURCE = "text-[0.75rem] text-text-muted";

export const CONJUGATION_GROUP = "my-2";
export const CONJUGATION_TENSE =
  "mt-[0.4rem] mb-[0.1rem] text-[0.82rem] font-semibold text-text-muted";

/** One grammar claim, as a small pill beside the spelling it is about. */
export const GRAMMAR = "my-[0.8rem] flex flex-wrap gap-[0.4rem]";
const CLAIM = "flex gap-[0.35rem] rounded-full border px-[0.7rem] py-[0.15rem] text-[0.82rem]";

export const CLAIM_STATED = `${CLAIM} border-border`;
/** Absence and uncertainty read differently from fact, at a glance. */
export const CLAIM_WITHOUT_VALUE = `${CLAIM} border-border border-dashed text-text-muted`;
export const CLAIM_LABEL = "text-text-muted";
export const CLAIM_VALUE = "m-0";

// What points at this entry, and where it can be checked -----------------

export const LINKS = "mt-[0.9rem]";
export const LINKS_LIST = "m-0 list-disc pl-[1.2rem]";

/** Prose on the attribution page, where the browser's own margins used to do it. */
export const PARAGRAPH = "my-4";

export const SOURCE_LINE = "mt-[0.8rem] text-[0.75rem] text-text-muted";

/** A quiet note under a result, or under the page: which release, and credit. */
const QUIET_FOOTER = "mt-10 border-t border-border pt-4 text-[0.8rem] text-text-muted";

export const RELEASE_FOOTER = QUIET_FOOTER;
export const RELEASE_LINE = "my-[0.4rem]";
export const SITE_FOOTER = `${COLUMN} ${QUIET_FOOTER} pb-8`;

// The attribution page ---------------------------------------------------

export const PAGE_HEADING = SITE_NAME;
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
 * The "— open" mark inside a field label.
 *
 * It reads as a sentence rather than as a tag, so it drops the label's own
 * upper-casing and letter-spacing where it sits.
 */
export const OPEN_MARK = `${AMBIGUOUS} normal-case tracking-normal`;

/**
 * A release identity: long, and broken wherever it has to be to fit.
 *
 * Only the size is here. Every `<code>` on the site already renders in the
 * monospace stack `--font-mono` declares, because that is what Tailwind's own
 * base layer sets `code` to — so a component says nothing about the face.
 */
export const CODE_IDENTITY = "text-[0.85em] break-all";
