"use client";

// The request and response panels beside a docs topic (board 31). The request
// is shown in curl, JavaScript or Python; the response by status, where a topic
// has more than one example (`/lookup`'s 200, its filtered 200 and its 404). A
// response's tab picks its request too, since each example is its own request.
// A long response scrolls inside its panel.
//
// Every block is in the HTML the server sends, the ones not showing `hidden`,
// so the page states every example without a script and
// web/test/developers.test.tsx reads them all off the static markup.

import { Fragment, useState } from "react";
import type { Language } from "./apiReference.ts";
import {
  CODE_LINE_ADDRESS,
  CODE_LINE_MUTED,
  CODE_LINE_STRONG,
  CODE_PANEL_BODY,
  CODE_PANEL_COPY,
  CODE_PANEL_HEAD,
  CODE_PANEL_REQUEST,
  CODE_PANEL_RESPONSE,
  CODE_PANEL_RESPONSE_BODY,
  CODE_PANEL_STATUS,
  CODE_PANEL_TAB,
  CODE_PANEL_TITLE,
} from "./styles.ts";

/** One example, printed: its request in each language, and its answer. */
export interface PanelExample {
  status: number;
  /** What sets it apart from another example of its status, after the status on its tab. */
  label?: string;
  requests: Readonly<Record<Language, string>>;
  /** The answer's JSON; absent where a topic shows only how to send a request. */
  response?: string;
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
  const [language, setLanguage] = useState<Language>(languages[0]);
  const [shown, setShown] = useState(0);
  const example = examples[shown];
  const withResponse = examples.some((each) => each.response !== undefined);
  return (
    <>
      <div className={CODE_PANEL_REQUEST}>
        <div className={CODE_PANEL_HEAD}>
          <h4 className={CODE_PANEL_TITLE}>Request</h4>
          {languages.map((each) => (
            <button
              key={each}
              className={CODE_PANEL_TAB}
              type="button"
              aria-pressed={each === language}
              onClick={() => setLanguage(each)}
            >
              {each}
            </button>
          ))}
          <Copy text={example.requests[language]} />
        </div>
        {examples.map((each, i) =>
          languages.map((lang) => (
            <pre
              key={`${i} ${lang}`}
              className={CODE_PANEL_BODY}
              data-request={lang}
              data-status={each.status}
              hidden={i !== shown || lang !== language}
            >
              <code>
                <CodeLines text={each.requests[lang]} request />
              </code>
            </pre>
          )),
        )}
      </div>
      {withResponse ? (
        <div className={CODE_PANEL_RESPONSE}>
          <div className={CODE_PANEL_HEAD}>
            <h4 className={CODE_PANEL_TITLE}>Response</h4>
            {examples.length === 1 ? (
              <span className={CODE_PANEL_STATUS}>{example.status}</span>
            ) : (
              examples.map((each, i) => (
                <button
                  key={i}
                  className={CODE_PANEL_TAB}
                  type="button"
                  aria-pressed={i === shown}
                  onClick={() => setShown(i)}
                >
                  {each.label === undefined ? each.status : `${each.status} ${each.label}`}
                </button>
              ))
            )}
            <Copy text={example.response ?? ""} />
          </div>
          {examples.map((each, i) => (
            <pre key={i} className={CODE_PANEL_RESPONSE_BODY} data-response={each.status} hidden={i !== shown} tabIndex={0}>
              <code>{each.response === undefined ? null : <CodeLines text={each.response} request={false} />}</code>
            </pre>
          ))}
        </div>
      ) : null}
    </>
  );
}
