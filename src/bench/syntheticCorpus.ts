// A seeded synthetic archive in the release's own `.jsonl` shape, so the lookup
// benchmark (#37) runs with no dataset download. It is not Italian and claims
// nothing about the dictionary: it reproduces the shapes the lemma-link query
// meets — homograph records, lemmas listing their forms, form-of records
// pointing back at them, and edges whose target has no record.
//
// The same seed gives the same lines, and a smaller corpus is a prefix of a
// larger one, so two scales differ in size and not in how a word is shaped.

import { createWriteStream } from "node:fs";
import { finished } from "node:stream/promises";
import { createGzip } from "node:zlib";

/** mulberry32: small, fast, and the same sequence on every machine. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CONSONANTS = "bcdfglmnprstv";
const VOWELS = "aeiou";

/**
 * A distinct stem per lemma: consonant-vowel syllables only, at least two. Every
 * ending below starts with a vowel, so the first doubled vowel in a word is
 * where its stem ends, and no two lemmas ever spell the same surface.
 */
function stem(index: number): string {
  let n = index + CONSONANTS.length * VOWELS.length;
  let text = "";
  while (n > 0) {
    const digit = n % (CONSONANTS.length * VOWELS.length);
    text += CONSONANTS[digit % CONSONANTS.length] + VOWELS[Math.floor(digit / CONSONANTS.length)];
    n = Math.floor(n / (CONSONANTS.length * VOWELS.length));
  }
  return text;
}

interface Paradigm {
  pos: string;
  posTitle: string;
  formTitle: string;
  ending: string;
  tags: string[];
  forms: { ending: string; tags: string[] }[];
}

const NOUN: Paradigm = {
  pos: "noun", posTitle: "Sostantivo", formTitle: "Sostantivo, forma flessa", ending: "o",
  tags: ["masculine", "singular"],
  forms: [{ ending: "i", tags: ["masculine", "plural"] }],
};
const ADJECTIVE: Paradigm = {
  pos: "adj", posTitle: "Aggettivo", formTitle: "Aggettivo, forma flessa", ending: "o",
  tags: ["masculine", "singular"],
  forms: [
    { ending: "a", tags: ["feminine", "singular"] },
    { ending: "i", tags: ["masculine", "plural"] },
    { ending: "e", tags: ["feminine", "plural"] },
  ],
};
const VERB_ENDINGS = [
  "o", "i", "a", "iamo", "ate", "ano", "avo", "avi", "ava", "avamo", "avate", "avano", "ai",
  "asti", "ò", "ammo", "aste", "arono", "erò", "erai", "erà", "eremo", "erete", "eranno", "ando", "ato",
];
const VERB: Paradigm = {
  pos: "verb", posTitle: "Verbo", formTitle: "Voce verbale", ending: "are",
  tags: [],
  forms: VERB_ENDINGS.map((ending) => ({ ending, tags: [] })),
};

/** How a lemma's records are drawn. Each is a probability in [0, 1]. */
const SHAPE = {
  /** A form gets a record of its own pointing back at the lemma. */
  formRecord: 0.6,
  /** The lemma has no record at all, so its forms' edges dangle. */
  orphan: 0.03,
} as const;

function paradigm(roll: number): Paradigm {
  if (roll < 0.5) return NOUN;
  if (roll < 0.7) return ADJECTIVE;
  return VERB;
}

/** Records spelling the lemma: mostly one, a long tail up to seven, as `bello` has four. */
function homographs(roll: number, extra: number): number {
  if (roll < 0.8) return 1;
  if (roll < 0.92) return 2;
  if (roll < 0.97) return 3;
  if (roll < 0.99) return 4;
  return 5 + Math.floor(extra * 3);
}

/**
 * The first `records` lines of the corpus `seed` names. Every line is one
 * admitted Italian record.
 */
export function* syntheticLines(seed: number, records: number): Generator<string> {
  const next = random(seed);
  let emitted = 0;
  for (let lemma = 0; emitted < records; lemma += 1) {
    const shape = paradigm(next());
    const base = stem(lemma);
    const word = base + shape.ending;
    const count = homographs(next(), next());
    const orphan = next() < SHAPE.orphan;
    const forms = shape.forms.map((form) => ({ form: base + form.ending, tags: form.tags }));
    const lines: string[] = [];
    if (!orphan) {
      for (let h = 0; h < count; h += 1) {
        lines.push(JSON.stringify({
          word, pos: shape.pos, pos_title: shape.posTitle, lang_code: "it", tags: shape.tags, forms,
          senses: Array.from({ length: 1 + Math.floor(next() * 3) }, (_, s) => ({ glosses: [`senso ${h + 1}.${s + 1} di ${word}`] })),
        }));
      }
    }
    for (const form of forms) {
      if (next() >= SHAPE.formRecord) continue;
      lines.push(JSON.stringify({
        word: form.form, pos: shape.pos, pos_title: shape.formTitle, lang_code: "it", tags: ["form-of", ...form.tags],
        senses: [{ glosses: [`forma di ${word}`], tags: ["form-of"], form_of: [{ word }] }],
      }));
    }
    for (const line of lines) {
      if (emitted === records) return;
      emitted += 1;
      yield line;
    }
  }
}

/** Write the corpus gzipped to `path`, the way the release archive is stored. */
export async function writeSyntheticArchive(path: string, seed: number, records: number): Promise<void> {
  const gzip = createGzip();
  const out = gzip.pipe(createWriteStream(path));
  for (const line of syntheticLines(seed, records)) {
    if (!gzip.write(`${line}\n`)) await new Promise((resolve) => gzip.once("drain", resolve));
  }
  gzip.end();
  await finished(out);
}
