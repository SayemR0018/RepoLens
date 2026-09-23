import type { RepoRef } from "./github";
import { assembleMasterPrompt, honestySection, type MasterSections } from "./masterPrompt";
import type { AnalyzeResult } from "./schemas";

export type MockScale = "small" | "medium" | "mono";

export function mockScaleFor(ref: RepoRef): MockScale {
  const key = `${ref.owner}/${ref.repo}`.toLowerCase();
  if (/(mono|workspace|turborepo|(^|[/-])nx([/-]|$)|pnpm-workspace)/.test(key)) {
    return "mono";
  }
  if (
    key === "vercel/next.js" ||
    key === "facebook/react" ||
    key === "microsoft/vscode" ||
    key === "django/django" ||
    key === "fastapi/fastapi" ||
    /(medium|vscode|django|fastapi|next\.js)/.test(key)
  ) {
    return "medium";
  }
  return "small";
}

export function buildMockResult(ref: RepoRef): AnalyzeResult {
  const scale = mockScaleFor(ref);
  if (scale === "mono") {
    return monoResult(ref);
  }
  if (scale === "medium") {
    return mediumResult(ref);
  }
  return smallResult(ref);
}

function smallResult(ref: RepoRef): AnalyzeResult {
  const sections: MasterSections = {
    identity: `Sample identity for ${ref.owner}/${ref.repo}. Single-package TypeScript library on branch main. License MIT. Description: deterministic small fixture. This sample did not read the repository.`,
    stack: "Language: TypeScript. Manifest: package.json. Dependencies named in the fixture: none. Dev dependency: typescript.",
    moduleMap: "Top level: src/, package.json, tsconfig.json, README.md. Module root: src. Notable path: src/index.ts.",
    entryPoints: "- src/index.ts (fetched in this fixture) exports the public API.",
    runtime: [
      "Install: npm install.",
      "Build: npm run build (tsc).",
      "Test: npm test (node --test).",
      "Start: no start script in the sample manifest.",
    ].join("\n"),
    interfaces: "Config: tsconfig.json. No environment variables in the sample. Do not invent env keys.",
    data: "No database schema, migration, or network side effect is present in the sample sources.",
    rebuildOrder: [
      "Create files in this order. Regenerate lockfiles; do not paste them.",
      "Phase 1 — manifests: package.json (fetched).",
      "Phase 2 — config and env examples: tsconfig.json (fetched).",
      "Phase 3 — entry points: src/index.ts (fetched).",
      "Phase 4 — other notable paths: README.md (fetched).",
      "Phase 5 — run npm install, npm run build, and npm test from section 5.",
    ].join("\n"),
    honesty: honestySection([]),
  };
  return {
    owner: ref.owner,
    repo: ref.repo,
    defaultBranch: "main",
    description: "Deterministic small sample. The repository was not fetched.",
    source: "mock",
    masterPrompt: assembleMasterPrompt(ref.owner, ref.repo, sections),
    omissions: [],
    explain: {
      summary: `Sample explainer for ${ref.owner}/${ref.repo}. This fixture stands in for a single-package TypeScript library on the main branch. The network was skipped so the master prompt can be reviewed without an API key. No structural omissions were recorded.`,
      stack: ["TypeScript", "Node.js"],
    },
  };
}

function mediumResult(ref: RepoRef): AnalyzeResult {
  const omissions = [
    "Skipped lockfiles: package-lock.json.",
    "Skipped binary, asset, or minified files: public/logo.png, public/og.png, and 2 more.",
    "Not fetched (outside the key-file cap): src/lib/cache.ts, src/app/layout.tsx, and 18 more.",
    "GitHub truncated the recursive tree, so paths beyond the listing were not ranked or fetched.",
  ];
  const sections: MasterSections = {
    identity: `Sample identity for ${ref.owner}/${ref.repo}. Multi-file TypeScript web app on branch main. License MIT. Description: deterministic medium fixture standing in for a public repository. This sample did not read ${ref.owner}/${ref.repo}.`,
    stack: "Language: TypeScript. Manifest: package.json. Dependencies named in the fixture: next, react, react-dom. Dev dependency: typescript.",
    moduleMap: [
      "Top level: app/, src/, public/, package.json, next.config.ts, .env.example, README.md.",
      "Module roots: app, src.",
      "Notable paths:",
      "- app: app/page.tsx, app/api/health/route.ts",
      "- src: src/lib/cache.ts (not fetched)",
    ].join("\n"),
    entryPoints: "- app/page.tsx (fetched in this fixture) is the UI entry.\n- app/api/health/route.ts (listed, not fetched) is an HTTP route.",
    runtime: [
      "Install: npm install.",
      "Build: npm run build (next build).",
      "Test: npm test (node --test).",
      "Start: npm run start (next start). Dev script: npm run dev (next dev).",
    ].join("\n"),
    interfaces: "Config: next.config.ts, .env.example. Env keys in .env.example: DATABASE_URL. Values were not copied. Do not invent additional keys.",
    data: "Data-related paths in the listing: none fetched. app/api/health/route.ts is an HTTP interface and was not fetched. Do not add a database client beyond the DATABASE_URL key named in .env.example.",
    rebuildOrder: [
      "Create files in this order. Regenerate lockfiles; do not paste package-lock.json.",
      "Phase 1 — manifests: package.json (fetched).",
      "Phase 2 — config and env examples: next.config.ts (fetched), .env.example (fetched).",
      "Phase 3 — entry points: app/page.tsx (fetched), app/api/health/route.ts (listed, not fetched).",
      "Phase 4 — other notable paths: src/lib/cache.ts (listed, not fetched), README.md (fetched).",
      "Phase 5 — run npm install, npm run build, npm test, and npm run start from section 5.",
    ].join("\n"),
    honesty: honestySection(omissions),
  };
  return {
    owner: ref.owner,
    repo: ref.repo,
    defaultBranch: "main",
    description: "Deterministic medium sample. The repository was not fetched.",
    source: "mock",
    masterPrompt: assembleMasterPrompt(ref.owner, ref.repo, sections),
    omissions,
    explain: {
      summary: `Sample explainer for ${ref.owner}/${ref.repo}. This medium fixture stands in for a multi-file TypeScript web app. Omissions are included so the honesty block can be reviewed without an API key. Lockfiles, images, and most source files stay out of the digest.`,
      stack: ["TypeScript", "Next.js", "React"],
    },
  };
}

function monoResult(ref: RepoRef): AnalyzeResult {
  const omissions = [
    "Skipped lockfiles: pnpm-lock.yaml.",
    "Skipped generated or vendor paths: apps/web/.next/cache/webpack, and 6 more.",
    "Not fetched (outside the key-file cap): packages/ui/package.json, apps/web/src/index.ts, and 11 more.",
    "Clipped README to 8000 characters.",
  ];
  const sections: MasterSections = {
    identity: `Sample identity for ${ref.owner}/${ref.repo}. pnpm workspace on branch main. License Apache-2.0. Description: deterministic monorepo fixture. This sample did not read the repository.`,
    stack: "Language: TypeScript. Manifests: pnpm-workspace.yaml, package.json, apps/web/package.json. Dependencies named in the root fixture: typescript. The web package names next and react. packages/ui/package.json was not fetched.",
    moduleMap: [
      "Top level: apps/, packages/, package.json, pnpm-workspace.yaml, turbo.json.",
      "Module roots: apps/web, packages, apps.",
      "Notable paths:",
      "- apps: apps/web/package.json, apps/web/app/page.tsx",
      "- packages: packages/ui/package.json (not fetched)",
    ].join("\n"),
    entryPoints: "- apps/web/app/page.tsx (fetched in this fixture).\n- apps/web/src/index.ts (listed, not fetched).",
    runtime: [
      "Install: pnpm install.",
      "Build: pnpm build (turbo run build).",
      "Test: pnpm test (turbo run test).",
      "Start: pnpm start is not in the root fixture. The web package dev script is pnpm --filter web dev (next dev).",
    ].join("\n"),
    interfaces: "Config: turbo.json. No env example was fetched in this fixture. Do not invent environment variables.",
    data: "No database schema or migration is in the fixture. Do not add a data store.",
    rebuildOrder: [
      "Create files in this order. Regenerate pnpm-lock.yaml; do not paste it.",
      "Phase 1 — manifests: pnpm-workspace.yaml (fetched), package.json (fetched), apps/web/package.json (fetched), packages/ui/package.json (listed, not fetched).",
      "Phase 2 — config and env examples: turbo.json (fetched).",
      "Phase 3 — entry points: apps/web/app/page.tsx (fetched).",
      "Phase 4 — other notable paths: apps/web/src/index.ts (listed, not fetched).",
      "Phase 5 — run pnpm install, pnpm build, and pnpm test from section 5.",
    ].join("\n"),
    honesty: honestySection(omissions),
  };
  return {
    owner: ref.owner,
    repo: ref.repo,
    defaultBranch: "main",
    description: "Deterministic monorepo sample. The repository was not fetched.",
    source: "mock",
    masterPrompt: assembleMasterPrompt(ref.owner, ref.repo, sections),
    omissions,
    explain: {
      summary: `Sample explainer for ${ref.owner}/${ref.repo}. This fixture stands in for a pnpm workspace with a web app and a UI package. Root and web manifests are represented, while packages/ui stays unfetched. Lockfiles and generated cache paths are recorded as omissions.`,
      stack: ["TypeScript", "pnpm", "Next.js"],
    },
  };
}
