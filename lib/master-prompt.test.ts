import assert from "node:assert/strict";
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
  assert.match(prompt, /You are ChatGPT-astra/);
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
});
