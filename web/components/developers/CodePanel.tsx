"use client";

// The request and response panels beside an endpoint's docs topic (board 31). The request
// is shown in curl, JavaScript or Python; the response by status, where a topic
// has more than one example (`/lookup`'s 200, its filtered 200 and its 404). A
// response's tab picks its request too, since each example is its own request.
// A long response scrolls inside its panel.
//
// The tabs are Base UI's (ADR 0010): the arrow keys move between them, and
// each tab names the panel it shows. Every block is in the HTML the server
// sends, the ones not showing `hidden`, so web/test/developers.test.tsx reads
// them all off the static markup.

import { Tabs } from "@base-ui/react/tabs";
import { Fragment, useState, type ComponentProps } from "react";
import type { Language } from "@/lib/developers/apiReference.ts";
import {
  CODE_LINE_ADDRESS,
  CODE_LINE_MUTED,
  CODE_LINE_STRONG,
  CODE_PANEL_BODY,
  CODE_PANEL_CODE,
  CODE_PANEL_COPY,
  CODE_PANEL_HEAD,
  CODE_PANEL_REQUEST,
  CODE_PANEL_RESPONSE,
  CODE_PANEL_RESPONSE_BODY,
  CODE_PANEL_STATUS,
  CODE_PANEL_TAB,
  CODE_PANEL_TABS,
  CODE_PANEL_TITLE,
} from "@/components/shared/styles.ts";

/** One example, printed: its request in each language, and its answer. */
export interface PanelExample {
  status: number;
  /** What sets it apart from another example of its status, after the status on its tab. */
  label?: string;
  requests: Readonly<Record<Language, string>>;
  /** The answer's JSON. */
  response: string;
}

/** A line that is only brackets and commas: `{`, `],`, `}`. */
const BRACKETS = /^\s*[[\]{}(),]+\s*$/;
/** A command's last line: the address it calls, quoted. */
const ADDRESS = /^\s*"https:\/\/[^"]+"$/;

/**
 * Code as board 31 colours it: a request's first line strong and the address a
 * command calls in the accent; a line of brackets muted; the rest plain.
 */
function roleOf(line: string, index: number, request: boolean): string | undefined {
  if (request && index === 0) return CODE_LINE_STRONG;
  if (request && ADDRESS.test(line)) return CODE_LINE_ADDRESS;
  if (!request && BRACKETS.test(line)) return CODE_LINE_MUTED;
  return undefined;
}

function CodeLines({ text, request }: { text: string; request: boolean }) {
  return text.split("\n").map((line, i) => {
    const role = roleOf(line, i, request);
    return (
      <Fragment key={i}>
        {i === 0 ? null : "\n"}
        {role === undefined ? line : <span className={role}>{line}</span>}
      </Fragment>
    );
  });
}

function Copy({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={CODE_PANEL_COPY}
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function CodePanel({ examples, languages }: { examples: readonly PanelExample[]; languages: readonly Language[] }) {
  // Held here, not only inside each tab list, because each side reads the
  // other's: a response's tab picks the request shown, and Copy copies what shows.
  const [language, setLanguage] = useState<Language>(languages[0]);
  const [shown, setShown] = useState(0);
  const example = examples[shown];
  return (
    <>
      <Tabs.Root className={CODE_PANEL_REQUEST} value={language} onValueChange={(value: Language) => setLanguage(value)}>
        <div className={CODE_PANEL_HEAD}>
          <h4 className={CODE_PANEL_TITLE}>Request</h4>
          <Tabs.List className={CODE_PANEL_TABS} aria-label="Request language">
            {languages.map((each) => (
              <Tabs.Tab key={each} className={CODE_PANEL_TAB} value={each}>
                {each}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          <Copy text={example.requests[language]} />
        </div>
        {languages.map((lang) => (
          <Tabs.Panel key={lang} className={CODE_PANEL_CODE} value={lang} keepMounted>
            {examples.map((each, i) => (
              <pre key={i} className={CODE_PANEL_BODY} data-request={lang} data-status={each.status} hidden={i !== shown}>
                <code>
                  <CodeLines text={each.requests[lang]} request />
                </code>
              </pre>
            ))}
          </Tabs.Panel>
        ))}
      </Tabs.Root>
      {examples.length === 1 ? (
        <div className={CODE_PANEL_RESPONSE}>
          <div className={CODE_PANEL_HEAD}>
            <h4 className={CODE_PANEL_TITLE}>Response</h4>
            <span className={CODE_PANEL_STATUS}>{example.status}</span>
            <Copy text={example.response} />
          </div>
          <ResponseBody example={example} />
        </div>
      ) : (
        <Tabs.Root className={CODE_PANEL_RESPONSE} value={shown} onValueChange={(value: number) => setShown(value)}>
          <div className={CODE_PANEL_HEAD}>
            <h4 className={CODE_PANEL_TITLE}>Response</h4>
            <Tabs.List className={CODE_PANEL_TABS} aria-label="Response">
              {examples.map((each, i) => (
                <Tabs.Tab key={i} className={CODE_PANEL_TAB} value={i}>
                  {each.label === undefined ? each.status : `${each.status} ${each.label}`}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            <Copy text={example.response} />
          </div>
          {examples.map((each, i) => (
            <Tabs.Panel key={i} value={i} keepMounted render={<ResponseBody example={each} />} />
          ))}
        </Tabs.Root>
      )}
    </>
  );
}

/** A response's JSON, scrolling inside its panel. */
function ResponseBody({ example, ...panel }: { example: PanelExample } & ComponentProps<"pre">) {
  return (
    <pre tabIndex={0} {...panel} className={CODE_PANEL_RESPONSE_BODY} data-response={example.status}>
      <code>
        <CodeLines text={example.response} request={false} />
      </code>
    </pre>
  );
}
