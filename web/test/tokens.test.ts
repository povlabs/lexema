// The token gate: no colour and no inline style anywhere in the page's markup.
//
// ADR 0010 binds a component to reach for a role token and never for a raw
// value: "A component never uses a raw colour or size where a role token
// exists; a missing role is a manifest question for Huey, not a literal in the
// markup." The nine roles live in one `@theme` block in `web/app/globals.css`,
// and `web/components/shared/styles.ts` is the one place a class string is
// written. This test is what keeps it that way after the migration: a hex
// colour, an `rgb()`, an `hsl()`, an `oklch()` or a `style={{ … }}` added to
// any file under `web/app/`, `web/components/` or `web/lib/` fails `pnpm test`.
//
// It reads the source text rather than a rendered page on purpose. A literal is
// a fact about the file, and a rendered page shows only the states the fixture
// happens to reach.

import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { Oklch } from "./oklch.ts";

/** The folders the page's code lives in: routes, components and their logic. */
const ROOTS = ["../app", "../components", "../lib"].map((dir) => fileURLToPath(new URL(dir, import.meta.url)));

/** Every component and module under one folder, at any depth. */
async function sources(dir: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await sources(path)));
    else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) found.push(path);
  }
  return found.sort();
}

/**
 * The lines of a file that render something, which is every line that is not a
 * comment.
 *
 * A comment naming an issue (`#60`) or quoting the palette it transcribes is
 * not a literal the page paints with, and the values themselves are in
 * `globals.css`, which is not scanned here at all — it is the one file that is
 * allowed to hold them.
 */
function code(source: string): { line: number; text: string }[] {
  return source
    .split("\n")
    .map((text, i) => ({ line: i + 1, text }))
    .filter(({ text }) => {
      const trimmed = text.trimStart();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    });
}

/** What a component may never carry, and the words to say when it does. */
const FORBIDDEN: { what: string; pattern: RegExp }[] = [
  { what: "a hex colour", pattern: /#[0-9a-fA-F]{3,8}\b/ },
  { what: "an rgb() colour", pattern: /\brgba?\(/ },
  { what: "an hsl() colour", pattern: /\bhsla?\(/ },
  { what: "an oklch() colour", pattern: /\boklch\(/ },
  { what: "an inline style attribute", pattern: /style=\{\{/ },
];

test("no component under web/app/, web/components/ or web/lib/ carries a colour literal or an inline style", async () => {
  const files = (await Promise.all(ROOTS.map(sources))).flat();
  for (const root of ROOTS) {
    assert.ok(files.some((file) => file.startsWith(root)), `found no sources to scan under ${root}`);
  }

  const offences: string[] = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const { line, text } of code(source)) {
      for (const { what, pattern } of FORBIDDEN) {
        if (pattern.test(text)) {
          offences.push(`${file}:${line} carries ${what}: ${text.trim()}`);
        }
      }
    }
  }

  assert.deepEqual(
    offences,
    [],
    `every colour belongs to a role token in web/app/globals.css:\n${offences.join("\n")}`,
  );
});

test("the role tokens are declared once, in globals.css, and nowhere else", async () => {
  const css = await readFile(
    fileURLToPath(new URL("../app/globals.css", import.meta.url)),
    "utf8",
  );

  // The nine roles of design-system-manifest.md § "Role tokens: the dark
  // scheme", in its own order. A role this file stops declaring stops being
  // reachable as a utility, which is a silent loss of colour on the page.
  const ROLES = [
    "surface",
    "surface-raised",
    "border",
    "border-strong",
    "text-muted",
    "text",
    "text-strong",
    "accent",
    "warning",
  ];
  for (const role of ROLES) {
    assert.match(css, new RegExp(`^  --color-${role}: oklch\\(`, "m"), `role ${role} is declared`);
  }
  assert.equal(
    css.match(/^ {2}--color-[a-z-]+:/gm)?.length,
    ROLES.length,
    "exactly nine colour roles are declared: no tenth role, and no scale step",
  );
});

// The design file's colour and font variables, exported from Pencil. The `.pen`
// file is encrypted and CI cannot read it, so this snapshot stands in for it;
// design-system-manifest.md says when to re-export it. Huey ruled that the
// stylesheet must match the design file, so a drift on either side fails here
// (https://github.com/hueypov/lexema/issues/103#issuecomment-5926547670).
const DESIGN: Record<string, string> = JSON.parse(
  await readFile(fileURLToPath(new URL("./fixtures/design-variables.json", import.meta.url)), "utf8"),
);

/** The value of one custom property in globals.css, or a failure naming it. */
function declared(css: string, property: string): string {
  const match = new RegExp(`^ {2}--${property}: (.+);$`, "m").exec(css);
  assert.ok(match, `--${property} is declared in globals.css`);
  return match[1];
}

test("each colour role in globals.css paints the design file's hex", async () => {
  const css = await readFile(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");
  const roles = [...css.matchAll(/^ {2}--color-([a-z-]+):/gm)].map(([, role]) => role);
  assert.equal(roles.length, 9, "nine colour roles to compare");

  for (const role of roles) {
    assert.ok(role in DESIGN, `the design file has a variable for role ${role}`);
    const value = declared(css, `color-${role}`);
    assert.equal(Oklch.parse(value).toHex(), DESIGN[role], `--color-${role}: ${value}`);
  }
});

test("each font role in globals.css leads with the design file's family", async () => {
  const css = await readFile(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");
  for (const role of ["serif", "sans", "mono"]) {
    const value = declared(css, `font-${role}`);
    const primary = value.split(",")[0].trim().replace(/^"(.*)"$/, "$1");
    assert.equal(primary, DESIGN[role], `--font-${role}: ${value}`);
  }
});
