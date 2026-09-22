import assert from "node:assert/strict";
import test from "node:test";
import { DIGEST_CHAR_LIMIT, type RepoDigest } from "./github";
import { fitDigest, summarizeSource } from "./summarize";

function digest(body: string): RepoDigest {
  return {
    owner: "acme",
    repo: "widget",
    defaultBranch: "main",
    description: "A widget.",
    language: "TypeScript",
    stars: 1,
    license: "MIT",
    topics: [],
    fileCount: 3,
    directoryCount: 1,
    topLevel: [{ name: "src", kind: "dir" }],
    extensions: [{ ext: ".ts", count: 1 }],
    notablePaths: ["src/index.ts"],
    readme: "# widget",
    keyFiles: [
      { path: "package.json", content: body },
      { path: "src/index.ts", content: body },
    ],
    treeTruncated: false,
    omissions: ["Skipped lockfiles: package-lock.json."],
    manifests: ["package.json"],
    entryPoints: ["src/index.ts"],
    configPaths: [],
    moduleRoots: ["src"],
    lockfiles: ["package-lock.json"],
  };
}

test("summarizeSource keeps a short file and extracts signals from a long one", () => {
  assert.equal(summarizeSource("src/a.ts", "export const a = 1;\n"), "export const a = 1;\n");
  const long = ["// header", "export function run() {", "  return 1;", "}", "x".repeat(2_000)].join("\n");
  const summary = summarizeSource("src/a.ts", long);
  assert.ok(summary.length < long.length);
  assert.match(summary, /Deterministic summary of src\/a\.ts/);
  assert.match(summary, /export function run/);
});

test("fitDigest stays inside the character budget and records the summary omission", () => {
  const fitted = fitDigest(digest(`${"export const value = 1;\n".repeat(800)}`));
  assert.ok(fitted.text.length <= DIGEST_CHAR_LIMIT + "\n…[digest truncated]".length);
  assert.match(fitted.digest.omissions.join("\n"), /deterministic summaries|clipped to 24000/i);
  assert.match(fitted.digest.omissions.join("\n"), /package-lock\.json/);
  assert.equal(fitted.text.includes("export const value"), true);
});
