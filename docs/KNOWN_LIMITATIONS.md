# Known limitations

What a reader should know about Lexema's data before relying on it. The list
below is written to be read on the site; where it goes there is the attribution
and licence work that follows go-live (#413, #19). The numbers come from
[the dictionary quality report](../reports/2026-10-01-dictionary-quality.md),
measured on release `it-0c432803`.

## For the site

- **Where the words come from.** Every entry comes from the Italian Wiktionary
  (Wikizionario), as [kaikki.org](https://kaikki.org/dictionary/Italian/)
  extracts it. Lexema writes no definition of its own and adds no translation.
  Definitions are in the Italian the source wrote them in.
- **It can be behind Wiktionary.** Lexema takes in a newer extract from time to
  time, not every edit as it happens.
- **Some words are missing.** Wiktionary has no page for some words, and some
  pages are written in a way the extraction cannot read. So a form can say what
  word it comes from, and that word can still have no entry here.
- **Some entries have no definition.** About 1 entry in 80 shows no definition.
- **Some nouns have no gender, so no article.** Up to about 1 noun in 8 has no gender
  stated in the source. Lexema never guesses one, so it shows no *il* or
  *la* for that noun.
- **What the source does not say is left blank.** A form, a gender or a number
  the source does not give is shown as missing, never filled in.
- **When the source does not choose, neither does Lexema.** If a form could
  belong to more than one word, every one of them is shown.
- **Accents matter.** `citta` is not `città`. A search without its accent finds
  nothing, and offers the accented word instead.
- **Every word links to its source.** The *Fonte* link at the end of a page
  opens that word's page on the Italian Wiktionary. *Segnala un errore*, beside
  it, sends a note that a person reads.
