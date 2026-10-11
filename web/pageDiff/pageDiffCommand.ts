// `pnpm run diff:pages [base] [head]` — render every word page at two commits
// and print what changed (#808).
//
// For each commit in turn, it checks the commit out into a linked worktree
// under a work directory (which installs its dependencies, ADR 0022), seeds a
// local dictionary there with that commit's own `pnpm run seed:dev`, and
// renders every word page with that commit's own site code
// (renderPages.ts). The words are every headword of either seed, so a page
// only one side has is still counted. Then it prints, in Markdown:
// pages compared, changed, added and removed, and the words of each.
//
// - `base` defaults to where `head` left `origin/main` (`git merge-base`);
//   `head` defaults to `HEAD`. Both are any commit Git can name.
// - `SEED_INPUT` is the seed's own: the development fixture by default, or
//   `.data/source/it-extract.jsonl.gz` for the whole release.
// - `PAGE_DIFF_WORK` names the work directory, which must not exist yet and
//   is kept, with each side's snapshot; by default a temporary one is made
//   and removed. Each commit's worktree is removed either way.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { dictionaryFile } from "../../src/lookup/localDictionary.js";
import { PageDiff, PageSnapshot } from "./pageDiff.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const PAGE_DIFF_DIR = fileURLToPath(new URL(".", import.meta.url));
const FRESH_CHECKOUT = "0".repeat(40);

/** The same headwords renderPages.ts counts, read here without the site's code. */
const HEADWORDS = `SELECT word FROM source_record WHERE release_id = ?1
  UNION SELECT word FROM recovered_entry WHERE release_id = ?1`;

const log = (line: string): void => void process.stderr.write(`${line}\n`);

const git = (args: readonly string[]): string => execFileSync("git", args, { cwd: REPO, encoding: "utf8" }).trim();

/** Run a command to the end, its output on stderr, so stdout carries only the summary. */
function run(command: string, args: readonly string[], cwd: string, env: Readonly<Record<string, string>> = {}): void {
  const result = spawnSync(command, args, { cwd, stdio: ["ignore", 2, "inherit"], env: { ...process.env, ...env } });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} in ${cwd} failed (${result.error?.message ?? `exit ${result.status}`})`);
}

/** One side of the comparison: a commit, checked out and seeded under the work directory. */
class Side {
  readonly tree: string;
  readonly state: string;
  constructor(
    readonly name: "base" | "head",
    readonly commit: string,
    readonly work: string,
  ) {
    this.tree = join(work, name);
    this.state = join(work, `${name}-state`);
  }

  get snapshot(): string {
    return join(this.work, `${this.name}.jsonl`);
  }

  async checkOut(): Promise<void> {
    log(`${this.name}: checking out ${this.commit}`);
    git(["worktree", "add", "--detach", this.tree, this.commit]);
    // The post-checkout hook sets a new worktree up; where hooks are not installed, its script is run here.
    if (!existsSync(join(this.tree, "node_modules", ".pnpm"))) run("sh", ["tools/set-up-worktree.sh", FRESH_CHECKOUT], this.tree);
    // Both sides render through this renderer, so they differ only in the site's code and data.
    await rm(join(this.tree, "web", "pageDiff"), { recursive: true, force: true });
    await cp(PAGE_DIFF_DIR, join(this.tree, "web", "pageDiff"), { recursive: true });
  }

  /** Seed with the commit's own `seed:dev`; the dictionary file it leaves. */
  async seed(seedInput: string | undefined): Promise<string> {
    log(`${this.name}: seeding`);
    run("pnpm", ["run", "seed:dev"], this.tree, {
      SEED_SQL: join(this.work, `${this.name}-sql`),
      SEED_STATE: this.state,
      ...(seedInput === undefined ? {} : { SEED_INPUT: seedInput }),
    });
    await rm(join(this.work, `${this.name}-sql`), { recursive: true, force: true });
    return dictionaryFile(this.state);
  }

  async render(database: string, words: string): Promise<PageSnapshot> {
    log(`${this.name}: rendering`);
    run(process.execPath, ["--import", "tsx", "web/pageDiff/renderPages.ts", database, words, this.snapshot], this.tree, {
      NODE_ENV: "production",
      TSX_TSCONFIG_PATH: join(this.tree, "web", "tsconfig.json"),
    });
    return PageSnapshot.parse(await readFile(this.snapshot, "utf8"));
  }

  remove(): void {
    if (existsSync(this.tree)) git(["worktree", "remove", "--force", this.tree]);
  }
}

function headwords(database: string): string[] {
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    const releases = db.prepare("SELECT DISTINCT master_release_id AS id FROM served_release").all() as { id: string }[];
    return releases.flatMap(({ id }) => (db.prepare(HEADWORDS).all(id) as { word: string }[]).map(({ word }) => word));
  } finally {
    db.close();
  }
}

async function main([baseArg, headArg]: string[]): Promise<void> {
  const headRef = headArg ?? "HEAD";
  const head = git(["rev-parse", "--verify", `${headRef}^{commit}`]);
  const base = git(["rev-parse", "--verify", `${baseArg ?? git(["merge-base", "origin/main", head])}^{commit}`]);
  const seedInput = process.env.SEED_INPUT === undefined ? undefined : resolve(process.env.SEED_INPUT);
  const seedLabel = seedInput === undefined ? "fixtures/dev-seed.jsonl" : relative(REPO, seedInput);

  const named = process.env.PAGE_DIFF_WORK;
  const made = named === undefined ? await mkdtemp(join(tmpdir(), "lexema-page-diff-")) : resolve(named);
  if (named !== undefined) await mkdir(made); // refuses a directory that exists, so a run never writes into one it did not make
  // Its real path: tsx applies web/tsconfig.json (JSX, paths) only to files under the path it was given,
  // and macOS's temporary directory is a symlink.
  const work = await realpath(made);
  const sides = [new Side("base", base, work), new Side("head", head, work)] as const;
  try {
    // One side at a time: a seed and a render are each a heavy job.
    const databases: string[] = [];
    for (const side of sides) {
      await side.checkOut();
      databases.push(await side.seed(seedInput));
    }
    const words = join(work, "words.txt");
    const every = [...new Set(databases.flatMap(headwords))].sort();
    await writeFile(words, `${every.join("\n")}\n`);
    log(`${every.length} headwords across both seeds`);
    const [before, after] = [await sides[0].render(databases[0], words), await sides[1].render(databases[1], words)];
    process.stdout.write(`${PageDiff.between(before, after).summary(base.slice(0, 8), head.slice(0, 8), seedLabel)}\n`);
  } finally {
    for (const side of sides) side.remove();
    if (named === undefined) await rm(work, { recursive: true, force: true });
  }
}

await main(process.argv.slice(2));
