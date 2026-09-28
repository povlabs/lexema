// developers.lexema.fyi/docs (#153, #166, board 31): the reference for the
// JSON API, one page of topics with a sidebar, and beside each topic the
// requests and answers it shows.
//
// Split from its route's `page.tsx` so `web/test/developers.test.tsx` can
// render it. It reads nothing from D1: what it states is `apiReference.ts`,
// and the unit weights are the API's own map.

import { Fragment, type ReactNode } from "react";
import { API_PREFIX, UNIT_WEIGHT, type Endpoint } from "@lexema/api/units.ts";
import { ORIGIN } from "../worker/hosts.ts";
import {
  anchorOf,
  API_BASE,
  AUTH_EXAMPLE,
  costText,
  ENDPOINT_REFERENCE,
  ENDPOINTS_IN_ORDER,
  ERROR_EXAMPLE,
  ERRORS,
  formatJson,
  GRAMMAR_VALUES,
  HEADERS,
  LANGUAGES,
  LOOKUP_RESULT,
  requestsOf,
  type Example,
  type Parameter,
} from "./apiReference.ts";
import { CodePanel } from "./CodePanel";
import { DeveloperPage, SIGN_IN_PATH } from "./DeveloperPage";
import { DocsNav, type DocsGroup } from "./DocsNav";
import { ExternalLink } from "./ExternalLink";
import {
  CODE_INLINE,
  DOCS_ANSWER,
  DOCS_ANSWER_TEXT,
  DOCS_CODE,
  DOCS_ENDPOINT,
  DOCS_EYEBROW,
  DOCS_HEADING,
  DOCS_LAYOUT,
  DOCS_MAIN,
  DOCS_METHOD,
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
} from "./styles.ts";

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

/** Rows of a name, what kind of value it is, and what it means. */
function Rows({ rows }: { rows: readonly { name: string; type?: string; required?: boolean; description: string }[] }) {
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
          </p>
        </li>
      ))}
    </ul>
  );
}

function Subheading({ children }: { children: string }) {
  return <h3 className={DOCS_SUBHEADING}>{children}</h3>;
}

/** The widest line a response is printed to, in characters: the code panel's width. */
const PANEL_WIDTH = 56;

/** Examples as the code panel prints them. */
const panelOf = (examples: readonly Example[], withResponse = true) =>
  examples.map((example) => ({
    status: example.status,
    label: example.label,
    requests: requestsOf(example),
    response: withResponse ? formatJson(example.response, PANEL_WIDTH) : undefined,
  }));

/** A topic: its eyebrow and heading, its text, and the code beside it. */
function Topic({
  id,
  group,
  title,
  code,
  children,
}: {
  id: string;
  group: string;
  title: string;
  code?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={DOCS_SECTION} id={id} aria-labelledby={`${id}-heading`}>
      <div className={DOCS_TEXT}>
        <p className={DOCS_EYEBROW}>{group}</p>
        <h2 className={DOCS_HEADING} id={`${id}-heading`}>
          {title}
        </h2>
        {children}
      </div>
      {code === undefined ? null : <div className={DOCS_CODE}>{code}</div>}
    </section>
  );
}

const describeParameter = (parameter: Parameter) => ({
  name: parameter.name,
  type: parameter.type,
  required: parameter.required,
  description: parameter.description,
});

/** A result's fields, each named with what it holds. */
const describeFields = (fields: Readonly<Record<string, string>>) =>
  Object.entries(fields).map(([name, description]) => ({ name, description }));

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
      id={anchorOf(endpoint)}
      group="Endpoints"
      title={reference.title}
      code={<CodePanel examples={panelOf(reference.examples)} languages={LANGUAGES} />}
    >
      <p className={DOCS_ENDPOINT}>
        <span className={DOCS_METHOD}>{reference.method}</span>
        <span className={DOCS_URL}>{`${API_BASE}/${endpoint}`}</span>
      </p>
      <Paragraph>{`${reference.summary} Costs ${costText(UNIT_WEIGHT[endpoint])}.`}</Paragraph>
      <Subheading>{reference.method === "POST" ? "Body" : "Query parameters"}</Subheading>
      <Rows rows={reference.parameters.map(describeParameter)} />
      {endpoint === "lookup" ? (
        <>
          <Subheading>Always returned</Subheading>
          <Rows rows={describeFields(LOOKUP_RESULT.always)} />
          <Subheading>Sections fields chooses among</Subheading>
          <Rows rows={describeFields(LOOKUP_RESULT.sections)} />
        </>
      ) : null}
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

const GETTING_STARTED = "Getting started";
const REFERENCE = "Reference";

/** The sidebar: every topic the page has, in its order. */
const GROUPS: readonly DocsGroup[] = [
  {
    label: GETTING_STARTED,
    topics: [
      { id: "introduction", label: "Introduction" },
      { id: "authentication", label: "Authentication" },
      { id: "units-and-limits", label: "Units and limits" },
      { id: "errors", label: "Errors" },
    ],
  },
  {
    label: "Endpoints",
    topics: ENDPOINTS_IN_ORDER.map((endpoint) => ({
      id: anchorOf(endpoint),
      label: endpoint,
      method: ENDPOINT_REFERENCE[endpoint].method,
    })),
  },
  {
    label: REFERENCE,
    topics: [
      { id: "grammar-values", label: "Grammar values" },
      { id: "attribution", label: "Attribution" },
    ],
  },
];

/** The whole page. */
export function DeveloperDocs() {
  return (
    <DeveloperPage current="docs" wide>
      <div className={DOCS_LAYOUT}>
        <aside className={DOCS_SIDEBAR}>
          <DocsNav groups={GROUPS} />
        </aside>
        <main className={DOCS_MAIN}>
          <Topic id="introduction" group={GETTING_STARTED} title="The Lexema API">
            <Paragraph>{`A JSON API over Lexema's Italian dictionary. Every endpoint is under \`${API_BASE}\`, takes an API key, and answers JSON.`}</Paragraph>
            <Paragraph>{"Each parameter is sent at most once. `release_id` names the release every answer was read from. Grammar values are Italian labels; the English codes are read as the same."}</Paragraph>
          </Topic>

          <Topic
            id="authentication"
            group={GETTING_STARTED}
            title="Authentication"
            code={<CodePanel examples={panelOf([AUTH_EXAMPLE], false)} languages={LANGUAGES} />}
          >
            <p className={DOCS_PARAGRAPH}>
              <a className={LINK} href={SIGN_IN_PATH}>
                Sign in
              </a>{" "}
              with Google or GitHub to create a key on your dashboard. A key is shown once, when it is made; Lexema keeps
              only its SHA-256, so a lost key is revoked and replaced.
            </p>
            <Paragraph>{"Send the key in the `X-API-Key` header of every request. A request without a valid key is a `401`."}</Paragraph>
          </Topic>

          <Topic id="units-and-limits" group={GETTING_STARTED} title="Units and limits">
            <Paragraph>{"Each answer an endpoint gives, a `200` or a `404`, costs the units this table lists, counted per key per UTC day. Every other response costs none."}</Paragraph>
            <table className={DOCS_TABLE}>
              <thead>
                <tr>
                  <th className={DOCS_TABLE_HEAD} scope="col">Method</th>
                  <th className={DOCS_TABLE_HEAD} scope="col">Endpoint</th>
                  <th className={DOCS_TABLE_HEAD} scope="col">Units</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS_IN_ORDER.map((endpoint) => (
                  <tr key={endpoint}>
                    <td className={DOCS_TABLE_CODE}>{ENDPOINT_REFERENCE[endpoint].method}</td>
                    <td className={DOCS_TABLE_CODE}>
                      <a className={LINK} href={`#${anchorOf(endpoint)}`}>
                        {`${API_PREFIX}${endpoint}`}
                      </a>
                    </td>
                    <td className={DOCS_TABLE_CELL}>{costText(UNIT_WEIGHT[endpoint])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Paragraph>{"Each key has its own number of requests per minute. Every request made with a valid key counts, refused ones included, and every response to it carries these headers. Past the limit, the answer is a `429` until the minute ends."}</Paragraph>
            <Rows rows={HEADERS.map((header) => ({ name: header.name, description: header.description }))} />
          </Topic>

          <Topic
            id="errors"
            group={GETTING_STARTED}
            title="Errors"
            code={<CodePanel examples={panelOf([ERROR_EXAMPLE])} languages={LANGUAGES} />}
          >
            <Paragraph>{"An error answers with its status and a body naming it."}</Paragraph>
            <Rows rows={ERRORS.map((error) => ({ name: `${error.status} ${error.code}`, description: error.when }))} />
            <Paragraph>{"A word `/lookup` does not find is a `404` with no `error`: its `suggestions` offer close spellings."}</Paragraph>
          </Topic>

          {ENDPOINTS_IN_ORDER.map((endpoint) => (
            <EndpointTopic key={endpoint} endpoint={endpoint} />
          ))}

          <Topic id="grammar-values" group={REFERENCE} title="Grammar values">
            <Paragraph>{"The grammar parameters take these Italian labels, and read the English codes beside them as the same."}</Paragraph>
            <GrammarValues />
          </Topic>

          <Topic id="attribution" group={REFERENCE} title="Attribution">
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
        </main>
      </div>
    </DeveloperPage>
  );
}
