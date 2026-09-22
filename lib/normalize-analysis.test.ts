import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { RepoDigest } from "./github";
import { readMermaidSource } from "./mermaid-text";
import { analysisShapeErrorMessage, normalizeAnalysis } from "./normalize-analysis";
import { analyzeResultSchema } from "./schemas";

const UNSAFE_SOURCE = /<\s*script\b|javascript:|on\w+\s*=/i;

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
      { name: "<script>alert(1)</script>", kind: "dir" },
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

test("normalizes empty mermaid and empty stack into a parseable analysis", () => {
  const bad = {
    description: "  from the model  ",
    explain: {
      summary: "  Explains the widget library in plain English.  ",
      purpose: "  Help a developer start reading. ",
      audience: " Developers new to the repo. ",
      stack: ["", "   "],
      highlights: [" ", ""],
    },
    mermaid: "",
    run: {
      prerequisites: [" Node.js 22 ", ""],
      steps: [{ title: "   ", detail: "  " }],
      keyPaths: [{ path: "  ", why: "  " }],
    },
  };

  const normalized = normalizeAnalysis(bad, digest());
  const parsed = analyzeResultSchema.safeParse(normalized);

  assert.equal(parsed.success, true);
  if (!parsed.success) {
    return;
  }
  assert.equal(parsed.data.explain.summary, "Explains the widget library in plain English.");
  assert.deepEqual(parsed.data.explain.stack, ["acme/widget: A small widget library."]);
  assert.deepEqual(parsed.data.explain.highlights, ["acme/widget: A small widget library."]);
  assert.equal(parsed.data.run.prerequisites.length, 1);
  assert.equal(parsed.data.run.steps[0]?.title, "Open package.json");
  assert.equal(parsed.data.run.keyPaths[0]?.path, "package.json");
  assert.match(parsed.data.mermaid, /^flowchart TD/);
  assert.match(parsed.data.mermaid, /src\//);
  assert.match(parsed.data.mermaid, /app\//);
  assert.match(parsed.data.masterPrompt, /## 1\. Identity/);
  assert.match(parsed.data.masterPrompt, /## 9\. Honesty/);
  assert.match(parsed.data.masterPrompt, /ChatGPT-astra/);
  assert.deepEqual(parsed.data.omissions, []);
  assert.equal(UNSAFE_SOURCE.test(parsed.data.mermaid), false);
  assert.equal(readMermaidSource(parsed.data.mermaid), parsed.data.mermaid);
});

test("keeps a fenced diagram and fills a blank stack from the digest", () => {
  const normalized = normalizeAnalysis(
    {
      explain: {
        summary: "Summary",
        purpose: "Purpose",
        audience: "Developers",
        stack: [],
        highlights: ["Uses the README."],
      },
      mermaid: "```mermaid\nflowchart LR\n  a[Readme] --> b[Source]\n```",
      run: {
        prerequisites: [],
        steps: [{ title: "Install", detail: "npm install" }],
        keyPaths: [{ path: "src/index.ts", why: "Entry" }],
      },
    },
    digest(),
  );
  const parsed = analyzeResultSchema.safeParse(normalized);
  assert.equal(parsed.success, true);
  if (!parsed.success) {
    return;
  }
  assert.equal(parsed.data.mermaid, "flowchart LR\n  a[Readme] --> b[Source]");
  assert.deepEqual(parsed.data.explain.stack, ["acme/widget: A small widget library."]);
  assert.equal(parsed.data.run.keyPaths[0]?.path, "src/index.ts");
});

test("replaces script and javascript mermaid and still parses", () => {
  const normalized = normalizeAnalysis(
    {
      explain: {
        summary: " \n ",
        purpose: "\t",
        audience: "",
        stack: ["TypeScript"],
        highlights: [],
      },
      mermaid: 'flowchart TD\n  a["<script>alert(1)</script>"]\n  b["javascript:alert(1)"]',
      run: {
        prerequisites: [],
        steps: [{ title: " Install ", detail: " \n " }],
        keyPaths: [],
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
  assert.equal(parsed.data.explain.purpose, "acme/widget: See README");
  assert.equal(parsed.data.explain.audience, "acme/widget: See README");
  assert.deepEqual(parsed.data.explain.highlights, ["acme/widget: See README"]);
  assert.equal(parsed.data.run.steps[0]?.title, "Install");
  assert.equal(parsed.data.run.steps[0]?.detail, "acme/widget: See README");
  assert.equal(UNSAFE_SOURCE.test(parsed.data.mermaid), false);
  assert.doesNotMatch(parsed.data.mermaid, /script|javascript:|onclick/i);
  assert.match(parsed.data.mermaid, /src\//);
});

test("shape error names the first zod issue path and message", () => {
  const parsed = analyzeResultSchema.safeParse({
    owner: "acme",
    repo: "widget",
    defaultBranch: "main",
    description: "",
    source: "live",
    explain: {
      summary: "Summary",
      purpose: "Purpose",
      audience: "Developers",
      stack: ["TypeScript"],
      highlights: ["A highlight"],
    },
    masterPrompt: "Rebuild the widget from the digest.",
    omissions: [],
    mermaid: "",
    run: {
      prerequisites: [],
      steps: [{ title: "Install", detail: "npm install" }],
      keyPaths: [{ path: "package.json", why: "Manifest" }],
    },
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
    /^The model returned an analysis that did not match the expected shape\. mermaid: /,
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
        summary: "Summary",
        purpose: "Purpose",
        audience: "Developers",
        stack: ["TypeScript"],
        highlights: ["Uses the README."],
      },
      mermaid: "flowchart TD\n  a[Readme] --> b[Source]",
      run: {
        prerequisites: [],
        steps: [{ title: "Install", detail: "npm install" }],
        keyPaths: [{ path: "package.json", why: "Manifest" }],
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

test("default model stays gpt-5.6-luna", () => {
  const source = readFileSync(new URL("./openai.ts", import.meta.url), "utf8");
  assert.match(source, /const DEFAULT_MODEL = "gpt-5\.6-luna"/);
  assert.match(source, /AbortSignal\.timeout\(50_000\)/);
  assert.match(source, /throw new AnalysisError\(analysisShapeErrorMessage\(parsed\.error\), 502\)/);
});
