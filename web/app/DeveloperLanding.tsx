// developers.lexema.fyi/ (#166, board 25): what the API is, one call and an
// excerpt of its answer, and every endpoint. The call is the docs' filtered
// `/lookup` example, and every value in the excerpt is read from its answer;
// the excerpt's lines are laid out as board 25 draws them.

import { API_PREFIX } from "@lexema/api/units.ts";
import {
  API_BASE,
  ENDPOINT_REFERENCE,
  ENDPOINTS_IN_ORDER,
  LOOKUP_FILTERED_EXAMPLE,
} from "./apiReference.ts";
import { DeveloperPage, SIGN_IN_PATH } from "./DeveloperPage";
import { DOCS_PATH, endpointPath } from "./docsPages.ts";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  DEV_SECTION_HEADING,
  DEV_SHELL,
  LANDING_ACTIONS,
  LANDING_CODE,
  LANDING_CODE_MUTED,
  LANDING_CODE_STRONG,
  LANDING_ENDPOINT_LIST,
  LANDING_ENDPOINT_PATH,
  LANDING_ENDPOINT_ROW,
  LANDING_ENDPOINT_TEXT,
  LANDING_ENDPOINTS,
  LANDING_FEATURE_HEADING,
  LANDING_FEATURE_TEXT,
  LANDING_FEATURES,
  LANDING_HEADING,
  LANDING_LEAD,
} from "./styles.ts";

/** The word the landing page looks up: a verb form, so the answer shows its lemma. */
const WORD = "andavano";

/** The key as board 25 writes it on the landing page. */
const LANDING_KEY = "lx_live_••••••••";

interface LookupResult {
  word: string;
  pos_title: string;
  match: { surface: string; grammar: readonly { tense?: string; person?: string }[] };
  definitions: readonly { definition: string }[];
}

const quote = (value: string) => JSON.stringify(value);

/**
 * The excerpt of the docs' filtered `/lookup` answer board 25 prints: the
 * lemma and its part of speech on one line, the form's tense and person
 * beside what was typed, and the first definition. Every value is read from
 * the example's answer.
 */
function excerptLines(): string[] {
  const response = LOOKUP_FILTERED_EXAMPLE.response as { results: readonly LookupResult[] };
  const [result] = response.results;
  const [grammar] = result.match.grammar;
  return [
    `  "word": ${quote(result.word)},  "pos_title": ${quote(result.pos_title)},`,
    `  "match": { "surface": ${quote(result.match.surface)}, "tense": ${quote(grammar.tense ?? "")}, "person": ${quote(grammar.person ?? "")} },`,
    `  "definitions": [{ "definition": ${quote(result.definitions[0].definition)} }]`,
  ];
}

const FEATURES = [
  { heading: "Any form, one call", text: `${WORD} → andare, with its mood, tense and person.` },
  { heading: "Only what you need", text: "Filter by part of speech, pick fields, narrow a conjugation." },
  { heading: "Close matches", text: "A typo or a missing accent returns what it probably was." },
] as const;

export function DeveloperLanding() {
  return (
    <DeveloperPage>
      <main className={DEV_SHELL}>
        <h1 className={LANDING_HEADING}>The Lexema API</h1>
        <p className={LANDING_LEAD}>
          Look up any Italian word, in any form, and get its lemma, meanings, forms and examples as JSON.
        </p>
        <div className={LANDING_ACTIONS}>
          <a className={BUTTON_PRIMARY} href={SIGN_IN_PATH}>
            Get an API key
          </a>
          <a className={BUTTON_SECONDARY} href={DOCS_PATH}>
            Read the docs
          </a>
        </div>

        <pre className={LANDING_CODE}>
          <code>
            <span className={LANDING_CODE_STRONG}>{`GET ${API_BASE}/lookup?q=${WORD}`}</span>
            {"\n"}
            <span className={LANDING_CODE_MUTED}>{`X-API-Key: ${LANDING_KEY}`}</span>
            {"\n\n"}
            <span className={LANDING_CODE_MUTED}>{"{"}</span>
            {`\n${excerptLines().join("\n")}\n`}
            <span className={LANDING_CODE_MUTED}>{"}"}</span>
          </code>
        </pre>

        <ul className={LANDING_FEATURES}>
          {FEATURES.map((feature) => (
            <li key={feature.heading}>
              <h2 className={LANDING_FEATURE_HEADING}>{feature.heading}</h2>
              <p className={LANDING_FEATURE_TEXT}>{feature.text}</p>
            </li>
          ))}
        </ul>

        <section className={LANDING_ENDPOINTS} aria-labelledby="endpoints">
          <h2 className={DEV_SECTION_HEADING} id="endpoints">
            Endpoints
          </h2>
          <ul className={LANDING_ENDPOINT_LIST}>
            {ENDPOINTS_IN_ORDER.map((endpoint) => (
              <li key={endpoint} className={LANDING_ENDPOINT_ROW}>
                <a className={LANDING_ENDPOINT_PATH} href={endpointPath(endpoint)}>
                  {`${ENDPOINT_REFERENCE[endpoint].method} ${API_PREFIX}${endpoint}`}
                </a>
                <span className={LANDING_ENDPOINT_TEXT}>{ENDPOINT_REFERENCE[endpoint].tagline}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </DeveloperPage>
  );
}
