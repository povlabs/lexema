// The Workers Builds deploy command on `main` (ADR 0018, docs/DEPLOY.md): the
// sweep, then the production build and `wrangler deploy`. The sweep is
// housekeeping, so however it ends, production still deploys.

export interface ProductionCommandSteps {
  sweep(): Promise<unknown>;
  /** The production build and `wrangler deploy`; throws when either fails. */
  deploy(): void;
  log(line: string): void;
}

/** Run the sweep, then deploy, whether or not the sweep succeeded. */
export async function runProductionCommand({ sweep, deploy, log }: ProductionCommandSteps): Promise<void> {
  try {
    await sweep();
  } catch (error) {
    log(`sweep failed, deploying anyway: ${error instanceof Error ? error.message : String(error)}`);
  }
  deploy();
}
