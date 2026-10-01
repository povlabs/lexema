// What a shared link's card says (#304): the 1200×630 picture WhatsApp, X,
// Slack or iMessage shows for a link to a result page. Board S1 in
// lexema-design.pen draws two cards.
//
// - A word card: the headword, a meta line `/ˈbɛllo/ · maschile · Aggettivo`,
//   and the first meaning. Each part of the meta line shows only when the page
//   has it, and in the page's own words: the first pronunciation under the
//   headword, the gender the first numbered reading's heading shows
//   (genderGrid.ts), and that reading's part of speech.
// - The home card, for everything else: the home page, a word Lexema does not
//   have, a search over the visitor's limit, and a lookup that failed.
//
// Everything here is decided from the page's own lookup, so a card never
// reads the database more than the page does. How it is drawn is
// web/worker/card/draw.tsx; where it is served is web/worker/card.ts.

import type { Attempt } from "./attempt.ts";
import { definitionsOf, type DefinitionItem } from "./definitions.ts";
import { headingGender } from "./genderGrid.ts";
import { SITE_NAME, SITE_TAGLINE } from "./params.ts";
import { phrasePage, type PhraseLine } from "./phrasePage.ts";
import { wordPage } from "./wordPage.ts";

/** A word card's parts. Every part but the headword is absent when the page has none. */
export interface WordCard {
  kind: "word";
  headword: string;
  pronunciation: string | undefined;
  gender: string | undefined;
  partOfSpeech: string | undefined;
  meaning: string | undefined;
}

export type Card = WordCard | { kind: "home" };

export const HOME_CARD: Card = { kind: "home" };

/** A card's size: the 1.91:1 picture link previews show. */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/** A definition's text as the page writes it, without its labels. */
function definitionText(item: DefinitionItem): string {
  return item.from === "page" ? item.definition.text : item.sense.glosses.map((gloss) => gloss.text).join(" ");
}

function phraseLineText(line: PhraseLine): string {
  if (line.kind === "meaning") return definitionText(line.item);
  const { before, phrase, after } = line.definition;
  return `${before}${phrase}${after}`;
}

/** The card a result page's lookup gives it. */
export function cardOf(attempt: Attempt): Card {
  if (attempt.outcome !== "found") return HOME_CARD;
  const searched = attempt.query.raw.trim();
  if (attempt.route.kind === "phrase") {
    // A searched expression's short page: titled as typed, no pronunciation,
    // and no grid, so no gender (#214).
    const page = phrasePage(searched, attempt.route, attempt.readings);
    const [first] = page.readings;
    return {
      kind: "word",
      headword: page.headword,
      pronunciation: undefined,
      gender: undefined,
      partOfSpeech: first?.reading.posTitle,
      meaning: first === undefined ? undefined : phraseLineText(first.lines[0]),
    };
  }
  const page = wordPage(searched, attempt.readings);
  // The reading the page's first meaning sits under: the first one numbered,
  // since a reading with no definition has no number. A page with none
  // numbered falls back to its first reading.
  const { reading } = page.readings.find((entry) => entry.number !== undefined) ?? page.readings[0];
  const [meaning] = definitionsOf(reading).items;
  return {
    kind: "word",
    headword: page.headword,
    pronunciation: page.wordFacts.pronunciations[0]?.ipa,
    gender: headingGender(reading),
    partOfSpeech: reading.posTitle,
    meaning: meaning === undefined ? undefined : definitionText(meaning),
  };
}

/**
 * Bumped when the drawing changes, so a card cached under the old drawing is
 * never served for the new one. The release in the address does the same for
 * the data.
 */
export const CARD_DRAWING = "1";

const CARD_PREFIX = "/card/";
const CARD_SUFFIX = ".png";
const WORD_PARAM = "word";

/** A card's address, as one release draws it: the home card, or a word's. */
export interface CardAddress {
  release: string;
  /** The search as typed, trimmed; absent for the home card. */
  word: string | undefined;
}

/** `/card/1/it-0c432803.png?word=casa`: the drawing, the release, and the word. */
export function cardPath({ release, word }: CardAddress): string {
  const path = `${CARD_PREFIX}${CARD_DRAWING}/${encodeURIComponent(release)}${CARD_SUFFIX}`;
  return word === undefined ? path : `${path}?${new URLSearchParams({ [WORD_PARAM]: word })}`;
}

/**
 * The card a URL asks for, or none when it is not a card's address. A card
 * of another drawing or release is still a card: the Worker sends it on to
 * the current one.
 */
export function cardAddressOf(url: URL): (CardAddress & { drawing: string }) | undefined {
  if (!url.pathname.startsWith(CARD_PREFIX) || !url.pathname.endsWith(CARD_SUFFIX)) return undefined;
  const parts = url.pathname.slice(CARD_PREFIX.length, -CARD_SUFFIX.length).split("/");
  if (parts.length !== 2 || parts.some((part) => part === "")) return undefined;
  let release: string;
  try {
    release = decodeURIComponent(parts[1]);
  } catch {
    return undefined;
  }
  const word = (url.searchParams.get(WORD_PARAM) ?? "").trim();
  return { drawing: parts[0], release, word: word === "" ? undefined : word };
}

/** A link preview's line of text: the first meaning, else the meta line, else what Lexema is. */
export function cardDescription(card: Card): string {
  if (card.kind === "home") return SITE_TAGLINE;
  const meta = [card.pronunciation, card.gender, card.partOfSpeech].filter((part) => part !== undefined);
  return card.meaning ?? (meta.length > 0 ? meta.join(" · ") : SITE_TAGLINE);
}

/**
 * The tags a result page carries for a shared link's preview: `og:title`,
 * `og:description`, `og:image` with its size, and a large-image Twitter card.
 * `origin` is the host the page was asked on, so a Preview's page names a
 * Preview's card.
 */
export function linkPreview({ title, card, word, release, origin }: {
  title: string;
  card: Card;
  /** The search as typed; a word card's address carries it. */
  word: string;
  release: string;
  origin: string;
}) {
  const description = cardDescription(card);
  const path = cardPath({ release, word: card.kind === "word" ? word.trim() : undefined });
  return {
    description,
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      type: "website",
      images: [{ url: new URL(path, origin).href, width: CARD_WIDTH, height: CARD_HEIGHT, type: "image/png" }],
    },
    twitter: { card: "summary_large_image" },
  } as const;
}
