import { convertRelease } from "./converter.js";

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  const value = process.argv[i + 1];
  if (key?.startsWith("--") && value !== undefined && !value.startsWith("--")) {
    args.set(key.slice(2), value);
    i += 1;
  }
}
// A count says a line was refused; only the location says which. Non-Italian
// lines are refused by the million and are not news, so they stay counted.
const shown = 50;
let located = 0;
const report = await convertRelease({
  input: args.get("input"),
  output: args.get("output"),
  releaseId: args.get("release-id"),
  onRejection: (rejection) => {
    if (rejection.kind === "other-language") return;
    located += 1;
    if (located <= shown) process.stderr.write(`${rejection.kind} line ${rejection.lineNo}: ${rejection.reason}\n`);
  },
});
if (located > shown) process.stderr.write(`${located - shown} further refused lines not listed\n`);
process.stdout.write([
  `files   ${report.files}`,
  `words   ${report.words}`,
  `records ${report.records}`,
  `bytes   ${report.bytes}`,
  `lines   ${report.linesRead}`,
  `skipped ${report.skippedOtherLanguage}`,
  `malformed ${report.malformed}`,
  `members ${report.malformedMembers}`,
].join("\n") + "\n");
