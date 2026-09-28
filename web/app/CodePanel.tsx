"use client";

// The request and response panels beside a docs topic (boards 31 and 31b). The
// request is shown in curl, JavaScript or Python; the response by status, where
// a topic has more than one answer (`/lookup`'s 200, its filtered 200 and its
// 404; a guide's 200 and 401). A response's tab picks the request it answers,
// which an endpoint's examples each have their own of, and a guide's answers
// share. A long response scrolls inside its panel.
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

/** A request in each language the docs print it in. */
export type PanelRequest = Readonly<Record<Language, string>>;

/** One answer, printed: its status, the request it answers, and its text. */
export interface PanelResponse {
  status: number;
  /** What sets it apart from another answer of its status, after the status on its tab. */
  label?: string;
  /** Which of the panel's requests it answers. */
  request: number;
  /** The answer as printed: its JSON, folded or whole, or its headers. */
  text: string;
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

export function CodePanel({
  requestTitle = "Request",
  responseTitle = "Response",
  requests,
  responses,
  languages,
}: {
  requestTitle?: string;
  responseTitle?: string;
  requests: readonly PanelRequest[];
  responses: readonly [PanelResponse, ...PanelResponse[]];
  languages: readonly Language[];
}) {
  const [language, setLanguage] = useState<Language>(languages[0]);
  const [shown, setShown] = useState(0);
  const response = responses[shown];
  return (
    <>
      <div className={CODE_PANEL_REQUEST}>
        <div className={CODE_PANEL_HEAD}>
          <h4 className={CODE_PANEL_TITLE}>{requestTitle}</h4>
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
          <Copy text={requests[response.request][language]} />
        </div>
        {requests.map((request, i) =>
          languages.map((lang) => (
            <pre
              key={`${i} ${lang}`}
              className={CODE_PANEL_BODY}
              data-request={lang}
              hidden={i !== response.request || lang !== language}
            >
              <code>
                <CodeLines text={request[lang]} request />
              </code>
            </pre>
          )),
        )}
      </div>
      <div className={CODE_PANEL_RESPONSE}>
        <div className={CODE_PANEL_HEAD}>
          <h4 className={CODE_PANEL_TITLE}>{responseTitle}</h4>
          {responses.length === 1 ? (
            <span className={CODE_PANEL_STATUS}>{response.status}</span>
          ) : (
            responses.map((each, i) => (
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
          <Copy text={response.text} />
        </div>
        {responses.map((each, i) => (
          <pre key={i} className={CODE_PANEL_RESPONSE_BODY} data-response={each.status} hidden={i !== shown} tabIndex={0}>
            <code>
              <CodeLines text={each.text} request={false} />
            </code>
          </pre>
        ))}
      </div>
    </>
  );
}
