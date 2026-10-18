// Rule `it-cardinal/v1` (ADR 0034, #804): which spellings it reads as a
// cardinal, and the value of each.

import assert from "node:assert/strict";
import test from "node:test";
import { CARDINAL_LIMIT, CARDINAL_RULE, cardinalDefinition, parseItalianCardinal } from "../src/italian/cardinal.js";

const valueOf = (key: string): number | undefined => parseItalianCardinal(key)?.value;

test("the rule reads the cardinals the issue names, and says which rule read them", () => {
  assert.equal(valueOf("duemilauno"), 2001);
  assert.equal(valueOf("centoventitré"), 123);
  assert.equal(valueOf("millenovecentottanta"), 1980);
  assert.equal(valueOf("duemilaventi"), 2020);
  assert.equal(parseItalianCardinal("duemilauno")?.rule, CARDINAL_RULE);
});

test("the rule reads the edges of its range: zero, one, a thousand and 999.999", () => {
  assert.equal(valueOf("zero"), 0);
  assert.equal(valueOf("uno"), 1);
  assert.equal(valueOf("mille"), 1000);
  assert.equal(valueOf("novecentonovantanovemilanovecentonovantanove"), CARDINAL_LIMIT);
});

test("a ten drops its vowel before uno and otto, and only there", () => {
  assert.deepEqual(["ventuno", "trentotto", "ventidue", "novantanove"].map(valueOf), [21, 38, 22, 99]);
  assert.deepEqual(["ventiuno", "trentaotto", "ventdue"].map(valueOf), [undefined, undefined, undefined]);
});

test("a hundred drops its o before ottanta, and may keep or drop it before uno and otto", () => {
  assert.deepEqual(["centottanta", "novecentottantuno", "centouno", "centuno", "centootto", "centotto"].map(valueOf), [180, 981, 101, 101, 108, 108]);
  assert.equal(valueOf("centoottanta"), undefined);
});

test("a thousand is mille, more are -mila, and a multiplier ending in uno may drop its o", () => {
  assert.deepEqual(["milleuno", "duemila", "ventunmila", "ventunomila", "centomila", "trecentoquarantacinquemilaseicentosettantotto"].map(valueOf), [
    1001, 2000, 21000, 21000, 100000, 345678,
  ]);
  assert.deepEqual(["unmila", "unomila", "unmille", "duemille", "millemila", "mila"].map(valueOf), [undefined, undefined, undefined, undefined, undefined, undefined]);
});

test("a compound's final tre may carry its accent or not; tre alone and a tre before more letters carry none", () => {
  assert.deepEqual(["ventitré", "ventitre", "milletré", "tre", "tremila"].map(valueOf), [23, 23, 1003, 3, 3000]);
  assert.deepEqual(["tré", "trémila", "ventitrémila", "ventitrè"].map(valueOf), [undefined, undefined, undefined, undefined]);
});

test("a malformed spelling, a number from a million up, spaces and digits are no cardinal of the rule", () => {
  for (const key of ["centocento", "unmilione", "milione", "due mila", "duemila e uno", "ventitre-mila", "2001", "", "casa", "duecentocento", "diecimilamila"]) {
    assert.equal(parseItalianCardinal(key), undefined, key);
  }
});

test("each value from 0 to 999.999 has a spelling the rule reads back to it", () => {
  const spell = (n: number): string => {
    const units = ["", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove"];
    const teens = ["dieci", "undici", "dodici", "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto", "diciannove"];
    const tens = ["", "", "venti", "trenta", "quaranta", "cinquanta", "sessanta", "settanta", "ottanta", "novanta"];
    const hundred = (m: number): string => {
      const rest = m % 100;
      const below = rest < 10 ? units[rest] : rest < 20 ? teens[rest - 10] : (rest % 10 === 1 || rest % 10 === 8 ? tens[Math.floor(rest / 10)].slice(0, -1) : tens[Math.floor(rest / 10)]) + units[rest % 10];
      const h = Math.floor(m / 100);
      if (h === 0) return below;
      const cento = h === 1 ? "cento" : `${units[h]}cento`;
      return rest >= 80 && rest < 90 ? cento.slice(0, -1) + below : cento + below;
    };
    if (n === 0) return "zero";
    const thousands = Math.floor(n / 1000);
    const head = thousands === 0 ? "" : thousands === 1 ? "mille" : `${hundred(thousands)}mila`;
    return head + hundred(n % 1000);
  };
  for (let n = 0; n <= CARDINAL_LIMIT; n += n < 3000 ? 1 : 997) assert.equal(valueOf(spell(n)), n, spell(n));
  assert.equal(valueOf(spell(CARDINAL_LIMIT)), CARDINAL_LIMIT);
});

test("the definition is the fixed Lexema text, the value in digits", () => {
  const read = parseItalianCardinal("duemilauno");
  assert.ok(read !== undefined);
  assert.equal(cardinalDefinition(read), "numero cardinale corrispondente a 2001");
});
