import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import type { RepoDigest } from "./github";
import {
  MASTER_SECTION_TITLES,
  assembleMasterPrompt,
  masterPromptHasAllSections,
  sectionsFromDigest,
} from "./masterPrompt";
import { buildMockResult, mockScaleFor } from "./mock";
import { analyzeResultSchema } from "./schemas";

function digest(): RepoDigest {
  return {
    owner: "acme",
    repo: "widget",
    defaultBranch: "main",
    description: "A small widget library.",
    language: "TypeScript",
    stars: 3,
    license: "MIT",
    topics: ["widgets"],
    fileCount: 4,
    directoryCount: 1,
    topLevel: [
      { name: "src", kind: "dir" },
      { name: "package.json", kind: "file" },
    ],
    extensions: [{ ext: ".ts", count: 1 }],
    notablePaths: ["package.json", "src/index.ts", ".env.example"],
    readme: "# widget\nBuild widgets.",
    keyFiles: [
      {
        path: "package.json",
        content: JSON.stringify({
          scripts: { build: "tsc", test: "node --test", start: "node dist/index.js" },
          dependencies: { zod: "^4.0.0" },
        }),
      },
      { path: ".env.example", content: "DATABASE_URL=\n" },
      { path: "src/index.ts", content: "export const ready = process.env.DATABASE_URL;\nfetch(ready);\n" },
    ],
    treeTruncated: false,
    omissions: [],
    manifests: ["package.json"],
    entryPoints: ["src/index.ts"],
    configPaths: [".env.example"],
    moduleRoots: ["src"],
    lockfiles: [],
  };
}

test("sections from a digest cover runtime, env, and a phased rebuild", () => {
  const sections = sectionsFromDigest(digest());
  const prompt = assembleMasterPrompt("acme", "widget", sections);
  assert.equal(masterPromptHasAllSections(prompt), true);
  assert.match(prompt, /You are an expert software engineer rebuilding this repository/);
  assert.match(prompt, /section 8/);
  assert.match(prompt, /section 9 wins/);
  assert.equal(/astra|chatgpt/i.test(prompt), false);
  const titles = MASTER_SECTION_TITLES.map((title) => prompt.indexOf(`## ${title}`));
  assert.deepEqual(titles, [...titles].sort((left, right) => left - right));
  assert.equal(titles.every((index) => index >= 0), true);
  assert.match(sections.stack, /zod/);
  assert.match(sections.runtime, /npm run build \(tsc\)/);
  assert.match(sections.runtime, /npm run test \(node --test\)/);
  assert.match(sections.runtime, /npm run start/);
  assert.match(sections.interfaces, /DATABASE_URL/);
  assert.match(sections.data, /fetch\(\)/);
  assert.match(sections.rebuildOrder, /Phase 1/);
  assert.match(sections.rebuildOrder, /Phase 5/);
  assert.match(sections.honesty, /selective sample/);
});

test("mock fixtures return a full master prompt and omissions on medium and mono", () => {
  assert.equal(mockScaleFor({ owner: "acme", repo: "widget" }), "small");
  assert.equal(mockScaleFor({ owner: "vercel", repo: "next.js" }), "medium");
  assert.equal(mockScaleFor({ owner: "acme", repo: "web-mono" }), "mono");

  const small = buildMockResult({ owner: "acme", repo: "widget" });
  const medium = buildMockResult({ owner: "fastapi", repo: "fastapi" });
  const mono = buildMockResult({ owner: "acme", repo: "workspace" });

  for (const result of [small, medium, mono]) {
    assert.equal(analyzeResultSchema.safeParse(result).success, true);
    assert.equal(result.source, "mock");
    for (const title of MASTER_SECTION_TITLES) {
      assert.match(result.masterPrompt, new RegExp(`## ${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    }
  }
  assert.deepEqual(small.omissions, []);
  assert.ok(medium.omissions.length > 0);
  assert.ok(mono.omissions.length > 0);
  assert.match(medium.masterPrompt, /package-lock\.json/);
  assert.match(mono.masterPrompt, /pnpm-lock\.yaml/);
  for (const result of [small, medium, mono]) {
    const sentences = result.explain.summary.match(/[^.!?]+[.!?]+/g) ?? [];
    assert.ok(sentences.length >= 2 && sentences.length <= 4, result.explain.summary);
    assert.deepEqual(Object.keys(result.explain).sort(), ["stack", "summary"]);
    assert.equal("mermaid" in result, false);
    assert.equal("run" in result, false);
    const visible = [
      result.masterPrompt,
      result.description,
      result.explain.summary,
      ...result.explain.stack,
    ].join("\n");
    assert.equal(/astra|chatgpt|claude|gemini/i.test(visible), false);
  }
});

test("user-facing copy does not name astra or a chat product", () => {
  const root = new URL("..", import.meta.url);
  const files = [
    ...readdirSync(new URL("./components/", root))
      .filter((name) => name.endsWith(".tsx"))
      .map((name) => new URL(`./components/${name}`, root)),
    new URL("./app/page.tsx", root),
    new URL("./app/layout.tsx", root),
    new URL("./lib/mock.ts", root),
    new URL("./lib/masterPrompt.ts", root),
    new URL("./lib/openai.ts", root),
    new URL("./lib/schemas.ts", root),
  ];
  const banned = /\bastra\b|chatgpt|claude|gemini/i;
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.equal(banned.test(text), false, file.pathname);
  }
});
