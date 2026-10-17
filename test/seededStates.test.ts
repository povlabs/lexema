import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { type Seeder, SeededStates, SeedInputs, UNUSED_STATE_LIFETIME_MS } from "../src/import/seededStates.js";

/** A checkout holding every input `SeedInputs` reads, with one fixture file. */
async function checkout(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "seed-inputs-"));
  await mkdir(join(root, "src", "import"), { recursive: true });
  await mkdir(join(root, "fixtures", "names"), { recursive: true });
  await mkdir(join(root, "web"));
  await writeFile(join(root, "src", "import", "seedDev.ts"), "seed\n");
  await writeFile(join(root, "fixtures", "names", "dev-names.jsonl"), "{}\n");
  await writeFile(join(root, "web", "wrangler.jsonc"), "{}\n");
  await writeFile(join(root, "package.json"), "{}\n");
  await writeFile(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  return root;
}

/** A seeder that writes `seeded` into each state and counts its runs. */
function countingSeeder(): { seed: Seeder; runs: () => number } {
  let runs = 0;
  return {
    seed: async (state) => {
      runs += 1;
      await mkdir(state);
      await writeFile(join(state, "db.sqlite"), `seeded ${runs}`);
    },
    runs: () => runs,
  };
}

test("the inputs' digest holds while nothing changes, and moves with a fixture, the code or a setting", async () => {
  const root = await checkout();
  const first = await SeedInputs.of(root, {});
  assert.equal((await SeedInputs.of(root, {})).digest, first.digest);

  await writeFile(join(root, "fixtures", "names", "dev-names.jsonl"), "{\"name\":\"Roma\"}\n");
  const afterFixture = await SeedInputs.of(root, {});
  assert.notEqual(afterFixture.digest, first.digest);

  await writeFile(join(root, "src", "import", "added.ts"), "export {};\n");
  const afterCode = await SeedInputs.of(root, {});
  assert.notEqual(afterCode.digest, afterFixture.digest);

  assert.notEqual((await SeedInputs.of(root, { RAW_PAGES: "fixtures" })).digest, afterCode.digest);
  // Where the seed writes is not an input.
  assert.equal((await SeedInputs.of(root, { SEED_STATE: "/elsewhere", SEED_STATES: "/kept" })).digest, afterCode.digest);
});

test("a remote seed has no local state to keep", async () => {
  await assert.rejects(SeedInputs.of(await checkout(), { SEED_REMOTE: "lexema-preview" }), /SEED_REMOTE/);
});

test("a state is seeded once per inputs, and every caller gets its own copy", async () => {
  const root = await checkout();
  const states = new SeededStates(join(root, ".data", "seeded-states"));
  const { seed, runs } = countingSeeder();
  const inputs = await SeedInputs.of(root, {});

  assert.equal(await states.copyTo(inputs, join(root, "a"), seed), "seeded");
  assert.equal(await states.copyTo(inputs, join(root, "b"), seed), "reused");
  assert.equal(runs(), 1);

  // Writing one copy leaves the other and the kept state as seeded.
  await writeFile(join(root, "a", "db.sqlite"), "written by one render");
  assert.equal(await readFile(join(root, "b", "db.sqlite"), "utf8"), "seeded 1");
  await states.copyTo(inputs, join(root, "c"), seed);
  assert.equal(await readFile(join(root, "c", "db.sqlite"), "utf8"), "seeded 1");

  await writeFile(join(root, "fixtures", "names", "dev-names.jsonl"), "changed\n");
  assert.equal(await states.copyTo(await SeedInputs.of(root, {}), join(root, "d"), seed), "seeded");
  assert.equal(runs(), 2);
  assert.equal(await readFile(join(root, "d", "db.sqlite"), "utf8"), "seeded 2");
});

test("a copy never lands on a directory that already exists", async () => {
  const root = await checkout();
  const states = new SeededStates(join(root, "kept"));
  await mkdir(join(root, "taken"));
  await assert.rejects(states.copyTo(await SeedInputs.of(root, {}), join(root, "taken"), countingSeeder().seed));
});

test("a failed seed keeps nothing, so the next run seeds again", async () => {
  const root = await checkout();
  const kept = join(root, "kept");
  const states = new SeededStates(kept);
  const inputs = await SeedInputs.of(root, {});
  const failing: Seeder = async (state) => {
    await mkdir(state);
    throw new Error("seed stopped");
  };
  await assert.rejects(states.copyTo(inputs, join(root, "a"), failing), /seed stopped/);
  assert.deepEqual(await readdir(kept), []);
  const { seed, runs } = countingSeeder();
  assert.equal(await states.copyTo(inputs, join(root, "a"), seed), "seeded");
  assert.equal(runs(), 1);
});

test("two runs seeding the same inputs at once both get the one kept state", async () => {
  const root = await checkout();
  const kept = join(root, "kept");
  const states = new SeededStates(kept);
  const inputs = await SeedInputs.of(root, {});
  const { seed } = countingSeeder();
  const origins = await Promise.all([states.copyTo(inputs, join(root, "a"), seed), states.copyTo(inputs, join(root, "b"), seed)]);
  assert.deepEqual([...origins].sort(), ["reused", "seeded"]);
  assert.deepEqual(await readdir(kept), [inputs.digest]);
  assert.equal(await readFile(join(root, "a", "db.sqlite"), "utf8"), await readFile(join(root, "b", "db.sqlite"), "utf8"));
});

test("keeping a new state removes those unused past their lifetime", async () => {
  const root = await checkout();
  const kept = join(root, "kept");
  const now = Date.now();
  const states = new SeededStates(kept, () => now);
  const { seed } = countingSeeder();
  const old = await SeedInputs.of(root, {});
  await states.copyTo(old, join(root, "a"), seed);
  const longAgo = new Date(now - UNUSED_STATE_LIFETIME_MS - 1000);
  await utimes(join(kept, old.digest), longAgo, longAgo);

  const fresh = await SeedInputs.of(root, { SEED_PART_BYTES: "1000" });
  await states.copyTo(fresh, join(root, "b"), seed);
  assert.deepEqual(await readdir(kept), [fresh.digest]);
});
