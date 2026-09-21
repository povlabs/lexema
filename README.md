# Lexema

An Italian word-search website for meanings, conjugations, articles, and related
forms.

The website is not built yet. The first goal is a working search flow that shows
available data honestly, including missing or disputed information. Dictionary
quality can improve separately from the website.

## The ethos

- **Source-grounded.** Every meaning, form, and pronunciation comes from the
  imported dictionary data, and each fact keeps a pointer to where it came from.
  Lexema never invents a definition, a conjugation, or an article.
- **Honest about gaps.** Missing, ambiguous, and disputed data shows as missing,
  ambiguous, or disputed. A search returns every valid candidate and lets the
  reader choose; nothing is silently dropped or corrected.
- **Deterministic grammar.** Italian articles and other grammar enrichment follow
  explicit rules over explicit source tags. There is no AI generation in the
  product.
- **English interface, Italian definitions.** The interface is in English.
  Definitions appear in the Italian the source wrote them in, because a
  translation would be a lexical claim Lexema cannot ground.

## Work tracking

[GitHub milestones](https://github.com/hueypov/lexema/milestones) hold the goals.
[Issues](https://github.com/hueypov/lexema/issues) hold tasks and decisions.
Changes go through linked pull requests.

## Developing on this?

Lexema runs on Cloudflare: a Worker reads a D1 projection of the dictionary, R2
keeps the original source file, and vinext renders the React pages. If you are
here to build, read [DEVELOPMENT.md](./DEVELOPMENT.md) for setup, commands, the
repository layout, and the current state of the code.
