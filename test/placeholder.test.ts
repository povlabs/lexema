// Wikizionario's missing-field placeholder is no data (#255). The matcher is
// checked on the templates' own wordings, then the lookup is checked over the
// real archive lines in `fixtures/placeholders.jsonl`.

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { seedSql } from "../src/import/seedSql.js";
import { withoutPlaceholder } from "../src/italian/placeholder.js";
import { lookup } from "../src/lookup/lookup.js";
import type { LookupResult, Reading } from "../src/lookup/types.js";
import { readOnlyDictionary } from "./databases.js";

const ETYMOLOGY = "→ Etimologia mancante. Se vuoi, aggiungila tu.";
const REFERENCES = "→ Riferimenti mancanti. Se vuoi, aggiungili tu.";
const HYPHENATION = "→ Divisione in sillabe mancante. Se vuoi, aggiungila tu.";
const DEFINITION = "definizione mancante; se vuoi, aggiungila tu";

test("each of the four templates, alone, is no data", () => {
  for (const placeholder of [ETYMOLOGY, REFERENCES, HYPHENATION, DEFINITION]) {
    assert.equal(withoutPlaceholder(placeholder), undefined, placeholder);
    assert.equal(withoutPlaceholder(`  ${placeholder}\n`), undefined, `${placeholder}, padded`);
  }
});

test("a placeholder behind a bracketed label is still no data", () => {
  assert.equal(withoutPlaceholder(`(sostantivo) ${ETYMOLOGY}`), undefined);
  assert.equal(withoutPlaceholder(`(sostantivo, aggettivo) ${ETYMOLOGY}`), undefined);
  assert.equal(withoutPlaceholder(`(principale) ${REFERENCES}`), undefined);
  assert.equal(withoutPlaceholder(`(tipografia) ${DEFINITION}`), undefined);
  assert.equal(withoutPlaceholder(`(di individuo)${DEFINITION}`), undefined);
  assert.equal(withoutPlaceholder(`(autoveicoli)(${DEFINITION}`), undefined);
  assert.equal(withoutPlaceholder(`${DEFINITION} (ellissi)`), undefined);
  assert.equal(withoutPlaceholder(`${ETYMOLOGY}\n.`), undefined, "punctuation alone is not real text");
  assert.equal(withoutPlaceholder(`(mineralogia)''${ETYMOLOGY}`), undefined, "italic markup before it is not real text");
});

test("real text beside a placeholder is kept, the joining punctuation trimmed", () => {
  assert.equal(withoutPlaceholder(`vedi insipido\n${ETYMOLOGY}`), "vedi insipido");
  assert.equal(withoutPlaceholder(`${ETYMOLOGY}\nDa Eskimo "mangiatore di carne cruda"`), 'Da Eskimo "mangiatore di carne cruda"');
  assert.equal(withoutPlaceholder(`${ETYMOLOGY} Carbonia significa terra del carbone`), "Carbonia significa terra del carbone");
  assert.equal(withoutPlaceholder(`${ETYMOLOGY}Il nome Scilla deriva dalla spiaggia`), "Il nome Scilla deriva dalla spiaggia");
  assert.equal(withoutPlaceholder(`Dal greco moystos.\n${ETYMOLOGY}`), "Dal greco moystos.", "the real text's own full stop stays");
  assert.equal(withoutPlaceholder(`dall'arabo\n${REFERENCES}`), "dall'arabo");
  assert.equal(withoutPlaceholder(`Verbo, ${ETYMOLOGY}`), "Verbo");
  assert.equal(withoutPlaceholder(`inglese\n** ${REFERENCES}`), "inglese", "the placeholder line's list marker goes with it");
  assert.equal(withoutPlaceholder(`*egiziano\n** ${REFERENCES}\n*spagnolo`), "*egiziano\n*spagnolo", "real list items keep their markers");
  assert.equal(withoutPlaceholder(`un po' ${ETYMOLOGY}`), "un po'", "an elision's apostrophe is real text");
  assert.equal(withoutPlaceholder(`acronimo di Federazione Italiana Giuoco Calcio: ${DEFINITION}`), "acronimo di Federazione Italiana Giuoco Calcio");
  assert.equal(withoutPlaceholder(`${DEFINITION} colui che rapisce o ha già rapito`), "colui che rapisce o ha già rapito");
  assert.equal(withoutPlaceholder(`${DEFINITION}Il destinatario di un bene`), "Il destinatario di un bene");
  assert.equal(
    withoutPlaceholder(`${DEFINITION}; la sua classificazione scientifica è Anguis fragilis ( tassonomia)`),
    "la sua classificazione scientifica è Anguis fragilis ( tassonomia)",
  );
});

test("real text on both sides keeps the separator the source put between them", () => {
  assert.equal(
    withoutPlaceholder(`pianta della famiglia delle Mirtacee ${DEFINITION}; la sua classificazione scientifica è Myrtus communis`),
    "pianta della famiglia delle Mirtacee; la sua classificazione scientifica è Myrtus communis",
  );
  assert.equal(
    withoutPlaceholder(`Io sbaglio sempre\n${ETYMOLOGY}\npossibilmente dalla parola latina baiulare`),
    "Io sbaglio sempre\npossibilmente dalla parola latina baiulare",
  );
});

test("mancante and mancanti outside the template are real text and stay as written", () => {
  for (const real of [
    "mancante",
    "giorni mancanti",
    "mi devi restituire il pezzo mancante",
    'dal latino ab cioè "lontano" e esse ossia "essere", da cui "essere lontano, mancante"',
    "Se vuoi superare quell'esame, ti tocca sgobbare",
    "definizione mancante",
  ]) {
    assert.equal(withoutPlaceholder(real), real, real);
  }
  assert.equal(withoutPlaceholder("   "), undefined, "an empty text is still no text");
});

// --- The lookup, over real archive lines -------------------------------------

const RELEASE = "it-placeholder-test";

async function withPlaceholderWords(run: (db: DatabaseSync) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-placeholder-"));
  const archive = join(dir, "fixture.jsonl.gz");
  await writeFile(archive, gzipSync(await readFile("fixtures/placeholders.jsonl")));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, "sql"),
    schema: "src/db/schema.sql",
    releaseId: RELEASE,
    archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
    license: "CC-BY-SA-4.0",
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  const db = new DatabaseSync(":memory:");
  try {
    for (const part of parts) db.exec(await readFile(part, "utf8"));
    await run(db);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
}

async function readings(db: DatabaseSync, query: string): Promise<[Reading, ...Reading[]]> {
  // Read-only, so the filter provably writes nothing back.
  const result: LookupResult = await lookup({ db: readOnlyDictionary(db), releaseId: RELEASE, query });
  assert.ok(result.outcome === "found", `${query}: expected a found result, got ${result.outcome}`);
  return result.readings;
}

const byPos = (all: readonly Reading[], pos: string): Reading => {
  const reading = all.find((candidate) => candidate.pos === pos);
  assert.ok(reading, `no ${pos} reading`);
  return reading;
};

test("an etymology that is only the placeholder, with or without its label, is no etymology", async () => {
  await withPlaceholderWords(async (db) => {
    const [andareVia] = await readings(db, "andare via");
    assert.deepEqual(andareVia.wordFacts.etymologies, []);

    // addì: `(avverbio) → Etimologia mancante…` goes, `(voce verbale) vedi addire` stays.
    for (const reading of await readings(db, "addì")) {
      assert.deepEqual(reading.wordFacts.etymologies.map((etymology) => etymology.text), ["(voce verbale) vedi addire"]);
      assert.equal(reading.wordFacts.etymologies[0]?.ref.jsonPointer, "/etymology_texts/1");
    }

    const [sbrisolona] = await readings(db, "sbrisolona");
    assert.deepEqual(sbrisolona.wordFacts.etymologies.map((etymology) => etymology.text), ["da sbrisola"], "the references placeholder goes too");
  });
});

test("an etymology with real text beside the placeholder keeps the real text, at its own pointer", async () => {
  await withPlaceholderWords(async (db) => {
    const [plutone] = await readings(db, "Plutone");
    assert.deepEqual(plutone.wordFacts.etymologies.map(({ text, ref }) => [text, ref.jsonPointer]), [["dal greco vagabondo", "/etymology_texts/0"]]);
  });
});

test("a hyphenation that is only the placeholder is dropped when the record is read", async () => {
  await withPlaceholderWords(async (db) => {
    const [gendo] = await readings(db, "gendo");
    assert.deepEqual(gendo.wordFacts.hyphenations, []);
    const [andareVia] = await readings(db, "andare via");
    assert.deepEqual(andareVia.wordFacts.hyphenations.map((hyphenation) => hyphenation.parts), [["an", "dà", "re - vì", "a"]]);
  });
});

test("a gloss that is only the definition placeholder is no gloss; its sense and its examples stay", async () => {
  await withPlaceholderWords(async (db) => {
    const bianca = byPos(await readings(db, "bianca"), "noun");
    assert.deepEqual(
      bianca.senses.map((sense) => sense.glosses.map((gloss) => gloss.text)),
      [["sonno iniziale dei bachi da seta"], [], []],
      "`(tipografia) definizione mancante…` and the bare one both read as no gloss",
    );

    const piratato = byPos(await readings(db, "piratato"), "adj");
    assert.deepEqual(piratato.senses[0]?.glosses, []);
    assert.deepEqual(piratato.senses[0]?.examples.map((example) => example.text), ["è un cd pirataro"]);

    const rapitore = byPos(await readings(db, "rapitore"), "adj");
    assert.deepEqual(rapitore.senses[0]?.glosses.map(({ text, ref }) => [text, ref.jsonPointer]), [
      ["colui che rapisce o ha già rapito", "/senses/0/glosses/0"],
    ]);

    const poco = byPos(await readings(db, "poco"), "noun");
    assert.deepEqual(poco.senses[0]?.glosses.map((gloss) => gloss.text), ["mancante"], "a real gloss saying mancante stays");
  });
});

test("the stored rows and the record's line keep the placeholder as imported", async () => {
  await withPlaceholderWords(async (db) => {
    const lines = (await readFile("fixtures/placeholders.jsonl", "utf8")).trim().split("\n");
    const stored = db.prepare("SELECT raw_json FROM source_record_json ORDER BY record_id").all().map((row) => row.raw_json);
    assert.deepEqual(stored, lines, "source_record_json is the archive line, byte for byte");
    const glosses = db.prepare("SELECT text FROM sense_gloss WHERE text LIKE '%se vuoi, aggiungila tu%'").all().map((row) => row.text);
    assert.ok(glosses.includes(DEFINITION) && glosses.includes(`(tipografia) ${DEFINITION}`), "sense_gloss still holds the placeholder");
    // A lookup does not change them.
    await readings(db, "bianca");
    assert.deepEqual(db.prepare("SELECT raw_json FROM source_record_json ORDER BY record_id").all().map((row) => row.raw_json), lines);
  });
});
