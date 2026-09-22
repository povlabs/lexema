# Refreshing a face

How to replace one of the three families with a newer upstream release. What the
files are and why both ranges are kept is in [README.md](README.md).

1. Re-run that family's request from [README.md](README.md) with a browser
   `User-Agent`. The Google Fonts CSS API answers older agents with `woff`
   rather than `woff2`, so a bare `curl` returns the wrong format.
2. Keep only the `latin` and `latin-ext` blocks from the answer, and carry their
   `unicode-range` declarations across unchanged. Narrowing a range silently
   drops glyphs: `latin` carries Italian's accented vowels, `latin-ext` carries
   the IPA a pronunciation needs.
3. Replace the file of the same name in this directory. The names encode family,
   weight, style and range, and [`../app/globals.css`](../app/globals.css)
   points at them by relative path.
4. Run `pnpm test`, then look at a rendered page: a missing glyph falls back to a
   system face rather than failing, so a bad subset passes CI and shows up only
   on screen.
