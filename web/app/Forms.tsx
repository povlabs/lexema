// A reading's *Forms* block, in the shape its data has: nothing, a gender and
// number grid, or a conjugation (design-system-manifest.md § "Forms: three
// shapes"). What goes where is decided in `genderGrid.ts` and
// `conjugation.ts`; this file only draws it.
//
// The searched form is marked only in a conjugation: underlined in the accent,
// with its person and tense labels in the accent too. A grid does not mark it.
// Every form in a conjugation links to its own search; grid forms do not.

import type { ReactNode } from "react";
import type { SourceForm, GrammarClaim } from "@lexema/lookup/types.ts";
import type { Conjugation, MoodTable, NonFinite, Person, Tense } from "./conjugation.ts";
import { GENDER_LABEL, NUMBER_LABEL, NUMBERS, type Grid, type GridCell } from "./genderGrid.ts";
import { MoodTabs } from "./MoodTabs";
import { italianLabel } from "./italianLabels.ts";
import type { UnplacedGroup } from "./unplaced.ts";
import {
  CELL_SEPARATOR,
  COMPOUND,
  COMPOUND_SUMMARY,
  COMPOUND_TABLES,
  MOOD_PANEL,
  TENSE_SET,
  TENSE_SET_SIMPLE,
  DASH,
  FORM_LINK,
  FORM_LINK_SEARCHED,
  GRID,
  GRID_ARTICLE,
  GRID_ARTICLE_DOT,
  GRID_ARTICLES,
  GRID_CELL,
  GRID_CORNER,
  GRID_FORM,
  GRID_GENDER,
  GRID_HEAD,
  GRID_LABEL,
  GRID_SPELLING,
  MORE_CLOSED,
  MORE_OPEN,
  NON_FINITE,
  NON_FINITE_DOT,
  NON_FINITE_FORMS,
  NON_FINITE_ITEM,
  NON_FINITE_LABEL,
  NON_FINITE_LABEL_SEARCHED,
  OTHER_FORM,
  OTHER_FORM_LABEL,
  OTHER_FORMS,
  PERSON,
  PERSON_HEAD,
  PERSON_HEAD_REPEAT,
  PERSON_REPEAT,
  PERSON_SEARCHED,
  TENSE_CELL,
  TENSE_HEAD,
  TENSE_HEAD_SEARCHED,
  TENSE_PAIRS,
  TENSE_TABLE,
} from "./styles.ts";

export const searchHref = (word: string): string => `/?q=${encodeURIComponent(word)}`;

function Dash() {
  return (
    <span className={DASH} aria-label="not given">
      —
    </span>
  );
}

function GridCellView({ cell }: { cell: GridCell }) {
  if (cell.spellings.length === 0) {
    return (
      <div className={GRID_CELL} role="cell">
        <Dash />
      </div>
    );
  }
  return (
    <div className={GRID_CELL} role="cell">
      {cell.spellings.map((spelling) => (
        <div key={spelling.surface} className={GRID_SPELLING}>
          <p className={GRID_FORM} lang="it">
            <span
              data-form={spelling.forms.length > 0 ? spelling.forms.map((form) => form.index).join(" ") : undefined}
              data-headword={spelling.headword ? "" : undefined}
            >
              {spelling.surface}
            </span>
          </p>
          {spelling.articles.length > 0 && (
            <p className={GRID_ARTICLES} lang="it">
              {spelling.articles.map((article, i) => (
                <span key={article}>
                  {i > 0 && (
                    <span className={GRID_ARTICLE_DOT} aria-hidden="true">
                      ·
                    </span>
                  )}
                  <span className={GRID_ARTICLE}>{article}</span>
                </span>
              ))}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function GridView({ grid, label }: { grid: Grid; label: string }) {
  return (
    <div className={GRID} role="table" aria-label={label} data-grid="">
      <div role="row" className="contents">
        <span className={GRID_CORNER} role="columnheader" />
        {NUMBERS.map((number) => (
          <span key={number} className={GRID_HEAD} role="columnheader" lang="it">
            {NUMBER_LABEL[number]}
          </span>
        ))}
      </div>
      {grid.rows.map((row) => (
        <div key={row.gender} role="row" className="contents">
          <span className={GRID_GENDER} role="rowheader" lang="it">
            {GENDER_LABEL[row.gender]}
          </span>
          {row.cells.map((cell, i) => (
            <GridCellView key={NUMBERS[i]} cell={cell} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SuperlativeGrid({ grid }: { grid: Grid }) {
  return (
    <>
      <p className={GRID_LABEL} lang="it">
        superlativo
      </p>
      <GridView grid={grid} label="superlativo" />
    </>
  );
}

/**
 * A form's grammar, each value in its Italian label (ADR 0015), or as the
 * source wrote it when Lexema has no Italian label for it.
 */
function grammarLabel(claims: readonly GrammarClaim[]): string {
  const texts = claims.flatMap((claim) => (claim.status === "missing" ? [] : [italianLabel(claim)]));
  return [...new Set(texts)].join(", ");
}

/**
 * Forms that take no cell, one group per thing they lack, each named for it.
 * An identical spelling with the same grammar shows once (`alpe` lists `alpi`
 * twice) and carries every entry.
 */
export function OtherForms({ groups, links }: { groups: readonly UnplacedGroup[]; links: boolean }) {
  return (
    <>
      {groups.map((group) => {
        const lines: { label: string; forms: SourceForm[] }[] = [];
        for (const form of group.forms) {
          const label = grammarLabel(form.claims);
          const same = lines.find((line) => line.label === label && line.forms[0].surface === form.surface);
          if (same === undefined) lines.push({ label, forms: [form] });
          else same.forms.push(form);
        }
        return (
          <div key={group.missing} data-unplaced={group.missing}>
            <p className={GRID_LABEL}>{group.missing[0].toUpperCase() + group.missing.slice(1)}</p>
            <dl className={OTHER_FORMS}>
              {lines.map(({ label, forms }) => (
                <div key={forms[0].index} className={OTHER_FORM}>
                  <dt className={OTHER_FORM_LABEL} lang="it">
                    {label || "—"}
                  </dt>
                  <dd className="m-0 font-mono text-text-strong" lang="it">
                    {links ? (
                      <FormLink forms={forms} searched={false} />
                    ) : (
                      <span data-form={forms.map((form) => form.index).join(" ")}>{forms[0].surface}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </>
  );
}

/** One spelling, linked to its search, carrying every source entry that spells it here. */
function FormLink({ forms, searched }: { forms: readonly SourceForm[]; searched: boolean }) {
  return (
    <a
      className={searched ? FORM_LINK_SEARCHED : FORM_LINK}
      href={searchHref(forms[0].surface)}
      lang="it"
      data-form={forms.map((form) => form.index).join(" ")}
      data-searched={searched ? "" : undefined}
    >
      {forms[0].surface}
    </a>
  );
}

/**
 * Every spelling of one slot, each once and each its own link: `va', va, vai`.
 * A spelling the source files twice in the slot (`abbisognare` repeats its
 * whole table) shows once and keeps both entries.
 */
function FormLinks({ forms, searched }: { forms: readonly SourceForm[]; searched: (form: SourceForm) => boolean }) {
  const spellings: SourceForm[][] = [];
  for (const form of forms) {
    const same = spellings.find((group) => group[0].surface === form.surface);
    if (same === undefined) spellings.push([form]);
    else same.push(form);
  }
  return (
    <>
      {spellings.map((group, i) => (
        <span key={group[0].index}>
          {i > 0 && <span className={CELL_SEPARATOR}>, </span>}
          <FormLink forms={group} searched={group.some(searched)} />
        </span>
      ))}
    </>
  );
}

const NON_FINITE_SHOWN: NonFinite["label"][] = ["gerundio", "participio", "ausiliare"];

/**
 * Gerundio · participio · ausiliare, and any other non-finite form the source
 * lists (`participio presente`). A slot the source leaves empty is a dash.
 */
function NonFiniteLine({ items, searched }: { items: readonly NonFinite[]; searched: (form: SourceForm) => boolean }) {
  const labels = [...new Set([...items.map((item) => item.label), ...NON_FINITE_SHOWN])].sort(
    (a, b) => ORDER.indexOf(a) - ORDER.indexOf(b),
  );
  return (
    <dl className={NON_FINITE}>
      {labels.map((label, i) => {
        const forms = items.find((item) => item.label === label)?.forms ?? [];
        return (
          <div key={label} className={NON_FINITE_ITEM}>
            {i > 0 && (
              <span className={NON_FINITE_DOT} aria-hidden="true">
                ·
              </span>
            )}
            <dt className={forms.some(searched) ? NON_FINITE_LABEL_SEARCHED : NON_FINITE_LABEL} lang="it">
              {label}
            </dt>
            <dd className={NON_FINITE_FORMS}>
              {forms.length === 0 ? <Dash /> : <FormLinks forms={forms} searched={searched} />}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

const ORDER: NonFinite["label"][] = ["infinito", "gerundio", "participio presente", "participio", "ausiliare"];

const personLabel = (mood: MoodTable["mood"], person: Person): string =>
  mood === "Congiuntivo" ? `che ${person}` : person;

/** Tenses two at a time, persons down. */
function TenseTables({
  table,
  tenses,
  searched,
}: {
  table: MoodTable;
  tenses: readonly Tense[];
  searched: (form: SourceForm) => boolean;
}) {
  const pairs: Tense[][] = [];
  for (let i = 0; i < tenses.length; i += 2) pairs.push(tenses.slice(i, i + 2));
  return (
    <div className={TENSE_PAIRS}>
      {pairs.map((pair, p) => (
        <table key={pair[0].name} className={TENSE_TABLE} data-tenses={pair.map((t) => t.name).join(" · ")}>
          <thead>
            <tr>
              <td className={p === 0 ? PERSON_HEAD : PERSON_HEAD_REPEAT} />
              {pair.map((tense) => (
                <th
                  key={tense.name}
                  scope="col"
                  className={tense.searched ? TENSE_HEAD_SEARCHED : TENSE_HEAD}
                  lang="it"
                >
                  {tense.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.persons.map((person, row) => {
              const hit = pair.some((tense) => tense.cells[row].searched);
              const personClass = hit ? PERSON_SEARCHED : PERSON;
              return (
                <tr key={person}>
                  <th scope="row" className={p === 0 ? personClass : `${personClass} ${PERSON_REPEAT}`} lang="it">
                    {personLabel(table.mood, person)}
                  </th>
                  {pair.map((tense) => (
                    <td key={tense.name} className={TENSE_CELL}>
                      {tense.cells[row].forms.length === 0 ? (
                        <Dash />
                      ) : (
                        <FormLinks forms={tense.cells[row].forms} searched={searched} />
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      ))}
    </div>
  );
}

/**
 * One mood's tables. With the compound tenses open, each set is named —
 * *Tempi semplici*, *Tempi composti* — and the link to hide them sits under
 * them (board f9vHId); closed, the simple tenses need no name.
 */
function MoodPanelView({ table, searched }: { table: MoodTable; searched: (form: SourceForm) => boolean }) {
  return (
    <div className={MOOD_PANEL}>
      {table.simple.length > 0 && (
        <>
          {table.compound.length > 0 && (
            <p className={TENSE_SET_SIMPLE} lang="it">
              Tempi semplici
            </p>
          )}
          <TenseTables table={table} tenses={table.simple} searched={searched} />
        </>
      )}
      {table.compound.length > 0 && (
        <details className={COMPOUND} open={table.compoundSearched}>
          <summary className={COMPOUND_SUMMARY}>
            <span className={MORE_CLOSED}>compound tenses</span>
            <span className={MORE_OPEN}>hide compound tenses</span>
          </summary>
          <div className={COMPOUND_TABLES}>
            <p className={TENSE_SET} lang="it">
              Tempi composti
            </p>
            <TenseTables table={table} tenses={table.compound} searched={searched} />
          </div>
        </details>
      )}
    </div>
  );
}

export function ConjugationView({
  conjugation,
  searchedPointers,
  word,
}: {
  conjugation: Conjugation;
  searchedPointers: ReadonlySet<string>;
  word: string;
}): ReactNode {
  const searched = (form: SourceForm) => searchedPointers.has(form.ref.jsonPointer);
  return (
    <>
      <NonFiniteLine items={conjugation.nonFinite} searched={searched} />
      {conjugation.openMood !== undefined && (
        <MoodTabs
          label={`Moods of ${word}`}
          open={conjugation.openMood}
          panels={conjugation.moods.map((table) => ({
            mood: table.mood,
            panel: <MoodPanelView table={table} searched={searched} />,
          }))}
        />
      )}
      <OtherForms groups={conjugation.unplaced} links />
    </>
  );
}
