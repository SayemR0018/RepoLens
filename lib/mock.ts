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
      summary: `Sample explainer for ${ref.owner}/${ref.repo}. RepoLens skipped the network and returned this small fixture so the master prompt can be reviewed without an API key.`,
      purpose: "Show a nine-section rebuild prompt for a single-package library.",
      audience: "Developers trying RepoLens locally, in CI, or before adding API keys.",
      stack: ["TypeScript", "Node.js"],
      highlights: [
        "The primary artefact is the master prompt, not a full-repo dump.",
        "This small fixture records no structural omissions.",
        "Mock mode is selected with REPOLENS_MOCK=1 or with mock set to true.",
      ],
    },
    mermaid: `flowchart TD
  paste[Paste GitHub URL] --> digest[Hybrid digest]
  digest --> prompt[Master prompt]
  digest --> explain[Explain]
  digest --> diagram[Diagram]
  digest --> run[Run]`,
    run: {
      prerequisites: ["Node.js 22 or newer"],
      steps: [
        { title: "Install dependencies", detail: "npm install" },
        { title: "Build", detail: "npm run build" },
        { title: "Test", detail: "npm test" },
        {
          title: "Start the app",
          detail: "No start script in this sample. Use npm run dev for RepoLens itself.",
        },
      ],
      keyPaths: [
        { path: "package.json", why: "Manifest for the sample library." },
        { path: "src/index.ts", why: "Public entrypoint." },
        { path: "tsconfig.json", why: "TypeScript config." },
      ],
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
      summary: `Sample explainer for ${ref.owner}/${ref.repo}. This medium fixture stands in for a multi-file app and includes omissions so the honesty block can be reviewed without API keys.`,
      purpose: "Show a master rebuild prompt plus explainer, diagram, and run guide for a mid-size repository.",
      audience: "Developers checking sample mode on a well-known public repository URL.",
      stack: ["TypeScript", "Next.js", "React"],
      highlights: [
        "Only a capped digest is represented. Lockfiles, images, and most source files are omissions.",
        "The master prompt states the rebuild order and what was not read.",
        "Live mode still refuses private repositories.",
      ],
    },
    mermaid: `flowchart TD
  url[Public GitHub URL] --> tree[Ranked tree]
  tree --> manifest[package.json]
  tree --> entry[app/page.tsx]
  manifest --> prompt[Master prompt]
  entry --> prompt
  prompt --> explain[Explain]
  prompt --> diagram[Diagram]
  prompt --> run[Run]`,
    run: {
      prerequisites: ["Node.js 22 or newer", "DATABASE_URL when leaving the sample"],
      steps: [
        { title: "Install dependencies", detail: "npm install" },
        { title: "Configure environment", detail: "Copy .env.example and set DATABASE_URL." },
        { title: "Build", detail: "npm run build" },
        { title: "Test", detail: "npm test" },
        { title: "Start", detail: "npm run start" },
      ],
      keyPaths: [
        { path: "package.json", why: "Names next, react, and the npm scripts." },
        { path: "app/page.tsx", why: "UI entrypoint in the fixture." },
        { path: ".env.example", why: "Declares DATABASE_URL without a secret value." },
        { path: "next.config.ts", why: "Next.js config listed in the sample." },
      ],
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
      summary: `Sample explainer for ${ref.owner}/${ref.repo}. This monorepo fixture shows a workspace digest with packages left unfetched on purpose.`,
      purpose: "Show how a master prompt describes a workspace without dumping every package.",
      audience: "Developers checking the sample against a workspace-shaped repository name.",
      stack: ["TypeScript", "pnpm", "Next.js"],
      highlights: [
        "Root and web manifests are in the digest. packages/ui is an omission.",
        "Lockfiles and the .next cache are omitted.",
        "The honesty block is part of the master prompt.",
      ],
    },
    mermaid: `flowchart TD
  root[pnpm-workspace.yaml] --> web[apps/web]
  root --> ui[packages/ui]
  web --> prompt[Master prompt]
  ui --> omitted[Not fetched]
  omitted --> honesty[Honesty]`,
    run: {
      prerequisites: ["Node.js 22 or newer", "pnpm"],
      steps: [
        { title: "Install the workspace", detail: "pnpm install" },
        { title: "Build", detail: "pnpm build" },
        { title: "Test", detail: "pnpm test" },
        { title: "Start the web app", detail: "pnpm --filter web dev" },
      ],
      keyPaths: [
        { path: "pnpm-workspace.yaml", why: "Declares the workspace packages." },
        { path: "package.json", why: "Root scripts for turbo." },
        { path: "apps/web/package.json", why: "Web app manifest." },
        { path: "apps/web/app/page.tsx", why: "Fetched UI entry." },
      ],
    },
  };
}
