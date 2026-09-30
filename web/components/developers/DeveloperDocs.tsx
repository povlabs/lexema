// developers.lexema.fyi/docs (#153, #166, boards 31 and 31b): the reference
// for the JSON API, one page per sidebar item (docsPages.ts). Each page has the
// sidebar with itself marked, its text, and Previous / Next. An endpoint's page
// has beside its text the requests and answers it shows; a guide's has none.
//
// Split from its routes' `page.tsx` so `web/test/developers.test.tsx` can
// render it. It reads nothing from D1: what it states is `apiReference.ts`,
// and how each endpoint counts calls is the API's own map.

import { Fragment, type ReactNode } from "react";
import { API_PREFIX, CALL_BASIS, type Endpoint } from "@lexema/api/calls.ts";
import { ORIGIN } from "@/worker/hosts.ts";
import {
  API_BASE,
  callText,
  ENDPOINT_REFERENCE,
  ENDPOINTS_IN_ORDER,
  ERRORS,
  FIELDS_TEXT,
  formatJson,
  GRAMMAR_VALUES,
  HEADERS,
  LANGUAGES,
  MATCH_VALUES,
  POS_TEXT,
  requestsOf,
  type Example,
  type Parameter,
  type ValueList,
} from "@/lib/developers/apiReference.ts";
import { CodePanel } from "./CodePanel";
import { DeveloperPage, SIGN_IN_PATH } from "./DeveloperPage";
import type { DocsGroup } from "./DocsLinks";
import { DocsContents } from "./DocsContents";
import { DocsNav } from "./DocsNav";
import {
  DOCS_PAGES,
  endpointPath,
  groupOf,
  labelOf,
  neighboursOf,
  pathOf,
  samePage,
  titleOf,
  type DocsGroupName,
  type DocsPage,
  type Guide,
} from "@/lib/developers/docsPages.ts";
import { ExternalLink } from "@/components/shared/ExternalLink";
import type { SignedIn } from "@/lib/developers/signedIn.ts";
import {
  CODE_INLINE,
  DOCS_ANSWER,
  DOCS_ANSWER_TEXT,
  DOCS_CODE,
  DOCS_ENDPOINT,
  DOCS_EYEBROW,
  DOCS_GUIDE,
  DOCS_GUIDE_BODY,
  DOCS_HEADING,
  DOCS_LAYOUT,
  DOCS_MAIN,
  DOCS_METHOD,
  DOCS_NEIGHBOUR,
  DOCS_NEIGHBOUR_LABEL,
  DOCS_NEIGHBOUR_NEXT,
  DOCS_NEIGHBOUR_TITLE,
  DOCS_NEIGHBOURS,
  DOCS_NEIGHBOURS_GUIDE,
  DOCS_PARAGRAPH,
  DOCS_ROW,
  DOCS_ROW_HEAD,
  DOCS_ROW_NAME,
  DOCS_ROW_REQUIRED,
  DOCS_ROW_TEXT,
  DOCS_ROW_TYPE,
  DOCS_ROWS,
  DOCS_SECTION,
  DOCS_SIDEBAR,
  DOCS_SIDEBAR_INNER,
  DOCS_STATUS_OK,
  DOCS_STATUS_OTHER,
  DOCS_SUBHEADING,
  DOCS_TABLE,
  DOCS_TABLE_CELL,
  DOCS_TABLE_CODE,
  DOCS_TABLE_HEAD,
  DOCS_TEXT,
  DOCS_URL,
  LINK,
} from "@/components/shared/styles.ts";

/** A sentence whose backticked runs are code. */
function Text({ children }: { children: string }) {
  return (
    <>
      {children.split("`").map((run, i) =>
        i % 2 === 1 ? (
          <code key={i} className={CODE_INLINE}>
            {run}
          </code>
        ) : (
          <Fragment key={i}>{run}</Fragment>
        ),
      )}
    </>
  );
}

function Paragraph({ children }: { children: string }) {
  return (
    <p className={DOCS_PARAGRAPH}>
      <Text>{children}</Text>
    </p>
  );
}

/** Where a closed list of values is written in full: its section of the Grammar values page. */
const valueListPath = (list: ValueList): string => `${pathOf({ kind: "guide", guide: "grammar-values" })}#${list}`;

interface Row {
  name: string;
  type?: string;
  required?: boolean;
  description: string;
  /** The list `description` ends partway through: its `...` links to the whole. */
  continued?: ValueList;
}

/** Rows of a name, what kind of value it is, and what it means. */
function Rows({ rows }: { rows: readonly Row[] }) {
  return (
    <ul className={DOCS_ROWS}>
      {rows.map((row) => (
        <li key={row.name} className={DOCS_ROW}>
          <p className={DOCS_ROW_HEAD}>
            <span className={DOCS_ROW_NAME}>{row.name}</span>
            {row.type === undefined ? null : <span className={DOCS_ROW_TYPE}>{row.type}</span>}
            {row.required ? <span className={DOCS_ROW_REQUIRED}>required</span> : null}
          </p>
          <p className={DOCS_ROW_TEXT}>
            <Text>{row.description}</Text>
            {row.continued === undefined ? null : (
              <>
                {" "}
                <a className={LINK} href={valueListPath(row.continued)} aria-label={`Every ${row.continued} value`}>
                  ...
                </a>
              </>
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Subheading({ id, children }: { id?: string; children: string }) {
  return (
    <h2 className={DOCS_SUBHEADING} id={id}>
      {children}
    </h2>
  );
}

/** The widest line a response is printed to, in characters: the code panel's width. */
const PANEL_WIDTH = 56;

/** Examples as the code panel prints them. */
const panelOf = (examples: readonly Example[]) =>
  examples.map((example) => ({
    status: example.status,
    label: example.label,
    requests: requestsOf(example),
    response: formatJson(example.response, PANEL_WIDTH),
  }));

/** Previous / Next: the pages either side of this one, in the sidebar's order. */
function Neighbours({ page }: { page: DocsPage }) {
  const { previous, next } = neighboursOf(page);
  return (
    <nav className={page.kind === "guide" ? DOCS_NEIGHBOURS_GUIDE : DOCS_NEIGHBOURS} aria-label="Previous and next">
      {previous === undefined ? null : (
        <a className={DOCS_NEIGHBOUR} href={pathOf(previous)} rel="prev">
          <span className={DOCS_NEIGHBOUR_LABEL}>Previous</span>
          <span className={DOCS_NEIGHBOUR_TITLE}>{`← ${titleOf(previous)}`}</span>
        </a>
      )}
      {next === undefined ? null : (
        <a className={DOCS_NEIGHBOUR_NEXT} href={pathOf(next)} rel="next">
          <span className={DOCS_NEIGHBOUR_LABEL}>Next</span>
          <span className={DOCS_NEIGHBOUR_TITLE}>{`${titleOf(next)} →`}</span>
        </a>
      )}
    </nav>
  );
}

/**
 * A page's topic: its eyebrow and heading, its text, and Previous / Next under
 * all. An endpoint's topic has its code beside the text; a guide's has none,
 * and its text takes the column's width (board 31b).
 */
function Topic(
  props:
    | { page: Extract<DocsPage, { kind: "guide" }>; children: ReactNode }
    | { page: Extract<DocsPage, { kind: "endpoint" }>; code: ReactNode; children: ReactNode },
) {
  const { page, children } = props;
  return (
    <article className={page.kind === "guide" ? DOCS_GUIDE : DOCS_SECTION} aria-labelledby="topic-heading">
      <div className={DOCS_TEXT}>
        <p className={DOCS_EYEBROW}>{groupOf(page)}</p>
        <h1 className={DOCS_HEADING} id="topic-heading">
          {titleOf(page)}
        </h1>
        {page.kind === "guide" ? <div className={DOCS_GUIDE_BODY}>{children}</div> : children}
      </div>
      {"code" in props ? <div className={DOCS_CODE}>{props.code}</div> : null}
      <Neighbours page={page} />
    </article>
  );
}

const describeParameter = (parameter: Parameter): Row => ({
  name: parameter.name,
  type: parameter.type,
  required: parameter.required,
  description: parameter.description,
  continued: parameter.continued,
});

function Answers({ answers }: { answers: readonly { status: string; description: string }[] }) {
  return (
    <ul className={DOCS_ROWS}>
      {answers.map((answer) => (
        <li key={answer.status} className={DOCS_ANSWER}>
          <span className={answer.status.startsWith("2") ? DOCS_STATUS_OK : DOCS_STATUS_OTHER}>{answer.status}</span>
          <p className={DOCS_ANSWER_TEXT}>
            <Text>{answer.description}</Text>
          </p>
        </li>
      ))}
    </ul>
  );
}

function EndpointTopic({ endpoint }: { endpoint: Endpoint }) {
  const reference = ENDPOINT_REFERENCE[endpoint];
  return (
    <Topic
      page={{ kind: "endpoint", endpoint }}
      code={<CodePanel examples={panelOf(reference.examples)} languages={LANGUAGES} />}
    >
      <p className={DOCS_ENDPOINT}>
        <span className={DOCS_METHOD}>{reference.method}</span>
        <span className={DOCS_URL}>{`${API_BASE}/${endpoint}`}</span>
      </p>
      <Paragraph>{reference.summary}</Paragraph>
      <Subheading>{reference.method === "POST" ? "Body" : "Query parameters"}</Subheading>
      <Rows rows={reference.parameters.map(describeParameter)} />
      <Subheading>Responses</Subheading>
      <Answers answers={reference.answers} />
    </Topic>
  );
}

/** The Italian labels the grammar parameters take, and the English codes read as the same. */
function GrammarValues() {
  return (
    <table className={DOCS_TABLE}>
      <thead>
        <tr>
          <th className={DOCS_TABLE_HEAD} scope="col">Parameter</th>
          <th className={DOCS_TABLE_HEAD} scope="col">Italian label</th>
          <th className={DOCS_TABLE_HEAD} scope="col">English code</th>
        </tr>
      </thead>
      <tbody>
        {GRAMMAR_VALUES.flatMap(({ parameter, values }) =>
          values.map(({ label, english }, i) => (
            <tr key={`${parameter} ${label}`}>
              <td className={DOCS_TABLE_CODE}>{i === 0 ? parameter : null}</td>
              <td className={DOCS_TABLE_CODE}>{label}</td>
              <td className={DOCS_TABLE_CODE}>{english.join(", ")}</td>
            </tr>
          )),
        )}
      </tbody>
    </table>
  );
}

/** Each guide page's topic. */
const GUIDE_TOPICS: Readonly<Record<Guide, () => ReactNode>> = {
  introduction: () => (
    <Topic page={{ kind: "guide", guide: "introduction" }}>
      <Paragraph>{`A JSON API over Lexema's Italian dictionary. Every endpoint is under \`${API_BASE}\`, takes an API key, and answers JSON.`}</Paragraph>
      <Paragraph>{"Each parameter is sent at most once. `release_id` names the release every answer was read from. Grammar values are Italian labels; the English codes are read as the same."}</Paragraph>
    </Topic>
  ),
  authentication: () => (
    <Topic page={{ kind: "guide", guide: "authentication" }}>
      <p className={DOCS_PARAGRAPH}>
        <a className={LINK} href={SIGN_IN_PATH}>
          Sign in
        </a>{" "}
        with Google or GitHub to create a key on your dashboard. A key is shown once, when it is made; Lexema keeps only
        its SHA-256, so a lost key is revoked and replaced.
      </p>
      <Paragraph>{"Send the key in the `X-API-Key` header of every request. A request without a valid key is a `401`, and one whose account has no active plan is a `402`."}</Paragraph>
    </Topic>
  ),
  "calls-and-limits": () => (
    <Topic page={{ kind: "guide", guide: "calls-and-limits" }}>
      <Paragraph>{"Each answer an endpoint gives, a `200` or a `404`, counts the calls this table lists, per key per UTC day. Every other response counts none."}</Paragraph>
      <table className={DOCS_TABLE}>
        <thead>
          <tr>
            <th className={DOCS_TABLE_HEAD} scope="col">Method</th>
            <th className={DOCS_TABLE_HEAD} scope="col">Endpoint</th>
            <th className={DOCS_TABLE_HEAD} scope="col">Calls</th>
          </tr>
        </thead>
        <tbody>
          {ENDPOINTS_IN_ORDER.map((endpoint) => (
            <tr key={endpoint}>
              <td className={DOCS_TABLE_CODE}>{ENDPOINT_REFERENCE[endpoint].method}</td>
              <td className={DOCS_TABLE_CODE}>
                <a className={LINK} href={endpointPath(endpoint)}>
                  {`${API_PREFIX}${endpoint}`}
                </a>
              </td>
              <td className={DOCS_TABLE_CELL}>{callText(CALL_BASIS[endpoint])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Paragraph>{"Your account may make a number of calls a minute, shared by all its keys. Calls count toward the minute as they do toward the month, so a batch of 7 words is 7 calls, and a request refused before it is answered, a `400`, `403`, `404` or `405`, counts nothing. Every response to a valid key carries `RateLimit-Limit`. Past the limit, the answer is a `429` with `Retry-After`."}</Paragraph>
      <Paragraph>{"Your plan also allows a number of calls each billing period. Past them, the answer is a `429` `allowance_exceeded` that names when the period resets, with `Retry-After` in seconds to it. A refused call does not count toward the period's calls, though it still counts toward the minute."}</Paragraph>
      <Rows rows={HEADERS.map((header) => ({ name: header.name, description: header.description }))} />
    </Topic>
  ),
  errors: () => (
    <Topic page={{ kind: "guide", guide: "errors" }}>
      <Paragraph>{"An error answers with its status and a body naming it: `error.code`, one of these, and `error.message`, what was wrong."}</Paragraph>
      <Rows rows={ERRORS.map((error) => ({ name: `${error.status} ${error.code}`, description: error.when }))} />
      <p className={DOCS_PARAGRAPH}>
        {"A word "}
        <a className={LINK} href={endpointPath("lookup")}>
          <code className={CODE_INLINE}>/lookup</code>
        </a>
        <Text>{" does not find is a `404` with no `error`: its `suggestions` offer close spellings."}</Text>
      </p>
    </Topic>
  ),
  "grammar-values": () => (
    <Topic page={{ kind: "guide", guide: "grammar-values" }}>
      <Paragraph>{"Every value `pos`, `match`, `fields` and the grammar parameters take."}</Paragraph>
      <Subheading id="pos">pos</Subheading>
      <Paragraph>{POS_TEXT}</Paragraph>
      <Subheading id="match">match</Subheading>
      <Rows rows={MATCH_VALUES.map(({ value, meaning }) => ({ name: value, description: meaning }))} />
      <Subheading id="fields">fields</Subheading>
      <Paragraph>{FIELDS_TEXT}</Paragraph>
      <Subheading id="grammar">Grammar</Subheading>
      <Paragraph>{"`mood`, `tense`, `person`, `gender` and `number` take these Italian labels, and read the English codes beside them as the same."}</Paragraph>
      <GrammarValues />
    </Topic>
  ),
  attribution: () => (
    <Topic page={{ kind: "guide", guide: "attribution" }}>
      <Paragraph>{"The API's text comes from Wikizionario, the Italian Wiktionary, under CC BY-SA 4.0. Every result carries `attribution`: `licence`, `licence_url`, `source`, and `source_url`, the word's Wikizionario page."}</Paragraph>
      <p className={DOCS_PARAGRAPH}>
        <Text>{"Where you show or pass on that text, credit it with the source and its page, name the licence with its link, and share what you adapt from it under the same licence. "}</Text>
        <a className={LINK} href={`${ORIGIN.lexema}/attribution`}>
          Sources and licences
        </a>
        {" has the full credit; "}
        <ExternalLink className={LINK} href="https://creativecommons.org/licenses/by-sa/4.0/">
          CC BY-SA 4.0
        </ExternalLink>{" "}
        has the licence.
      </p>
    </Topic>
  ),
};

const GROUP_ORDER: readonly DocsGroupName[] = ["Getting started", "Endpoints", "Reference"];

/** The sidebar's groups, with the page being read marked. */
const groupsFor = (current: DocsPage): DocsGroup[] =>
  GROUP_ORDER.map((label) => ({
    label,
    links: DOCS_PAGES.filter((page) => groupOf(page) === label).map((page) => ({
      href: pathOf(page),
      label: labelOf(page),
      method: page.kind === "endpoint" ? ENDPOINT_REFERENCE[page.endpoint].method : undefined,
      current: samePage(page, current),
    })),
  }));

/** One page of the docs. */
export function DeveloperDocs({ page, signedIn }: { page: DocsPage; signedIn?: SignedIn }) {
  const groups = groupsFor(page);
  return (
    <DeveloperPage current="docs" wide signedIn={signedIn}>
      <div className={DOCS_LAYOUT}>
        <aside className={DOCS_SIDEBAR}>
          <div className={DOCS_SIDEBAR_INNER}>
            <DocsNav groups={groups} label="Docs" />
          </div>
        </aside>
        {/* On a phone the sidebar is this bar: the page's group and name, opening onto the sidebar's list. */}
        <DocsContents group={groupOf(page)} page={titleOf(page)}>
          <DocsNav groups={groups} label="Docs contents" />
        </DocsContents>
        <main className={DOCS_MAIN}>
          {page.kind === "guide" ? GUIDE_TOPICS[page.guide]() : <EndpointTopic endpoint={page.endpoint} />}
        </main>
      </div>
    </DeveloperPage>
  );
}
