// The create-key form (#187, boards 28b and 28c) as a value: what it holds,
// whether it can be sent, and why not. The dialog holds a draft and sends it
// as form fields, the server reads those fields back into a draft, and both
// read its problems with `readDraft`, so the dialog's messages, its disabled
// Create key and the server's refusal never disagree about what a valid form
// is. A problem is never stored beside a draft, only read off it, so a message
// can never describe a value the form no longer holds.

import { ALL_ENDPOINTS, expiresAt, keyLifetime, onlyEndpoints, type EndpointScope, type KeyAccess, type KeyLifetime } from "@lexema/api/keyAccess.ts";
import { KEY_NAME_MAX, keyName, type KeyName } from "@lexema/api/ownedKeys.ts";
import { ENDPOINTS, type Endpoint } from "@lexema/api/units.ts";

/** The form's field carrying the key's name. */
export const KEY_NAME_FIELD = "name";
/** The choice between every endpoint and some (board 28b): `all` or `some`. */
export const ENDPOINT_SCOPE_FIELD = "endpoints";
export const ENDPOINT_SCOPE = { all: "all", some: "some" } as const;
/** The checklist (board 28c): one `endpoint` field per endpoint ticked. */
export const ENDPOINT_FIELD = "endpoint";
/** The expiry: one of `KEY_LIFETIMES`. */
export const EXPIRES_FIELD = "expires";

/** The form's fields, from a `FormData` or a `URLSearchParams`. */
export interface FormFields {
  get(name: string): FormDataEntryValue | null;
  getAll(name: string): FormDataEntryValue[];
}

/**
 * The create-key form as sent. A field the form leaves out reads as the
 * dialog's default: no name, All endpoints, Never. A value the dialog could
 * not have sent is kept as `unknown` (or, for a tick, as `strayTick`), so it
 * reads as a problem rather than as a default.
 */
export interface CreateKeyDraft {
  /** Trimmed (`nameOf`). Past `KEY_NAME_MAX + 1` characters it is cut there: still too long, and small enough to hold. */
  readonly name: string;
  readonly scope: "all" | "some" | "unknown";
  /** The endpoints ticked, each once, in the checklist's order. */
  readonly ticked: readonly Endpoint[];
  /** Whether a tick named something that is not an endpoint. */
  readonly strayTick: boolean;
  readonly expires: KeyLifetime | "unknown";
}

/** The dialog as it opens: board 28b's defaults. */
export const EMPTY_DRAFT: CreateKeyDraft = { name: "", scope: "all", ticked: [], strayTick: false, expires: "never" };

const text = (value: FormDataEntryValue | null): string | undefined => (typeof value === "string" ? value : undefined);

/** A typed name as a draft holds it: trimmed, and cut one character past the longest a name may be. */
export const nameOf = (typed: string): string => typed.trim().slice(0, KEY_NAME_MAX + 1);

/** The draft a posted form holds. */
export function draftOf(fields: FormFields): CreateKeyDraft {
  const scope = text(fields.get(ENDPOINT_SCOPE_FIELD)) ?? ENDPOINT_SCOPE.all;
  const sent = fields.getAll(ENDPOINT_FIELD).map((value) => (typeof value === "string" ? value : ""));
  const expires = text(fields.get(EXPIRES_FIELD)) ?? "never";
  return {
    name: nameOf(text(fields.get(KEY_NAME_FIELD)) ?? ""),
    scope: scope === ENDPOINT_SCOPE.all || scope === ENDPOINT_SCOPE.some ? scope : "unknown",
    ticked: ENDPOINTS.filter((endpoint) => sent.includes(endpoint)),
    strayTick: sent.some((value) => !(ENDPOINTS as readonly string[]).includes(value)),
    expires: keyLifetime(expires) ?? "unknown",
  };
}

/** The draft as the form fields the dialog sends: `draftOf` reads them back to the same draft. An `unknown` or a stray tick is written as an empty value. */
export function draftFields(draft: CreateKeyDraft): URLSearchParams {
  const fields = new URLSearchParams();
  fields.set(KEY_NAME_FIELD, draft.name);
  fields.set(ENDPOINT_SCOPE_FIELD, draft.scope === "unknown" ? "" : draft.scope);
  for (const endpoint of draft.ticked) fields.append(ENDPOINT_FIELD, endpoint);
  if (draft.strayTick) fields.append(ENDPOINT_FIELD, "");
  fields.set(EXPIRES_FIELD, draft.expires === "unknown" ? "" : draft.expires);
  return fields;
}

/** A field a problem sits under. */
export type CreateKeyField = "name" | "endpoints" | "expires";

/** Why the form cannot be sent as it is, said under the field at fault. */
export interface CreateKeyProblem {
  readonly field: CreateKeyField;
  readonly message: string;
}

/** At least one problem, at most one per field, in the form's order. */
export type CreateKeyProblems = readonly [CreateKeyProblem, ...CreateKeyProblem[]];

/** The name a key is asked for: the one typed, or, left empty, the default its account's count gives. */
export type RequestedName = { readonly kind: "typed"; readonly name: KeyName } | { readonly kind: "default" };

/** What a valid form asks for. */
export interface CreateKeyRequest {
  readonly name: RequestedName;
  readonly endpoints: EndpointScope;
  readonly lifetime: KeyLifetime;
}

export type CreateKeyReading = { readonly ok: true; readonly request: CreateKeyRequest } | { readonly ok: false; readonly problems: CreateKeyProblems };

export const NAME_TOO_LONG = `A key's name can be at most ${KEY_NAME_MAX} characters.`;
export const NOTHING_TICKED = "Tick at least one endpoint.";
export const NOT_AN_ENDPOINT = "That is not an endpoint.";
export const NO_SCOPE = "Choose All endpoints or Only some.";
export const NO_EXPIRY = "Choose when the key expires.";

/**
 * What a draft asks for, or every problem that stops it. Ticks are ignored
 * while All endpoints is chosen, as the dialog hides them.
 */
export function readDraft(draft: CreateKeyDraft): CreateKeyReading {
  const problems: CreateKeyProblem[] = [];

  let name: RequestedName = { kind: "default" };
  if (draft.name !== "") {
    const typed = keyName(draft.name);
    if (typed === undefined) problems.push({ field: "name", message: NAME_TOO_LONG });
    else name = { kind: "typed", name: typed };
  }

  let endpoints: EndpointScope = ALL_ENDPOINTS;
  if (draft.scope === "unknown") problems.push({ field: "endpoints", message: NO_SCOPE });
  else if (draft.scope === "some") {
    const only = draft.strayTick ? undefined : onlyEndpoints(draft.ticked);
    if (only === undefined) problems.push({ field: "endpoints", message: draft.strayTick ? NOT_AN_ENDPOINT : NOTHING_TICKED });
    else endpoints = only;
  }

  const lifetime = draft.expires === "unknown" ? undefined : draft.expires;
  const noExpiry: CreateKeyProblem = { field: "expires", message: NO_EXPIRY };
  if (lifetime === undefined) problems.push(noExpiry);

  const [first, ...rest] = problems;
  if (first === undefined && lifetime !== undefined) return { ok: true, request: { name, endpoints, lifetime } };
  // With no lifetime there is always a first problem: the expiry's own.
  return { ok: false, problems: [first ?? noExpiry, ...rest] };
}

/** The message a field shows, if it has a problem. */
export const problemAt = (problems: readonly CreateKeyProblem[], field: CreateKeyField): string | undefined =>
  problems.find((problem) => problem.field === field)?.message;

/** What a key asked for at `now` may reach, and until when. */
export const accessOf = (request: CreateKeyRequest, now: number): KeyAccess => ({
  endpoints: request.endpoints,
  expiresAt: expiresAt(request.lifetime, now),
});

/**
 * The name a key gets when its form leaves the name empty: `Key 1`, then
 * `Key 2`, counting every key the account has made, revoked ones too, so a
 * name is never handed out twice. Board 28b's hint names it in advance.
 */
export function defaultKeyName(made: number): KeyName {
  const name = keyName(`Key ${made + 1}`);
  if (name === undefined) throw new Error("a default key name is always a valid name");
  return name;
}

/**
 * Where the form stands in the dialog. `editing` until it is sent; while it
 * travels, `sending`; then either the dialog gives way to the new key, or it
 * stays open `refused` with the problems the server read off the sent form,
 * or `failed` for a reason that is no field's (the session, the CSRF token,
 * the key-creation limit, an outage). Any edit goes back to `editing`.
 */
export type CreateKeyStatus =
  | { readonly kind: "editing" }
  | { readonly kind: "sending" }
  | { readonly kind: "refused"; readonly problems: CreateKeyProblems }
  | { readonly kind: "failed"; readonly message: string };

/** The problems the dialog shows: the server's, for the form it refused, else the ones the draft has now. */
export function shownProblems(live: CreateKeyDraft, status: CreateKeyStatus): readonly CreateKeyProblem[] {
  if (status.kind === "refused") return status.problems;
  const reading = readDraft(live);
  return reading.ok ? [] : reading.problems;
}

/** Whether Create key can be pressed: the form holds a valid draft and is not already on its way. */
export const canSend = (live: CreateKeyDraft, status: CreateKeyStatus): boolean => status.kind !== "sending" && readDraft(live).ok;
