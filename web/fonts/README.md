# The three faces, served from here

`lexema-design.pen` names three families in its top-level `variables`: Spectral
for serif, Inter for sans, IBM Plex Mono for mono. They are committed here as
`.woff2` and declared in [`../app/globals.css`](../app/globals.css) rather than
fetched from a font CDN at runtime, so a reader looking up a word tells no third
origin which page they opened.

Every file came from Google Fonts' own CSS API on 2026-09-22, which is where the
upstream releases are published; nothing is touched after download. The requests,
verbatim:

- `https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,600;0,700;1,400&display=swap`
- `https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap`
- `https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&display=swap`

Each answer is a `@font-face` per weight per character range. Only the `latin`
and `latin-ext` ranges are kept — `latin-ext` is what renders Italian's accented
vowels — and their `unicode-range` declarations are carried across unchanged, so
a browser fetches a file only when a glyph on the page needs it.

Inter is one variable file per range covering weights 100–900: the API returns
the same bytes for 400 and 600, so it is stored once and declared
`font-weight: 100 900`.

To refresh a face, re-run its request above with a browser `User-Agent` (the API
answers older agents with `woff`), keep the `latin` and `latin-ext` blocks, and
replace the file of the same name.

Licences: Spectral and IBM Plex Mono are under the SIL Open Font License 1.1,
Inter under the SIL Open Font License 1.1.
