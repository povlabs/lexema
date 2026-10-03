// The recovered layer's parser and recovery, over the raw pages under fixtures/
// (#28). The record text each case compares against is copied from the named
// archive line, so no case needs `it-extract.jsonl.gz`.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { recordText, recoverDefinitions, type ListedUnder, type RecordRecovery, type RecordText } from "../src/italian/recovery.js";
import { readItalianSections, renderInline } from "../src/italian/wikitext.js";
import { loadFixturePages, RAW_PAGE_WIKI, type RawPage } from "../src/source/rawPage.js";

const pages = await loadFixturePages(resolve("fixtures"));

/** A record's senses, one gloss each, as `recordText` reads them. */
const senses = (...glosses: string[]): Pick<RecordText, "senseCount" | "glosses"> => ({
  senseCount: glosses.length,
  glosses: glosses.map((text, senseIndex) => ({ senseIndex, text })),
});

/** Example texts as one sense's examples, where a case's pointers carry nothing. */
const inOneSense = (...texts: string[]): RecordText["examples"] =>
  texts.map((text, j) => ({ pointer: `/senses/0/examples/${j}/text`, text }));

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
  ...senses("casa ( approfondimento) f sing", "casa ( citazioni)"),
  examples: [],
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
  ...senses(
    "che riguarda la storia dell'antica Grecia e dell'antica Roma, ritenute le patrie della civiltà occidentale",
    "che descrive qualcosa di caratteristico o tipico",
    "in riferimento alla musica classica, ovvero quella composta da autori dei secoli immediatamente successivi alla fine del medioevo",
    "in riferimento alla danza classica",
    "riferimento a qualcosa di tradizionale, in contrapposizione a qualcosa di moderno",
    "una denominazione di vini",
  ),
  examples: inOneSense(
    "il mondo classico è davvero affascinante",
    "il classico comportamento infantile",
    "un brano classico",
    "l'esibizione è tratta da un pezzo classico",
    "il corso di diritto classico non è interessante come quello di diritto internazionale",
    "Chianti classico, soave classico, bardolino classico",
  ),
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
        heldAsExample: null,
        leadIn: null,
        listedUnder: null,
      },
    ],
  );
  // The italic `#*` lines beside it are usage sentences the extraction kept;
  // none of them is recovered, as a definition or otherwise.
  for (const example of CLASSICO.examples) {
    assert.equal(recovery.recovered.some((definition) => definition.text === example.text), false, example.text);
  }
});

/**
 * `informatica` noun, archive line 8: four senses, each glossed — the page
 * writes its three sub-terms on `#` lines, where the extraction reads them.
 */
const INFORMATICA: RecordText = {
  word: "informatica",
  posTitle: "Sostantivo",
  ...senses(
    "disciplina scientifica e tecnica che studia, con l'aiuto di concetti statistici e matematici, le operazioni per predisporre lo sviluppo di informazioni e dati con sistemi elettronici di calcolo e le loro applicazioni pratiche",
    "ingegneria informatica: ramo dell'ingegneria che progetta e realizza sistemi e soluzioni per elaborare informazioni e dati",
    "sicurezza informatica: ramo dell'informatica che si occupa delle operazioni per difendere reti e sistemi di computer da rischi e violazioni di dati",
    "informatica umanistica: è un campo di studi, ricerca, insegnamento che nasce dall'unione di discipline umanistiche e informatiche",
  ),
  examples: inOneSense("Visto il costo contenuto di un personal computer, oggi l'informatica è entrata in quasi tutte le case"),
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
  const recovery = matched(recoverDefinitions({ ...CASA, word: "dimora", ...senses() }, renamed));
  assert.equal(recovery.loss, "full");
  assert.equal(recovery.recovered.length, 7);
  assert.equal(recovery.recovered[3].text, "dimora costruttrice");
});

test("a definition the record already glosses is not recovered twice", () => {
  const glossed = { ...CASA, ...senses(...CASA.glosses.map((gloss) => gloss.text), "dimora di una persona; costruzione o struttura in cui uno vive; in particolare la casa in cui uno vive con la sua famiglia") };
  const recovery = matched(recoverDefinitions(glossed, page("casa")));
  assert.equal(recovery.recovered.length, 6);
  assert.deepEqual(recovery.alreadyGlossed.map((definition) => definition.ref.line), [10]);
});

test("lap steel guitar: a definition the extraction filed as an example is recovered as a definition, and names that example", () => {
  // Archive line 605574, verbatim: its one sense is furniture, and the page's
  // main definition sits in that sense's `examples`.
  const record = recordText(JSON.parse(readFileSync(resolve("fixtures/lap-steel-guitar.jsonl"), "utf8")));
  const recovery = matched(recoverDefinitions(record, page("lap steel guitar")));
  assert.deepEqual(
    recovery.recovered.map((definition) => [definition.route, definition.heldAsExample]),
    [["below-page-control", "/senses/0/examples/0/text"], ["lead-in-item", null], ["lead-in-item", null]],
  );
});

test("lap steel guitar: the items of a recovered definition's colon list sit under it, not beside it", () => {
  const record = recordText(JSON.parse(readFileSync(resolve("fixtures/lap-steel-guitar.jsonl"), "utf8")));
  const recovery = matched(recoverDefinitions(record, page("lap steel guitar")));
  assert.deepEqual(
    recovery.recovered.map((definition) => [definition.ref.line, definition.leadIn?.ref.line ?? null, definition.listedUnder]),
    [
      [6, null, null],
      [7, 6, { in: "recovered", index: 0 }],
      [8, 6, { in: "recovered", index: 0 }],
    ],
  );
});

test("accollato: the items below a sense the record carries sit under that sense, exactly as the page words them", () => {
  // Archive line 33357, verbatim, and its page from the 2026-07-01 dump.
  const record = recordText(JSON.parse(readFileSync(resolve("fixtures/accollato.jsonl"), "utf8")));
  const recovery = matched(recoverDefinitions(record, page("accollato")));
  assert.equal(recovery.loss, "partial");
  const under = { in: "sense", senseIndex: 2 };
  assert.deepEqual(
    recovery.recovered.map((definition) => [definition.route, definition.ref.line, definition.text, definition.listedUnder]),
    [
      ["lead-in-item", 7, "due scudi araldici contigui,", under],
      ["lead-in-item", 8, "più figure lunghe i cui fianchi si toccano,", under],
      [
        "lead-in-item",
        9,
        "animali muniti di collare (preferibile il termine collarinato) o con altre figure poste attorno o sul collo, come un lambello o una corona",
        under,
      ],
      ["lead-in-item", 10, "figure lunghe cui se ne attorcigliano altre,", under],
      ["lead-in-item", 11, "scudi che si appoggiano a insegne d'onore sporgenti dal retro,", under],
      ["lead-in-item", 12, "animali rappresentati con i colli intrecciati, o anche solo congiunti, e passati in decusse.", under],
    ],
  );
  assert.deepEqual(recovery.recovered[0].leadIn, {
    ref: { wiki: RAW_PAGE_WIKI, title: "accollato", revisionId: 3891844, line: 6 },
    text: "attributo araldico che si applica a:",
    on: "sense-line",
  });
  assert.equal(recovery.recovered[0].wikitext, "#*due scudi araldici contigui,");
});

/** Where accollato's six items sit when its archive record carries `glosses`, one sense each, instead of its own. */
const accollatoUnder = (...glosses: string[]): (ListedUnder | null)[] => {
  const record = recordText(JSON.parse(readFileSync(resolve("fixtures/accollato.jsonl"), "utf8")));
  const places = matched(recoverDefinitions({ ...record, ...senses(...glosses) }, page("accollato"))).recovered.map(
    (definition) => definition.listedUnder,
  );
  assert.equal(places.length, 6);
  return [...new Set(places.map((place) => JSON.stringify(place)))].map((place) => JSON.parse(place));
};

const ABITO = "(di abito)che arriva fino al collo";
const SCARPA = "(di scarpa)che copre fino al collo del piede";
const ARALDICO = "attributo araldico che si applica a:";

test("accollato: a lead-in two senses gloss is the sense of neither, and its items stay at the top of the list", () => {
  assert.deepEqual(accollatoUnder(ARALDICO, ABITO, SCARPA, ARALDICO), [null]);
  // A sense that quotes the lead-in beside the one whose gloss is its text:
  // only the equal one is its sense, wherever the two sit.
  const quoting = "(araldica) si dice di figura cui si applica l'attributo araldico che si applica a: vedi sotto";
  assert.deepEqual(accollatoUnder(quoting, ABITO, SCARPA, ARALDICO), [{ in: "sense", senseIndex: 3 }]);
  assert.deepEqual(accollatoUnder(quoting, SCARPA, ARALDICO), [{ in: "sense", senseIndex: 2 }]);
});

test("accollato: a gloss is compared with its whitespace collapsed and its closing colon dropped, and nothing else", () => {
  assert.deepEqual(accollatoUnder(ABITO, SCARPA, "attributo  araldico che si applica a"), [{ in: "sense", senseIndex: 2 }]);
  assert.deepEqual(accollatoUnder(ABITO, SCARPA, "Attributo araldico che si applica a:"), [null]);
  assert.deepEqual(accollatoUnder(ABITO, SCARPA, "attributo araldico che si applica a:;"), [null]);
});

test("accollato: one sense per `#` line does not prove the senses are the page's lines in order", () => {
  // The record drops the first `#` line's sense and adds one at the end: the
  // sense in the lead-in's place is the added one, and the gloss finds the right one.
  assert.deepEqual(accollatoUnder(SCARPA, ARALDICO, "(figurato) che sta addosso"), [{ in: "sense", senseIndex: 1 }]);
  // The record drops the lead-in's own sense: nothing carries it, so nothing holds its items.
  assert.deepEqual(accollatoUnder(ABITO, SCARPA, "(figurato) che sta addosso"), [null]);
});

test("accollato: a sense that quotes the lead-in is not the lead-in's sense, even when it is the only one that does", () => {
  // The record drops the heraldic sense and carries one that quotes its line.
  // It is the one sense holding those words, and it sits in the lead-in's
  // place, but its gloss is not the line's text.
  const quoting = "(araldica) si dice di figura cui si applica l'attributo araldico che si applica a: vedi sotto";
  assert.deepEqual(accollatoUnder(ABITO, SCARPA, quoting), [null]);
  assert.deepEqual(accollatoUnder(ABITO, SCARPA, quoting, "(figurato) che sta addosso"), [null]);
});

test("two `#` lines with the same text: a gloss equal to both is the sense of neither, and their items stay at the top", () => {
  const twice = dumpLines("accollato", 3891844, [
    "{{-agg-|it}}",
    "# {{Term|araldica|it}} attributo araldico che si applica a:",
    "#*due scudi araldici contigui,",
    "#{{Term|abbigliamento|it}}''(di abito)''che arriva fino al [[collo]]",
    "# {{Term|araldica|it}} attributo araldico che si applica a:",
    "#*figure lunghe cui se ne attorcigliano altre,",
  ]);
  // The record keeps one of the two lines' senses. Which one the page cannot say.
  const record = { word: "accollato", posTitle: "Aggettivo", examples: [], ...senses(ABITO, ARALDICO) };
  assert.deepEqual(
    matched(recoverDefinitions(record, twice)).recovered.map((definition) => definition.listedUnder),
    [null, null],
  );
});

test("a `#` line the renderer cannot print whole is told apart from a lead-in by the words it does print", () => {
  const withSibling = (sibling: string) =>
    dumpLines("accollato", 3891844, [
      "{{-agg-|it}}",
      sibling,
      "# {{Term|araldica|it}} attributo araldico che si applica a:",
      "#*due scudi araldici contigui,",
    ]);
  const placed = (sibling: string, ...glosses: string[]) =>
    matched(
      recoverDefinitions({ word: "accollato", posTitle: "Aggettivo", examples: [], ...senses(...glosses) }, withSibling(sibling)),
    ).recovered.map((definition) => definition.listedUnder);
  // `{{Vd}}` is unknown, but the words around it are not the lead-in's.
  assert.deepEqual(placed("#per gli usi al plurale {{Vd|accollati}};", "per gli usi al plurale vedi accollati;", ARALDICO), [
    { in: "sense", senseIndex: 1 },
  ]);
  // `{{Nodef}}` prints the archive's own words, which are not the lead-in's.
  assert.deepEqual(placed("# {{Nodef|it}}", "definizione mancante; se vuoi, aggiungila tu", ARALDICO), [{ in: "sense", senseIndex: 1 }]);
  // A line that is one unknown template could print the lead-in's text.
  assert.deepEqual(placed("# {{Vd|accollati}}", "vedi accollati", ARALDICO), [null]);
  // So could one whose known words fit around it.
  assert.deepEqual(placed("# attributo {{Vd|x}} a:", "attributo vedi x a:", ARALDICO), [null]);
});

test("filetto: the items below `{{Pn|w=…}} detto di:` sit under the sense the extraction glosses with the headword's link", () => {
  // Archive line 40204, verbatim, and its page from the 2026-07-01 dump. The
  // line prints `filetto detto di:`; the record glosses it `filetto (
  // approfondimento) detto di:`, the link `{{Pn|w=…}}` adds (#399).
  const record = recordText(JSON.parse(readFileSync(resolve("fixtures/filetto.jsonl"), "utf8")));
  const recovery = matched(recoverDefinitions(record, page("filetto")));
  const under = { in: "sense", senseIndex: 6 };
  assert.equal(record.glosses[6].text, "filetto ( approfondimento) detto di:");
  assert.deepEqual(
    recovery.recovered.map((definition) => [definition.route, definition.ref.line, definition.listedUnder]),
    [
      ["lead-in-item", 11, under],
      ["lead-in-item", 12, under],
      ["lead-in-item", 13, under],
    ],
  );
  assert.deepEqual(recovery.recovered[0].leadIn, {
    ref: { wiki: RAW_PAGE_WIKI, title: "filetto", revisionId: 4045314, line: 10 },
    text: "filetto detto di:",
    on: "sense-line",
  });
});

test("a lead-in is placed only under the one sense whose gloss is its text, wherever that sense sits", () => {
  // filetto, revision 4045314: the record glosses `{{Pn|w=…}} detto di:` as
  // `filetto ( approfondimento) detto di:`, which reads as the line's text
  // once the link is dropped.
  const filetto = dumpLines("filetto", 4045314, [
    "{{-sost-|it}}",
    "# [[diminutivo]] di [[filo]]",
    "# {{Term|araldica|it}} {{Pn|w=filetto (araldica)}} detto di:",
    "#*linea di partizione leggermente ingrossata e dotata di smalto proprio, utilizzata soprattutto per separare due campi dello stesso smalto,",
    "# {{Est}} [[ognuna]] delle [[quattro]] [[sezioni]] o [[parti]] dei [[pesci]]",
  ]);
  const placed = (record: Pick<RecordText, "senseCount" | "glosses">) =>
    matched(recoverDefinitions({ word: "filetto", posTitle: "Sostantivo", examples: [], ...record }, filetto)).recovered.map(
      (definition) => definition.listedUnder,
    );
  const glosses = ["diminutivo di filo", "filetto ( approfondimento) detto di:", "ognuna delle quattro sezioni o parti dei pesci"];
  assert.deepEqual(placed(senses(...glosses)), [{ in: "sense", senseIndex: 1 }]);
  // A sense the page does not show as a `#` line moves nothing: the lead-in is
  // the one sense whose gloss is its text, by text, never by place.
  assert.deepEqual(placed(senses("aggiunto", ...glosses)), [{ in: "sense", senseIndex: 2 }]);
  assert.deepEqual(placed(senses("aggiunto", "diminutivo di filo", "filetto detto di:", "ognuna delle quattro sezioni")), [
    { in: "sense", senseIndex: 2 },
  ]);
  // A sense in the lead-in's place whose gloss is not its text places nothing.
  assert.deepEqual(placed(senses("diminutivo di filo", "filetto ( approfondimento) detto altro:", "ognuna")), [null]);
  // The link is dropped only after the record's own headword, and only once.
  assert.deepEqual(placed(senses("diminutivo di filo", "filo ( approfondimento) detto di:", "ognuna")), [null]);
  // A gloss with the link and one without, both reading as the line: neither is its sense.
  assert.deepEqual(placed(senses("diminutivo di filo", "filetto ( approfondimento) detto di:", "filetto detto di:")), [null]);
});

test("an item that defines itself in full still sits in the list its lead-in opens: layout, not wording", () => {
  // d'oro, revision 3395935.
  const doro = dumpLines("d'oro", 3395935, [
    "{{-agg-|it}}",
    "# {{Fig}} [[prezioso]] o di [[valore]], anche in senso [[astratto]]:",
    "#* ''[[parola|parole]] '''d'oro''''', ''[[persona]] '''d'oro''''', ''[[regola]] '''d'oro''''';",
    "#* ''[[nozze d'oro]]'': il cinquantesimo [[anniversario]] di [[matrimonio]];",
  ]);
  const recovery = matched(
    recoverDefinitions({ word: "d'oro", posTitle: "Aggettivo", examples: [], ...senses("prezioso o di valore, anche in senso astratto:") }, doro),
  );
  assert.deepEqual(
    recovery.recovered.map((definition) => [definition.text, definition.listedUnder]),
    [["nozze d'oro: il cinquantesimo anniversario di matrimonio;", { in: "sense", senseIndex: 0 }]],
  );
  // liceo, revision 4031729: a bold sub-term under a colon line sits in its list too.
  const liceo = dumpLines("liceo", 4031729, [
    "{{-sost-|it}}",
    "#in particolare in [[Italia]]:",
    "#* '''liceo classico''': [[incentrato]] sullo [[studio]] del [[latino]] e del [[greco]] [[antico]]",
  ]);
  assert.deepEqual(
    matched(recoverDefinitions({ word: "liceo", posTitle: "Sostantivo", examples: [], ...senses("in particolare in Italia:") }, liceo)).recovered.map(
      (definition) => [definition.route, definition.listedUnder],
    ),
    [["sub-term", { in: "sense", senseIndex: 0 }]],
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
    const recovery = matched(recoverDefinitions({ word: "prova", posTitle, ...senses(), examples: [] }, nodef));
    assert.deepEqual(recovery.recovered, [], posTitle);
  }
});

test("a line whose template the renderer does not know is reported, never printed wrong", () => {
  const unknown: RawPage = {
    wiki: RAW_PAGE_WIKI, title: "prova", revisionId: 1, timestamp: "2026-09-23T00:00:00Z",
    wikitext: ["== {{-it-}} ==", "{{-sost-|it}}", "# {{Pn}} ''f sing''", "#* [[saggio]] {{Sconosciuto|x}} di qualcosa"].join("\n"),
  };
  const recovery = matched(recoverDefinitions({ word: "prova", posTitle: "Sostantivo", ...senses(), examples: [] }, unknown));
  assert.deepEqual(recovery.recovered, []);
  assert.deepEqual(recovery.unrendered.map((line) => [line.ref.line, line.template]), [[4, "sconosciuto"]]);
});

test("a record whose part of speech the page does not carry is unmatched, not guessed at", () => {
  assert.deepEqual(recoverDefinitions({ ...CASA, posTitle: "Verbo" }, page("casa")), { outcome: "no-matching-section" });
});

// The cases below are lines from the 2026-07-01 Italian Wiktionary dump
// (CC BY-SA 4.0), each named with its title and revision. The first full run
// over the dump read the negative ones as definitions; they are held here so
// the fix stays.

/** One Italian section built from dump lines, under a made-up revision. */
function dumpLines(title: string, revisionId: number, lines: readonly string[]): RawPage {
  return { wiki: RAW_PAGE_WIKI, title, revisionId, timestamp: "2026-07-01T00:00:00Z", wikitext: ["== {{-it-}} ==", ...lines].join("\n") };
}

const recovered = (title: string, posTitle: string, page: RawPage): string[] =>
  matched(recoverDefinitions({ word: title, posTitle, ...senses(), examples: [] }, page)).recovered.map((definition) => definition.text);

test("below {{Nodef}} the page says it has no definition: a plain sentence there is not one, a sub-term that defines itself is", () => {
  // fondarsi, revision 3639635; colorito, revision 3964599.
  const fondarsi = dumpLines("fondarsi", 3639635, [
    "{{-verb-|it}}",
    "# {{Nodef|it}}",
    "#*la tua tesi, per essere credibile, deve fondarsi su dati incontrovertibili ",
  ]);
  assert.deepEqual(recovered("fondarsi", "Verbo", fondarsi), []);
  const colorito = dumpLines("colorito", 3964599, [
    "{{-agg-|it}}",
    "# {{Nodef|it}}",
    "#* '''espressione colorita''': utilizzo di termini volgari ed impropri",
  ]);
  assert.deepEqual(recovered("colorito", "Aggettivo", colorito), ["espressione colorita: utilizzo di termini volgari ed impropri"]);
});

test("a bold headword that runs on into a sentence is a usage sentence, not a sub-term", () => {
  // discordia, revision 3982261: no comma, colon or bracket after the bold word.
  const discordia = dumpLines("discordia", 3982261, [
    "{{-sost-|it}}",
    "# mancata [[conformità]] di opinioni.",
    "#* '''Discordia''' di pareri.",
  ]);
  assert.deepEqual(recovered("discordia", "Sostantivo", discordia), []);
  // fegato, revision 4037598: the colon marks the definition off from its term.
  const fegato = dumpLines("fegato", 4037598, [
    "{{-sost-|it}}",
    "# {{Term|chimica|it}} nome di talune miscele di composti di colore bruno-rossiccio",
    "#* '''fegato di zolfo''': miscela di polisolfuri impiegata nel trattamento di alcune malattie della pelle",
  ]);
  assert.deepEqual(recovered("fegato", "Sostantivo", fegato), [
    "fegato di zolfo: miscela di polisolfuri impiegata nel trattamento di alcune malattie della pelle",
  ]);
});

test("a line ending in ! or ? is something said, not a definition", () => {
  // eppure, revision 4054630.
  const eppure = dumpLines("eppure", 4054630, [
    "{{-cong-|it}}",
    "#(''Escalamazione'') esprime [[rammarico]]",
    "#* '''Eppure''', me l'avevano detto!''",
  ]);
  assert.deepEqual(recovered("eppure", "Congiunzione", eppure), []);
});

test("the items after the page's own `Esempi:` are examples, not meanings", () => {
  // famiglia, revision 4043061.
  const famiglia = dumpLines("famiglia", 4043061, [
    "{{-sost-|it}}",
    "#Esempi: ",
    "#* famiglia matriarcale,",
    "#* famiglia patriarcale, f. matrimoniale, f. monogamica, f. genealogica",
  ]);
  assert.deepEqual(recovered("famiglia", "Sostantivo", famiglia), []);
});

test("an italic quotation with its author in brackets is a quotation, even in a list a colon opens", () => {
  // paturnie, revision 3689785.
  const paturnie = dumpLines("paturnie", 3689785, [
    "{{-sost-|it}}",
    "# pop. ansie o angosce improvvise, inspiegabili e deprimenti [[malumore]], [[nervosismo]], [[stizza]], [[intolleranza]]:",
    "#* ''I genitori trasmettono ai figli le loro paturnie, le loro ubbie'' (Daniele Luttazzi)",
  ]);
  assert.deepEqual(recovered("paturnie", "Sostantivo", paturnie), []);
});

// A `#` line the page wrapped onto the next physical line, outside the list
// (reports/2026-09-18-definition-loss.md, "A second, separate loss route").

test("pantomima: a partial loss — the figurative sense's definition sits on the line after its `#`, and comes back with that line's label", () => {
  // Archive line 421114: the theatre sense only.
  const record = recordText(JSON.parse(readFileSync(resolve("fixtures/pantomima.jsonl"), "utf8")));
  assert.equal(record.senseCount, 1);
  const recovery = matched(recoverDefinitions(record, page("pantomima")));
  assert.equal(recovery.loss, "partial");
  const text = "Susseguirsi di gesti vivaci e concitati, per comunicare agli altri senza che i presenti se ne accorgano.";
  assert.deepEqual(
    recovery.recovered.map((definition) => [definition.route, definition.ref, definition.labels, definition.text, definition.wikitext]),
    [["wrapped-prose", { wiki: RAW_PAGE_WIKI, title: "pantomima", revisionId: 3994400, line: 6 }, ["figurato"], text, text]],
  );
  // Only the one line right after the `#` line: the quoted line below it is not read.
  assert.equal(recovery.recovered.some((definition) => definition.text.includes("Vidi nello specchio")), false);
});

test("vaglielo: a full loss — the record's one sense has no gloss, and the page's definition is the line after its empty `#`", () => {
  // Archive line 140524: `"senses": [{"tags": ["no-gloss"]}]`.
  const vaglielo: RecordText = { word: "vaglielo", posTitle: "Verbo", senseCount: 1, glosses: [], examples: [] };
  const recovery = matched(recoverDefinitions(vaglielo, page("vaglielo")));
  assert.equal(recovery.loss, "full");
  assert.deepEqual(
    recovery.recovered.map((definition) => [definition.route, definition.ref.line, definition.labels, definition.text]),
    [["wrapped-prose", 7, [], "Verbo imperativo composto da andare e glielo."]],
  );
});

test("verde: the heraldic sense's wrapped definition is read under its `#` line, with that line's labels", () => {
  const wrapped = readItalianSections(page("verde")).flatMap((section) =>
    section.senseLines.flatMap((line) =>
      line.below.map((definition) => [section.posTemplate, line.kind, line.ref.line, definition.route, definition.ref.line, definition.labels, definition.text]),
    ),
  );
  assert.deepEqual(wrapped, [
    [
      "sost",
      "page-control",
      30,
      "wrapped-prose",
      31,
      ["colore", "araldica"],
      "smalto araldico di colore verde intenso. Nella rappresentazione monocromatica è simbolizzato da linee parallele inclinate di 45° gradi che vanno dall'angolo in alto a sinistra a quello in basso a destra",
    ],
  ]);
  // The page has two noun sections, so a noun record still matches neither.
  assert.deepEqual(recoverDefinitions({ word: "verde", posTitle: "Sostantivo", ...senses(), examples: [] }, page("verde")), {
    outcome: "ambiguous-section",
    sections: 2,
  });
});

test("the line after a `#` that states a meaning, after {{Nodef}}, or a picture after a bare label, is not a definition", () => {
  // melone, revision 4040279: a usage sentence after a sense the record glosses.
  const melone = dumpLines("melone", 4040279, [
    "{{-sost-|it}}",
    "# {{Term|gastronomia|it}} [[frutto]] del melone",
    "In estate è un rinfrescante il melone",
  ]);
  assert.deepEqual(recovered("melone", "Sostantivo", melone), []);
  // malaccorto, revision 4039970: the page says it has no definition.
  const malaccorto = dumpLines("malaccorto", 4039970, ["{{-agg-|it}}", "# {{Nodef|it}}", "Nel loro essere malaccorti furono ridicoli"]);
  assert.deepEqual(recovered("malaccorto", "Aggettivo", malaccorto), []);
  // papaya, revision 4004516: a picture after a bare label.
  const papaya = dumpLines("papaya", 4004516, [
    "{{-sost-|it}}",
    "#{{Term|botanica|it}}",
    "[[File:Carica papaya 001.JPG|thumb|una pianta di papaya [[w:Carica papaya|Carica papaya]]]]",
  ]);
  assert.deepEqual(recovered("papaya", "Sostantivo", papaya), []);
});

// `{{taxon}}` prints the way Template:Taxon does (#495), picture left out.

test("{{taxon|X}} prints its fixed words with X bold and italic, in any case of the name", () => {
  // Aglio, revision 4023379.
  const aglio = renderInline("{{Term|botanica|it}}  [[genere]] della famiglia delle [[Liliacee]]; {{taxon|Allium sativum}}", "Aglio");
  assert.ok(aglio.rendered);
  assert.equal(aglio.text, "genere della famiglia delle Liliacee; la sua classificazione scientifica è Allium sativum ( tassonomia)");
  assert.deepEqual(aglio.labels, ["botanica"]);
  assert.deepEqual(
    aglio.runs.filter((run) => run.italic || run.bold).map((run) => [run.text, run.italic, run.bold]),
    [["Allium sativum", true, true], ["tassonomia", false, true]],
  );
  for (const name of ["Taxon", "TAXON"]) {
    const rendered = renderInline(`{{${name}|Allium sativum}}`, "Aglio");
    assert.ok(rendered.rendered, name);
    assert.equal(rendered.text, "la sua classificazione scientifica è Allium sativum ( tassonomia)", name);
  }
});

test("{{taxon}} with no first argument prints no definition, so the line stays unrendered", () => {
  for (const body of ["[[pianta]]; {{taxon}}", "[[pianta]]; {{Taxon|}}", "[[pianta]]; {{taxon| }}", "[[pianta]]; {{taxon|lang=it}}"]) {
    assert.deepEqual(renderInline(body, "prova"), { rendered: false, template: "taxon" }, body);
  }
});

test("{{Taxon}} inside italics toggles the emphasis around the name, and the words stay right", () => {
  // coniglio: `#:''{{Taxon|Oryctolagus cuniculus}}''`.
  const coniglio = renderInline("''{{Taxon|Oryctolagus cuniculus}}''", "coniglio");
  assert.ok(coniglio.rendered);
  assert.equal(coniglio.text, "la sua classificazione scientifica è Oryctolagus cuniculus ( tassonomia)");
  assert.deepEqual(
    coniglio.runs.filter((run) => run.text.trim() !== "").map((run) => [run.text.trim(), run.italic, run.bold]),
    [
      ["la sua classificazione scientifica è", true, false],
      ["Oryctolagus cuniculus", false, true],
      ["(", true, false],
      ["tassonomia", true, true],
      [")", true, false],
    ],
  );
});

test("a record-backed `#` line with {{Taxon}} is known whole and reads as the record's gloss", () => {
  // cavallo; the gloss is the archive's.
  const cavallo = dumpLines("cavallo", 1, [
    "{{-sost-|it}}",
    "# {{Term|zoologia|it|mammalogia}} [[mammifero]] [[quadrupede]] [[equino]] [[erbivoro]], {{Taxon|Equus caballus}}",
  ]);
  const [noun] = readItalianSections(cavallo);
  assert.deepEqual(noun.senseLines.map((line) => [line.kind, line.text]), [
    ["sense", { known: "whole", text: "mammifero quadrupede equino erbivoro, la sua classificazione scientifica è Equus caballus ( tassonomia)" }],
  ]);
  assert.deepEqual(noun.unrendered, []);
});
