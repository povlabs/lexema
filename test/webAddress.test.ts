// Rule `gloss-web-address/v1` (#872, ADR 0019): a web address an editor left
// in a gloss goes, with one space left between the words either side, the
// seed stores the gloss that way, a one-off update does the same to an older
// seed, and the raw line keeps the source's wording.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { DictionarySql } from "../src/import/normalizeGlosses.js";
import { seedSql } from "../src/import/seedSql.js";
import { dropStoredWebAddresses } from "../src/import/webAddressUpdate.js";
import { WEB_ADDRESS_GLOSS_GLOB, withoutWebAddresses } from "../src/italian/sourceTextNormalization.js";

// Every gloss of release it-0c432803 holding `http://` or `https://`, from the
// archive (reports/2026-10-18-gloss-web-addresses.md): word, archive line,
// sense, the gloss, and the gloss as the rule stores it.
const WEB_ADDRESSES: readonly (readonly [string, number, number, string, string])[] = [
  ["nobiltà", 8269, 0, "https://araldicando.miraheze.org/wiki/Pagina_principale condizione sociale di persone ritenute superiori alle altre, che soprattutto in passato e in determinati paesi, godevano di privilegi e distinzioni particolari, e spesso monopolizzavano la proprietà terriera e l’accesso alle principali cariche civili e militari dello stato", "condizione sociale di persone ritenute superiori alle altre, che soprattutto in passato e in determinati paesi, godevano di privilegi e distinzioni particolari, e spesso monopolizzavano la proprietà terriera e l’accesso alle principali cariche civili e militari dello stato"],
  ["scratch", 21853, 2, "effetto sonoro fortemente somigliante a quello di cui sopra, ottenuto con lo strofinamento in lunghezza delle corde della chitarra elettrica, e nel contempo accendendo e spegnendo quest'ultima in sequenza intermittentehttps://suonarechitarra.com/2019/01/07/tom-morello-e-i-suoni-improbabili/#DJ_Scratch", "effetto sonoro fortemente somigliante a quello di cui sopra, ottenuto con lo strofinamento in lunghezza delle corde della chitarra elettrica, e nel contempo accendendo e spegnendo quest'ultima in sequenza intermittente"],
  ["trap", 23306, 1, "nel linguaggio comune, la musica rap successiva al 2015, molto spesso melodicahttps://www.2duerighe.com/rubriche/dreki-fiori-di-cemento/123575-rap-italiano.html?amp=1https://produzionehiphop.com/blog/storia-e-curiosita/la-storia-dellhip-hop-italiano-old-school-italia.html", "nel linguaggio comune, la musica rap successiva al 2015, molto spesso melodica"],
  ["quarto", 30447, 3, "nella musica popolare moderna, ciascuna delle unità di ritmo di un branohttps://gremus.it/leggere-la-musica/la-semiminima-o-quarto", "nella musica popolare moderna, ciascuna delle unità di ritmo di un brano"],
  ["alcolemia", 47343, 0, "concentrazione di alcol etilico nel sangue; è considerata normale se inferiore a duecento milligrammi su litrohttps://m.my-personaltrainer.it/salute/tasso-alcolemico.html#:~:text=L'alcolemia%20%C3%A8%20considerata%20nella,0%2C50%20g%2FL", "concentrazione di alcol etilico nel sangue; è considerata normale se inferiore a duecento milligrammi su litro"],
  ["androginia", 47471, 3, "nel gergo giornalistico, ragazza di bell'aspetto che adotta comportamenti associati sia agli uomini che alle donnehttps://www.gay.it/10-celebrita-androgine-anni-90", "nel gergo giornalistico, ragazza di bell'aspetto che adotta comportamenti associati sia agli uomini che alle donne"],
  ["Salento", 62155, 1, "Il Salento inizia da Egnazia e arriva fino a Leuca. Misura circa 5800 km2 e comprende la prov. di Lecce e parte di quelle di Brindisi e di Taranto.[https://www.barbarhouse.com/it/guide/salento.html [1]]", "Il Salento inizia da Egnazia e arriva fino a Leuca. Misura circa 5800 km2 e comprende la prov. di Lecce e parte di quelle di Brindisi e di Taranto."],
  ["metamorfosi", 91874, 4, "in alcune opere di finzione, capacità di alcune entità senzienti di assumere sembianze diverse da quelle d'originehttps://www.wired.it/article/film-insetti-giganti-assassini-alieni-libri-titoli/", "in alcune opere di finzione, capacità di alcune entità senzienti di assumere sembianze diverse da quelle d'origine"],
  ["ciortone", 113793, 0, "sgombro http://it.wikipedia.org/wiki/Scomber_scombrus (pesce)", "sgombro (pesce)"],
  ["biliardo", 134002, 1, "un milione di miliardi, equivalente anche a mille bilioni; rappresentato nella notazione scientifica da 10¹⁵, è il prodotto della quindicesima potenza di due per quella di cinquehttps://www.chimica-online.it/download/biliardo.htm", "un milione di miliardi, equivalente anche a mille bilioni; rappresentato nella notazione scientifica da 10¹⁵, è il prodotto della quindicesima potenza di due per quella di cinque"],
  ["tripla", 135501, 2, "nel gioco del basket, segnatura di tre punti messa in atto facendo entrare la palla nel canestro avversario con una semplice elevazione verticale completa dal suolo, ad una distanza minima significativa dalla base del tabellonehttps://www.basketcoach.net/wli/main/view/dettaglio_archivio?NomeMacroCategoria=Fondamentali&IDMacroCategoria=8&pagina=Le%20Regole&CategoriaID=109&id_pagine_uniche=&titolo_user_id=d8f5443e8616b5b3", "nel gioco del basket, segnatura di tre punti messa in atto facendo entrare la palla nel canestro avversario con una semplice elevazione verticale completa dal suolo, ad una distanza minima significativa dalla base del tabellone"],
  ["ologramma", 136520, 1, "in alcune opere di fantascienza, immagine in tre dimensioni molto realistica e capace di agire e pensare da sé, creata con computer fittizi particolarihttps://www.officinakreativa.it/ologramma-3d/", "in alcune opere di fantascienza, immagine in tre dimensioni molto realistica e capace di agire e pensare da sé, creata con computer fittizi particolari"],
  ["funk", 421399, 1, "forma primitiva e cadenzata di musica rap, nata negli Stati Uniti nel 1970https://www.discotecalaziale.com/blog/soul-funk-gli-anni-doro-della-musica-nera-che-ha-cambiato-il-mondo/?srsltid=AfmBOookCwTZ4ic2__n_y2ZUo5c89CM1vRV2zXMJsRSuhkHelR5AYBt-https://www.musicaincontatto.it/2018/11/28/il-funk/", "forma primitiva e cadenzata di musica rap, nata negli Stati Uniti nel 1970"],
  ["ghostwriter", 604795, 1, "chi scrive le parole di una canzone per conto di terzi, soprattutto pop o raphttps://www.exclusivemagazine.it/2018/11/19/ghost-writing-nel-rap-italiano-scandalo-o-evoluzione/", "chi scrive le parole di una canzone per conto di terzi, soprattutto pop o rap"],
];

const row = (word: string) => {
  const found = WEB_ADDRESSES.find(([w]) => w === word);
  assert.ok(found, word);
  return found;
};

test("a web address glued to the last word, leading a gloss, or inside it goes with its spacing", () => {
  assert.equal(withoutWebAddresses(row("nobiltà")[3]).slice(0, 30), "condizione sociale di persone ");
  assert.equal(withoutWebAddresses(row("scratch")[3]).slice(-25), "in sequenza intermittente");
  assert.equal(withoutWebAddresses(row("funk")[3]), "forma primitiva e cadenzata di musica rap, nata negli Stati Uniti nel 1970");
  assert.equal(withoutWebAddresses(row("ciortone")[3]), "sgombro (pesce)");
  // Two addresses glued together, and a bracketed external link with its label.
  assert.equal(withoutWebAddresses(row("trap")[3]), "nel linguaggio comune, la musica rap successiva al 2015, molto spesso melodica");
  assert.ok(withoutWebAddresses(row("Salento")[3]).endsWith("di Brindisi e di Taranto."));
  assert.equal(WEB_ADDRESSES.length, 14);
  for (const [, , , gloss, stored] of WEB_ADDRESSES) {
    assert.equal(withoutWebAddresses(gloss), stored, gloss);
    assert.doesNotMatch(stored, /https?:|\s{2}|^\s|\s$/u, gloss);
  }
});

test("a gloss with no web address, or nothing but one, is left as written", () => {
  for (const gloss of [
    "legno lungo e diritto",
    "protocollo http per il trasferimento di ipertesti",
    "spazio  doppio scritto dalla fonte",
    "https://it.wikipedia.org/wiki/Scomber_scombrus",
  ]) {
    assert.equal(withoutWebAddresses(gloss), gloss, gloss);
  }
  // Only the address's own spacing changes: a double space elsewhere stays.
  assert.equal(withoutWebAddresses("spazio  doppio https://example.org fine"), "spazio  doppio fine");
});

test("the update's GLOB selects every gloss the rule changes", () => {
  const db = new DatabaseSync(":memory:");
  const glob = db.prepare("SELECT ? GLOB ? AS hit");
  for (const [, , , gloss] of WEB_ADDRESSES) assert.equal((glob.get(gloss, WEB_ADDRESS_GLOSS_GLOB) as { hit: number }).hit, 1, gloss);
  db.close();
});

const record = (word: string, glosses: string[][]): string =>
  JSON.stringify({ word, pos: "noun", pos_title: "Sostantivo", lang_code: "it", tags: ["masculine"], senses: glosses.map((g) => ({ glosses: g })) });
const FUNK = row("funk");
const CIORTONE = row("ciortone");
const LINES = [
  record("funk", [["genere musicale"], [FUNK[3]]]),
  record("ciortone", [[CIORTONE[3]]]),
  record("palo", [["legno lungo e diritto"]]),
];
const EXPECTED = ["genere musicale", FUNK[4], CIORTONE[4], "legno lungo e diritto"];

async function seeded(run: (db: DatabaseSync) => void): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-web-address-"));
  try {
    const input = join(dir, "fixture.jsonl");
    await writeFile(input, `${LINES.join("\n")}\n`);
    const report = await seedSql({
      input, outputDir: join(dir, "sql"), schema: resolve("src/db/schema.sql"), releaseId: "it-test",
      requiredWords: [], validateFixtureClosure: false,
    });
    assert.ok(report.sourceTextRules.includes("gloss-web-address/v1"), "the seed reports the rule it wrote under");
    const db = new DatabaseSync(":memory:");
    try {
      for (const part of report.parts) db.exec(readFileSync(part, "utf8"));
      run(db);
    } finally {
      db.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const glosses = (db: DatabaseSync): string[] =>
  (db.prepare("SELECT text FROM sense_gloss ORDER BY gloss_id").all() as { text: string }[]).map(({ text }) => text);
const rawLines = (db: DatabaseSync): string[] =>
  (db.prepare("SELECT raw_json FROM source_record_json ORDER BY record_id").all() as { raw_json: string }[]).map(({ raw_json }) => raw_json);

test("the seed stores the gloss without its web address and keeps the raw line byte-for-byte", async () => {
  await seeded((db) => {
    assert.deepEqual(glosses(db), EXPECTED);
    assert.deepEqual(rawLines(db), LINES);
  });
});

test("the one-off update rewrites a database seeded before the rule, once, and reports the rows", async () => {
  await seeded((db) => {
    const sql: DictionarySql = {
      query: <Row>(text: string) => db.prepare(text).all() as Row[],
      run: (text: string) => db.exec(text),
    };
    // As a seed before #872 wrote them: the source's wording.
    const update = db.prepare("UPDATE sense_gloss SET text = ? WHERE text = ?");
    update.run(FUNK[3], FUNK[4]);
    update.run(CIORTONE[3], CIORTONE[4]);

    assert.deepEqual(dropStoredWebAddresses(sql), { rule: "gloss-web-address/v1", candidates: 2, changed: 2 });
    assert.deepEqual(glosses(db), EXPECTED);
    assert.deepEqual(rawLines(db), LINES);

    assert.deepEqual(dropStoredWebAddresses(sql), { rule: "gloss-web-address/v1", candidates: 0, changed: 0 });
    assert.deepEqual(glosses(db), EXPECTED);
    assert.deepEqual(rawLines(db), LINES);
  });
});
