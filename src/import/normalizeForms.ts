// The one-off update for a dictionary seeded before #342 (ADR 0019). The seed
// now writes no row for a `forms[]` entry `normalizeFormSurface` says is no
// form; this removes the rows an older seed wrote for one: its `lookup_form`
// row and the form claims about it. `source_record_json` keeps the entry.

import { normalizeItalianExact } from "../italian/normalize.js";
import { PLURAL_PLACEHOLDER_FORM, normalizeFormSurface } from "../italian/sourceTextNormalization.js";
import type { DictionarySql } from "./normalizeGlosses.js";

/** What the update found and did. */
export interface FormNormalizationReport {
  /** `lookup_form` rows removed by this run; 0 on a database already normalized. */
  readonly forms: number;
  /** Form-scoped `grammar_claim` rows removed with them. */
  readonly claims: number;
}

interface StoredForm {
  readonly lookup_id: number;
  readonly record_id: number;
  readonly form_index: number;
  readonly surface: string;
}

const quoted = (value: string): string => `'${value.replaceAll("'", "''")}'`;

/**
 * Every stored form `normalizeFormSurface` drops. The key probe reads only the
 * rows that could be one, through the search index, and the rule decides.
 */
function dropped(db: DictionarySql): StoredForm[] {
  return db
    .query<StoredForm>(
      `SELECT lookup_id, record_id, form_index, surface FROM lookup_form
        WHERE release_id IN (SELECT release_id FROM source_release)
          AND surface_key = ${quoted(normalizeItalianExact(PLURAL_PLACEHOLDER_FORM))}
          AND origin = 'embedded-form'
        ORDER BY lookup_id`,
    )
    .filter(({ surface }) => normalizeFormSurface(surface) === undefined);
}

/** The form claims about the given stored forms: each is about its record's `forms[form_index]`. */
const claimsOf = (ids: string): string =>
  `grammar_claim WHERE scope = 'form'
     AND (record_id, scope_index) IN (SELECT record_id, form_index FROM lookup_form WHERE lookup_id IN (${ids}))`;

/**
 * Remove every stored form the rule drops, with its form claims, then read the
 * rows back. The claims go first, because the form row is how a later run
 * finds them; so a run cut short is finished by the next one, and a second
 * run finds nothing to do. Throws when a dropped form is still stored.
 */
export function normalizeStoredForms(db: DictionarySql): FormNormalizationReport {
  const forms = dropped(db);
  if (forms.length === 0) return { forms: 0, claims: 0 };

  const ids = forms.map(({ lookup_id }) => lookup_id).join(",");
  const [{ n: claims }] = db.query<{ n: number }>(`SELECT count(*) AS n FROM ${claimsOf(ids)}`);
  db.run(
    [
      `DELETE FROM ${claimsOf(ids)};`,
      ...forms.map(({ lookup_id, surface }) =>
        `DELETE FROM lookup_form WHERE lookup_id = ${lookup_id} AND surface = ${quoted(surface)};`),
    ].join("\n"),
  );

  const left = dropped(db);
  if (left.length > 0) {
    throw new Error(`${left.length} dropped form(s) still stored after the update: lookup_id ${left.map(({ lookup_id }) => lookup_id).join(", ")}`);
  }
  return { forms: forms.length, claims };
}
