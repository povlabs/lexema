// The local patch of `@base-ui/react` (#924, patches/@base-ui__react@1.8.0.patch):
// a combobox or autocomplete builds its `Intl.Collator` only when a filter uses
// it, so the search field's `filter={null}` never builds one, and one that does
// filter still filters as before.
//
// Base UI keeps each collator in a module-level cache keyed on the locale, so
// each case renders under a locale no other case uses; a hit in that cache
// would hide a construction.
//
// @patch-pin: @base-ui/react@1.8.0

import assert from "node:assert/strict";
import { test } from "node:test";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { Combobox } from "@base-ui/react/combobox";
import { renderToStaticMarkup } from "react-dom/server";
import { SearchField } from "@/components/dictionary/SearchField";

/** Runs `render` and counts the `Intl.Collator`s built while it ran. */
function collatorsBuilt(render: () => void): number {
  const original = Intl.Collator;
  let built = 0;
  Intl.Collator = new Proxy(original, {
    construct(target, args: ConstructorParameters<typeof Intl.Collator>) {
      built += 1;
      return new target(...args);
    },
    apply(target, _this, args: ConstructorParameters<typeof Intl.Collator>) {
      built += 1;
      return target(...args);
    },
  });
  try {
    render();
  } finally {
    Intl.Collator = original;
  }
  return built;
}

const WORDS = ["casa", "cane", "pane"];

function OpenCombobox({ locale, filter }: { locale: string; filter?: null }) {
  return (
    <Combobox.Root items={WORDS} locale={locale} filter={filter} defaultOpen defaultInputValue="ca">
      <Combobox.Input />
      <Combobox.List>{(word: string) => <Combobox.Item key={word} value={word}>{word}</Combobox.Item>}</Combobox.List>
    </Combobox.Root>
  );
}

function OpenAutocomplete({ locale, filter }: { locale: string; filter?: null }) {
  return (
    <Autocomplete.Root items={WORDS} locale={locale} filter={filter} defaultOpen defaultValue="ca">
      <Autocomplete.Input />
      <Autocomplete.List>{(word: string) => <Autocomplete.Item key={word} value={word}>{word}</Autocomplete.Item>}</Autocomplete.List>
    </Autocomplete.Root>
  );
}

test("the search field renders Base UI's Autocomplete and builds no Intl.Collator (#924)", () => {
  let html = "";
  const built = collatorsBuilt(() => {
    html = renderToStaticMarkup(<SearchField raw="" version="test" />);
  });
  assert.equal(built, 0);
  assert.match(html, /<input[^>]*name="q"/);
});

test("a combobox with filter={null} builds no Intl.Collator and keeps every item in order (#924)", () => {
  let html = "";
  const built = collatorsBuilt(() => {
    html = renderToStaticMarkup(<OpenCombobox locale="fr-FR" filter={null} />);
  });
  assert.equal(built, 0);
  assert.deepEqual(itemsIn(html), WORDS);
});

test("a combobox with the default filter still builds its collator and filters by it (#924)", () => {
  let html = "";
  const built = collatorsBuilt(() => {
    html = renderToStaticMarkup(<OpenCombobox locale="de-DE" />);
  });
  assert.equal(built, 1);
  assert.deepEqual(itemsIn(html), ["casa", "cane"]);
});

test("an autocomplete with filter={null} builds no Intl.Collator and keeps every item in order (#924)", () => {
  let html = "";
  const built = collatorsBuilt(() => {
    html = renderToStaticMarkup(<OpenAutocomplete locale="es-ES" filter={null} />);
  });
  assert.equal(built, 0);
  assert.deepEqual(itemsIn(html), WORDS);
});

test("an autocomplete with the default filter still builds its collator and filters by it (#924)", () => {
  let html = "";
  const built = collatorsBuilt(() => {
    html = renderToStaticMarkup(<OpenAutocomplete locale="pt-PT" />);
  });
  assert.equal(built, 1);
  assert.deepEqual(itemsIn(html), ["casa", "cane"]);
});

function itemsIn(html: string): string[] {
  return [...html.matchAll(/role="option"[^>]*>([^<]*)</g)].map((match) => match[1]);
}
