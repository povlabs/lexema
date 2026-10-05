// The Workers Builds deploy command on the `production` branch (ADR 0018,
// docs/DEPLOY.md): the sweep, then the app migrations on production's app
// database (#611), then the production build and `wrangler deploy`. The sweep
// is housekeeping, so however it ends, production still deploys. The
// migrations are not: when they fail or are refused, nothing deploys, so the
// new code never runs on an older schema.

export interface ProductionCommandSteps {
  sweep(): Promise<unknown>;
  /** Apply the pending app migrations to production's app database; throws when that fails or is refused. */
  migrate(): void;
  /** The production build and `wrangler deploy`; throws when either fails. */
  deploy(): void;
  log(line: string): void;
}

/** Run the sweep, then the migrations, then deploy: after the sweep whatever its outcome, and only once the migrations succeeded. */
export async function runProductionCommand({ sweep, migrate, deploy, log }: ProductionCommandSteps): Promise<void> {
  try {
    await sweep();
  } catch (error) {
    log(`sweep failed, deploying anyway: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    migrate();
  } catch (error) {
    throw new Error(`app migrations failed, so production is not deployed: ${error instanceof Error ? error.message : String(error)}`);
  }
  deploy();
}
