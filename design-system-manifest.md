# Design-system manifest — rendered UI design law

The agent-readable design law a builder reads before generating any UI, the way it
reads [AGENTS.md](./AGENTS.md). Lexema has no rendered UI yet, so this file holds
only the law the decisions already settle. It is founder-authored and
agent-transcribed: an agent records a ruling here and never invents one. Where the
law is silent, ask Huey before painting; the gap is not filled here.

## Settled law

| Rule | Source |
|---|---|
| The interface is in English. | [ADR 0004](./.decisions/0004-cloudflare-workers-d1-vinext.md) |
| Definitions, examples, and forms appear in the Italian the source wrote them in, never translated or paraphrased. | [ADR 0004](./.decisions/0004-cloudflare-workers-d1-vinext.md) |
| Missing, ambiguous, and disputed data is shown as such, in words. It is never hidden, smoothed over, or signalled by colour alone. | [README.md](./README.md) |
| Every candidate a lookup returns is rendered. The interface may rank; it never drops. | [AGENTS.md](./AGENTS.md), the product rule |

## Not yet ruled

Role tokens, the type ramp, colour roles, component primitives, density, focus
treatment, and dark mode. The first UI issue settles these with Huey. Until then
there is no role-token layer for the `taste-color` skill to read, and a builder
who needs one stops and asks.
