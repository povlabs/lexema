"use client";

// The dashboard's key flow, in place (#187): Create key, Revoke and Delete
// account change the page where it stands instead of loading another. Each
// sends its action with fetch (dashboardActions.ts), through the session,
// Origin, CSRF and key-creation checks. Where each stands is a value in
// keyFlow.ts; this file wires those values to Base UI (ADR 0010).
//
// Create key opens board 28b; the new key then takes the same dialog's place
// (28e), with its secret, which lives only in this page's memory and goes
// when the dialog closes, and the key list gains the new row. Closing it says
// "Key “…” created" in a toast (28f). Revoke asks first (28d); Revoke key
// takes the row away and says so in a toast, or says in one why it could
// not. Delete account asks first (30); deleting ends the session, so the
// page then goes where signing out goes.

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog } from "@base-ui/react/dialog";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { defaultKeyName } from "./createKeyForm.ts";
import { CreateKeyForm, KeyResult } from "./CreateKeyDialog";
import { CREATE_KEY_ACTION, CSRF_FIELD, revokeKeyAction, sendAction } from "./dashboardActions.ts";
import { DashboardModal } from "./DashboardModal";
import { DashboardToasts, useShowToast } from "./DashboardToasts";
import { deleteWarning, endpointsText, type KeyRow } from "./dashboardView.ts";
import { DeleteAccount } from "./DeleteAccountDialog";
import { answeredKeyStep, closeKeyStep, KEY_ASKING, KEY_CLOSED, REVOKE_IDLE, revokeAfter, revokeToast, type KeyStep, type RevokeStep } from "./keyFlow.ts";
import { RevokeKey } from "./RevokeKeyDialog";
import {
  CONFIRM_BOX,
  CREATE_KEY_BOX,
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

/** The dashboard's live keys, key count and toasts, around the page (`children`). */
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
  return (
    <FlowContext.Provider value={flow}>
      <DashboardToasts>{children}</DashboardToasts>
    </FlowContext.Provider>
  );
}

/** Create key, and the dialog it opens: the form (board 28b), then, in its place, the new key (28e). */
export function CreateKeyControl({ className }: { className: string }) {
  const { made, csrf, created } = useFlow();
  const showToast = useShowToast();
  const [step, setStep] = useState<KeyStep>(KEY_CLOSED);
  // The step an answer lands on: it arrives after renders this closure never saw.
  const live = useRef(step);
  const move = (next: KeyStep) => {
    live.current = next;
    setStep(next);
  };

  const send = (fields: URLSearchParams) => {
    fields.set(CSRF_FIELD, csrf);
    move({ kind: "asking", status: { kind: "sending" } });
    void sendAction(CREATE_KEY_ACTION, fields).then((answer) => {
      if (answer.outcome === "created") created(answer.key);
      move(answeredKeyStep(live.current, answer));
    });
  };

  return (
    <Dialog.Root
      open={step.kind !== "closed"}
      onOpenChange={(open) => {
        if (open) return move(KEY_ASKING);
        const closing = closeKeyStep(live.current);
        move(closing.step);
        if (closing.toast !== undefined) showToast(closing.toast);
      }}
    >
      <Dialog.Trigger className={className}>Create key</Dialog.Trigger>
      <DashboardModal className={CREATE_KEY_BOX}>
        {step.kind === "created" && <KeyResult keyRow={step.key} secret={step.secret} />}
        {step.kind === "asking" && (
          <CreateKeyForm
            defaultName={defaultKeyName(made)}
            status={step.status}
            onEdit={() => {
              if (live.current.kind === "asking" && live.current.status.kind !== "sending") move(KEY_ASKING);
            }}
            onSend={send}
          />
        )}
      </DashboardModal>
    </Dialog.Root>
  );
}

/** Delete account, and the confirmation it opens (board 30). */
export function DeleteAccountControl({ className }: { className: string }) {
  const { keys, csrf } = useFlow();
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger className={className}>Delete account</AlertDialog.Trigger>
      <DashboardModal className={CONFIRM_BOX}>
        <DeleteAccount warning={deleteWarning(keys.length)} csrf={csrf} />
      </DashboardModal>
    </AlertDialog.Root>
  );
}

/** A key's Revoke, and the confirmation it opens (board 28d); the answer is a toast (28f). */
function RevokeControl({ keyRow }: { keyRow: KeyRow }) {
  const { csrf, revoked } = useFlow();
  const showToast = useShowToast();
  const [step, setStep] = useState<RevokeStep>(REVOKE_IDLE);
  const act = (event: "ask" | "cancel" | "confirm") => {
    const next = revokeAfter(step, event);
    setStep(next.step);
    if (!next.send) return;
    void sendAction(revokeKeyAction(keyRow.keyId), new URLSearchParams({ [CSRF_FIELD]: csrf })).then((answer) => {
      showToast(revokeToast(keyRow.name, answer));
      if (answer.outcome === "revoked") revoked(keyRow.keyId);
      else setStep(REVOKE_IDLE);
    });
  };
  return (
    <AlertDialog.Root open={step.kind === "asking"} onOpenChange={(open) => act(open ? "ask" : "cancel")}>
      <AlertDialog.Trigger className={KEYS_REVOKE} aria-label={`Revoke ${keyRow.name}`}>
        Revoke
      </AlertDialog.Trigger>
      <DashboardModal className={CONFIRM_BOX}>
        <RevokeKey keyRow={keyRow} onConfirm={() => act("confirm")} />
      </DashboardModal>
    </AlertDialog.Root>
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
                <RevokeControl keyRow={key} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
