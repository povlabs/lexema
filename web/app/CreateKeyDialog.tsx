"use client";

// Board 28b (28bm on a phone): what a new key is called, what it may call and
// how long it lasts, asked before it is made (#187). Create key on the
// dashboard opens it (DashboardFlow.tsx), so the button never makes a key on
// its own.
//
// The name is optional: left empty, the key gets the default the hint names.
// Endpoints is All endpoints by default; Only some swaps the hint for the
// checklist of the 8 endpoints (board 28c). Expires is Never by default. The
// choice and the checklist are Base UI's radio and checkbox (ADR 0010).
//
// What the form holds and why it cannot be sent are one value
// (createKeyForm.ts): each problem shows in `warning` under its own field,
// and Create key is pressable only while there is none, so Only some with
// nothing ticked cannot be sent. Create key sends the form with fetch, with
// the session's CSRF token; the new key then opens board 29 in place, and a
// refusal is said in this dialog. Cancel and Escape close it.

import { Checkbox } from "@base-ui/react/checkbox";
import { CheckboxGroup } from "@base-ui/react/checkbox-group";
import { Dialog } from "@base-ui/react/dialog";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { useState, type FormEvent } from "react";
import { KEY_LIFETIMES, keyLifetime, LIFETIME_LABEL, type KeyLifetime } from "@lexema/api/keyAccess.ts";
import { KEY_NAME_MAX } from "@lexema/api/ownedKeys.ts";
import { ENDPOINTS, type Endpoint } from "@lexema/api/units.ts";
import {
  canSend,
  draftFields,
  EMPTY_DRAFT,
  ENDPOINT_SCOPE,
  nameOf,
  problemAt,
  shownProblems,
  type CreateKeyDraft,
  type CreateKeyField,
  type CreateKeyStatus,
} from "./createKeyForm.ts";
import { CREATE_KEY_ACTION, CSRF_FIELD, sendAction, UNREACHABLE } from "./dashboardActions.ts";
import type { KeyRow } from "./dashboardView.ts";
import { ChevronIcon } from "./icons";
import { CheckIcon } from "./MenuIcons";
import {
  CREATE_KEY_ACTIONS,
  CREATE_KEY_CHECK,
  CREATE_KEY_CHECKBOX,
  CREATE_KEY_CHECKLIST,
  CREATE_KEY_CHEVRON,
  CREATE_KEY_HINT,
  CREATE_KEY_INPUT,
  CREATE_KEY_LABEL,
  CREATE_KEY_LABEL_FIRST,
  CREATE_KEY_PROBLEM,
  CREATE_KEY_RADIO,
  CREATE_KEY_SCOPE,
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

/** What the create-key dialog holds: drawn inside its `Dialog.Popup`, it opens on board 28b's defaults unless given a draft. */
export function CreateKeyForm({
  defaultName,
  csrf,
  onCreated,
  opening = EMPTY_DRAFT,
}: {
  defaultName: string;
  csrf: string;
  onCreated: (key: KeyRow, secret: string) => void;
  opening?: CreateKeyDraft;
}) {
  const [typed, setTyped] = useState(opening.name);
  const [scope, setScope] = useState<"all" | "some">(opening.scope === ENDPOINT_SCOPE.some ? ENDPOINT_SCOPE.some : ENDPOINT_SCOPE.all);
  const [ticked, setTicked] = useState<readonly Endpoint[]>(opening.ticked);
  const [expires, setExpires] = useState<KeyLifetime>(opening.expires === "unknown" ? "never" : opening.expires);
  const [status, setStatus] = useState<CreateKeyStatus>({ kind: "editing" });

  const draft: CreateKeyDraft = { name: nameOf(typed), scope, ticked, strayTick: false, expires };
  const problems = shownProblems(draft, status);
  const nameProblem = problemAt(problems, "name");
  const endpointsProblem = problemAt(problems, "endpoints");
  const expiresProblem = problemAt(problems, "expires");

  /** Any edit: the form is being filled in again. */
  const edit = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setStatus((now) => (now.kind === "sending" ? now : { kind: "editing" }));
  };

  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend(draft, status)) return;
    const fields = draftFields(draft);
    fields.set(CSRF_FIELD, csrf);
    setStatus({ kind: "sending" });
    void sendAction(CREATE_KEY_ACTION, fields).then((answer) => {
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
    <>
      <Dialog.Title className={MODAL_TITLE}>Create an API key</Dialog.Title>
      <form onSubmit={send} noValidate>
        <label className={CREATE_KEY_LABEL_FIRST} htmlFor="create-key-name">
          Name
        </label>
        <input
          className={CREATE_KEY_INPUT}
          id="create-key-name"
          type="text"
          maxLength={KEY_NAME_MAX}
          autoComplete="off"
          placeholder="What's it for? e.g. Learning app"
          value={typed}
          onChange={(event) => edit(setTyped)(event.target.value)}
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
        <RadioGroup
          className={CREATE_KEY_SCOPES}
          value={scope}
          onValueChange={(value) => edit(setScope)(value === ENDPOINT_SCOPE.some ? ENDPOINT_SCOPE.some : ENDPOINT_SCOPE.all)}
          aria-labelledby="create-key-endpoints"
          aria-describedby={describedBy(scope === "all" ? "create-key-endpoints-hint" : undefined, "endpoints", endpointsProblem)}
        >
          <label className={CREATE_KEY_SCOPE}>
            <Radio.Root className={CREATE_KEY_RADIO} value={ENDPOINT_SCOPE.all} />
            All endpoints
          </label>
          <label className={CREATE_KEY_SCOPE}>
            <Radio.Root className={CREATE_KEY_RADIO} value={ENDPOINT_SCOPE.some} />
            Only some
          </label>
        </RadioGroup>
        {scope === "all" ? (
          <p className={CREATE_KEY_HINT} id="create-key-endpoints-hint">
            Only some: pick the endpoints this key may call. Anything else answers 403.
          </p>
        ) : (
          <CheckboxGroup
            className={CREATE_KEY_CHECKLIST}
            value={[...ticked]}
            onValueChange={(value) => edit(setTicked)(ENDPOINTS.filter((endpoint) => value.includes(endpoint)))}
            role="group"
            aria-label="The endpoints this key may call"
            aria-describedby={endpointsProblem === undefined ? undefined : problemId("endpoints")}
          >
            {ENDPOINTS.map((endpoint) => (
              <label key={endpoint} className={CREATE_KEY_CHECK}>
                <Checkbox.Root className={CREATE_KEY_CHECKBOX} value={endpoint}>
                  <Checkbox.Indicator>
                    <CheckIcon className={CREATE_KEY_TICK} />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                {endpoint}
              </label>
            ))}
          </CheckboxGroup>
        )}
        <Problem field="endpoints" message={endpointsProblem} />

        <label className={CREATE_KEY_LABEL} htmlFor="create-key-expires">
          Expires
        </label>
        <div className={CREATE_KEY_SELECT_WRAP}>
          <select
            className={CREATE_KEY_SELECT}
            id="create-key-expires"
            value={expires}
            onChange={(event) => edit(setExpires)(keyLifetime(event.target.value) ?? "never")}
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
          <Dialog.Close className={DELETE_CANCEL}>Cancel</Dialog.Close>
          <button className={CREATE_KEY_SUBMIT} type="submit" disabled={!canSend(draft, status)}>
            Create key
          </button>
        </div>
      </form>
    </>
  );
}
