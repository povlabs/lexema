// The first sound a record's own `sounds[].ipa` gives its word, read for the
// article rule (`it-articles/v3`, src/italian/articles.ts).
//
// The source writes IPA in several styles: `/ˈjɔɡa/`, `[ho'ra]`, `kjeˈtino`
// with no slashes, `/ˈkikko//` with one too many, and two transcriptions in
// one string (`/ˈd͡ʒɛts/, /ˈd͡ʒɛz//`, `/ˈkjuso/ o /ˈkjuzo/`). Each
// transcription is read on its own, and only its opening is read: the first
// sound, and what follows it, since the article for `s` depends on whether a
// consonant comes next.
//
// Nothing here guesses. A transcription that opens on an optional sound
// (`/(h)ikikoˈmɔri/`) or on nothing readable has no first sound, and a record
// whose transcriptions do not all open the same way has no spoken initial:
// only the first sounds that were heard, for the rule to weigh.

declare const fromRecordIpa: unique symbol;

/** What comes right after the first sound: a vowel, another sound, or nothing. */
export type FollowingSound = "vowel" | "end" | { consonant: string };

/**
 * The opening every IPA on one record agrees on. It is minted only by
 * `spokenOpening`, from the record's own transcriptions, so an article can
 * never rest on a sound Lexema supplied.
 */
export type SpokenInitial = {
  readonly sound: string;
  readonly next: FollowingSound;
  readonly [fromRecordIpa]: true;
};

/** IPA vowel letters, including the non-Italian ones loans are written with. */
const VOWELS = new Set([..."aeiouyøœæɐəʌɑɒɪʊɜɛɔɨʉɯɤɘɵɞʏɶ"]);

/** Marks that carry no sound of their own: stress, length, syllable breaks, spacing. */
const SILENT = new Set([..."ˈˌ',.ːˑ:‿ /[]", "\u00a0", "\u202f"]);

/** Two letters written for one sound, with or without the tie bar. */
const AFFRICATES: ReadonlyMap<string, string> = new Map([
  ["ts", "ts"],
  ["dz", "dz"],
  ["tʃ", "tʃ"],
  ["dʒ", "dʒ"],
  ["ʦ", "ts"],
  ["ʣ", "dz"],
  ["ʧ", "tʃ"],
  ["ʤ", "dʒ"],
]);

/** Letters the source writes for one IPA sound. */
const SPELLED_ALIKE: ReadonlyMap<string, string> = new Map([
  ["g", "ɡ"],
  ["ɾ", "r"],
]);

/**
 * The transcription's letters, with the marks that carry no sound dropped.
 * Combining diacritics go too, the tie bar included: `opening` reads an
 * affricate off its two letters, written with the bar or without it.
 */
function letters(transcription: string): string[] | undefined {
  const out: string[] = [];
  for (const char of transcription.normalize("NFD")) {
    if (SILENT.has(char)) continue;
    if (/\p{M}/u.test(char)) continue;
    // A modifier letter colours the sound before it (`wᵝ`, `tʰ`); it is not one.
    if (/\p{Lm}/u.test(char)) continue;
    // An optional sound, or anything that is not a letter, leaves the opening unread.
    if (!/\p{L}/u.test(char)) return out.length === 0 ? undefined : out;
    out.push(char);
  }
  return out;
}

/** The first sound and what follows it, or `undefined` when the opening cannot be read. */
function opening(transcription: string): { sound: string; next: FollowingSound } | undefined {
  const chars = letters(transcription);
  if (chars === undefined || chars.length === 0) return undefined;
  const sounds: string[] = [];
  for (let i = 0; i < chars.length && sounds.length < 2; ) {
    const pair = AFFRICATES.get(`${chars[i]}${chars[i + 1] ?? ""}`);
    if (pair !== undefined) {
      sounds.push(pair);
      i += 2;
      continue;
    }
    const single = AFFRICATES.get(chars[i]) ?? chars[i];
    sounds.push(SPELLED_ALIKE.get(single) ?? single);
    i += 1;
  }
  const [sound, after] = sounds;
  const next: FollowingSound = after === undefined ? "end" : VOWELS.has(after) ? "vowel" : { consonant: after };
  return { sound, next };
}

/** The transcriptions one `sounds[].ipa` string holds. */
function transcriptions(ipa: string): string[] {
  return ipa.split(/\/\s*,\s*\/|\s+o\s+/u);
}

const sameNext = (a: FollowingSound, b: FollowingSound): boolean =>
  typeof a === "string" || typeof b === "string" ? a === b : a.consonant === b.consonant;

/**
 * What a record's IPA says about its word's opening. `agreed` when every
 * transcription is read and opens the same way. Otherwise `unsettled`, with
 * the first sound of each transcription that could be read: none when the
 * record has no IPA or none of it reads, several when they disagree.
 */
export type SpokenOpening =
  | { readonly reading: "agreed"; readonly initial: SpokenInitial }
  | { readonly reading: "unsettled"; readonly heard: ReadonlySet<string> };

/** What the record's own transcriptions say about its word's opening. */
export function spokenOpening(ipas: readonly string[]): SpokenOpening {
  const openings = ipas.flatMap(transcriptions).map(opening);
  const read = openings.filter((each) => each !== undefined);
  const [first] = read;
  const agreed =
    first !== undefined &&
    read.length === openings.length &&
    read.every((other) => other.sound === first.sound && sameNext(other.next, first.next));
  if (agreed) return { reading: "agreed", initial: first as SpokenInitial };
  return { reading: "unsettled", heard: new Set(read.map((each) => each.sound)) };
}

/** Whether a sound is a vowel, for the article rule. */
export const isVowelSound = (sound: string): boolean => VOWELS.has(sound);
