// What a later kaikki release would change in the master (#18): its records
// matched with the master's by content, never by line number or record id,
// which neither file keeps stable. docs/UPDATES.md explains the matching.

import { createHash } from "node:crypto";

/** A record the master serves, as the diff reads it. */
export interface MasterRecord {
  recordId: number;
  /** The release its line is in: the master's own, or a feed a change came from. */
  releaseId: string;
  lineNo: number;
  word: string;
  pos: string;
  lineSha256: string;
}

/** A record of the later release, as the diff reads it. */
export interface FeedRecord {
  lineNo: number;
  word: string;
  pos: string;
  lineSha256: string;
  /** Its content's digest (src/update/content.ts): equal lines in another key order match. */
  contentSha256: string;
}

/** The three kinds of change, by the prefix of their ids. */
const PREFIX = { new: "new", changed: "chg", lost: "lost" } as const;

export type ChangeKind = keyof typeof PREFIX;

/**
 * A change's id: its kind's prefix and twelve hex digits of a digest of what
 * it is — its kind, word, part of speech and the digests of the lines it
 * changes. The same master and the same later file give the same ids on every
 * run, so a person can choose changes by id and apply them later.
 */
export type ChangeId = string & { readonly changeId: unique symbol };

const ID = /^(new|chg|lost)-[0-9a-f]{12}$/;

/** `text` as a change id, or undefined when it is not shaped like one. */
export function changeIdOf(text: string): ChangeId | undefined {
  return ID.test(text) ? (text as ChangeId) : undefined;
}

function idFor(kind: ChangeKind, word: string, pos: string, masterSha: string, feedSha: string): ChangeId {
  const digest = createHash("sha256").update([kind, word, pos, masterSha, feedSha].join("\u0000"), "utf8").digest("hex");
  return `${PREFIX[kind]}-${digest.slice(0, 12)}` as ChangeId;
}

/**
 * One change the later release would make. `new` is a record of a (word, pos)
 * the master holds no unmatched record of; `changed` is the one unmatched
 * record of a (word, pos) on each side, whose content differs; `lost` is a
 * master record the later release has no record of its (word, pos) for.
 */
export type Change =
  | { kind: "new"; id: ChangeId; word: string; pos: string; feed: FeedRecord }
  | { kind: "changed"; id: ChangeId; word: string; pos: string; master: MasterRecord; feed: FeedRecord }
  | { kind: "lost"; id: ChangeId; word: string; pos: string; master: MasterRecord };

/**
 * A (word, pos) whose records cannot be paired one to one: several unmatched
 * records on one side and at least one on the other. The diff names it and
 * guesses no pairing, so nothing in it can be applied.
 */
export interface AmbiguousGroup {
  word: string;
  pos: string;
  master: MasterRecord[];
  feed: FeedRecord[];
}

/** Everything the later release would change, and how much it leaves as it is. */
export interface ReleaseDiff {
  changes: Change[];
  ambiguous: AmbiguousGroup[];
  /** Master records the later release holds a record of the same content for. */
  unchanged: number;
}

interface Group {
  word: string;
  pos: string;
  master: MasterRecord[];
  feed: FeedRecord[];
}

const groupKey = (word: string, pos: string): string => `${word}\u0000${pos}`;

/**
 * Take out of a group the pairs `same` says hold the same record, each master
 * record with at most one feed record, in line order. Returns how many paired.
 */
function pairOff(group: Group, same: (master: MasterRecord, feed: FeedRecord) => boolean): number {
  let paired = 0;
  for (const master of [...group.master]) {
    const at = group.feed.findIndex((feed) => same(master, feed));
    if (at === -1) continue;
    group.feed.splice(at, 1);
    group.master.splice(group.master.indexOf(master), 1);
    paired += 1;
  }
  return paired;
}

/**
 * The master's records and the later release's, grouped by (word, pos) and
 * paired where the line is byte for byte the same. What is left unpaired needs
 * the master's content to decide: `contentWanted` names those records, and
 * `diff` finishes the match once their content digests are read.
 */
export class RecordMatch {
  private constructor(
    private readonly groups: readonly Group[],
    private readonly byteMatched: number,
  ) {}

  static of(master: readonly MasterRecord[], feed: readonly FeedRecord[]): RecordMatch {
    const groups = new Map<string, Group>();
    const groupOf = (word: string, pos: string): Group => {
      const key = groupKey(word, pos);
      let group = groups.get(key);
      if (group === undefined) {
        group = { word, pos, master: [], feed: [] };
        groups.set(key, group);
      }
      return group;
    };
    for (const record of [...master].sort((a, b) => a.recordId - b.recordId)) groupOf(record.word, record.pos).master.push(record);
    for (const record of [...feed].sort((a, b) => a.lineNo - b.lineNo)) groupOf(record.word, record.pos).feed.push(record);
    let byteMatched = 0;
    for (const group of groups.values()) byteMatched += pairOff(group, (m, f) => m.lineSha256 === f.lineSha256);
    return new RecordMatch([...groups.values()], byteMatched);
  }

  /**
   * The master records still unpaired in a group the later release also has
   * unpaired records in: whether one of them says what a feed record says is
   * a question of content, which the master's line answers.
   */
  get contentWanted(): number[] {
    return this.groups
      .filter((group) => group.master.length > 0 && group.feed.length > 0)
      .flatMap((group) => group.master.map((record) => record.recordId));
  }

  /**
   * Finish the match: pair what says the same in another layout, then call
   * what is left. `contentOf` holds the content digest of every record
   * `contentWanted` named.
   */
  diff(contentOf: ReadonlyMap<number, string>): ReleaseDiff {
    let unchanged = this.byteMatched;
    const changes: Change[] = [];
    const ambiguous: AmbiguousGroup[] = [];
    for (const original of this.groups) {
      const group: Group = { ...original, master: [...original.master], feed: [...original.feed] };
      if (group.master.length > 0 && group.feed.length > 0) {
        unchanged += pairOff(group, (m, f) => {
          const content = contentOf.get(m.recordId);
          if (content === undefined) throw new Error(`no content read for master record ${m.recordId}`);
          return content === f.contentSha256;
        });
      }
      const { word, pos, master, feed } = group;
      if (master.length === 0) {
        for (const record of feed) changes.push({ kind: "new", id: idFor("new", word, pos, "", record.lineSha256), word, pos, feed: record });
      } else if (feed.length === 0) {
        for (const record of master) changes.push({ kind: "lost", id: idFor("lost", word, pos, record.lineSha256, ""), word, pos, master: record });
      } else if (master.length === 1 && feed.length === 1) {
        const [before] = master;
        const [after] = feed;
        changes.push({ kind: "changed", id: idFor("changed", word, pos, before.lineSha256, after.lineSha256), word, pos, master: before, feed: after });
      } else {
        ambiguous.push({ word, pos, master, feed });
      }
    }
    return withUniqueIds(changes, ambiguous, unchanged);
  }
}

/**
 * Two changes of one (word, pos) with the same id hold byte-identical lines,
 * so neither can be chosen apart from the other: their group is ambiguous.
 */
function withUniqueIds(changes: readonly Change[], ambiguous: readonly AmbiguousGroup[], unchanged: number): ReleaseDiff {
  const count = new Map<ChangeId, number>();
  for (const change of changes) count.set(change.id, (count.get(change.id) ?? 0) + 1);
  const clashing = new Set(changes.filter((change) => (count.get(change.id) ?? 0) > 1).map((change) => groupKey(change.word, change.pos)));
  const unclear = new Map<string, AmbiguousGroup>();
  for (const change of changes) {
    const key = groupKey(change.word, change.pos);
    if (!clashing.has(key)) continue;
    const group = unclear.get(key) ?? { word: change.word, pos: change.pos, master: [], feed: [] };
    if (change.kind !== "new") group.master.push(change.master);
    if (change.kind !== "lost") group.feed.push(change.feed);
    unclear.set(key, group);
  }
  return {
    changes: changes.filter((change) => !clashing.has(groupKey(change.word, change.pos))),
    ambiguous: [...ambiguous, ...unclear.values()],
    unchanged,
  };
}
