// developers.lexema.fyi/ (#166, board 25): what the API is, one call and an
// excerpt of its answer, and every endpoint. The call is the docs' filtered
// `/lookup` example and the excerpt is read from its answer, so the landing
// page shows nothing the API does not return.

import { API_PREFIX } from "@lexema/api/units.ts";
import {
  API_BASE,
  ENDPOINT_REFERENCE,
  ENDPOINTS_IN_ORDER,
  EXAMPLE_KEY,
  formatJson,
  LOOKUP_FILTERED_EXAMPLE,
} from "./apiReference.ts";
import { DeveloperPage, SIGN_IN_PATH } from "./DeveloperPage";
import { DOCS_PATH, endpointPath } from "./docsPages.ts";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  DEV_HEADING,
  DEV_SECTION_HEADING,
  DEV_SHELL,
  LANDING_ACTIONS,
  LANDING_CODE,
  LANDING_CODE_MUTED,
  LANDING_ENDPOINT_LIST,
  LANDING_ENDPOINT_PATH,
  LANDING_ENDPOINT_ROW,
  LANDING_ENDPOINT_TEXT,
  LANDING_ENDPOINTS,
  LANDING_FEATURE_HEADING,
  LANDING_FEATURE_TEXT,
  LANDING_FEATURES,
  LANDING_LEAD,
} from "./styles.ts";

/** The word the landing page looks up: a verb form, so the answer shows its lemma. */
const WORD = "andavano";

interface LookupResult {
  word: string;
  pos_title: string;
  match: unknown;
  definitions: { definition: string }[];
}

/** The fields of `/lookup`'s answer the landing page shows, from the docs' example. */
function excerpt(): string {
  const response = LOOKUP_FILTERED_EXAMPLE.response as { results: LookupResult[] };
  const [result] = response.results;
  return formatJson({
    word: result.word,
    pos_title: result.pos_title,
    match: result.match,
    definitions: result.definitions.slice(0, 1).map(({ definition }) => ({ definition })),
  });
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
        <h1 className={DEV_HEADING}>The Lexema API</h1>
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
            {`GET ${API_BASE}/lookup?q=${WORD}\n`}
            <span className={LANDING_CODE_MUTED}>{`X-API-Key: ${EXAMPLE_KEY}`}</span>
            {`\n\n${excerpt()}`}
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
