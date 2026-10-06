// A reading's *Forms* block, in the shape its data has: nothing, a gender and
// number grid, or a conjugation (design-system-manifest.md § "Forms: three
// shapes"). What goes where is decided in `genderGrid.ts` and
// `conjugation.ts`; this file only draws it.
//
// The searched form is marked only in a conjugation: underlined in the accent,
// with its person and tense labels in the accent too. A grid does not mark it.
// Every form in a conjugation links to its own search; grid forms do not.

import type { ReactNode } from "react";
import { bothGenders, type AgreeingSpelling } from "@lexema/italian/essereAgreement.ts";
import { factRefKey, sourcePointerOf, type DeclaredForm } from "@lexema/lookup/types.ts";
import {
  isSourceForm,
  splitsByAuxiliary,
  type Conjugation,
  type MoodTable,
  type NonFinite,
  type Person,
  type TableForm,
  type Tense,
} from "@/lib/dictionary/conjugation.ts";
import { GENDER_LABEL, NUMBER_LABEL, NUMBERS, type Grid, type GridCell } from "@/lib/dictionary/genderGrid.ts";
import { More, MoodMoreBlock, MorePanel } from "./More";
import { MoodTabs } from "./MoodTabs";
import {
  CELL_SEPARATOR,
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
  NON_FINITE,
  NON_FINITE_DOT,
  NON_FINITE_FORMS,
  NON_FINITE_ITEM,
  NON_FINITE_LABEL,
  NON_FINITE_LABEL_SEARCHED,
  PERSON,
  PERSON_HEAD,
  PERSON_HEAD_REPEAT,
  PERSON_REPEAT,
  PERSON_SEARCHED,
  TENSE_CELL,
  TENSE_CELL_SEARCHED_ROW,
  TENSE_CELL_SEARCHED_ROW_WIDE,
  TENSE_HEAD,
  TENSE_HEAD_SEARCHED,
  TENSE_PAIRS,
  TENSE_PAIRS_LINED,
  TENSE_TABLE,
} from "@/components/shared/styles.ts";

export const searchHref = (word: string): string => `/?q=${encodeURIComponent(word)}`;

/** A form's place in the source, which no other form in a table shares. */
const formKey = ({ ref }: TableForm): string => factRefKey(ref);

function Dash() {
  return (
    <span className={DASH} aria-hidden="true">
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
              data-line={
                spelling.declaredBy.length + spelling.declaredForms.length > 0
                  ? [
                      ...spelling.declaredBy.map((record) => record.refs[0].lineNo),
                      ...spelling.declaredForms.map((form) => form.ref.lineNo),
                    ].join(" ")
                  : undefined
              }
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
 * One spelling, linked to its search, carrying every source entry that spells
 * it here. `shown` is the text it shows: the source's spelling, or both genders
 * of it (`sono andato/a`).
 */
function FormLink({ forms, searched, shown }: { forms: readonly TableForm[]; searched: boolean; shown: string }) {
  // A record's own entry is named by its index in `forms[]`; a declared
  // lemma's form is a record of its own, named by its line.
  const own = forms.filter(isSourceForm);
  const declared = forms.filter((form): form is DeclaredForm => !isSourceForm(form));
  return (
    <a
      className={searched ? FORM_LINK_SEARCHED : FORM_LINK}
      href={searchHref(forms[0].surface)}
      lang="it"
      data-form={own.length > 0 ? own.map((form) => form.index).join(" ") : undefined}
      data-line={declared.length > 0 ? declared.map((form) => form.ref.lineNo).join(" ") : undefined}
      data-searched={searched ? "" : undefined}
    >
      {shown}
    </a>
  );
}

const NONE_AGREE: ReadonlyMap<string, AgreeingSpelling> = new Map();

/** The text a spelling shows: both genders where it agrees, else the source's spelling. */
function shownSpelling(surface: string, agreeing: ReadonlyMap<string, AgreeingSpelling>): string {
  const spelling = agreeing.get(surface);
  return spelling === undefined ? surface : bothGenders(spelling);
}

/**
 * Every spelling of one slot, each once and each its own link: `va', va, vai`.
 * A spelling the source files twice in the slot (`abbisognare` repeats its
 * whole table) shows once and keeps both entries. A spelling `agreeing` names
 * shows both genders, `sono andato/a`, and links to the source's spelling.
 *
 * `lines` are the slot's spellings grouped by the auxiliary they are built on
 * (#683). One group is the plain run above. Two or more each take a line of
 * their own, with no comma between them, so vivere's `io` cell is `ho vissuto`
 * above `sono vissuto/a`. A group too long for its column wraps under a
 * hanging indent, so a wrapped line reads as part of its group and the next
 * group still starts at the column's edge (`ho assorbito,` / `  assorto` /
 * `sono assorbito/a,`). Each group after the first is a bare `div`, and the
 * indent is set once per set by `TENSE_PAIRS_LINED`, since every byte here is
 * in the HTML and again in the payload (#647).
 */
function FormLinks({
  lines,
  searched,
  agreeing = NONE_AGREE,
}: {
  lines: readonly (readonly TableForm[])[];
  searched: (form: TableForm) => boolean;
  agreeing?: ReadonlyMap<string, AgreeingSpelling>;
}) {
  if (lines.length > 1) {
    return (
      <>
        <FormLinks lines={lines.slice(0, 1)} searched={searched} agreeing={agreeing} />
        {lines.slice(1).map((line, i) => (
          // The lines never reorder, and a short key keeps the payload light.
          <div key={i}>
            <FormLinks lines={[line]} searched={searched} agreeing={agreeing} />
          </div>
        ))}
      </>
    );
  }
  const spellings: TableForm[][] = [];
  for (const form of lines[0] ?? []) {
    const same = spellings.find((group) => group[0].surface === form.surface);
    if (same === undefined) spellings.push([form]);
    else same.push(form);
  }
  return (
    <>
      {spellings.map((group, i) => (
        <span key={formKey(group[0])}>
          {i > 0 && <span className={CELL_SEPARATOR}>, </span>}
          <FormLink forms={group} searched={group.some(searched)} shown={shownSpelling(group[0].surface, agreeing)} />
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
function NonFiniteLine({ items, searched }: { items: readonly NonFinite<TableForm>[]; searched: (form: TableForm) => boolean }) {
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
              {forms.length === 0 ? <Dash /> : <FormLinks lines={[forms]} searched={searched} />}
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
  table: MoodTable<TableForm>;
  tenses: readonly Tense<TableForm>[];
  searched: (form: TableForm) => boolean;
}) {
  const pairs: Tense<TableForm>[][] = [];
  for (let i = 0; i < tenses.length; i += 2) pairs.push(tenses.slice(i, i + 2));
  return (
    <div className={tenses.some(splitsByAuxiliary) ? TENSE_PAIRS_LINED : TENSE_PAIRS}>
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
              const cellClass = hit
                ? TENSE_CELL_SEARCHED_ROW
                : tenses.some((tense) => tense.cells[row].searched)
                  ? TENSE_CELL_SEARCHED_ROW_WIDE
                  : TENSE_CELL;
              return (
                <tr key={person}>
                  <th scope="row" className={p === 0 ? personClass : `${personClass} ${PERSON_REPEAT}`} lang="it">
                    {personLabel(table.mood, person)}
                  </th>
                  {pair.map((tense) => (
                    <td key={tense.name} className={cellClass}>
                      {tense.cells[row].forms.length === 0 ? (
                        <Dash />
                      ) : (
                        <FormLinks lines={tense.cells[row].lines} searched={searched} agreeing={tense.cells[row].agreeing} />
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
 * One mood's tables. The compound tenses wait behind the one `+ more` after the
 * simple tenses, open when the search hit one in any mood; every mood's control
 * opens and closes them on every tab (`MoodsMore`, #683). Open, each set is named —
 * *Tempi semplici*, *Tempi composti* (board f9vHId) — and `less` ends them;
 * closed, the simple tenses need no name.
 */
function MoodPanelView({ table, searched }: { table: MoodTable<TableForm>; searched: (form: TableForm) => boolean }) {
  return (
    <MoodMoreBlock>
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
        <>
          <MorePanel>
            <p className={TENSE_SET} lang="it">
              Tempi composti
            </p>
            <TenseTables table={table} tenses={table.compound} searched={searched} />
          </MorePanel>
          <More place="compound" />
        </>
      )}
    </MoodMoreBlock>
  );
}

export function ConjugationView({
  conjugation,
  searchedPointers,
  word,
}: {
  conjugation: Conjugation<TableForm>;
  searchedPointers: ReadonlySet<string>;
  word: string;
}): ReactNode {
  const searched = (form: TableForm) => searchedPointers.has(sourcePointerOf(form.ref) ?? "");
  return (
    <>
      <NonFiniteLine items={conjugation.nonFinite} searched={searched} />
      {conjugation.openMood !== undefined && (
        <MoodTabs
          label={`Moods of ${word}`}
          open={conjugation.openMood}
          compoundOpen={conjugation.compoundSearched}
          panels={conjugation.moods.map((table) => ({
            mood: table.mood,
            panel: <MoodPanelView table={table} searched={searched} />,
          }))}
        />
      )}
    </>
  );
}
