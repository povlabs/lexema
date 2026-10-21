# Why every Preview deploy failed with 10021 — 2026-10-21

Issue [#911](https://github.com/povlabs/lexema/issues/911). Since 2026-10-21 every
Preview deploy ends red at `wrangler preview` with
`Script startup exceeded CPU time limit. [code: 10021]`
([Cloudflare's error list](https://developers.cloudflare.com/workers/observability/errors/#validation-errors-10021)).

## Cause

The cause is in the repo: startup work in the Worker's global scope.

[src/italian/curatedCorrections.ts](../src/italian/curatedCorrections.ts) builds
`CURATED_CORRECTIONS` when it loads. That runs three rules over their evidence
tables, and the form-of meaning rule compares spellings with an edit distance
for every record it lists. The Worker needs none of that list. It needs only
`evidenceUrl`, the permanent link of a cited revision. But three runtime modules
imported `evidenceUrl` from that file:

- [src/lookup/handKept.ts](../src/lookup/handKept.ts), since #856 (2026-10-17);
- [src/italian/handKeptReadings.ts](../src/italian/handKeptReadings.ts), since #745 (2026-10-09);
- [src/italian/handKeptTables.ts](../src/italian/handKeptTables.ts), since #845 (2026-10-17).

A bundler keeps a module whose top level calls functions, so the whole build and
its tables went into the Worker and ran at every startup.

The CPU profile of the built Worker on `main` names it: of 354 ms active startup,
about 284 ms is inside that module's load, and 264 ms of that is the edit-distance
function (`editDistance` in
[src/italian/formOfMeaningEdge.ts](../src/italian/formOfMeaningEdge.ts), minified
`Wi`). Everything else in startup is under 20 ms.

## Why it broke on 2026-10-21 and not before

The bundle did not change between the last green Previews and the first red one.
`main` before #906 (`7587062`) measures 371 ms active, and `main` after #907
(`f7b0df2`) measures 354 ms: the same within noise. So the Worker had been near
the limit for some days, and on 2026-10-21 Cloudflare's measure of it went over.
Whether that came from a change on Cloudflare's side or from normal variance in
its startup timing is not visible from here. The Workers Builds log is readable
only in the Cloudflare dashboard, and the check run on the pull request carries
no log. The pinned wrangler is `4.135.0`; the build log's banner was not read.

Either way, the startup work is ours, and it was most of startup. Removing it
leaves a wide margin under any limit Cloudflare applies.

## Measurements

Command, run from `web/` after `pnpm run build`, with no Cloudflare login used:

```sh
CLOUDFLARE_API_TOKEN=unused-local-profile node_modules/.bin/wrangler check startup --config dist/server/wrangler.json
```

`wrangler check startup` builds the Worker with `wrangler deploy --dry-run` and
profiles its startup on this machine (an Apple laptop). Cloudflare's CPUs differ,
so these numbers compare builds; they are not Cloudflare's own figure.

| Build | Bundle | Active startup CPU |
|---|---:|---:|
| `main` before #906, `7587062` | 9,594 KiB | 370.6 ms |
| `main`, `f7b0df2` | 9,595 KiB | 354.3 ms |
| This fix | 6,618 KiB | 68.6 ms |

The Preview build changes only the bindings in `dist/server/wrangler.json`
([web/builds/previewConfig.ts](../web/builds/previewConfig.ts)), not the code, so
its startup work is the same as the plain build's.

## Fix

[src/italian/evidence.ts](../src/italian/evidence.ts) now holds `Evidence` and
`evidenceUrl`, and the three runtime modules import from it.
`curatedCorrections.ts` re-exports both, so import-side code is unchanged.
[web/test/startupWork.test.ts](../web/test/startupWork.test.ts) follows every
runtime import from web/'s runtime folders into `src/` and fails if any reaches
`curatedCorrections.ts`.

Production builds from the same code, so production's startup drops the same
way on its next deploy.
