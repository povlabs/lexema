// Every log line the Worker writes names the request it came from (#413).
//
// Workers Logs keeps what `console` prints (docs/RUN_THE_SITE.md, "What is
// logged"). The Worker runs each request inside `inRequest`
// (web/worker/shared/requestLog.ts), and `log` adds that request's id to the fields
// of every line, so one failure's lines can be found together, and a reader
// quoting the id of a failed page can be matched to them.
//
// What a line carries is the caller's to keep small: a message, a few fields
// naming what failed, and the failure itself. Never a search string, an
// address or an email, whose absence the callers keep and the doc states.
// Outside a request, as in a test or a CLI, a line is exactly what was passed.

import { AsyncLocalStorage } from "node:async_hooks";

const current = new AsyncLocalStorage<string>();

/** Run `work` as the request `requestId`, so every line it logs names it. */
export const inRequest = <T>(requestId: string, work: () => T): T => current.run(requestId, work);

/** The id of the request being answered, or undefined outside one. */
export const currentRequestId = (): string | undefined => current.getStore();

/** What a line names besides its message: plain values, never the reader's input. */
export type LogFields = Readonly<Record<string, unknown>>;

const withRequestId = (fields: LogFields): LogFields => {
  const requestId = current.getStore();
  return requestId === undefined ? fields : { requestId, ...fields };
};

type Write = (message: string, ...rest: unknown[]) => void;

const line =
  (write: () => Write) =>
  (message: string, fields: LogFields = {}, failure?: unknown): void => {
    const named = withRequestId(fields);
    if (failure === undefined) write()(message, named);
    else write()(message, named, failure);
  };

/** The Worker's log: `console`'s levels, each line naming the request. */
export const log = {
  error: line(() => console.error),
  warn: line(() => console.warn),
  info: line(() => console.info),
};
