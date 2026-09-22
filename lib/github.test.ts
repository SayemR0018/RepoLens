import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyFileContent,
  collectOmissions,
  selectKeyPaths,
  type RepoFile,
} from "./github";

const files: RepoFile[] = [
  { path: "package.json", size: 120 },
  { path: "pnpm-workspace.yaml", size: 40 },
  { path: "apps/web/package.json", size: 80 },
  { path: "packages/ui/package.json", size: 80 },
  { path: "src/main.ts", size: 40 },
  { path: "src/index.ts", size: 40 },
  { path: "Dockerfile", size: 30 },
  { path: "Makefile", size: 30 },
  { path: "package-lock.json", size: 9_000 },
  { path: "public/logo.png", size: 2_000 },
  { path: "dist/bundle.js", size: 2_000 },
  { path: ".env", size: 20 },
  { path: "app/page.tsx", size: 40 },
];

test("ranks root manifests and entrypoints ahead of locks, binaries, and extra packages", () => {
  const selected = selectKeyPaths(files);
  assert.ok(selected.length <= 6);
  assert.deepEqual(selected.slice(0, 3), [
    "package.json",
    "pnpm-workspace.yaml",
    "apps/web/package.json",
  ]);
  assert.ok(selected.includes("src/main.ts"));
  assert.ok(selected.includes("app/page.tsx"));
  assert.equal(selected.includes("package-lock.json"), false);
  assert.equal(selected.includes("public/logo.png"), false);
  assert.equal(selected.includes("dist/bundle.js"), false);
  assert.equal(selected.includes(".env"), false);
  assert.equal(selected.includes("packages/ui/package.json"), false);
});

test("omissions name locks, binaries, secrets, generated paths, truncation, and unfetched files", () => {
  const omissions = collectOmissions(files, selectKeyPaths(files), true);
  const text = omissions.join("\n");
  assert.match(text, /truncated the recursive tree/);
  assert.match(text, /Skipped lockfiles: package-lock\.json/);
  assert.match(text, /Skipped binary, asset, or minified files: public\/logo\.png/);
  assert.match(text, /Skipped generated or vendor paths: dist\/bundle\.js/);
  assert.match(text, /Skipped env files that may contain secrets: \.env/);
  assert.match(text, /packages\/ui\/package\.json/);
});

test("classifies git LFS pointers separately from text", () => {
  assert.equal(
    classifyFileContent("version https://git-lfs.github.com/spec/v1\noid sha256:abc\n"),
    "lfs",
  );
  assert.equal(classifyFileContent("export const value = 1;\n"), "text");
  assert.equal(classifyFileContent(""), "empty");
  assert.equal(classifyFileContent("a\u0000b"), "binary");
});
