// The served release, read from the change declarations in a checkout (#139).
//
// The web build calls this once (web/vite.config.ts), so the Licence page
// carries the release as a value and reads no database and no file at request
// time. What the release is follows from src/source/servedRelease.ts.
//
// Only `update:auto` declarations name a release, so only they are parsed.
// A declaration is checked against the rules its command applies today, and
// an older one of another command can name rules since superseded
// (`load:page-entries`' first two lack `italian-page-facts/v1`): it was valid
// when it was deployed, and nothing reads it again, so it is not read here.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { servedRelease, type ServedRelease } from "../source/servedRelease.js";
import { DECLARATIONS_DIR, isDeclarationPath, parseDeclaration, type ChangeDeclaration } from "./declaration.js";

/** The `update:auto` declaration `text` states, or none for a file of another command. */
function feedOf(file: string, text: string): ChangeDeclaration | undefined {
  let command: unknown;
  try {
    ({ command } = JSON.parse(text) as { command?: unknown });
  } catch {
    // Not JSON: the parser's refusal names the file and why.
    return parseDeclaration(file, text);
  }
  return command === "update:auto" ? parseDeclaration(file, text) : undefined;
}

/** The release the declarations under `root`'s `dictionary-changes/` leave the dictionary serving. */
export async function readServedRelease(root: string): Promise<ServedRelease> {
  const files = (await readdir(join(root, DECLARATIONS_DIR)))
    .map((name) => `${DECLARATIONS_DIR}/${name}`)
    .filter(isDeclarationPath)
    .sort();
  const feeds = await Promise.all(files.map(async (file) => feedOf(file, await readFile(join(root, file), "utf8"))));
  return servedRelease(feeds.filter((feed) => feed !== undefined));
}
