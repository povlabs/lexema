"use client";

// "Report a mistake": the link beside Source and the small box it opens
// (board 22; ruled on #51, 2026-09-27). What's wrong, which reading (optional),
// and details; Send stays off until a choice and details are given. No account
// and no email field. What the server does with a report is lib/dictionary/report.ts.
//
// The same box opens from "Report a missing word" on a search that found
// nothing (#441). There it reports the query as a missing word: it asks no
// "What's wrong?", names no reading, and its details are optional.
//
// Base UI supplies the dialog's behaviour (ADR 0010): focus is kept inside,
// Escape closes it, and the page behind is inert while it is open.

import { Dialog } from "@base-ui/react/dialog";
import { useEffect, useId, useRef, useState } from "react";
import {
  afterAnswer,
  OPENING_TROUBLE,
  REPORT_CHOICE_LABEL,
  REPORT_CHOICES,
  REPORT_DETAILS_HINT,
  REPORT_DETAILS_LIMIT,
  REPORT_SUBJECT_LABEL,
  needsDetails,
  requestOpening,
  type OpeningTrouble,
  type ReportAnswer,
  type ReportChoice,
  type ReportReading,
  type ReportSubject,
  type ReportTarget,
} from "@/lib/dictionary/report.ts";
import { TURNSTILE_SCRIPT } from "@/lib/shared/turnstile.ts";
import {
  REPORT_BACKDROP,
  REPORT_CANCEL,
  REPORT_CHIP,
  REPORT_CHIPS,
  REPORT_CLOSE,
  REPORT_DETAILS,
  REPORT_ERROR,
  REPORT_FIELD,
  REPORT_FIELD_LABEL,
  REPORT_FOOTER,
  REPORT_NOTE,
  REPORT_OPTIONAL,
  REPORT_POPUP,
  REPORT_RETRY,
  REPORT_SEND,
  REPORT_SENT_CHECK,
  REPORT_SENT_TEXT,
  REPORT_SUBTITLE,
  REPORT_SUBTITLE_WORD,
  REPORT_TITLE,
  REPORT_TRIGGER,
  REPORT_X,
} from "@/components/shared/styles.ts";

/** How the dialog names a reading: `1 · Sostantivo`, or `Sostantivo` when it has no number. */
export const readingChoiceLabel = ({ number, posTitle }: ReportReading): string =>
  number === undefined ? posTitle : `${number} · ${posTitle}`;

type Status = "editing" | "sending" | ReturnType<typeof afterAnswer>["status"] | OpeningTrouble;

const TROUBLE: Partial<Record<Status, string>> = {
  limited: "Too many reports from you in the last hour. Try again later.",
  challenge: "The check that you are a person did not pass. Try again.",
  expired: "This box has been open too long. Close it and open it again.",
  failed: "The report could not be sent. Try again in a moment.",
  ...OPENING_TROUBLE,
};

const isOpeningTrouble = (status: Status): status is OpeningTrouble => status === "open-limited" || status === "open-failed";

interface Turnstile {
  render(container: HTMLElement, options: { sitekey: string; callback: (token: string) => void }): string;
  reset(widget: string): void;
  remove(widget: string): void;
}

/**
 * Load Turnstile once, render its widget into `container` while it is
 * mounted, and return a function that resets it for a fresh token.
 */
function useTurnstile(siteKey: string | undefined, container: HTMLDivElement | null, onToken: (token: string) => void) {
  const resetRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (siteKey === undefined || container === null) return;
    const withTurnstile = (run: (turnstile: Turnstile) => void) => {
      const loaded = (window as { turnstile?: Turnstile }).turnstile;
      if (loaded !== undefined) return run(loaded);
      let script = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT}"]`);
      if (script === null) {
        script = document.createElement("script");
        script.src = TURNSTILE_SCRIPT;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", () => run((window as { turnstile?: Turnstile }).turnstile as Turnstile), { once: true });
    };
    let widget: string | undefined;
    let turnstileRef: Turnstile | undefined;
    withTurnstile((turnstile) => {
      turnstileRef = turnstile;
      widget = turnstile.render(container, { sitekey: siteKey, callback: onToken });
      resetRef.current = () => {
        if (widget !== undefined) turnstile.reset(widget);
      };
    });
    return () => {
      resetRef.current = () => {};
      if (widget !== undefined) turnstileRef?.remove(widget);
    };
  }, [siteKey, container, onToken]);
  return () => resetRef.current();
}

function Chip({ name, value, checked, onChange, children }: { name: string; value: string; checked: boolean; onChange: () => void; children: string }) {
  return (
    <label className={REPORT_CHIP}>
      <input className="sr-only" type="radio" name={name} value={value} checked={checked} onChange={onChange} />
      <span lang={name === "reading" ? "it" : undefined}>{children}</span>
    </label>
  );
}

export function ReportDialog({ word, subject, siteKey }: { word: string; subject: ReportSubject; siteKey?: string }) {
  const readings = subject.kind === "mistake" ? subject.readings : [];
  const label = REPORT_SUBJECT_LABEL[subject.kind];
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<ReportChoice | undefined>(undefined);
  const [reading, setReading] = useState<number | "unsure" | undefined>(undefined);
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<Status>("editing");
  const [token, setToken] = useState<string | undefined>(undefined);
  const [widget, setWidget] = useState<HTMLDivElement | null>(null);
  const [openToken, setOpenToken] = useState<string | undefined>(undefined);
  const honeypot = useRef<HTMLInputElement>(null);
  const ids = { choice: useId(), reading: useId(), details: useId() };

  const resetChallenge = useTurnstile(open && status !== "sent" ? siteKey : undefined, widget, setToken);

  const reset = () => {
    setChoice(undefined);
    setReading(undefined);
    setDetails("");
    setStatus("editing");
    setToken(undefined);
    setOpenToken(undefined);
  };

  /** Ask the server for the token this opening is timed against. */
  async function requestOpenToken() {
    const opening = await requestOpening(fetch);
    if ("token" in opening) {
      setOpenToken(opening.token);
      setStatus((current) => (isOpeningTrouble(current) ? "editing" : current));
    } else {
      setStatus(opening.trouble);
    }
  }

  /** What the report is about: set by the page for a missing word, picked by the reader on a word page. */
  const target: ReportTarget | undefined =
    subject.kind === "missing"
      ? { choice: "missing", recordId: undefined }
      : choice === undefined
        ? undefined
        : { choice, recordId: typeof reading === "number" ? reading : undefined };

  const ready =
    target !== undefined &&
    (!needsDetails(target) || details.trim() !== "") &&
    status !== "sending" &&
    openToken !== undefined &&
    (siteKey === undefined || token !== undefined);

  async function send() {
    if (!ready || target === undefined) return;
    setStatus("sending");
    try {
      const response = await fetch("/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          word,
          ...target,
          details,
          openToken,
          website: honeypot.current?.value ?? "",
          challenge: token,
        }),
      });
      settle((await response.json()) as ReportAnswer);
    } catch {
      settle({ outcome: "failed" });
    }
  }

  /** Show the answer; a Turnstile token is single-use, so any failure asks for a fresh one. */
  function settle(answer: ReportAnswer) {
    const next = afterAnswer(answer);
    if (!next.keepChallenge) {
      setToken(undefined);
      resetChallenge();
    }
    setStatus(next.status);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          reset();
          void requestOpenToken();
        }
      }}
    >
      <Dialog.Trigger className={REPORT_TRIGGER}>{label}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className={REPORT_BACKDROP} />
        <Dialog.Popup className={REPORT_POPUP}>
          {status !== "sent" && (
            <Dialog.Close className={REPORT_X} aria-label="Close">
              ×
            </Dialog.Close>
          )}
          {status === "sent" ? (
            <>
              <Dialog.Title className={REPORT_TITLE}>
                <span className={REPORT_SENT_CHECK} aria-hidden="true">
                  ✓
                </span>
                Report sent
              </Dialog.Title>
              <Dialog.Description className={REPORT_SENT_TEXT}>
                Thank you. Your report on <span lang="it">{word}</span> has been sent.
              </Dialog.Description>
              <Dialog.Close className={REPORT_CLOSE}>Close</Dialog.Close>
            </>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <Dialog.Title className={REPORT_TITLE}>{label}</Dialog.Title>
              <Dialog.Description className={REPORT_SUBTITLE}>
                on{" "}
                <span className={REPORT_SUBTITLE_WORD} lang="it">
                  {word}
                </span>
              </Dialog.Description>

              {subject.kind === "mistake" && (
                <fieldset className={REPORT_FIELD}>
                  <legend className={REPORT_FIELD_LABEL} id={ids.choice}>
                    What’s wrong?
                  </legend>
                  <div className={REPORT_CHIPS}>
                    {REPORT_CHOICES.map((value) => (
                      <Chip key={value} name="choice" value={value} checked={choice === value} onChange={() => setChoice(value)}>
                        {REPORT_CHOICE_LABEL[value]}
                      </Chip>
                    ))}
                  </div>
                </fieldset>
              )}

              {readings.length > 0 && (
                <fieldset className={REPORT_FIELD}>
                  <legend className={REPORT_FIELD_LABEL} id={ids.reading}>
                    Which reading? <span className={REPORT_OPTIONAL}>optional</span>
                  </legend>
                  <div className={REPORT_CHIPS}>
                    {readings.map((entry) => (
                      <Chip
                        key={entry.recordId}
                        name="reading"
                        value={String(entry.recordId)}
                        checked={reading === entry.recordId}
                        onChange={() => setReading(entry.recordId)}
                      >
                        {readingChoiceLabel(entry)}
                      </Chip>
                    ))}
                    <label className={REPORT_CHIP}>
                      <input
                        className="sr-only"
                        type="radio"
                        name="reading"
                        value="unsure"
                        checked={reading === "unsure"}
                        onChange={() => setReading("unsure")}
                      />
                      <span>Not sure</span>
                    </label>
                  </div>
                </fieldset>
              )}

              <div className={REPORT_FIELD}>
                <label className={REPORT_FIELD_LABEL} htmlFor={ids.details}>
                  Details
                </label>
                <textarea
                  id={ids.details}
                  className={REPORT_DETAILS}
                  placeholder={REPORT_DETAILS_HINT[subject.kind]}
                  maxLength={REPORT_DETAILS_LIMIT}
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                />
              </div>

              {/* A field no reader sees or reaches; a bot that fills it is dropped. */}
              <div hidden aria-hidden="true">
                <label>
                  Website
                  <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
                </label>
              </div>

              {siteKey !== undefined && <div ref={setWidget} className={REPORT_FIELD} />}

              {TROUBLE[status] !== undefined && (
                <p className={REPORT_ERROR} role="alert">
                  {TROUBLE[status]}
                  {isOpeningTrouble(status) && (
                    <button type="button" className={REPORT_RETRY} onClick={() => void requestOpenToken()}>
                      Try again
                    </button>
                  )}
                </p>
              )}

              <div className={REPORT_FOOTER}>
                <p className={REPORT_NOTE}>No account needed.</p>
                <Dialog.Close className={REPORT_CANCEL}>Cancel</Dialog.Close>
                <button type="submit" className={REPORT_SEND} disabled={!ready}>
                  Send report
                </button>
              </div>
            </form>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
