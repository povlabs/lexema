// Entry point of .github/workflows/preview-marker.yml's smoke job, run with
// plain `node` and no install. The steps are previewSmokeCommand.ts's; what to
// smoke is the announce job's `announced` output, in `ANNOUNCED`.

import { setTimeout as sleep } from "node:timers/promises";
import { readAnnouncedOutput } from "./previewMarkerCommand.ts";
import { restSmokeGitHub, smokePreview } from "./previewSmokeCommand.ts";

const log = (line: string) => process.stderr.write(`${line}\n`);

/** How long one request to a preview site may take. */
const REQUEST_TIMEOUT_MS = 20_000;
/** The marker has just seen the sites answer, so a request that gets none is retried briefly. */
const ATTEMPTS = 3;
const WAIT_MS = 10_000;

try {
  const { sha, pullRequests } = readAnnouncedOutput(process.env.ANNOUNCED ?? "");
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  const runId = process.env.GITHUB_RUN_ID;
  await smokePreview({
    sha,
    pullRequests,
    github: restSmokeGitHub(process.env.GITHUB_TOKEN ?? "", repository, fetch),
    fetchPage: async (url, headers) => {
      const response = await fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      return {
        status: response.status,
        robotsTag: response.headers.get("x-robots-tag") ?? undefined,
        contentType: response.headers.get("content-type") ?? undefined,
        body: await response.text(),
      };
    },
    attempts: ATTEMPTS,
    wait: () => sleep(WAIT_MS),
    detailsUrl: runId === undefined ? undefined : `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${repository}/actions/runs/${runId}`,
    log,
  });
} catch (error) {
  log(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
