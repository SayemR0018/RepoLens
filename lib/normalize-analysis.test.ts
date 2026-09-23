import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { RepoDigest } from "./github";
import { analysisShapeErrorMessage, normalizeAnalysis } from "./normalize-analysis";
import { analyzeResultSchema } from "./schemas";

function digest(overrides: Partial<RepoDigest> = {}): RepoDigest {
  return {
    owner: "acme",
    repo: "widget",
    defaultBranch: "main",
    description: "A small widget library.",
    language: "TypeScript",
    stars: 3,
    license: "MIT",
    topics: [],
    fileCount: 4,
    directoryCount: 2,
    topLevel: [
      { name: "src", kind: "dir" },
      { name: "app", kind: "dir" },
      { name: "README.md", kind: "file" },
    ],
    extensions: [{ ext: ".ts", count: 2 }],
    notablePaths: ["src/index.ts"],
    readme: "# widget",
    keyFiles: [{ path: "package.json", content: "{}" }],
    treeTruncated: false,
    omissions: [],
    manifests: ["package.json"],
    entryPoints: ["src/index.ts"],
    configPaths: [],
    moduleRoots: ["src"],
    lockfiles: [],
    ...overrides,
  };
}

test("clips a long summary and fills an empty stack from the digest", () => {
  const normalized = normalizeAnalysis(
    {
      description: "  from the model  ",
      explain: {
        summary:
          "First sentence about the widget. Second sentence about the library. Third sentence about the digest. Fourth sentence about the branch. Fifth sentence should be dropped. Sixth sentence should be dropped.",
        purpose: "Help a developer start reading.",
        audience: "Developers new to the repo.",
        stack: ["", "   "],
        highlights: ["A long highlight that should not surface."],
      },
      mermaid: "flowchart TD\n  a --> b",
      run: {
        prerequisites: ["Node.js 22"],
        steps: [{ title: "Install", detail: "npm install" }],
        keyPaths: [{ path: "package.json", why: "Manifest" }],
      },
    },
    digest(),
  );
  const parsed = analyzeResultSchema.safeParse(normalized);

  assert.equal(parsed.success, true);
  if (!parsed.success) {
    return;
  }
  assert.equal(
    parsed.data.explain.summary,
    "First sentence about the widget. Second sentence about the library. Third sentence about the digest. Fourth sentence about the branch.",
  );
  assert.deepEqual(parsed.data.explain.stack, ["acme/widget: A small widget library."]);
  assert.deepEqual(Object.keys(parsed.data.explain).sort(), ["stack", "summary"]);
  assert.equal("mermaid" in parsed.data, false);
  assert.equal("run" in parsed.data, false);
  assert.match(parsed.data.masterPrompt, /## 1\. Identity/);
  assert.match(parsed.data.masterPrompt, /## 9\. Honesty/);
  assert.match(parsed.data.masterPrompt, /expert software engineer rebuilding this repository/);
  assert.equal(/astra|chatgpt/i.test(parsed.data.masterPrompt), false);
  assert.deepEqual(parsed.data.omissions, []);
});

test("fills a blank summary and stack from the digest", () => {
  const normalized = normalizeAnalysis(
    {
      explain: {
        summary: " \n ",
        stack: [],
      },
    },
    digest({ description: "  " }),
  );
  const parsed = analyzeResultSchema.safeParse(normalized);
  assert.equal(parsed.success, true);
  if (!parsed.success) {
    return;
  }
  assert.equal(parsed.data.explain.summary, "acme/widget: See README");
  assert.deepEqual(parsed.data.explain.stack, ["acme/widget: See README"]);
});

test("keeps a short stack and ignores extra report fields", () => {
  const normalized = normalizeAnalysis(
    {
      explain: {
        summary: "Summary of the widget. It is a small library.",
        purpose: "Purpose",
        audience: "Developers",
        stack: ["TypeScript", "Node.js"],
        highlights: ["Uses the README."],
      },
    },
    digest(),
  );
  const parsed = analyzeResultSchema.safeParse(normalized);
  assert.equal(parsed.success, true);
  if (!parsed.success) {
    return;
  }
  assert.equal(parsed.data.explain.summary, "Summary of the widget. It is a small library.");
  assert.deepEqual(parsed.data.explain.stack, ["TypeScript", "Node.js"]);
});

test("shape error names the first zod issue path and message", () => {
  const parsed = analyzeResultSchema.safeParse({
    owner: "acme",
    repo: "widget",
    defaultBranch: "main",
    description: "",
    source: "live",
    explain: {
      summary: "Summary of the widget.",
      stack: ["TypeScript"],
    },
    masterPrompt: "   ",
    omissions: [],
  });
  assert.equal(parsed.success, false);
  if (parsed.success) {
    return;
  }
  const issue = parsed.error.issues[0];
  assert.ok(issue);
  assert.equal(
    analysisShapeErrorMessage(parsed.error),
    `The model returned an analysis that did not match the expected shape. ${issue.path.join(".")}: ${issue.message}`,
  );
  assert.match(
    analysisShapeErrorMessage(parsed.error),
    /^The model returned an analysis that did not match the expected shape\. masterPrompt: /,
  );
});

test("model sections override the digest fallback and honesty stays server-owned", () => {
  const normalized = normalizeAnalysis(
    {
      master: {
        identity: "Custom identity for the widget.",
        stack: "",
        honesty: "The model must not hide a skipped lockfile.",
      },
      explain: {
        summary: "Summary of the widget.",
        stack: ["TypeScript"],
      },
    },
    digest({ omissions: ["Skipped lockfiles: package-lock.json."] }),
  );
  const parsed = analyzeResultSchema.safeParse(normalized);
  assert.equal(parsed.success, true);
  if (!parsed.success) {
    return;
  }
  assert.match(parsed.data.masterPrompt, /Custom identity for the widget/);
  assert.match(parsed.data.masterPrompt, /## 2\. Stack & dependencies/);
  assert.match(parsed.data.masterPrompt, /## 5\. Runtime/);
  assert.match(parsed.data.masterPrompt, /## 8\. Rebuild order/);
  assert.match(parsed.data.masterPrompt, /Skipped lockfiles: package-lock\.json/);
  assert.equal(parsed.data.masterPrompt.includes("must not hide"), false);
  assert.deepEqual(parsed.data.omissions, ["Skipped lockfiles: package-lock.json."]);
});

test("default model stays gpt-5.6-luna and the prompt does not request removed panels", () => {
  const openai = readFileSync(new URL("./openai.ts", import.meta.url), "utf8");
  const schemas = readFileSync(new URL("./schemas.ts", import.meta.url), "utf8");
  assert.match(openai, /const DEFAULT_MODEL = "gpt-5\.6-luna"/);
  assert.match(openai, /AbortSignal\.timeout\(50_000\)/);
  assert.match(openai, /throw new AnalysisError\(analysisShapeErrorMessage\(parsed\.error\), 502\)/);
  for (const source of [openai, schemas]) {
    assert.equal(/mermaid|howToRun|RunGuide|\bDiagram\b/i.test(source), false);
  }
});
