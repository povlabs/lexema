// A synthetic release, generated deterministically, at whatever scale you ask
// for.
//
// The point is reproducibility. Benchmark numbers taken against the real
// 560,357-record Italian archive cannot be re-derived by anyone who has not
// downloaded that archive, and a number nobody can re-run is not evidence. This
// builds a release with the same *shape* — the same ratio of embedded forms and
// form_of edges to records, and homographs at the same rate — from a seed, so
// the same command produces the same corpus on any machine.
//
// It is not Italian and does not pretend to be. Lookup cost depends on how many
// rows a key matches and how many edges point at it, not on what the letters
// mean.

import { writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

/**
 * Proportions measured on the real release (560,357 records): 1,273,490 lookup
 * rows, so ~713k embedded forms, and 608,726 form_of edges.
 */
export const REAL_RELEASE = {
  records: 560_357,
  lookupRows: 1_273_490,
  formOfEdges: 608_726,
} as const;

const EMBEDDED_FORMS_PER_RECORD = (REAL_RELEASE.lookupRows - REAL_RELEASE.records) / REAL_RELEASE.records;
const EDGES_PER_RECORD = REAL_RELEASE.formOfEdges / REAL_RELEASE.records;

/**
 * Distinct headwords per record. Below 1, so words repeat and homographs
 * appear — `sale` being three records is the case that makes lookup interesting
 * and a corpus of unique words would benchmark the easy path only.
 */
const DISTINCT_WORD_RATIO = 0.75;

/**
 * Homographs are not spread evenly upstream: most words are one or two records
 * and a few are many. `bella` reaches nine. So a slice of the word pool is
 * drawn far more often than the rest, which is what puts high-reading keys in
 * the corpus at all — without them the benchmark only ever measures the easy
 * end of the distribution.
 */
const HOT_WORD_SHARE = 0.001;
const HOT_DRAW_RATE = 0.05;

const POS = ["noun", "verb", "adj"] as const;
const POS_TITLE: Record<(typeof POS)[number], string> = {
  noun: "Sostantivo",
  verb: "Voce verbale",
  adj: "Aggettivo",
};

/** mulberry32. Small, seeded, and identical everywhere. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ONSETS = ["b", "c", "d", "f", "g", "l", "m", "n", "p", "r", "s", "t", "v", "z", "ch", "gl", "sc", "tr"];
const NUCLEI = ["a", "e", "i", "o", "u", "à", "è", "ì", "ò", "ù"];

/** A pronounceable stem. Accented vowels appear because the key keeps them. */
function stem(index: number): string {
  const pick = rng(index * 2654435761);
  const syllables = 2 + Math.floor(pick() * 2);
  let word = "";
  for (let i = 0; i < syllables; i += 1) {
    word += ONSETS[Math.floor(pick() * ONSETS.length)] + NUCLEI[Math.floor(pick() * NUCLEI.length)];
  }
  return word;
}

const INFLECTION_SUFFIXES = ["i", "e", "o", "a", "ano", "ava", "ato", "ino"];

/** What one record looks like once written out. Kept for the summary. */
export interface CorpusShape {
  records: number;
  distinctWords: number;
  embeddedForms: number;
  formOfEdges: number;
}

export interface CorpusOptions {
  /** How many records to write. */
  records: number;
  /** Where the .jsonl.gz goes. */
  output: string;
  seed?: number;
}

/**
 * Write a synthetic `.jsonl.gz` the importer accepts. Returns what was actually
 * generated, so a benchmark can print the corpus it measured rather than the
 * one it intended.
 */
export async function writeCorpus({ records, output, seed = 20260919 }: CorpusOptions): Promise<CorpusShape> {
  const random = rng(seed);
  const distinctWords = Math.max(1, Math.round(records * DISTINCT_WORD_RATIO));
  const words = Array.from({ length: distinctWords }, (_, i) => stem(i + seed));

  const lines: string[] = [];
  let embeddedForms = 0;
  let formOfEdges = 0;

  const hotWords = Math.max(1, Math.round(distinctWords * HOT_WORD_SHARE));

  for (let i = 0; i < records; i += 1) {
    // Words are consumed in order and then reused, which puts the ordinary
    // homographs at a steady rate instead of clustering them at one end of the
    // file. The hot draw layers the long tail on top.
    const word = random() < HOT_DRAW_RATE ? words[Math.floor(random() * hotWords)] : words[i % distinctWords];
    const pos = POS[Math.floor(random() * POS.length)];

    // Poisson-ish: a fractional average becomes "this many, plus maybe one more".
    const formCount = Math.floor(EMBEDDED_FORMS_PER_RECORD) + (random() < EMBEDDED_FORMS_PER_RECORD % 1 ? 1 : 0);
    const forms = Array.from({ length: formCount }, () => ({
      form: word + INFLECTION_SUFFIXES[Math.floor(random() * INFLECTION_SUFFIXES.length)],
      tags: ["plural"],
      source: "Appendice:Coniugazioni/bench",
    }));
    embeddedForms += forms.length;

    // The real release averages more than one edge per record, so a record can
    // carry a second form_of sense. An edge names a word and most of the time
    // that word exists; a tenth dangle, as they do upstream.
    const edgeCount = Math.floor(EDGES_PER_RECORD) + (random() < EDGES_PER_RECORD % 1 ? 1 : 0);
    const edgeSenses = Array.from({ length: edgeCount }, () => {
      const target = random() < 0.1 ? `${word}-missing` : words[Math.floor(random() * distinctWords)];
      return { glosses: [`forma flessa di ${target}`], tags: ["form-of"], form_of: [{ word: target }] };
    });
    formOfEdges += edgeSenses.length;

    lines.push(
      JSON.stringify({
        word,
        pos,
        pos_title: POS_TITLE[pos],
        lang_code: "it",
        tags: edgeCount > 0 ? ["form-of"] : ["masculine", "singular"],
        forms,
        senses:
          edgeCount > 0
            ? edgeSenses
            : [{ glosses: [`definizione sintetica di ${word}`], raw_tags: ["bench"] }],
      }),
    );
  }

  await writeFile(output, gzipSync(Buffer.from(lines.join("\n") + "\n", "utf8")));
  return { records, distinctWords, embeddedForms, formOfEdges };
}
