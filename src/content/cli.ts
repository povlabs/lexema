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
const report = convertRelease({ database: args.get("database"), output: args.get("output") });
process.stdout.write([
  `files   ${report.files}`,
  `words   ${report.words}`,
  `records ${report.records}`,
  `bytes   ${report.bytes}`,
].join("\n") + "\n");
