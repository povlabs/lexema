// The `/developers` page's markup (#153): the reference for the JSON API.
//
// Split from `developers/page.tsx` the way `Attribution.tsx` is, so
// `web/test/developers.test.tsx` can render it. It reads nothing from D1: what
// it states is `apiReference.ts`, and the unit weights are the API's own map.

import { Fragment, type ReactNode } from "react";
import { API_PREFIX, UNIT_WEIGHT, type Endpoint } from "@lexema/api/units.ts";
import {
  API_BASE,
  curlOf,
  ENDPOINT_REFERENCE,
  ENDPOINTS_IN_ORDER,
  ERROR_EXAMPLE,
  ERRORS,
  EXAMPLE_KEY,
  formatJson,
  GRAMMAR_VALUES,
  HEADERS,
  LOOKUP_RESULT,
  NOT_FOUND_EXAMPLE,
  unitsText,
  type Example,
  type Parameter,
} from "./apiReference.ts";
import {
  BLOCK,
  BLOCK_LABEL,
  CODE_BLOCK,
  CODE_INLINE,
  EXAMPLE_BLOCKS,
  FORM_LINK,
  JUMP_LINK,
  JUMP_LINKS,
  LINK,
  PAGE_HEADING,
  READING_DOT,
  READING_GRAMMAR,
  REFERENCE_CELL,
  REFERENCE_CELL_CODE,
  REFERENCE_DESCRIPTION,
  REFERENCE_ENDPOINT,
  REFERENCE_ENDPOINT_HEADING,
  REFERENCE_ENDPOINTS,
  REFERENCE_HEAD,
  REFERENCE_METHOD,
  REFERENCE_PARAGRAPH,
  REFERENCE_PATH,
  REFERENCE_REQUIRED,
  REFERENCE_ROWS,
  REFERENCE_SECTION,
  REFERENCE_TABLE,
  REFERENCE_TERM,
  SECTION_HEADING,
  SHELL_TOP,
} from "./styles.ts";
import { ExternalLink } from "./ExternalLink";
import { SiteHeader } from "./SiteHeader";

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

function Rows({ rows }: { rows: readonly { term: ReactNode; description: string }[] }) {
  return (
    <dl className={REFERENCE_ROWS}>
      {rows.map((row, i) => (
        <Fragment key={i}>
          <dt className={REFERENCE_TERM}>{row.term}</dt>
          <dd className={REFERENCE_DESCRIPTION}>
            <Text>{row.description}</Text>
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

function Parameters({ parameters }: { parameters: readonly Parameter[] }) {
  return (
    <Rows
      rows={parameters.map((parameter) => ({
        term: (
          <>
            {parameter.name}
            {parameter.required ? <span className={REFERENCE_REQUIRED}>required</span> : null}
          </>
        ),
        description: parameter.description,
      }))}
    />
  );
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={BLOCK}>
      <h4 className={BLOCK_LABEL}>{label}</h4>
      {children}
    </div>
  );
}

function ExampleBlocks({ example }: { example: Example }) {
  return (
    <div className={EXAMPLE_BLOCKS}>
      <pre className={CODE_BLOCK}>
        <code>{curlOf(example)}</code>
      </pre>
      <pre className={CODE_BLOCK}>
        <code>{`HTTP ${example.status}\n\n${formatJson(example.response)}`}</code>
      </pre>
    </div>
  );
}

const pathOf = (endpoint: Endpoint) => `${API_PREFIX}${endpoint}`;
const anchorOf = (endpoint: Endpoint) => endpoint.replace("/", "-");
const unitsLabel = (endpoint: Endpoint) => {
  const { units, per } = UNIT_WEIGHT[endpoint];
  return `${units} ${units === 1 ? "unit" : "units"}${per === "word" ? " per word" : ""}`;
};

function EndpointSection({ endpoint }: { endpoint: Endpoint }) {
  const reference = ENDPOINT_REFERENCE[endpoint];
  return (
    <section className={REFERENCE_ENDPOINT} id={anchorOf(endpoint)} aria-labelledby={`${anchorOf(endpoint)}-heading`}>
      <h3 className={REFERENCE_ENDPOINT_HEADING} id={`${anchorOf(endpoint)}-heading`}>
        <span className={REFERENCE_METHOD}>{reference.method}</span>
        <span className={READING_DOT}>·</span>
        <span className={REFERENCE_PATH}>{pathOf(endpoint)}</span>
        <span className={READING_DOT}>·</span>
        <span className={READING_GRAMMAR}>{unitsLabel(endpoint)}</span>
      </h3>
      <p className={REFERENCE_PARAGRAPH}>
        <Text>{reference.summary}</Text>
      </p>
      <Block label="Parameters">
        <Parameters parameters={reference.parameters} />
      </Block>
      {endpoint === "lookup" ? (
        <>
          <Block label="Grammar values">
            <GrammarValues />
          </Block>
          <Block label="Result">
            <Parameters parameters={LOOKUP_RESULT.map((field) => ({ ...field, required: false }))} />
          </Block>
        </>
      ) : null}
      <Block label="Answers">
        <Rows rows={reference.answers.map((answer) => ({ term: answer.status, description: answer.description }))} />
      </Block>
      <Block label="Example">
        <ExampleBlocks example={reference.example} />
      </Block>
    </section>
  );
}

/** The Italian labels the grammar parameters take, and the English codes read as the same. */
function GrammarValues() {
  return (
    <table className={REFERENCE_TABLE}>
      <thead>
        <tr>
          <th className={REFERENCE_HEAD} scope="col">Parameter</th>
          <th className={REFERENCE_HEAD} scope="col">Italian label</th>
          <th className={REFERENCE_HEAD} scope="col">English code</th>
        </tr>
      </thead>
      <tbody>
        {GRAMMAR_VALUES.flatMap(({ parameter, values }) =>
          values.map(({ label, english }, i) => (
            <tr key={`${parameter} ${label}`}>
              <td className={REFERENCE_CELL_CODE}>{i === 0 ? parameter : null}</td>
              <td className={REFERENCE_CELL_CODE}>{label}</td>
              <td className={REFERENCE_CELL_CODE}>{english.join(", ")}</td>
            </tr>
          )),
        )}
      </tbody>
    </table>
  );
}

const SECTIONS = [
  { id: "keys", title: "Keys" },
  { id: "endpoints", title: "Endpoints" },
  { id: "units", title: "Units" },
  { id: "rate-limits", title: "Rate limits" },
  { id: "errors", title: "Errors" },
  { id: "attribution", title: "Attribution" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function Section({ id, first = false, children }: { id: SectionId; first?: boolean; children: ReactNode }) {
  const title = SECTIONS.find((section) => section.id === id)?.title;
  return (
    <section className={first ? undefined : REFERENCE_SECTION} aria-labelledby={id}>
      <h2 className={SECTION_HEADING} id={id}>
        {title}
      </h2>
      {children}
    </section>
  );
}

const AUTH_EXAMPLE = `curl -H "X-API-Key: ${EXAMPLE_KEY}" "${API_BASE}/exists?q=sale"`;

/** The whole page. */
export function Developers() {
  return (
    <>
      <SiteHeader />
      <main className={SHELL_TOP}>
        <h1 className={PAGE_HEADING}>Lexema API</h1>
        <p className={REFERENCE_PARAGRAPH}>
          <Text>{`A JSON API over Lexema's Italian dictionary. Every endpoint is under \`${API_BASE}\`, takes an API key, and answers JSON.`}</Text>
        </p>
        <nav aria-label="On this page">
          <ul className={JUMP_LINKS}>
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a className={JUMP_LINK} href={`#${section.id}`}>
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <Section id="keys" first>
          <p className={REFERENCE_PARAGRAPH}>
            <Text>{"Keys are issued by hand: ask Huey for one. A key is shown once, when it is made; Lexema keeps only its SHA-256, so a lost key is revoked and replaced."}</Text>
          </p>
          <p className={REFERENCE_PARAGRAPH}>
            <Text>{"Send the key in the `X-API-Key` header of every request. A request without a valid key is a `401`."}</Text>
          </p>
          <pre className={CODE_BLOCK}>
            <code>{AUTH_EXAMPLE}</code>
          </pre>
        </Section>

        <Section id="endpoints">
          <table className={REFERENCE_TABLE}>
            <thead>
              <tr>
                <th className={REFERENCE_HEAD} scope="col">Method</th>
                <th className={REFERENCE_HEAD} scope="col">Endpoint</th>
                <th className={REFERENCE_HEAD} scope="col">Units</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS_IN_ORDER.map((endpoint) => (
                <tr key={endpoint}>
                  <td className={REFERENCE_CELL_CODE}>{ENDPOINT_REFERENCE[endpoint].method}</td>
                  <td className={REFERENCE_CELL_CODE}>
                    <a className={FORM_LINK} href={`#${anchorOf(endpoint)}`}>
                      {pathOf(endpoint)}
                    </a>
                  </td>
                  <td className={REFERENCE_CELL}>{unitsText(UNIT_WEIGHT[endpoint])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={REFERENCE_PARAGRAPH}>
            <Text>{"Each parameter is sent at most once. `release_id` names the release every answer was read from. Grammar values are Italian labels; the English codes are read as the same."}</Text>
          </p>
          <div className={REFERENCE_ENDPOINTS}>
            {ENDPOINTS_IN_ORDER.map((endpoint) => (
              <EndpointSection key={endpoint} endpoint={endpoint} />
            ))}
          </div>
        </Section>

        <Section id="units">
          <p className={REFERENCE_PARAGRAPH}>
            <Text>{"Each answer an endpoint gives, a `200` or a `404`, costs the units the endpoint table lists, counted per key per UTC day. Every other response costs none."}</Text>
          </p>
        </Section>

        <Section id="rate-limits">
          <p className={REFERENCE_PARAGRAPH}>
            <Text>{"Each key has its own number of requests per minute. Every request made with a valid key counts, refused ones included, and every response to it carries these headers. Past the limit, the answer is a `429` until the minute ends."}</Text>
          </p>
          <Rows rows={HEADERS.map((header) => ({ term: header.name, description: header.description }))} />
        </Section>

        <Section id="errors">
          <p className={REFERENCE_PARAGRAPH}>
            <Text>{"An error answers with its status and a body naming it."}</Text>
          </p>
          <ExampleBlocks example={ERROR_EXAMPLE} />
          <div className={BLOCK}>
            <Rows rows={ERRORS.map((error) => ({ term: `${error.status} ${error.code}`, description: error.when }))} />
          </div>
          <p className={REFERENCE_PARAGRAPH}>
            <Text>{"A word `/lookup` does not find is a `404` with no `error`: its `suggestions` offer close spellings."}</Text>
          </p>
          <ExampleBlocks example={NOT_FOUND_EXAMPLE} />
        </Section>

        <Section id="attribution">
          <p className={REFERENCE_PARAGRAPH}>
            <Text>{"The API's text comes from Wikizionario, the Italian Wiktionary, under CC BY-SA 4.0. Every result carries `attribution`: `licence`, `licence_url`, `source`, and `source_url`, the word's Wikizionario page."}</Text>
          </p>
          <p className={REFERENCE_PARAGRAPH}>
            <Text>{"Where you show or pass on that text, credit it with the source and its page, name the licence with its link, and share what you adapt from it under the same licence. "}</Text>
            <a className={LINK} href="/attribution">
              Sources and licences
            </a>
            {" has the full credit; "}
            <ExternalLink className={LINK} href="https://creativecommons.org/licenses/by-sa/4.0/">
              CC BY-SA 4.0
            </ExternalLink>{" "}
            has the licence.
          </p>
        </Section>
      </main>
    </>
  );
}
