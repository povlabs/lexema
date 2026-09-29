"use client";

// The dashboard's key flow, in place (#187): Create key, Revoke and Delete
// account change the page where it stands instead of loading another. Each
// sends its action with fetch (dashboardActions.ts), through the session,
// Origin, CSRF and key-creation checks.
//
// Create key opens board 28b; a new key closes it and opens board 29 with its
// secret, which lives only in this page's memory and goes when that dialog
// closes, and the key list gains the new row. Revoke takes the row away.
// Delete account opens board 30; deleting ends the session, so the page then
// goes where signing out goes. The dialogs are Base UI's (ADR 0010,
// DashboardModal.tsx), and whether each is open is held here.

import { Dialog } from "@base-ui/react/dialog";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { defaultKeyName } from "./createKeyForm.ts";
import { CreateKeyForm } from "./CreateKeyDialog";
import { CSRF_FIELD, revokeKeyAction, sendAction, UNREACHABLE } from "./dashboardActions.ts";
import { DashboardModal } from "./DashboardModal";
import { deleteWarning, endpointsText, type KeyRow } from "./dashboardView.ts";
import { DeleteAccount } from "./DeleteAccountDialog";
import { KeyCreated } from "./KeyCreated";
import {
  CREATE_KEY_BOX,
  DASH_KEYS_CARD,
  DELETE_BOX,
  KEY_CREATED_BOX,
  KEYS_ACTION,
  KEYS_BODY,
  KEYS_CREATED,
  KEYS_ENDPOINT_NAMES,
  KEYS_ENDPOINTS,
  KEYS_EXPIRES,
  KEYS_FAILURE,
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

interface Flow {
  readonly keys: readonly KeyRow[];
  /** Every key the account has made, revoked ones too: the next default name's number. */
  readonly made: number;
  readonly csrf: string;
  created(key: KeyRow): void;
  revoked(keyId: number): void;
}

const FlowContext = createContext<Flow | undefined>(undefined);

function useFlow(): Flow {
  const flow = useContext(FlowContext);
  if (flow === undefined) throw new Error("a dashboard control is drawn outside DashboardFlow");
  return flow;
}

/** The dashboard's live keys and key count, around the page (`children`). */
export function DashboardFlow({
  keys: firstKeys,
  made: firstMade,
  csrf,
  children,
}: {
  keys: readonly KeyRow[];
  made: number;
  csrf: string;
  children: ReactNode;
}) {
  const [keys, setKeys] = useState(firstKeys);
  const [made, setMade] = useState(firstMade);
  const created = useCallback((key: KeyRow) => {
    setKeys((live) => [...live, key]);
    setMade((count) => count + 1);
  }, []);
  const revoked = useCallback((keyId: number) => setKeys((live) => live.filter((key) => key.keyId !== keyId)), []);
  const flow = useMemo<Flow>(() => ({ keys, made, csrf, created, revoked }), [keys, made, csrf, created, revoked]);
  return <FlowContext.Provider value={flow}>{children}</FlowContext.Provider>;
}

/** Where making a key stands: no dialog, board 28b open, or board 29 open with the new key's secret. */
type KeyStep =
  | { readonly kind: "closed" }
  | { readonly kind: "asking" }
  | { readonly kind: "created"; readonly name: string; readonly secret: string };

const CLOSED: KeyStep = { kind: "closed" };

/** Create key, and the two dialogs it leads to: the form (board 28b), then the new key's secret (board 29). */
export function CreateKeyControl({ className }: { className: string }) {
  const { made, csrf, created } = useFlow();
  const [step, setStep] = useState<KeyStep>(CLOSED);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Dialog.Root
        open={step.kind === "asking"}
        onOpenChange={(open) => setStep((now) => (open ? { kind: "asking" } : now.kind === "asking" ? CLOSED : now))}
      >
        <Dialog.Trigger ref={trigger} className={className}>
          Create key
        </Dialog.Trigger>
        <DashboardModal className={CREATE_KEY_BOX}>
          <CreateKeyForm
            defaultName={defaultKeyName(made)}
            csrf={csrf}
            onCreated={(key, secret) => {
              created(key);
              setStep({ kind: "created", name: key.name, secret });
            }}
          />
        </DashboardModal>
      </Dialog.Root>
      <Dialog.Root open={step.kind === "created"} onOpenChange={(open) => !open && setStep(CLOSED)}>
        <DashboardModal className={KEY_CREATED_BOX} finalFocus={trigger}>
          {step.kind === "created" && <KeyCreated name={step.name} secret={step.secret} />}
        </DashboardModal>
      </Dialog.Root>
    </>
  );
}

/** Delete account, and the confirmation it opens (board 30). */
export function DeleteAccountControl({ className }: { className: string }) {
  const { keys, csrf } = useFlow();
  return (
    <Dialog.Root>
      <Dialog.Trigger className={className}>Delete account</Dialog.Trigger>
      <DashboardModal className={DELETE_BOX}>
        <DeleteAccount warning={deleteWarning(keys.length)} csrf={csrf} />
      </DashboardModal>
    </Dialog.Root>
  );
}

/** Revoke: the row taken away in place, or, refused, the reason said under the table. */
function RevokeButton({ keyRow, onRefused }: { keyRow: KeyRow; onRefused: (message: string) => void }) {
  const { csrf, revoked } = useFlow();
  const [sending, setSending] = useState(false);
  return (
    <button
      className={KEYS_REVOKE}
      type="button"
      disabled={sending}
      aria-label={`Revoke ${keyRow.name}`}
      onClick={() => {
        setSending(true);
        void sendAction(revokeKeyAction(keyRow.keyId), new URLSearchParams({ [CSRF_FIELD]: csrf })).then((answer) => {
          setSending(false);
          if (answer.outcome === "revoked") revoked(keyRow.keyId);
          else onRefused(answer.outcome === "refused" ? answer.message : UNREACHABLE);
        });
      }}
    >
      Revoke
    </button>
  );
}

/** The account's live keys (board 28; one card per key on a phone, 28m), or nothing while it has none. */
export function KeyTable() {
  const { keys } = useFlow();
  const [refusal, setRefusal] = useState<string | undefined>(undefined);
  if (keys.length === 0) return null;
  return (
    <>
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
                  <RevokeButton keyRow={key} onRefused={setRefusal} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {refusal !== undefined && (
        <p className={KEYS_FAILURE} role="alert">
          {refusal}
        </p>
      )}
    </>
  );
}
