/** The shape of a Worker's fetch handler, as vinext's App Router entry exports it. */
export type FetchHandler<E> = (request: Request, env: E, ctx: ExecutionContext) => Promise<Response>;
