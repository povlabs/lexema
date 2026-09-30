// Wikizionario's missing-field placeholder, and the source text left once it is
// taken out (#255).
//
// Where a page has no hyphenation, definition, etymology or references,
// Wikizionario prints a fixed sentence asking the reader to add one, and the
// extraction keeps it as if it were the field's text:
//
//   → Divisione in sillabe mancante. Se vuoi, aggiungila tu.
//   definizione mancante; se vuoi, aggiungila tu
//   → Etimologia mancante. Se vuoi, aggiungila tu.
//   → Riferimenti mancanti. Se vuoi, aggiungili tu.
//
// That sentence is a template, not data, so a reading treats it as no data.
// The template is matched whole, by its shape, and never by one word:
// "giorni mancanti" or "il pezzo mancante" are real text and stay. This is a
// read-time filter only: the stored rows and `source_record_json` keep the
// sentence as imported, so it is not a source text normalization (ADR 0019).

/**
 * The template: an arrow-led subject (`→ Divisione in sillabe`) or a one-word
 * subject (`definizione`), `mancante` or `mancanti`, a full stop or semicolon,
 * and the fixed request `se vuoi, aggiungi-la/-lo/-li/-le tu`. Its `Se`
 * follows the subject's case, and its own full stop, when it has one, is part
 * of it. `tu` may run straight into the next word's
 * capital (`tuIl destinatario`), never into a lower-case letter.
 */
const PLACEHOLDER = /(?:→\s*\p{L}[\p{L} ]*?|\p{L}+)\s+mancant[ei][.;]\s*[Ss]e vuoi,\s*aggiungil[aeio]\s+tu(?!\p{Ll})\.?/gu;

/**
 * Joining punctuation left dangling before a removed placeholder, with the
 * wikitext markup that led into it: an italic or bold quote run (`''`) and
 * the list marker of the placeholder's own line (`**`, `#`). A full stop ends
 * real text and stays, and so does a single `'`, which is an elision (`po'`).
 */
const JOINER_BEFORE = /(?:[\s,;:(*#]|'{2,})+$/u;
/** Joining punctuation left dangling after one, with a quote run that closed it. */
const JOINER_AFTER = /^(?:[\s,;:.)]|'{2,})+/u;

/**
 * Only bracketed labels, which the placeholder was prefixed with: `(tipografia)`,
 * `(sostantivo, aggettivo)`. With the placeholder gone they label nothing.
 */
const LABELS_ONLY = /^(?:\([^()]*\)\s*)+$/u;

const REAL = /[\p{L}\p{N}]/u;

/**
 * The real text of a source string, with every placeholder taken out and the
 * joining punctuation and whitespace around it trimmed; undefined when nothing
 * real is left — only labels or punctuation — or nothing was there at all.
 *
 * A string that holds no placeholder comes back unchanged, however it reads.
 * Where real text stands on both sides of one, the two keep the separator the
 * source put between them: a line break, else the first `;`, `:` or `,`, else
 * a space.
 */
export function withoutPlaceholder(text: string): string | undefined {
  const pieces = text.split(PLACEHOLDER);
  if (pieces.length === 1) return text.trim() === "" ? undefined : text;

  let rest = "";
  let gap = "";
  pieces.forEach((piece, i) => {
    const afterPlaceholder = i > 0 ? piece.replace(JOINER_AFTER, "") : piece;
    const own = i < pieces.length - 1 ? afterPlaceholder.replace(JOINER_BEFORE, "") : afterPlaceholder;
    gap += piece.slice(0, piece.length - afterPlaceholder.length);
    if (own !== "") {
      if (rest !== "") rest += separatorIn(gap);
      rest += own;
      gap = "";
    }
    gap += afterPlaceholder.slice(own.length);
  });
  return REAL.test(rest) && !LABELS_ONLY.test(rest.trim()) ? rest : undefined;
}

/** How two runs of real text join across the punctuation a placeholder left between them. */
function separatorIn(gap: string): string {
  if (gap.includes("\n")) return "\n";
  const mark = /[;:,]/u.exec(gap);
  return mark === null ? " " : `${mark[0]} `;
}
