// The name a branch's Preview goes by, and the app database named after it
// (ADR 0018). The preview command and the sweep both derive it here, from the
// branch name alone, so the sweep finds exactly what the preview command made.
//
// A branch name is not a host label: this repository's look like
// `build/251-preview-adr-f7d91140` or `huey/foo_bar`. The name must be one DNS
// label twice over. Cloudflare serves a Preview at `<name>.preview.lexema.fyi`
// and one deployment of it at `<deployment-id>-<name>.preview.lexema.fyi`
// ("Previews", https://developers.cloudflare.com/workers/previews/#urls), and a
// label is at most 63 characters (RFC 1035 §2.3.4). Neither Cloudflare's docs
// nor Wrangler 4.135.0 say how long a deployment id is: Wrangler only prints
// the URLs the API returns (`formatPreviewDeploymentSummary` in
// wrangler-dist/cli.js). So the budget assumes the longest id Cloudflare uses,
// a 36-character UUID, and a name gets 63 - 36 - 1 = 26 characters.
//
// The same name, behind `lexema-preview-app-`, names a D1 database: 45
// characters at most, of lowercase letters, digits and hyphens. Behind
// `lexema-preview-dict-`, it names the branch's dictionary slice (#447), when
// the branch changes dictionary data: 46 characters at most.

import { createHash } from "node:crypto";

/** A host label is at most 63 characters (RFC 1035 §2.3.4). */
const LABEL_MAX = 63;
/** The longest deployment id the budget allows for: a UUID. */
const DEPLOYMENT_ID_MAX = 36;
/** The longest a Preview name may be: `<deployment-id>-<name>` still fits one label. */
export const PREVIEW_NAME_MAX = LABEL_MAX - DEPLOYMENT_ID_MAX - 1;
/** Hex digits of the branch's SHA-256 a changed or shortened name ends with. */
const HASH_LENGTH = 8;

/** What every Preview app database's name starts with. */
export const APP_DATABASE_PREFIX = "lexema-preview-app-";
/** What every Preview dictionary slice's name starts with (#447). */
export const SLICE_DATABASE_PREFIX = "lexema-preview-dict-";

/** A name that is one DNS label: lowercase letters, digits and inner hyphens. */
const NAME = new RegExp(`^[a-z0-9](?:[a-z0-9-]{0,${PREVIEW_NAME_MAX - 2}}[a-z0-9])?$`);

/**
 * One branch's Preview name. It exists only as a valid name: `ofBranch` makes
 * one from any branch, and `ofAppDatabase` reads one back out of a database
 * name, or none.
 *
 * A branch that is already a short, valid name keeps it, so `huey-242-preview`
 * previews as `huey-242-preview`. Any other branch keeps a readable prefix and
 * ends with the first 8 hex digits of its own SHA-256, so two branches that
 * clean up to the same text, such as `huey/foo_bar` and `huey-foo-bar`, still
 * get different names, and the same branch always gets the same one.
 */
export class PreviewName {
  readonly value: string;

  private constructor(value: string) {
    if (!NAME.test(value)) throw new Error(`not a Preview name: ${JSON.stringify(value)}`);
    this.value = value;
  }

  /** The Preview name for this branch, the same every time. */
  static ofBranch(branch: string): PreviewName {
    if (branch.length === 0) throw new Error("a Preview needs a branch name; WORKERS_CI_BRANCH is empty");
    if (NAME.test(branch)) return new PreviewName(branch);
    const hash = createHash("sha256").update(branch).digest("hex").slice(0, HASH_LENGTH);
    const cleaned = branch.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "");
    const prefix = cleaned.slice(0, PREVIEW_NAME_MAX - HASH_LENGTH - 1).replace(/-+$/, "");
    return new PreviewName(prefix === "" ? hash : `${prefix}-${hash}`);
  }

  /** The Preview whose app database this is, or none for any other database. */
  static ofAppDatabase(databaseName: string): PreviewName | undefined {
    return PreviewName.behind(APP_DATABASE_PREFIX, databaseName);
  }

  /** The Preview whose dictionary slice this is, or none for any other database. */
  static ofSliceDatabase(databaseName: string): PreviewName | undefined {
    return PreviewName.behind(SLICE_DATABASE_PREFIX, databaseName);
  }

  private static behind(prefix: string, databaseName: string): PreviewName | undefined {
    if (!databaseName.startsWith(prefix)) return undefined;
    const value = databaseName.slice(prefix.length);
    return NAME.test(value) ? new PreviewName(value) : undefined;
  }

  /** The D1 database this Preview writes to: `lexema-preview-app-<name>`. */
  get appDatabase(): string {
    return `${APP_DATABASE_PREFIX}${this.value}`;
  }

  /** The D1 database this Preview's dictionary slice is in, when it has one: `lexema-preview-dict-<name>`. */
  get sliceDatabase(): string {
    return `${SLICE_DATABASE_PREFIX}${this.value}`;
  }

  equals(other: PreviewName): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
