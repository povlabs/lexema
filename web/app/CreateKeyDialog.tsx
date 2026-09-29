"use client";

// Board 28b (28bm on a phone): what a new key is called, what it may call and
// how long it lasts, asked before it is made (#187). Create key on the
// dashboard is a link to `/dashboard?create=key`, which the server draws with
// this dialog open, so the button never makes a key on its own; with a script
// the dialog opens in place instead (DashboardFlow.tsx).
//
// The name is optional: left empty, the key gets the default the hint names.
// Endpoints is All endpoints by default; Only some opens the checklist of the
// 8 endpoints (board 28c) with no script, since the form's own CSS reads which
// is ticked. Expires is Never by default. The form posts to the create action
// with the session's CSRF token.
//
// What the form holds and why it cannot be sent are one value
// (createKeyForm.ts). With a script, Create key is pressable only while the
// form is valid, so Only some with nothing ticked cannot be sent, and the form
// goes with fetch: the new key opens board 29 in place, and a refusal is said
// in this dialog. With no script, or on a forced post, the server answers a
// refused form with this dialog drawn again holding what was sent, each
// problem in `warning` under its own field. Cancel, and Escape with a script,
// close it.

import { useEffect, useState, type FormEvent } from "react";
import { KEY_LIFETIMES, LIFETIME_LABEL } from "@lexema/api/keyAccess.ts";
import { KEY_NAME_MAX } from "@lexema/api/ownedKeys.ts";
import { ENDPOINTS } from "@lexema/api/units.ts";
import {
  canSend,
  draftOf,
  drawnStatus,
  ENDPOINT_FIELD,
  ENDPOINT_SCOPE,
  ENDPOINT_SCOPE_FIELD,
  EXPIRES_FIELD,
  KEY_NAME_FIELD,
  problemAt,
  type CreateKeyDraft,
  type CreateKeyField,
  type CreateKeyStatus,
} from "./createKeyForm.ts";
import { CloseLink, CsrfField } from "./DashboardControls";
import { CREATE_KEY_ACTION, sendAction, UNREACHABLE } from "./dashboardActions.ts";
import type { KeyRow } from "./dashboardView.ts";
import { ChevronIcon } from "./icons";
import { CheckIcon } from "./MenuIcons";
import { PageDialog } from "./PageDialog";
import {
  CREATE_KEY_ACTIONS,
  CREATE_KEY_BOX,
  CREATE_KEY_CHECK,
  CREATE_KEY_CHECKBOX,
  CREATE_KEY_CHECKLIST,
  CREATE_KEY_CHEVRON,
  CREATE_KEY_FORM,
  CREATE_KEY_HINT,
  CREATE_KEY_INPUT,
  CREATE_KEY_LABEL,
  CREATE_KEY_LABEL_FIRST,
  CREATE_KEY_PROBLEM,
  CREATE_KEY_RADIO,
  CREATE_KEY_SCOPE,
  CREATE_KEY_SCOPE_HINT,
  CREATE_KEY_SCOPES,
  CREATE_KEY_SELECT,
  CREATE_KEY_SELECT_WRAP,
  CREATE_KEY_SUBMIT,
  CREATE_KEY_TICK,
  DELETE_CANCEL,
  DIALOG_FAILURE,
  MODAL_TITLE,
} from "./styles.ts";

const problemId = (field: CreateKeyField): string => `create-key-${field}-problem`;

/** A field's problem, in `warning` under it, or nothing. */
function Problem({ field, message }: { field: CreateKeyField; message: string | undefined }) {
  if (message === undefined) return null;
  return (
    <p className={CREATE_KEY_PROBLEM} id={problemId(field)} role="alert">
      {message}
    </p>
  );
}

/** A field's `aria-describedby`: its hint, then its problem when it has one. */
const describedBy = (hint: string | undefined, field: CreateKeyField, message: string | undefined): string | undefined =>
  [hint, message === undefined ? undefined : problemId(field)].filter((id) => id !== undefined).join(" ") || undefined;

export function CreateKeyDialog({
  draft,
  defaultName,
  csrf,
  onClose,
  onCreated,
}: {
  /** What the form opens holding: board 28b's defaults, or a refused form the server drew again. */
  draft: CreateKeyDraft;
  defaultName: string;
  csrf: string;
  onClose: () => void;
  onCreated: (key: KeyRow, secret: string) => void;
}) {
  const [live, setLive] = useState(draft);
  const [status, setStatus] = useState<CreateKeyStatus>(() => drawnStatus(draft));
  // Create key is disabled only once a script runs: the server's HTML never
  // disables it, so a form drawn again with no script can still be sent.
  const [scripted, setScripted] = useState(false);
  useEffect(() => setScripted(true), []);

  const problems = status.kind === "refused" ? status.problems : [];
  const nameProblem = problemAt(problems, "name");
  const endpointsProblem = problemAt(problems, "endpoints");
  const expiresProblem = problemAt(problems, "expires");

  const edited = (event: FormEvent<HTMLFormElement>) => {
    setLive(draftOf(new FormData(event.currentTarget)));
    setStatus((now) => (now.kind === "sending" ? now : { kind: "editing" }));
  };
  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend(live, status)) return;
    const form = new FormData(event.currentTarget);
    setStatus({ kind: "sending" });
    void sendAction(CREATE_KEY_ACTION, form).then((answer) => {
      switch (answer.outcome) {
        case "created":
          onCreated(answer.key, answer.secret);
          return;
        case "refused-form":
          setStatus({ kind: "refused", problems: answer.problems });
          return;
        case "refused":
          setStatus({ kind: "failed", message: answer.message });
          return;
        default:
          setStatus({ kind: "failed", message: UNREACHABLE });
      }
    });
  };

  return (
    <PageDialog titleId="create-key" onClose={onClose} className={CREATE_KEY_BOX}>
      <h2 className={MODAL_TITLE} id="create-key">
        Create an API key
      </h2>
      <form className={CREATE_KEY_FORM} method="post" action={CREATE_KEY_ACTION} onChange={edited} onSubmit={send}>
        <CsrfField csrf={csrf} />
        <label className={CREATE_KEY_LABEL_FIRST} htmlFor="create-key-name">
          Name
        </label>
        <input
          className={CREATE_KEY_INPUT}
          id="create-key-name"
          name={KEY_NAME_FIELD}
          type="text"
          maxLength={KEY_NAME_MAX}
          autoComplete="off"
          placeholder="What's it for? e.g. Learning app"
          defaultValue={draft.name}
          aria-invalid={nameProblem !== undefined || undefined}
          aria-describedby={describedBy("create-key-hint", "name", nameProblem)}
        />
        <p className={CREATE_KEY_HINT} id="create-key-hint">
          Optional. Left empty, it's called {defaultName}.
        </p>
        <Problem field="name" message={nameProblem} />

        <p className={CREATE_KEY_LABEL} id="create-key-endpoints">
          Endpoints
        </p>
        <div
          className={CREATE_KEY_SCOPES}
          role="radiogroup"
          aria-labelledby="create-key-endpoints"
          aria-describedby={describedBy("create-key-endpoints-hint", "endpoints", endpointsProblem)}
        >
          <label className={CREATE_KEY_SCOPE}>
            <input className={CREATE_KEY_RADIO} type="radio" name={ENDPOINT_SCOPE_FIELD} value={ENDPOINT_SCOPE.all} defaultChecked={draft.scope === "all"} />
            All endpoints
          </label>
          <label className={CREATE_KEY_SCOPE}>
            <input className={CREATE_KEY_RADIO} type="radio" name={ENDPOINT_SCOPE_FIELD} value={ENDPOINT_SCOPE.some} defaultChecked={draft.scope === "some"} />
            Only some
          </label>
        </div>
        <p className={CREATE_KEY_SCOPE_HINT} id="create-key-endpoints-hint">
          Only some: pick the endpoints this key may call. Anything else answers 403.
        </p>
        <fieldset
          className={CREATE_KEY_CHECKLIST}
          aria-label="The endpoints this key may call"
          aria-describedby={endpointsProblem === undefined ? undefined : problemId("endpoints")}
        >
          {ENDPOINTS.map((endpoint) => (
            <label key={endpoint} className={CREATE_KEY_CHECK}>
              <input
                className={CREATE_KEY_CHECKBOX}
                type="checkbox"
                name={ENDPOINT_FIELD}
                value={endpoint}
                defaultChecked={draft.ticked.includes(endpoint)}
              />
              <CheckIcon className={CREATE_KEY_TICK} />
              {endpoint}
            </label>
          ))}
        </fieldset>
        <Problem field="endpoints" message={endpointsProblem} />

        <label className={CREATE_KEY_LABEL} htmlFor="create-key-expires">
          Expires
        </label>
        <div className={CREATE_KEY_SELECT_WRAP}>
          <select
            className={CREATE_KEY_SELECT}
            id="create-key-expires"
            name={EXPIRES_FIELD}
            defaultValue={draft.expires === "unknown" ? "never" : draft.expires}
            aria-invalid={expiresProblem !== undefined || undefined}
            aria-describedby={describedBy("create-key-expires-hint", "expires", expiresProblem)}
          >
            {KEY_LIFETIMES.map((lifetime) => (
              <option key={lifetime} value={lifetime}>
                {LIFETIME_LABEL[lifetime]}
              </option>
            ))}
          </select>
          <ChevronIcon className={CREATE_KEY_CHEVRON} />
        </div>
        <p className={CREATE_KEY_HINT} id="create-key-expires-hint">
          After this date the key answers 401.
        </p>
        <Problem field="expires" message={expiresProblem} />
        {status.kind === "failed" && (
          <p className={DIALOG_FAILURE} role="alert">
            {status.message}
          </p>
        )}

        <div className={CREATE_KEY_ACTIONS}>
          <CloseLink className={DELETE_CANCEL} onClose={onClose}>
            Cancel
          </CloseLink>
          <button className={CREATE_KEY_SUBMIT} type="submit" disabled={scripted && !canSend(live, status)}>
            Create key
          </button>
        </div>
      </form>
    </PageDialog>
  );
}
