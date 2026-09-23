// The recovered layer's parser and recovery, over the raw pages under fixtures/
// (#28). The record text each case compares against is copied from the named
// archive line, so no case needs `it-extract.jsonl.gz`.

import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { recoverDefinitions, type RecordRecovery, type RecordText } from "../src/italian/recovery.js";
import { readItalianSections } from "../src/italian/wikitext.js";
import { loadFixturePages, RAW_PAGE_WIKI, type RawPage } from "../src/source/rawPage.js";

const pages = await loadFixturePages(resolve("fixtures"));

function page(title: string): RawPage {
  const found = pages.page(title);
  assert.ok(found, `fixtures/ has no raw page for ${title}`);
  return found;
}

function matched(recovery: RecordRecovery): Extract<RecordRecovery, { outcome: "matched" }> {
  assert.equal(recovery.outcome, "matched");
  return recovery as Extract<RecordRecovery, { outcome: "matched" }>;
}

/** `casa`, archive line 1: two senses, both page furniture. */
const CASA: RecordText = {
  word: "casa",
  posTitle: "Sostantivo",
  glosses: ["casa ( approfondimento) f sing", "casa ( citazioni)"],
  exampleTexts: [],
};

test("casa: every definition sits below a page-control line, and all seven come back with their examples", () => {
  const recovery = matched(recoverDefinitions(CASA, page("casa")));
  assert.equal(recovery.loss, "full");
  assert.deepEqual(
    recovery.recovered.map((definition) => [definition.route, definition.ref.line, definition.labels, definition.text]),
    [
      ["below-page-control", 8, ["architettura"], "edificio costruito per essere utilizzato come abitazione e composto da uno o più piani, suddivisi in vani distinti, ognuno per un uso specifico"],
      ["below-page-control", 10, [], "dimora di una persona; costruzione o struttura in cui uno vive; in particolare la casa in cui uno vive con la sua famiglia"],
      ["below-page-control", 13, [], "edificio che accoglie temporaneamente, per motivi specifici di salute o altro, alcune categorie di persone"],
      ["below-page-control", 15, ["figurato", "industriale"], "casa costruttrice"],
      ["below-page-control", 17, ["scacchi"], "nel gioco degli scacchi, è il nome tecnico della casella sulla scacchiera"],
      ["below-page-control", 18, ["astrologia"], "ognuna di dodici parti in cui è suddiviso il cielo in un dato momento"],
      ["below-page-control", 20, ["astrologia"], "casa lunare: ognuna di ventotto parti in cui è suddiviso il cielo durante il moto di rivoluzione della Luna"],
    ],
  );
  // Each `#**` line is attached to the definition above it, as an example.
  assert.deepEqual(
    recovery.recovered.map((definition) => definition.examples.map((example) => example.text)),
    [
      ["un mio amico ha acquistato una bella casa in montagna"],
      ["ti avviso che stasera torno a casa tardi dal lavoro", "e, in quel momento solo, si recò in piazza per poi andare a casa e riprendere il lavoro"],
      ["ha dovuto ricoverare sua zia in una casa di riposo"],
      ["ho portato il mio scooter dal meccanico per una riparazione, ma ho dovuto aspettare qualche giorno perché il pezzo di ricambio era reperibile solo presso la casa costruttrice"],
      [],
      ["alla tua nascita Saturno si trovava nella settima casa"],
      ["la Luna entrerà nella venticinquesima casa lunare alle 16:31 di giovedì prossimo"],
    ],
  );
  // Every value names the revision and line it was read from.
  const [first] = recovery.recovered;
  assert.deepEqual(first.ref, { wiki: RAW_PAGE_WIKI, title: "casa", revisionId: 4257826, line: 8 });
  assert.deepEqual(first.examples[0].ref, { wiki: RAW_PAGE_WIKI, title: "casa", revisionId: 4257826, line: 9 });
  assert.equal(first.wikitext.startsWith("#* {{Term|architettura|it}} [[edificio]]"), true);
  assert.equal(recovery.unrendered.length, 0);
});

test("casa: the two `#` lines are page controls, not senses, and the picture on line 8 is not text", () => {
  const [noun] = readItalianSections(page("casa"));
  assert.equal(noun.posTitle, "Sostantivo");
  assert.deepEqual(noun.senseLines.map((line) => [line.kind, line.ref.line, line.below.length]), [
    ["page-control", 7, 7],
    ["page-control", 22, 0],
  ]);
  assert.doesNotMatch(noun.senseLines[0].below[0].text, /File|thumb|pietra/);
});

/** `classico` adjective, archive line 48398: six senses, each glossed. */
const CLASSICO: RecordText = {
  word: "classico",
  posTitle: "Aggettivo",
  glosses: [
    "che riguarda la storia dell'antica Grecia e dell'antica Roma, ritenute le patrie della civiltà occidentale",
    "che descrive qualcosa di caratteristico o tipico",
    "in riferimento alla musica classica, ovvero quella composta da autori dei secoli immediatamente successivi alla fine del medioevo",
    "in riferimento alla danza classica",
    "riferimento a qualcosa di tradizionale, in contrapposizione a qualcosa di moderno",
    "una denominazione di vini",
  ],
  exampleTexts: [
    "il mondo classico è davvero affascinante",
    "il classico comportamento infantile",
    "un brano classico",
    "l'esibizione è tratta da un pezzo classico",
    "il corso di diritto classico non è interessante come quello di diritto internazionale",
    "Chianti classico, soave classico, bardolino classico",
  ],
};

test("classico: a partial loss — the record keeps its six senses and loses the sub-term below the first", () => {
  const recovery = matched(recoverDefinitions(CLASSICO, page("classico")));
  assert.equal(recovery.loss, "partial");
  assert.deepEqual(
    recovery.recovered.map((definition) => ({ ...definition, examples: definition.examples.length })),
    [
      {
        route: "sub-term",
        term: "liceo classico",
        text: "liceo classico, indirizzo della scuola secondaria superiore italiana, incentrato sullo studio del latino e del greco antico",
        labels: [],
        ref: { wiki: RAW_PAGE_WIKI, title: "classico", revisionId: 4050810, line: 6 },
        wikitext:
          "#*'''liceo classico''', [[indirizzo]] della [[scuola]] [[secondaria]] [[superiore]] [[italiana]], [[incentrato]] sullo [[studio]] del {{la}} e del {{grc}}",
        examples: 0,
        heldAsExample: false,
      },
    ],
  );
  // The italic `#*` lines beside it are usage sentences the extraction kept;
  // none of them is recovered, as a definition or otherwise.
  for (const example of CLASSICO.exampleTexts) {
    assert.equal(recovery.recovered.some((definition) => definition.text === example), false, example);
  }
});

/**
 * `informatica` noun, archive line 8: four senses, each glossed — the page
 * writes its three sub-terms on `#` lines, where the extraction reads them.
 */
const INFORMATICA: RecordText = {
  word: "informatica",
  posTitle: "Sostantivo",
  glosses: [
    "disciplina scientifica e tecnica che studia, con l'aiuto di concetti statistici e matematici, le operazioni per predisporre lo sviluppo di informazioni e dati con sistemi elettronici di calcolo e le loro applicazioni pratiche",
    "ingegneria informatica: ramo dell'ingegneria che progetta e realizza sistemi e soluzioni per elaborare informazioni e dati",
    "sicurezza informatica: ramo dell'informatica che si occupa delle operazioni per difendere reti e sistemi di computer da rischi e violazioni di dati",
    "informatica umanistica: è un campo di studi, ricerca, insegnamento che nasce dall'unione di discipline umanistiche e informatiche",
  ],
  exampleTexts: ["Visto il costo contenuto di un personal computer, oggi l'informatica è entrata in quasi tutte le case"],
};

test("informatica: the ordinary layout — `#` states the sense, `#*` is a usage sentence — recovers nothing", () => {
  const recovery = matched(recoverDefinitions(INFORMATICA, page("informatica")));
  assert.equal(recovery.loss, "none");
  assert.deepEqual(recovery.recovered, []);
  assert.deepEqual(recovery.alreadyGlossed, []);
  const sections = readItalianSections(page("informatica"));
  assert.ok(sections.every((section) => section.senseLines.every((line) => line.kind === "sense" && line.below.length === 0)));
});

test("the rule is the page structure, not the word: casa's layout under another title recovers the same way", () => {
  const casa = page("casa");
  const renamed: RawPage = { ...casa, title: "dimora", wikitext: casa.wikitext.replaceAll("casa", "dimora") };
  const recovery = matched(recoverDefinitions({ ...CASA, word: "dimora", glosses: [] }, renamed));
  assert.equal(recovery.loss, "full");
  assert.equal(recovery.recovered.length, 7);
  assert.equal(recovery.recovered[3].text, "dimora costruttrice");
});

test("a definition the record already glosses is not recovered twice", () => {
  const glossed = { ...CASA, glosses: [...CASA.glosses, "dimora di una persona; costruzione o struttura in cui uno vive; in particolare la casa in cui uno vive con la sua famiglia"] };
  const recovery = matched(recoverDefinitions(glossed, page("casa")));
  assert.equal(recovery.recovered.length, 6);
  assert.deepEqual(recovery.alreadyGlossed.map((definition) => definition.ref.line), [10]);
});

test("lap steel guitar: a definition the extraction filed as an example is recovered as a definition, and says so", () => {
  const record: RecordText = {
    word: "lap steel guitar",
    posTitle: "Sostantivo",
    glosses: ["lap steel guitar ( approfondimento) f sing"],
    exampleTexts: [
      '(musica) tipo di steel guitar che si suona da seduti, appoggiata sulle gambe (lap, in inglese, vuol dire effettivamente "grembo"), sprovvista quindi di meccanismi a pedale; ve ne sono due tipi fondamentali:',
    ],
  };
  const recovery = matched(recoverDefinitions(record, page("lap steel guitar")));
  assert.deepEqual(
    recovery.recovered.map((definition) => [definition.route, definition.heldAsExample]),
    [["below-page-control", true], ["lead-in-item", false], ["lead-in-item", false]],
  );
});

test("page controls with no definition below them, and quotations below a colon, recover nothing", () => {
  const nodef: RawPage = {
    wiki: RAW_PAGE_WIKI, title: "prova", revisionId: 1, timestamp: "2026-09-23T00:00:00Z",
    wikitext: [
      "== {{-it-}} ==",
      "{{-avv-|it}}",
      "# {{Nodef|it}}",
      "#* ''non abbiamo prova abbastanza''",
      "{{-sost-|it}}",
      "# [[liquore]] ottenuto dalla scorza:",
      "#*«La marchesa prese della '''prova'''» [[w:Antonio Fogazzaro|Antonio Fogazzaro]]",
    ].join("\n"),
  };
  for (const posTitle of ["Avverbio", "Sostantivo"]) {
    const recovery = matched(recoverDefinitions({ word: "prova", posTitle, glosses: [], exampleTexts: [] }, nodef));
    assert.deepEqual(recovery.recovered, [], posTitle);
  }
});

test("a line whose template the renderer does not know is reported, never printed wrong", () => {
  const unknown: RawPage = {
    wiki: RAW_PAGE_WIKI, title: "prova", revisionId: 1, timestamp: "2026-09-23T00:00:00Z",
    wikitext: ["== {{-it-}} ==", "{{-sost-|it}}", "# {{Pn}} ''f sing''", "#* [[saggio]] {{Sconosciuto|x}} di qualcosa"].join("\n"),
  };
  const recovery = matched(recoverDefinitions({ word: "prova", posTitle: "Sostantivo", glosses: [], exampleTexts: [] }, unknown));
  assert.deepEqual(recovery.recovered, []);
  assert.deepEqual(recovery.unrendered.map((line) => [line.ref.line, line.template]), [[4, "sconosciuto"]]);
});

test("a record whose part of speech the page does not carry is unmatched, not guessed at", () => {
  assert.deepEqual(recoverDefinitions({ ...CASA, posTitle: "Verbo" }, page("casa")), { outcome: "no-matching-section" });
});
