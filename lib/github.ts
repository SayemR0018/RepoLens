const API_ROOT = "https://api.github.com";
const README_LIMIT = 8_000;
const FILE_LIMIT = 3_500;
export const DIGEST_CHAR_LIMIT = 24_000;
export const MAX_KEY_FILES = 6;
const MAX_NOTABLE_PATHS = 32;
const MAX_LISTED_PATHS = 32;
const MAX_FILE_BYTES = 100_000;
const ROLE_CAPS = { manifest: 3, entrypoint: 2, config: 2 } as const;

const MANIFEST_SCORE: Record<string, number> = {
  "package.json": 100,
  "pnpm-workspace.yaml": 99,
  "turbo.json": 97,
  "nx.json": 97,
  "lerna.json": 96,
  "pyproject.toml": 95,
  "go.mod": 95,
  "cargo.toml": 95,
  "go.work": 93,
  "pom.xml": 90,
  "build.gradle": 90,
  "build.gradle.kts": 90,
  "requirements.txt": 90,
  "pipfile": 88,
  "gemfile": 88,
  "composer.json": 88,
  "mix.exs": 88,
  "pubspec.yaml": 88,
  "setup.py": 86,
  "setup.cfg": 80,
  "package.swift": 86,
};

const ENTRY_SCORE: Record<string, number> = {
  "main.ts": 86,
  "main.tsx": 86,
  "main.py": 86,
  "main.go": 86,
  "manage.py": 84,
  "main.js": 84,
  "main.jsx": 84,
  "main.rs": 84,
  "page.tsx": 82,
  "lib.rs": 82,
  "index.ts": 80,
  "index.tsx": 80,
  "wsgi.py": 80,
  "asgi.py": 80,
  "program.cs": 80,
  "page.jsx": 80,
  "server.ts": 78,
  "index.js": 78,
  "page.ts": 78,
  "index.jsx": 78,
  "app.py": 76,
  "app.ts": 76,
  "app.tsx": 76,
  "server.js": 76,
  "server.py": 76,
  "main.rb": 76,
  "main.php": 76,
  "mod.rs": 74,
};

const CONFIG_SCORE: Record<string, number> = {
  dockerfile: 74,
  makefile: 72,
  "docker-compose.yml": 72,
  "docker-compose.yaml": 72,
  "compose.yml": 70,
  "compose.yaml": 70,
  "next.config.ts": 70,
  "next.config.mjs": 70,
  "next.config.js": 70,
  ".env.example": 68,
  "vite.config.ts": 66,
  ".env.sample": 66,
  ".env.template": 66,
  "nuxt.config.ts": 66,
  "tsconfig.json": 64,
  "vite.config.js": 64,
  "astro.config.mjs": 64,
  "svelte.config.js": 64,
};

const LOCK_FILE =
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|cargo\.lock|gemfile\.lock|poetry\.lock|composer\.lock|go\.sum|packages\.lock\.json)$/i;
const BINARY_OR_MINIFIED =
  /\.(png|jpe?g|gif|webp|ico|pdf|zip|wasm|woff2?|mp4|mp3|mov|psd|bin|onnx|pt|safetensors|dmg|exe|dll|so|dylib|parquet|sqlite|db|map|min\.(js|css))$/i;
const GENERATED_DIR =
  /(^|\/)(node_modules|vendor|dist|build|coverage|\.next|out|target|__pycache__)\//i;

export class GitHubError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
  }
}

export type RepoRef = {
  owner: string;
  repo: string;
};

export type RepoFile = {
  path: string;
  size?: number;
};

export type RankedFile = {
  path: string;
  role: "manifest" | "entrypoint" | "config";
  score: number;
};

export type RepoDigest = {
  owner: string;
  repo: string;
  defaultBranch: string;
  description: string;
  language: string | null;
  stars: number;
  license: string | null;
  topics: string[];
  fileCount: number;
  directoryCount: number;
  topLevel: Array<{ name: string; kind: "dir" | "file" }>;
  extensions: Array<{ ext: string; count: number }>;
  notablePaths: string[];
  readme: string | null;
  keyFiles: Array<{ path: string; content: string }>;
  treeTruncated: boolean;
  omissions: string[];
  manifests: string[];
  entryPoints: string[];
  configPaths: string[];
  moduleRoots: string[];
  lockfiles: string[];
};

type TreeItem = RepoFile & {
  type: "blob" | "tree";
};

type RepoPayload = {
  name: string;
  private: boolean;
  description: string | null;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  license: { spdx_id?: string | null } | null;
  topics?: string[];
  owner: { login: string };
};

type FetchedFile = {
  path: string;
  status: "ok" | "missing" | "lfs";
  content: string;
};

export function parseGitHubUrl(input: string): RepoRef {
  const raw = input.trim();
  if (!raw) {
    throw new GitHubError("Enter a GitHub repository URL.", 400);
  }

  const ssh = /^git@github\.com:([^/]+)\/([^/]+)$/i.exec(raw);
  if (ssh) {
    return pair(ssh[1], stripGitSuffix(ssh[2]));
  }

  if (
    /^https?:\/\//i.test(raw) ||
    /^github\.com\//i.test(raw) ||
    /^www\.github\.com\//i.test(raw)
  ) {
    let url: URL;
    try {
      url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    } catch {
      throw new GitHubError("That does not look like a GitHub repository URL.", 400);
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "github.com") {
      throw new GitHubError("Only github.com repositories are supported.", 400);
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      throw new GitHubError("Use a repository URL like github.com/owner/repo.", 400);
    }
    return pair(parts[0], stripGitSuffix(parts[1]));
  }

  const shorthand = /^([^/\s]+)\/([^/\s]+)$/.exec(raw);
  if (!shorthand) {
    throw new GitHubError("Use github.com/owner/repo or owner/repo.", 400);
  }
  return pair(shorthand[1], stripGitSuffix(shorthand[2]));
}

export function rankRebuildFiles(files: readonly RepoFile[]): RankedFile[] {
  const ranked: RankedFile[] = [];
  for (const file of files) {
    if (ignoredForRanking(file)) {
      continue;
    }
    const scored = scoreFile(file.path);
    if (scored) {
      ranked.push({ path: file.path, role: scored.role, score: scored.score });
    }
  }
  ranked.sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));
  return ranked;
}

export function selectKeyPaths(files: readonly RepoFile[]): string[] {
  const ranked = rankRebuildFiles(files);
  const chosen: string[] = [];
  const counts: Record<RankedFile["role"], number> = {
    manifest: 0,
    entrypoint: 0,
    config: 0,
  };
  const roles: RankedFile["role"][] = ["manifest", "entrypoint", "config"];
  for (const role of roles) {
    for (const item of ranked) {
      if (chosen.length >= MAX_KEY_FILES) {
        return chosen;
      }
      if (item.role !== role || chosen.includes(item.path)) {
        continue;
      }
      if (counts[role] >= ROLE_CAPS[role]) {
        break;
      }
      chosen.push(item.path);
      counts[role] += 1;
    }
  }
  for (const item of ranked) {
    if (chosen.length >= MAX_KEY_FILES) {
      break;
    }
    if (!chosen.includes(item.path)) {
      chosen.push(item.path);
    }
  }
  return chosen;
}

export function collectOmissions(
  files: readonly RepoFile[],
  selected: readonly string[],
  treeTruncated: boolean,
): string[] {
  const generated: string[] = [];
  const locks: string[] = [];
  const binaries: string[] = [];
  const oversized: string[] = [];
  const secrets: string[] = [];

  for (const file of files) {
    if (isGenerated(file.path)) {
      generated.push(file.path);
      continue;
    }
    if (isLockFile(file.path)) {
      locks.push(file.path);
      continue;
    }
    if (isBinaryOrMinified(file.path)) {
      binaries.push(file.path);
      continue;
    }
    if (isSecretEnv(file.path)) {
      secrets.push(file.path);
      continue;
    }
    if ((file.size ?? 0) > MAX_FILE_BYTES) {
      oversized.push(file.path);
    }
  }

  const omissions: string[] = [];
  if (treeTruncated) {
    omissions.push(
      "GitHub truncated the recursive tree, so paths beyond the listing were not ranked or fetched.",
    );
  }
  pushListed(omissions, "Skipped generated or vendor paths", generated);
  pushListed(omissions, "Skipped lockfiles", locks);
  pushListed(omissions, "Skipped binary, asset, or minified files", binaries);
  pushListed(omissions, "Skipped files over the 100000-byte cap", oversized);
  pushListed(omissions, "Skipped env files that may contain secrets", secrets);

  const selectedSet = new Set(selected);
  const unfetched = rankRebuildFiles(files)
    .map((item) => item.path)
    .filter((path) => !selectedSet.has(path));
  pushListed(omissions, "Not fetched (outside the key-file cap)", unfetched);
  return omissions;
}

export function classifyFileContent(content: string): "text" | "empty" | "binary" | "lfs" {
  if (!content) {
    return "empty";
  }
  if (content.includes("\u0000")) {
    return "binary";
  }
  if (/^version https:\/\/git-lfs\.github\.com\/spec\/v1/m.test(content)) {
    return "lfs";
  }
  return "text";
}

export async function buildDigest(ref: RepoRef): Promise<RepoDigest> {
  const repo = await fetchRepo(ref);
  if (repo.private) {
    throw new GitHubError(
      "That repository is private. RepoLens only analyzes public repositories.",
      404,
    );
  }

  const owner = repo.owner.login;
  const name = repo.name;
  const [tree, readme] = await Promise.all([
    fetchTree(owner, name, repo.default_branch),
    fetchReadme(owner, name),
  ]);

  const blobs = tree.items.filter((item) => item.type === "blob");
  const directories = tree.items.filter((item) => item.type === "tree");
  const files: RepoFile[] = blobs.map((item) => ({ path: item.path, size: item.size }));
  const ranked = rankRebuildFiles(files);
  const keyPaths = selectKeyPaths(files);
  const omissions = collectOmissions(files, keyPaths, tree.truncated);
  const fetched = await Promise.all(
    keyPaths.map((path) => fetchRawFile(owner, name, repo.default_branch, path)),
  );

  const keyFiles: Array<{ path: string; content: string }> = [];
  const missing: string[] = [];
  const lfs: string[] = [];
  const clipped: string[] = [];
  for (const file of fetched) {
    if (file.status === "missing") {
      missing.push(file.path);
      continue;
    }
    if (file.status === "lfs") {
      lfs.push(file.path);
      continue;
    }
    if (file.content.length > FILE_LIMIT) {
      clipped.push(file.path);
    }
    keyFiles.push({ path: file.path, content: clip(file.content, FILE_LIMIT) });
  }
  pushListed(omissions, "Could not read", missing);
  pushListed(omissions, "Git LFS pointers were not expanded", lfs);
  pushListed(omissions, `Clipped key file bodies to ${FILE_LIMIT} characters`, clipped);

  let readmeText: string | null = null;
  if (readme) {
    if (classifyFileContent(readme) === "lfs") {
      omissions.push("Git LFS pointer was not expanded: README.");
    } else if (classifyFileContent(readme) === "text") {
      if (readme.length > README_LIMIT) {
        omissions.push(`Clipped README to ${README_LIMIT} characters.`);
      }
      readmeText = clip(readme, README_LIMIT);
    }
  }

  return {
    owner,
    repo: name,
    defaultBranch: repo.default_branch,
    description: repo.description?.trim() ?? "",
    language: typeof repo.language === "string" ? repo.language : null,
    stars: typeof repo.stargazers_count === "number" ? repo.stargazers_count : 0,
    license: repo.license?.spdx_id ?? null,
    topics: Array.isArray(repo.topics) ? repo.topics.slice(0, 12) : [],
    fileCount: files.length,
    directoryCount: directories.length,
    topLevel: topLevelEntries(tree.items),
    extensions: extensionCounts(files),
    notablePaths: notablePaths(files, ranked),
    readme: readmeText,
    keyFiles,
    treeTruncated: tree.truncated,
    omissions: omissions.slice(0, 40),
    manifests: pathsForRole(ranked, "manifest"),
    entryPoints: pathsForRole(ranked, "entrypoint"),
    configPaths: pathsForRole(ranked, "config"),
    moduleRoots: moduleRoots(tree.items, ranked),
    lockfiles: files
      .filter((file) => isLockFile(file.path) && !isGenerated(file.path))
      .map((file) => file.path)
      .slice(0, 16),
  };
}

export function formatDigest(
  digest: RepoDigest,
  options?: { limit?: number | null },
): string {
  const lines: string[] = [
    `Repository: ${digest.owner}/${digest.repo}`,
    "Digest kind: hybrid. Ranked manifests, entrypoints, and config only. This is not a full repository dump.",
    `Default branch: ${digest.defaultBranch}`,
    `Description: ${digest.description || "(none)"}`,
    `Primary language: ${digest.language ?? "(unknown)"}`,
    `Stars: ${digest.stars}`,
    `License: ${digest.license ?? "(none)"}`,
    `Topics: ${digest.topics.length > 0 ? digest.topics.join(", ") : "(none)"}`,
    `Files: ${digest.fileCount}`,
    `Directories: ${digest.directoryCount}`,
    digest.treeTruncated
      ? "Tree listing: GitHub truncated the recursive tree, so this digest is partial."
      : "Tree listing: complete enough to summarize. Individual file contents below are clipped.",
    "",
    "Top level:",
    ...digest.topLevel.map((entry) => `- ${entry.name}${entry.kind === "dir" ? "/" : ""}`),
    "",
    "Extensions:",
    ...digest.extensions.map((entry) => `- ${entry.ext}: ${entry.count}`),
    "",
    "Module roots:",
    ...(digest.moduleRoots.length > 0 ? digest.moduleRoots.map((path) => `- ${path}`) : ["- (none)"]),
    "",
    "Manifests:",
    ...(digest.manifests.length > 0 ? digest.manifests.map((path) => `- ${path}`) : ["- (none)"]),
    "",
    "Entry points:",
    ...(digest.entryPoints.length > 0 ? digest.entryPoints.map((path) => `- ${path}`) : ["- (none)"]),
    "",
    "Config:",
    ...(digest.configPaths.length > 0 ? digest.configPaths.map((path) => `- ${path}`) : ["- (none)"]),
    "",
    "Lockfiles (not fetched):",
    ...(digest.lockfiles.length > 0 ? digest.lockfiles.map((path) => `- ${path}`) : ["- (none)"]),
    "",
    "Notable paths:",
    ...(digest.notablePaths.length > 0
      ? digest.notablePaths.map((path) => `- ${path}`)
      : ["- (none)"]),
    "",
    "Omissions:",
    ...(digest.omissions.length > 0 ? digest.omissions.map((item) => `- ${item}`) : ["- (none recorded)"]),
    "",
    "README:",
    digest.readme ?? "(no README)",
    "",
    "Key files:",
  ];

  if (digest.keyFiles.length === 0) {
    lines.push("(none fetched)");
  } else {
    for (const file of digest.keyFiles) {
      lines.push("", `--- ${file.path} ---`, file.content);
    }
  }

  const text = lines.join("\n");
  const limit = options?.limit === undefined ? DIGEST_CHAR_LIMIT : options.limit;
  if (limit === null || text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}\n…[digest truncated]`;
}

function pair(owner: string, repo: string): RepoRef {
  if (!isSegment(owner) || !isSegment(repo)) {
    throw new GitHubError("Use github.com/owner/repo or owner/repo.", 400);
  }
  return { owner, repo };
}

function stripGitSuffix(repo: string): string {
  return repo.replace(/\.git$/i, "");
}

function isSegment(value: string): boolean {
  return /^[A-Za-z0-9_.-]+$/.test(value) && value !== "." && value !== "..";
}

function githubHeaders(accept: string): Headers {
  const headers = new Headers({
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "RepoLens",
  });
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

async function githubFetch(path: string, accept: string): Promise<Response> {
  return fetch(`${API_ROOT}${path}`, {
    headers: githubHeaders(accept),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
}

async function fetchRepo(ref: RepoRef): Promise<RepoPayload> {
  const response = await githubFetch(
    `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`,
    "application/vnd.github+json",
  );
  if (!response.ok) {
    throw await toGitHubError(response);
  }
  const payload: unknown = await readJson(response);
  if (!isRepoPayload(payload)) {
    throw new GitHubError("GitHub returned a repository record RepoLens could not read.", 502);
  }
  return payload;
}

async function fetchTree(
  owner: string,
  repo: string,
  branch: string,
): Promise<{ items: TreeItem[]; truncated: boolean }> {
  const response = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    "application/vnd.github+json",
  );
  if (response.status === 409) {
    throw new GitHubError(
      "That repository has no commits yet, so there is nothing to analyze.",
      409,
    );
  }
  if (!response.ok) {
    throw await toGitHubError(response);
  }
  const payload: unknown = await readJson(response);
  if (!payload || typeof payload !== "object" || !("tree" in payload) || !Array.isArray(payload.tree)) {
    throw new GitHubError("GitHub returned a file tree RepoLens could not read.", 502);
  }
  const truncated =
    "truncated" in payload && typeof payload.truncated === "boolean" ? payload.truncated : false;
  return { items: normalizeTree(payload.tree), truncated };
}

async function fetchReadme(owner: string, repo: string): Promise<string | null> {
  const response = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`,
    "application/vnd.github.raw",
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw await toGitHubError(response);
  }
  return response.text();
}

async function fetchRawFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
): Promise<FetchedFile> {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const response = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
    "application/vnd.github.raw",
  );
  if (response.status === 404) {
    return { path, status: "missing", content: "" };
  }
  if (!response.ok) {
    const error = await toGitHubError(response);
    if (error.status === 429) {
      throw error;
    }
    return { path, status: "missing", content: "" };
  }
  const text = await response.text();
  const kind = classifyFileContent(text);
  if (kind === "empty" || kind === "binary") {
    return { path, status: "missing", content: "" };
  }
  if (kind === "lfs") {
    return { path, status: "lfs", content: text };
  }
  return { path, status: "ok", content: text };
}

async function toGitHubError(response: Response): Promise<GitHubError> {
  const remaining = response.headers.get("x-ratelimit-remaining");
  if ((response.status === 403 || response.status === 429) && remaining === "0") {
    const token = process.env.GITHUB_TOKEN?.trim();
    return new GitHubError(
      token
        ? "GitHub API rate limit reached for GITHUB_TOKEN. Wait for the limit to reset and try again."
        : "GitHub API rate limit reached. Live multi-file fetch needs GITHUB_TOKEN to raise the limit. Set it and try again.",
      429,
    );
  }
  if (response.status === 404) {
    return new GitHubError(
      "Repository not found or private. RepoLens only reads public repositories.",
      404,
    );
  }
  if (response.status === 401 || response.status === 403) {
    return new GitHubError(
      "GitHub refused access. The repository may be private, or GITHUB_TOKEN is invalid.",
      403,
    );
  }
  return new GitHubError("GitHub could not be reached. Try again in a moment.", 502);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new GitHubError("GitHub returned a response RepoLens could not read.", 502);
  }
}

function isRepoPayload(value: unknown): value is RepoPayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const repo = value as Partial<RepoPayload>;
  return (
    typeof repo.name === "string" &&
    typeof repo.private === "boolean" &&
    typeof repo.default_branch === "string" &&
    (repo.description === null || typeof repo.description === "string") &&
    !!repo.owner &&
    typeof repo.owner.login === "string"
  );
}

function normalizeTree(entries: unknown[]): TreeItem[] {
  const items: TreeItem[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const item = entry as { path?: unknown; type?: unknown; size?: unknown };
    if (typeof item.path !== "string" || (item.type !== "blob" && item.type !== "tree")) {
      continue;
    }
    items.push({
      path: item.path,
      type: item.type,
      size: typeof item.size === "number" ? item.size : undefined,
    });
  }
  return items;
}

function scoreFile(path: string): { role: RankedFile["role"]; score: number } | null {
  const base = basename(path);
  const penalty = path.split("/").length - 1;
  const manifest = MANIFEST_SCORE[base] ?? projectManifestScore(base);
  if (manifest !== null) {
    return { role: "manifest", score: manifest - penalty * 4 };
  }
  const entry = ENTRY_SCORE[base];
  if (entry !== undefined && isPlausibleEntry(path, base)) {
    return { role: "entrypoint", score: entry - penalty * 4 };
  }
  const config = CONFIG_SCORE[base];
  if (config !== undefined) {
    return { role: "config", score: config - penalty * 4 };
  }
  return null;
}

function projectManifestScore(base: string): number | null {
  if (base.endsWith(".csproj") || base.endsWith(".fsproj") || base === "solution.sln" || base.endsWith(".sln")) {
    return 86;
  }
  return null;
}

function isPlausibleEntry(path: string, base: string): boolean {
  if (/\.(test|spec)\./i.test(path) || /(^|\/)__tests__\//i.test(path)) {
    return false;
  }
  const depth = path.split("/").length - 1;
  if (base === "page.tsx" || base === "page.jsx" || base === "page.ts") {
    return /(^|\/)(app|pages)\//.test(path);
  }
  if (base === "main.go" && /(^|\/)cmd\//.test(path)) {
    return depth <= 4;
  }
  if (base === "lib.rs" || base === "main.rs") {
    return depth <= 3;
  }
  return depth <= 3;
}

function ignoredForRanking(file: RepoFile): boolean {
  if ((file.size ?? 0) > MAX_FILE_BYTES) {
    return true;
  }
  return (
    isGenerated(file.path) ||
    isLockFile(file.path) ||
    isBinaryOrMinified(file.path) ||
    isSecretEnv(file.path)
  );
}

function isGenerated(path: string): boolean {
  return GENERATED_DIR.test(path);
}

function isLockFile(path: string): boolean {
  return LOCK_FILE.test(path);
}

function isBinaryOrMinified(path: string): boolean {
  return BINARY_OR_MINIFIED.test(path) || /\.min\.(js|css)$/i.test(path);
}

function isSecretEnv(path: string): boolean {
  const base = basename(path);
  if (base !== ".env" && !base.startsWith(".env.")) {
    return false;
  }
  return !/\.(example|sample|template)$/i.test(base);
}

function basename(path: string): string {
  return path.split("/").pop()?.toLowerCase() ?? "";
}

function pathsForRole(ranked: readonly RankedFile[], role: RankedFile["role"]): string[] {
  return ranked.filter((item) => item.role === role).map((item) => item.path).slice(0, MAX_LISTED_PATHS);
}

function moduleRoots(items: readonly TreeItem[], ranked: readonly RankedFile[]): string[] {
  const roots = new Set<string>();
  for (const item of ranked) {
    if (item.role !== "manifest" || !item.path.includes("/")) {
      continue;
    }
    roots.add(item.path.slice(0, item.path.lastIndexOf("/")));
  }
  const markers = new Set(["packages", "apps", "services", "crates", "libs", "modules"]);
  for (const item of items) {
    const top = item.path.split("/")[0];
    if (top && markers.has(top)) {
      roots.add(top);
    }
  }
  return [...roots].sort((left, right) => left.localeCompare(right)).slice(0, 24);
}

function notablePaths(files: readonly RepoFile[], ranked: readonly RankedFile[]): string[] {
  const preferred = ranked.map((item) => item.path);
  const seen = new Set(preferred);
  const rest: string[] = [];
  for (const file of files) {
    if (
      seen.has(file.path) ||
      isGenerated(file.path) ||
      isLockFile(file.path) ||
      isBinaryOrMinified(file.path) ||
      isSecretEnv(file.path)
    ) {
      continue;
    }
    if (file.path.split("/").length <= 3) {
      rest.push(file.path);
    }
  }
  return [...preferred, ...rest].slice(0, MAX_NOTABLE_PATHS);
}

function topLevelEntries(items: TreeItem[]): Array<{ name: string; kind: "dir" | "file" }> {
  const kinds = new Map<string, "dir" | "file">();
  for (const item of items) {
    const name = item.path.split("/")[0];
    if (!name) {
      continue;
    }
    const kind = item.path.includes("/") || item.type === "tree" ? "dir" : "file";
    if (kinds.get(name) !== "dir") {
      kinds.set(name, kind);
    }
  }
  return [...kinds.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 24)
    .map(([name, kind]) => ({ name, kind }));
}

function extensionCounts(files: readonly RepoFile[]): Array<{ ext: string; count: number }> {
  const counts = new Map<string, number>();
  for (const file of files) {
    if (isGenerated(file.path) || isLockFile(file.path)) {
      continue;
    }
    const base = file.path.split("/").pop() ?? file.path;
    const dot = base.lastIndexOf(".");
    const ext = dot > 0 ? base.slice(dot).toLowerCase() : "(none)";
    counts.set(ext, (counts.get(ext) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([ext, count]) => ({ ext, count }));
}

function pushListed(omissions: string[], label: string, paths: readonly string[]): void {
  const line = listLine(label, paths);
  if (line) {
    omissions.push(line);
  }
}

function listLine(label: string, paths: readonly string[]): string | null {
  if (paths.length === 0) {
    return null;
  }
  const shown = paths.slice(0, 5);
  const more = paths.length - shown.length;
  const tail = more > 0 ? `, and ${more} more` : "";
  return `${label}: ${shown.join(", ")}${tail}.`;
}

function clip(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}\n…[truncated]`;
}
