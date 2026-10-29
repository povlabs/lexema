// What a shared link's preview says (#304): the title, the line of text and
// the picture WhatsApp, X, Slack or iMessage shows for a link to a result page.
//
// - A word card: the headword, its pronunciation, gender, part of speech and
//   first meaning. The preview's line is the first meaning, else a meta line
//   `/ˈbɛllo/ · maschile · Aggettivo`. Each part shows only when the page has
//   it, and in the page's own words: the first pronunciation under the
//   headword, the gender the first numbered reading's heading shows
//   (genderGrid.ts), and that reading's part of speech. A form's block names
//   it as its heading does, every part of speech of its records when they
//   have several: `Aggettivo · Sostantivo` for bella (#727, #735).
// - The home card, for everything else: the home page, a word Lexema does not
//   have, a search over the visitor's limit, and a lookup that failed.
//
// Everything here is decided from the page's own lookup, so a preview never
// reads the database more than the page does. The picture is one static file
// for every page (#919), so nothing here names the served version.

import type { Attempt } from "./attempt.ts";
import { definitionsOf, hasDefinitions, type DefinitionItem } from "./definitions.ts";
import { headingGender, placesGender } from "./genderGrid.ts";
import { SITE_NAME, SITE_TAGLINE } from "./params.ts";
import { phrasePage, type PhraseReadingText } from "./phrasePage.ts";
import { headingTitle, wordPage } from "./wordPage.ts";

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

/** The picture's size: the 1.91:1 link previews show (web/public/share-card.png). */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/** A definition's text as the page writes it, without its labels. */
function definitionText(item: DefinitionItem): string {
  if (item.from === "name") return item.description;
  if (item.from === "lexeme") return item.gloss.text;
  if (item.from === "cardinal") return item.text;
  return item.from === "page" ? item.definition.text : item.sense.glosses.map((gloss) => gloss.text).join(" ");
}

/** A phrase reading's first meaning, else its first form line, as the page writes them. */
function phraseText(text: PhraseReadingText): string {
  if (text.kind === "own") return definitionText(text.meanings[0].item);
  const [meaning] = text.meanings;
  if (meaning !== undefined) return definitionText(meaning.item);
  const { before, phrase, after } = text.forms[0];
  return `${before}${phrase}${after}`;
}

/** The card a result page's lookup gives it. */
export function cardOf(attempt: Attempt): Card {
  if (attempt.outcome === "declared-lemma") {
    // A declared lemma's page (#453): the word and its first part of speech,
    // and nothing it does not have: no pronunciation, gender or meaning.
    const { page } = attempt;
    return {
      kind: "word",
      headword: page.headword,
      pronunciation: undefined,
      gender: undefined,
      partOfSpeech: page.readings[0].reading.posTitle,
      meaning: undefined,
    };
  }
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
      meaning: first === undefined ? undefined : phraseText(first.text),
    };
  }
  const page = wordPage(searched, attempt.readings, attempt.lemmas, attempt.route, attempt.declared, attempt.bases, attempt.verbs, attempt.entries);
  // The reading the page's first meaning sits under: the first block, or the
  // first reading that has a definition. A page with neither falls back to its
  // first reading.
  const entry =
    page.readings.find((one) => one.kind === "verb-form" || one.kind === "grid-form" || one.kind === "shape-form" || hasDefinitions(one.reading)) ??
    page.readings[0];
  if (entry.kind === "shape-form") {
    // A form rule it-word-shape/v1 read (#802): its first line, built by rule.
    return {
      kind: "word",
      headword: page.headword,
      pronunciation: undefined,
      gender: undefined,
      partOfSpeech: headingTitle(entry.heading),
      meaning: entry.lines[0].text,
    };
  }
  if (entry.kind === "grid-form") {
    // A form only its base word's grid spells (#700): its first line, built by rule.
    return {
      kind: "word",
      headword: page.headword,
      pronunciation: page.wordFacts.pronunciations[0]?.ipa,
      gender: placesGender(entry.places),
      partOfSpeech: entry.posTitle,
      meaning: entry.lines[0].text,
    };
  }
  if (entry.kind === "verb-form") {
    // A verb form block (#636): its first line, the source's or built by rule (#627).
    const [line] = entry.lines;
    return {
      kind: "word",
      headword: page.headword,
      pronunciation: page.wordFacts.pronunciations[0]?.ipa,
      gender: undefined,
      partOfSpeech: entry.posTitle,
      meaning: line.kind === "rule" ? line.text : definitionText(line.item),
    };
  }
  const { reading } = entry;
  const [meaning] = definitionsOf(reading).items;
  return {
    kind: "word",
    headword: page.headword,
    pronunciation: page.wordFacts.pronunciations[0]?.ipa,
    gender: entry.kind === "source" && entry.role === "form-of" && !entry.recordGrammar ? undefined : headingGender(reading),
    partOfSpeech: entry.kind === "source" && entry.role === "form-of" ? headingTitle(entry.heading) : reading.posTitle,
    meaning: meaning === undefined ? undefined : definitionText(meaning),
  };
}

/**
 * The one picture every page's preview shows (#919): the home card, drawn once
 * and kept as a static file in web/public/, so no request draws it. An old
 * `/card/…` address is sent here by web/public/_redirects, before the Worker runs.
 */
export const SHARE_IMAGE_PATH = "/share-card.png";

/** A link preview's line of text: the first meaning, else the meta line, else what Lexema is. */
export function cardDescription(card: Card): string {
  if (card.kind === "home") return SITE_TAGLINE;
  const meta = [card.pronunciation, card.gender, card.partOfSpeech].filter((part) => part !== undefined);
  return card.meaning ?? (meta.length > 0 ? meta.join(" · ") : SITE_TAGLINE);
}

/**
 * The tags a result page carries for a shared link's preview: `og:title`,
 * `og:description`, `og:image` with its size, and a large-image Twitter card.
 * The words are the page's own; the picture is the same for every page.
 * `origin` is the host the page was asked on, so a Preview's page names a
 * Preview's picture.
 */
export function linkPreview({ title, card, origin }: { title: string; card: Card; origin: string }) {
  const description = cardDescription(card);
  return {
    description,
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      type: "website",
      images: [{ url: new URL(SHARE_IMAGE_PATH, origin).href, width: CARD_WIDTH, height: CARD_HEIGHT, type: "image/png" }],
    },
    twitter: { card: "summary_large_image" },
  } as const;
}
