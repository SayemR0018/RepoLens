const API_ROOT = "https://api.github.com";
const README_LIMIT = 8_000;
const FILE_LIMIT = 3_500;
const DIGEST_LIMIT = 24_000;
const MAX_KEY_FILES = 6;
const MAX_NOTABLE_PATHS = 32;
const MAX_FILE_BYTES = 100_000;

const RANKED_FILES = [
  "package.json",
  "pnpm-workspace.yaml",
  "pyproject.toml",
  "requirements.txt",
  "pipfile",
  "go.mod",
  "cargo.toml",
  "gemfile",
  "composer.json",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "dockerfile",
  "docker-compose.yml",
  "compose.yaml",
  "makefile",
  "next.config.ts",
  "next.config.mjs",
  "next.config.js",
  "app/page.tsx",
  "src/main.ts",
  "src/main.py",
  "src/index.ts",
  "src/index.js",
  "main.go",
  "src/lib.rs",
] as const;

const SKIP_FILE = [
  /(^|\/)node_modules\//i,
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|cargo\.lock|gemfile\.lock)$/i,
  /\.min\.(js|css)$/i,
  /\.map$/i,
  /\.(png|jpe?g|gif|webp|ico|pdf|zip|wasm|woff2?)$/i,
];

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
};

type TreeItem = {
  path: string;
  type: "blob" | "tree";
  size?: number;
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

  const files = tree.items.filter((item) => item.type === "blob");
  const directories = tree.items.filter((item) => item.type === "tree");
  const keyPaths = pickKeyFiles(files);
  const keyFiles = (
    await Promise.all(
      keyPaths.map(async (path) => {
        const content = await fetchRawFile(owner, name, repo.default_branch, path);
        return content ? { path, content: clip(content, FILE_LIMIT) } : null;
      }),
    )
  ).filter((file): file is { path: string; content: string } => file !== null);

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
    notablePaths: notablePaths(files),
    readme: readme ? clip(readme, README_LIMIT) : null,
    keyFiles,
    treeTruncated: tree.truncated,
  };
}

export function formatDigest(digest: RepoDigest): string {
  const lines: string[] = [
    `Repository: ${digest.owner}/${digest.repo}`,
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
    "Notable paths:",
    ...(digest.notablePaths.length > 0
      ? digest.notablePaths.map((path) => `- ${path}`)
      : ["- (none)"]),
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
  if (text.length <= DIGEST_LIMIT) {
    return text;
  }
  return `${text.slice(0, DIGEST_LIMIT)}\n…[digest truncated]`;
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
  const text = await response.text();
  if (text.includes("\u0000")) {
    return null;
  }
  return text;
}

async function fetchRawFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
): Promise<string | null> {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const url = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${encodedPath}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "RepoLens", Accept: "text/plain" },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }
  const text = await response.text();
  if (!text || text.includes("\u0000")) {
    return null;
  }
  return text;
}

async function toGitHubError(response: Response): Promise<GitHubError> {
  const remaining = response.headers.get("x-ratelimit-remaining");
  if ((response.status === 403 || response.status === 429) && remaining === "0") {
    return new GitHubError(
      "GitHub API rate limit reached. Set GITHUB_TOKEN to raise the limit and try again.",
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

function pickKeyFiles(files: TreeItem[]): string[] {
  const eligible = files.filter((file) => {
    if ((file.size ?? 0) > MAX_FILE_BYTES) {
      return false;
    }
    return !SKIP_FILE.some((pattern) => pattern.test(file.path));
  });
  const byLower = new Map(eligible.map((file) => [file.path.toLowerCase(), file.path]));
  const chosen: string[] = [];
  for (const name of RANKED_FILES) {
    const hit = byLower.get(name);
    if (hit && !chosen.includes(hit)) {
      chosen.push(hit);
    }
    if (chosen.length >= MAX_KEY_FILES) {
      return chosen;
    }
  }
  for (const file of eligible) {
    if (chosen.length >= MAX_KEY_FILES) {
      break;
    }
    if (chosen.includes(file.path) || !isEntryLike(file.path)) {
      continue;
    }
    chosen.push(file.path);
  }
  return chosen;
}

function isEntryLike(path: string): boolean {
  const base = path.split("/").pop()?.toLowerCase() ?? "";
  if (base.startsWith("readme")) {
    return false;
  }
  return /^(main|index|app|server|mod)\.(py|go|rs|ts|tsx|js|jsx|rb|php)$/.test(base);
}

function notablePaths(files: TreeItem[]): string[] {
  const ranked = new Set<string>(RANKED_FILES);
  const preferred: string[] = [];
  const rest: string[] = [];
  for (const file of files) {
    if (SKIP_FILE.some((pattern) => pattern.test(file.path))) {
      continue;
    }
    if (ranked.has(file.path.toLowerCase()) || isEntryLike(file.path)) {
      preferred.push(file.path);
    } else if (file.path.split("/").length <= 3) {
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

function extensionCounts(files: TreeItem[]): Array<{ ext: string; count: number }> {
  const counts = new Map<string, number>();
  for (const file of files) {
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

function clip(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}\n…[truncated]`;
}
