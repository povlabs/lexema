"use client";

// The dashboard's key flow in place (#187): with a script, Create key, Revoke
// and Delete account change the page where it stands instead of loading
// another. Every control here is still a link or a form the server answers,
// so with no script the page works as before: Create key goes to
// `/dashboard?create=key`, each form posts, and the server draws the answer.
//
// With a script, a plain click on Create key or Delete account opens its
// dialog here, and each form is sent with fetch asking for JSON
// (dashboardActions.ts), through the same session, CSRF and key-creation
// checks. A new key's dialog (board 29) then opens with its secret, which
// lives only in this page's memory and goes when the dialog closes; the key
// list gains the new row. Revoke takes the row away. Deleting the account ends
// the session, so the page then goes where signing out goes.
//
// Closing a dialog in place (Cancel, Done, ×, Escape) leaves the address at
// `/dashboard`, so reloading never reopens it, and gives the focus back to the
// control that opened it.

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { EMPTY_DRAFT, defaultKeyName, type CreateKeyDraft } from "./createKeyForm.ts";
import { CreateKeyDialog } from "./CreateKeyDialog";
import { CsrfField, plainClick } from "./DashboardControls";
import { CONFIRM_DELETE_PAGE, CREATE_KEY_PAGE, DASHBOARD, revokeKeyAction, sendAction } from "./dashboardActions.ts";
import { deleteWarning, endpointsText, type KeyRow } from "./dashboardView.ts";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { KeyCreatedDialog } from "./KeyCreated";
import {
  DASH_BEHIND,
  DASH_KEYS_CARD,
  KEYS_ACTION,
  KEYS_BODY,
  KEYS_CREATED,
  KEYS_ENDPOINT_NAMES,
  KEYS_ENDPOINTS,
  KEYS_EXPIRES,
  KEYS_HEAD,
  KEYS_HEAD_ROW,
  KEYS_LAST_USED,
  KEYS_NAME,
  KEYS_PHONE_BREAK,
  KEYS_PHONE_LABEL,
  KEYS_PREFIX,
  KEYS_REVOKE,
  KEYS_ROW,
  KEYS_TABLE,
} from "./styles.ts";

/**
 * A dialog open over the dashboard: the create form (board 28b), holding the
 * draft it opens with; a new key's secret (board 29); or the delete
 * confirmation (board 30).
 */
export type DashboardDialog =
  | { readonly kind: "create-key"; readonly draft: CreateKeyDraft }
  | { readonly kind: "key-created"; readonly name: string; readonly secret: string }
  | { readonly kind: "confirm-delete" };

interface Flow {
  readonly keys: readonly KeyRow[];
  /** Every key the account has made, revoked ones too: the next default name's number. */
  readonly made: number;
  readonly csrf: string;
  readonly dialog: DashboardDialog | undefined;
  open(dialog: DashboardDialog): void;
  close(): void;
  created(key: KeyRow, secret: string): void;
  revoked(keyId: number): void;
}

const FlowContext = createContext<Flow | undefined>(undefined);

function useFlow(): Flow {
  const flow = useContext(FlowContext);
  if (flow === undefined) throw new Error("a dashboard control is drawn outside DashboardFlow");
  return flow;
}

/** The dashboard's state, around the page (`children`, inert while a dialog is open) and whichever dialog is open. */
export function DashboardFlow({
  keys: firstKeys,
  made: firstMade,
  csrf,
  dialog: firstDialog,
  children,
}: {
  keys: readonly KeyRow[];
  made: number;
  csrf: string;
  dialog?: DashboardDialog;
  children: ReactNode;
}) {
  const [keys, setKeys] = useState(firstKeys);
  const [made, setMade] = useState(firstMade);
  const [dialog, setDialog] = useState(firstDialog);
  const opener = useRef<HTMLElement | null>(null);

  const open = useCallback((next: DashboardDialog) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDialog(next);
  }, []);
  const close = useCallback(() => {
    setDialog(undefined);
    // The key-created page and `?create=key` are addresses for the page with no script; closed here, the page is the dashboard.
    if (window.location.pathname + window.location.search !== DASHBOARD) window.history.replaceState(window.history.state, "", DASHBOARD);
    const back = opener.current;
    opener.current = null;
    requestAnimationFrame(() => back?.focus());
  }, []);
  const created = useCallback((key: KeyRow, secret: string) => {
    setKeys((live) => [...live, key]);
    setMade((count) => count + 1);
    setDialog({ kind: "key-created", name: key.name, secret });
  }, []);
  const revoked = useCallback((keyId: number) => setKeys((live) => live.filter((key) => key.keyId !== keyId)), []);

  const flow = useMemo<Flow>(() => ({ keys, made, csrf, dialog, open, close, created, revoked }), [keys, made, csrf, dialog, open, close, created, revoked]);
  return (
    <FlowContext.Provider value={flow}>
      <div className={DASH_BEHIND} inert={dialog !== undefined}>
        {children}
      </div>
      <OpenDialog />
    </FlowContext.Provider>
  );
}

function OpenDialog() {
  const { dialog, made, keys, csrf, close, created } = useFlow();
  switch (dialog?.kind) {
    case "create-key":
      return <CreateKeyDialog draft={dialog.draft} defaultName={defaultKeyName(made)} csrf={csrf} onClose={close} onCreated={created} />;
    case "key-created":
      return <KeyCreatedDialog name={dialog.name} secret={dialog.secret} onClose={close} />;
    case "confirm-delete":
      return <DeleteAccountDialog warning={deleteWarning(keys.length)} csrf={csrf} onClose={close} />;
    case undefined:
      return null;
  }
}

/** Create key: a link to the page that draws the dialog, or, with a script, the dialog opened here. */
export function CreateKeyLink({ className }: { className: string }) {
  const { open } = useFlow();
  return (
    <a
      className={className}
      href={CREATE_KEY_PAGE}
      onClick={(event) => {
        if (!plainClick(event)) return;
        event.preventDefault();
        open({ kind: "create-key", draft: EMPTY_DRAFT });
      }}
    >
      Create key
    </a>
  );
}

/** Delete account: a link to the page that draws the confirmation, or, with a script, the confirmation opened here. */
export function DeleteAccountLink({ className }: { className: string }) {
  const { open } = useFlow();
  return (
    <a
      className={className}
      href={CONFIRM_DELETE_PAGE}
      onClick={(event) => {
        if (!plainClick(event)) return;
        event.preventDefault();
        open({ kind: "confirm-delete" });
      }}
    >
      Delete account
    </a>
  );
}

/**
 * Revoke: a form that posts, or, with a script, the row taken away in place.
 * An answer that is not `revoked` (an expired form, an outage) sends the form
 * the plain way instead, so the server's own answer says what went wrong.
 */
function RevokeForm({ keyRow }: { keyRow: KeyRow }) {
  const { csrf, revoked } = useFlow();
  const [sending, setSending] = useState(false);
  return (
    <form
      method="post"
      action={revokeKeyAction(keyRow.keyId)}
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        setSending(true);
        void sendAction(form.action, new FormData(form)).then((answer) => {
          setSending(false);
          if (answer.outcome === "revoked") revoked(keyRow.keyId);
          else form.submit();
        });
      }}
    >
      <CsrfField csrf={csrf} />
      <button className={KEYS_REVOKE} type="submit" disabled={sending} aria-label={`Revoke ${keyRow.name}`}>
        Revoke
      </button>
    </form>
  );
}

/** The account's live keys (board 28; one card per key on a phone, 28m), or nothing while it has none. */
export function KeyTable() {
  const { keys } = useFlow();
  if (keys.length === 0) return null;
  return (
    <div className={DASH_KEYS_CARD}>
      <table className={KEYS_TABLE}>
        <thead className={KEYS_HEAD_ROW}>
          <tr>
            <th className={KEYS_HEAD} scope="col">
              Name
            </th>
            <th className={KEYS_HEAD} scope="col">
              Key
            </th>
            <th className={KEYS_HEAD} scope="col">
              Endpoints
            </th>
            <th className={KEYS_HEAD} scope="col">
              Expires
            </th>
            <th className={KEYS_HEAD} scope="col">
              Created
            </th>
            <th className={KEYS_HEAD} scope="col">
              Last used
            </th>
            <th className={KEYS_HEAD} scope="col">
              <span className="sr-only">Revoke</span>
            </th>
          </tr>
        </thead>
        <tbody className={KEYS_BODY}>
          {keys.map((key) => (
            <tr key={key.keyId} className={KEYS_ROW} data-key-id={key.keyId}>
              <td className={KEYS_NAME}>{key.name}</td>
              <td className={KEYS_PREFIX}>{key.prefix}</td>
              <td className={KEYS_ENDPOINTS}>
                {key.endpoints.kind === "all" ? endpointsText(key.endpoints) : <span className={KEYS_ENDPOINT_NAMES}>{endpointsText(key.endpoints)}</span>}
              </td>
              <td className={KEYS_EXPIRES}>
                <span className={KEYS_PHONE_LABEL}>Expires </span>
                {key.expires}
              </td>
              <td className={KEYS_CREATED}>
                <span className={KEYS_PHONE_LABEL}>Created </span>
                {key.created}
              </td>
              <td className={KEYS_LAST_USED}>
                <span className={KEYS_PHONE_LABEL}>{" · Last used "}</span>
                {key.lastUsed}
              </td>
              <td className={KEYS_PHONE_BREAK} aria-hidden="true" />
              <td className={KEYS_ACTION}>
                <RevokeForm keyRow={key} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
