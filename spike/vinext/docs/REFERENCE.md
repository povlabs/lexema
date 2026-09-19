# vinext spike — reference

Lookup facts for the throwaway spike in `spike/vinext/`. How to run it is in
[`../README.md`](../README.md); what it taught us is in
[`docs/SPIKE_VINEXT_D1.md`](../../../docs/SPIKE_VINEXT_D1.md).

## Versions

Every direct dependency is pinned exact, with no `^`. The committed lockfile
locks the transitive resolutions. Install with `--frozen-lockfile`.

| Package | Version |
| --- | --- |
| `vinext` | `1.0.0-beta.10` |
| `@vinext/cloudflare` | `1.0.0-beta.8` |
| `vite` | `8.3.0` |
| `wrangler` | `4.135.0` |
| `workerd` (via wrangler) | `1.20260918.1` |
| `@cloudflare/vite-plugin` | `1.56.0` |
| `@vitejs/plugin-rsc` | `0.5.35` |
| `@vitejs/plugin-react` | `6.1.1` |
| `react` / `react-dom` | `19.3.0` |
| `react-server-dom-webpack` | `19.3.0` |
| `typescript` | `5.9.3` |
| Node | `24` (`.nvmrc`); also ran fine on local Node 26.2.0 |
| pnpm | `10.13.1` |

Scaffolded with `create-vinext-app@1.0.0-beta.3`.

Two limits on the pinning claim. The lockfile still carries upstream peer
ranges such as `vite: ^6.1.0 || ^7.0.0 || ^8.0.0`; those are compatibility
metadata, not floating resolved versions, and are left alone on purpose.
`.nvmrc` pins Node's major only (`24`), not an exact release.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm run dev` | vinext dev server |
| `pnpm run build` | build the Worker into `dist/` |
| `pnpm run start` | run the built Worker under wrangler (workerd) |
| `pnpm run db:seed` | seed the local D1 database |
| `pnpm run typecheck` | regenerate Workers types, then `tsc --noEmit` |
| `pnpm run proof` | all of the above, with assertions |

There is no `deploy` script. It was removed on purpose — this spike is local
only and never touches a Cloudflare account.

## Proof-run ownership tokens

`scripts/proof.sh` asserts it is talking to the server it started. Three
layers, each independent:

| Layer | Where | What it catches |
| --- | --- | --- |
| Port pre-bind | `scripts/proof.sh` (`proof-server.mjs port`) | Anything already listening on `127.0.0.1:$PORT`; fails before seeding or building |
| Per-run header | `x-spike-proof-run`, set from `--var SPIKE_PROOF_RUN` | A response from any server that is not this run |
| Live-pid check | `process.kill(pid, 0)` around each fetch | A wrangler that has exited; fast-fail only, a zombie still passes |
