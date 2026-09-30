// Entry point of .github/workflows/preview-marker.yml's announce job, run with
// plain `node` and no install. The steps are previewMarkerCommand.ts's. What it
// announced goes to the job's `announced` output, which the smoke job reads.

import { appendFileSync, readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { announcedOutput, announcePreview, restGitHub } from "./previewMarkerCommand.ts";

const log = (line: string) => process.stderr.write(`${line}\n`);

/** How long one request to a preview site may take. */
const PROBE_TIMEOUT_MS = 10_000;
/** A new Preview's certificate can take a while (docs/DEPLOY.md); about five minutes in all. */
const ATTEMPTS = 10;
const WAIT_MS = 30_000;

try {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath === undefined) throw new Error("GITHUB_EVENT_PATH is not set; this runs in GitHub Actions");
  const outcome = await announcePreview({
    event: JSON.parse(readFileSync(eventPath, "utf8")),
    github: restGitHub(process.env.GITHUB_TOKEN ?? "", process.env.GITHUB_REPOSITORY ?? "", fetch),
    probe: async (url) => {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
      await response.body?.cancel();
      return { status: response.status, robotsTag: response.headers.get("x-robots-tag") ?? undefined };
    },
    attempts: ATTEMPTS,
    wait: () => sleep(WAIT_MS),
    log,
  });
  const announced = announcedOutput(outcome);
  const outputPath = process.env.GITHUB_OUTPUT;
  if (announced !== undefined && outputPath !== undefined) appendFileSync(outputPath, `announced=${announced}\n`);
} catch (error) {
  log(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
