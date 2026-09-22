import type { RepoDigest } from "./github";

export const MASTER_SECTION_TITLES = [
  "1. Identity",
  "2. Stack & dependencies",
  "3. Module map",
  "4. Entry points",
  "5. Runtime",
  "6. Interfaces, env, and config",
  "7. Data & side effects",
  "8. Rebuild order",
  "9. Honesty",
] as const;

export type MasterSectionKey =
  | "identity"
  | "stack"
  | "moduleMap"
  | "entryPoints"
  | "runtime"
  | "interfaces"
  | "data"
  | "rebuildOrder"
  | "honesty";

export type MasterSections = Record<MasterSectionKey, string>;

const SECTION_KEYS: MasterSectionKey[] = [
  "identity",
  "stack",
  "moduleMap",
  "entryPoints",
  "runtime",
  "interfaces",
  "data",
  "rebuildOrder",
  "honesty",
];

export function masterPromptHasAllSections(prompt: string): boolean {
  return MASTER_SECTION_TITLES.every((title) => prompt.includes(`## ${title}`));
}

export function assembleMasterPrompt(
  owner: string,
  repo: string,
  sections: MasterSections,
): string {
  const preamble = [
    `You are ChatGPT-astra. Rebuild ${owner.trim()}/${repo.trim()} as a working project from the facts in this prompt.`,
    "Create files in the phased order in section 8.",
    "Do not invent packages, commands, environment variables, or files that are not listed.",
    "Where a fact is missing, leave a TODO comment instead of guessing.",
    "Section 9 lists source that was not read. Do not pretend those paths were inspected.",
  ].join(" ");
  const body = MASTER_SECTION_TITLES.map((title, index) => {
    const key = SECTION_KEYS[index];
    const text = sections[key].trim() || "Not evidenced by the digest.";
    return `## ${title}\n${text}`;
  }).join("\n\n");
  return `${preamble}\n\n${body}\n`;
}

export function honestySection(omissions: readonly string[]): string {
  if (omissions.length === 0) {
    return "No structural omissions were recorded. The digest is still a selective sample (README plus a capped set of manifests, entrypoints, and config), not a full-repo dump. Do not assume unread paths match this prompt.";
  }
  return [
    "The following source was skipped, truncated, or not fetched. Do not invent the contents of these paths.",
    ...omissions.map((item) => `- ${item}`),
  ].join("\n");
}

export function sectionsFromDigest(digest: RepoDigest): MasterSections {
  return {
    identity: identitySection(digest),
    stack: stackSection(digest),
    moduleMap: moduleMapSection(digest),
    entryPoints: entrySection(digest),
    runtime: runtimeSection(digest),
    interfaces: interfacesSection(digest),
    data: dataSection(digest),
    rebuildOrder: rebuildSection(digest),
    honesty: honestySection(digest.omissions),
  };
}

export function mergeMasterSections(
  fallback: MasterSections,
  model: Partial<MasterSections>,
): MasterSections {
  const merged: MasterSections = { ...fallback };
  for (const key of SECTION_KEYS) {
    if (key === "honesty") {
      continue;
    }
    const value = model[key]?.trim();
    if (value) {
      merged[key] = value;
    }
  }
  merged.honesty = fallback.honesty;
  return merged;
}

export function readModelSections(master: Record<string, unknown> | null): Partial<MasterSections> {
  return {
    identity: text(master?.identity),
    stack: text(master?.stack),
    moduleMap: text(master?.moduleMap),
    entryPoints: text(master?.entryPoints),
    runtime: text(master?.runtime),
    interfaces: text(master?.interfaces),
    data: text(master?.data),
    rebuildOrder: text(master?.rebuildOrder),
  };
}

function identitySection(digest: RepoDigest): string {
  const lines = [
    `Repository: ${digest.owner}/${digest.repo}.`,
    `Default branch: ${digest.defaultBranch}.`,
    `Description: ${digest.description.trim() || "none provided"}.`,
    `Primary language: ${digest.language ?? "unknown"}.`,
    `License: ${digest.license ?? "none detected"}.`,
    `Topics: ${digest.topics.length > 0 ? digest.topics.join(", ") : "none"}.`,
    `Stars: ${digest.stars}.`,
    `Tree listing: ${digest.fileCount} files, ${digest.directoryCount} directories.`,
  ];
  const excerpt = readmeExcerpt(digest.readme);
  if (excerpt) {
    lines.push(`README excerpt: ${excerpt}`);
  }
  return lines.join("\n");
}

function stackSection(digest: RepoDigest): string {
  const lines = [`Primary language: ${digest.language ?? "unknown"}.`];
  if (digest.extensions.length > 0) {
    lines.push(
      `Extensions: ${digest.extensions.map((entry) => `${entry.ext} (${entry.count})`).join(", ")}.`,
    );
  }
  const fetched = new Set(digest.keyFiles.map((file) => file.path));
  for (const file of digest.keyFiles) {
    const deps = dependenciesFrom(file.path, file.content);
    if (deps.length > 0) {
      lines.push(`Dependencies named in ${file.path}: ${deps.join(", ")}.`);
    } else if (isManifestPath(file.path)) {
      lines.push(`${file.path} was fetched and named no parseable dependencies.`);
    }
  }
  const unseen = digest.manifests.filter((path) => !fetched.has(path));
  if (unseen.length > 0) {
    lines.push(`Manifests listed but not fetched: ${unseen.join(", ")}.`);
  }
  if (lines.length === 1 && digest.manifests.length === 0) {
    lines.push("No manifest was identified in the digest.");
  }
  return lines.join("\n");
}

function moduleMapSection(digest: RepoDigest): string {
  const top =
    digest.topLevel.length > 0
      ? digest.topLevel.map((entry) => `${entry.name}${entry.kind === "dir" ? "/" : ""}`).join(", ")
      : "(empty)";
  const roots = digest.moduleRoots.length > 0 ? digest.moduleRoots.join(", ") : "none";
  const grouped = groupByTop(digest.notablePaths);
  const lines = [`Top level: ${top}.`, `Module roots: ${roots}.`];
  if (grouped.length === 0) {
    lines.push("Notable paths: none.");
  } else {
    lines.push("Notable paths:");
    lines.push(...grouped);
  }
  return lines.join("\n");
}

function entrySection(digest: RepoDigest): string {
  if (digest.entryPoints.length === 0) {
    return "No entrypoint was identified. Do not invent a main file.";
  }
  const fetched = new Set(digest.keyFiles.map((file) => file.path));
  return digest.entryPoints
    .map((path) => `- ${path}${fetched.has(path) ? " (fetched)" : " (listed, not fetched)"}`)
    .join("\n");
}

function runtimeSection(digest: RepoDigest): string {
  const manager = detectPackageManager(digest);
  const lines: string[] = [];
  if (manager === "npm" || manager === "pnpm" || manager === "yarn" || manager === "bun") {
    lines.push(`Install: ${manager} install.`);
    const scripts = packageScripts(digest);
    lines.push(scriptLine("Build", "build", scripts.build, manager));
    lines.push(scriptLine("Test", "test", scripts.test, manager));
    if (scripts.start) {
      lines.push(scriptLine("Start", "start", scripts.start, manager));
    } else if (scripts.dev) {
      lines.push(`Start: no start script. Dev script is present: ${commandFor(manager, "dev")} (${scripts.dev}).`);
    } else {
      lines.push("Start: no start or dev script in the fetched package.json.");
    }
  } else if (manager === "pip") {
    const hasRequirements = digest.manifests.some((path) => path.toLowerCase().endsWith("requirements.txt"));
    const hasPyproject = digest.manifests.some((path) => path.toLowerCase().endsWith("pyproject.toml"));
    if (hasRequirements) {
      lines.push("Install: pip install -r requirements.txt.");
    }
    if (hasPyproject) {
      lines.push("Install: pip install -e . when pyproject.toml is the manifest.");
    }
    lines.push("Build: no build command was parsed from the Python manifest.");
    lines.push("Test: no test command was parsed. Check the README excerpt before guessing pytest.");
    lines.push("Start: no start command was parsed from the fetched manifests.");
  } else if (manager === "go") {
    lines.push("Install: go mod download.");
    lines.push("Build: go build ./...");
    lines.push("Test: go test ./...");
    lines.push("Start: go run . when a main package is listed in section 4.");
  } else if (manager === "cargo") {
    lines.push("Install: cargo fetch.");
    lines.push("Build: cargo build.");
    lines.push("Test: cargo test.");
    lines.push("Start: cargo run.");
  } else {
    lines.push("Install, build, test, and start: no package-manager command was evidenced by the fetched manifests.");
  }

  const targets = makefileTargets(digest);
  if (targets.length > 0) {
    lines.push(`Makefile targets present: ${targets.join(", ")}.`);
  }
  if (digest.configPaths.some((path) => basename(path) === "dockerfile")) {
    lines.push("A Dockerfile is listed. Do not invent image tags or ports that are not in the fetched file.");
  }
  return lines.join("\n");
}

function interfacesSection(digest: RepoDigest): string {
  const lines: string[] = [];
  if (digest.configPaths.length > 0) {
    lines.push(`Config paths: ${digest.configPaths.join(", ")}.`);
  }
  for (const file of digest.keyFiles) {
    if (!isEnvExample(file.path)) {
      continue;
    }
    const keys = envKeys(file.content);
    lines.push(
      keys.length > 0
        ? `Env keys in ${file.path}: ${keys.join(", ")}. Values were not copied.`
        : `Env file ${file.path} was fetched and named no KEY= entries.`,
    );
  }
  const envFromCode = new Set<string>();
  for (const file of digest.keyFiles) {
    for (const key of codeEnvKeys(file.content)) {
      envFromCode.add(key);
    }
  }
  if (envFromCode.size > 0) {
    lines.push(`process.env names seen in fetched files: ${[...envFromCode].slice(0, 16).join(", ")}.`);
  }
  if (lines.length === 0) {
    return "No env example or config file was fetched. Do not invent environment variables.";
  }
  return lines.join("\n");
}

function dataSection(digest: RepoDigest): string {
  const notes: string[] = [];
  const paths = unique([
    ...digest.notablePaths,
    ...digest.manifests,
    ...digest.configPaths,
    ...digest.keyFiles.map((file) => file.path),
  ]);
  const dataPaths = paths.filter((path) =>
    /schema\.prisma|(^|\/)migrations\/|\.sql$|(^|\/)supabase\/|docker-compose|compose\.ya?ml|(^|\/)seed/i.test(
      path,
    ),
  );
  if (dataPaths.length > 0) {
    notes.push(`Data-related paths in the listing: ${dataPaths.join(", ")}.`);
  }
  for (const file of digest.keyFiles) {
    if (/\bfetch\s*\(/.test(file.content)) {
      notes.push(`${file.path} calls fetch().`);
    }
    if (/\b(readFile|writeFile|createWriteStream|fs\.promises)\b/.test(file.content)) {
      notes.push(`${file.path} touches the filesystem.`);
    }
  }
  if (notes.length === 0) {
    return "No database schema, migration, or side-effect call was evidenced in the fetched files. Do not add a database unless a later file confirms one.";
  }
  return notes.join("\n");
}

function rebuildSection(digest: RepoDigest): string {
  const fetched = new Set(digest.keyFiles.map((file) => file.path));
  const used = new Set([...digest.manifests, ...digest.configPaths, ...digest.entryPoints]);
  const rest = digest.notablePaths.filter((path) => !used.has(path)).slice(0, 24);
  return [
    "Create files in this order. Regenerate lockfiles; do not paste them.",
    phaseLine("Phase 1 — manifests", digest.manifests, fetched),
    phaseLine("Phase 2 — config and env examples", digest.configPaths, fetched),
    phaseLine("Phase 3 — entry points", digest.entryPoints, fetched),
    phaseLine("Phase 4 — other notable paths", rest, fetched),
    "Phase 5 — run the install, build, test, and start commands from section 5. If a command is missing there, stop instead of guessing.",
  ].join("\n");
}

function phaseLine(title: string, paths: readonly string[], fetched: ReadonlySet<string>): string {
  if (paths.length === 0) {
    return `${title}: none identified in the digest.`;
  }
  const marked = paths.map((path) => `${path} (${fetched.has(path) ? "fetched" : "listed, not fetched"})`);
  return `${title}: ${marked.join(", ")}.`;
}

function scriptLine(
  label: string,
  scriptName: string,
  command: string | undefined,
  manager: string,
): string {
  if (!command) {
    return `${label}: no ${scriptName} script in the fetched package.json.`;
  }
  return `${label}: ${commandFor(manager, scriptName)} (${command}).`;
}

function commandFor(manager: string, scriptName: string): string {
  if (manager === "npm") {
    return `npm run ${scriptName}`;
  }
  if (manager === "bun") {
    return `bun run ${scriptName}`;
  }
  return `${manager} ${scriptName}`;
}

function detectPackageManager(
  digest: RepoDigest,
): "pnpm" | "yarn" | "bun" | "npm" | "pip" | "go" | "cargo" | null {
  const locks = digest.lockfiles.map((path) => path.toLowerCase());
  const manifests = digest.manifests.map((path) => path.toLowerCase());
  if (
    locks.some((path) => path.endsWith("pnpm-lock.yaml")) ||
    manifests.some((path) => path.endsWith("pnpm-workspace.yaml"))
  ) {
    return "pnpm";
  }
  if (locks.some((path) => path.endsWith("yarn.lock"))) {
    return "yarn";
  }
  if (locks.some((path) => path.endsWith("bun.lock") || path.endsWith("bun.lockb"))) {
    return "bun";
  }
  if (manifests.some((path) => path.endsWith("package.json"))) {
    return "npm";
  }
  if (manifests.some((path) => path.endsWith("pyproject.toml") || path.endsWith("requirements.txt") || path.endsWith("pipfile"))) {
    return "pip";
  }
  if (manifests.some((path) => path.endsWith("go.mod"))) {
    return "go";
  }
  if (manifests.some((path) => path.endsWith("cargo.toml"))) {
    return "cargo";
  }
  return null;
}

function packageScripts(digest: RepoDigest): Record<string, string> {
  const scripts: Record<string, string> = {};
  const files = digest.keyFiles
    .filter((file) => file.path.toLowerCase().endsWith("package.json"))
    .slice()
    .sort((left, right) => left.path.split("/").length - right.path.split("/").length);
  for (const file of files) {
    const parsed = parseJsonObject(file.content);
    const block = parsed?.scripts;
    if (!block || typeof block !== "object" || Array.isArray(block)) {
      continue;
    }
    for (const [name, command] of Object.entries(block)) {
      if (typeof command === "string" && command.trim() && !scripts[name]) {
        scripts[name] = command.trim();
      }
    }
  }
  return scripts;
}

function dependenciesFrom(path: string, content: string): string[] {
  const base = basename(path);
  if (base === "package.json") {
    const parsed = parseJsonObject(content);
    if (!parsed) {
      return [];
    }
    return unique([
      ...objectKeys(parsed.dependencies),
      ...objectKeys(parsed.devDependencies),
      ...objectKeys(parsed.peerDependencies),
    ]).slice(0, 40);
  }
  if (base === "requirements.txt" || base === "pipfile") {
    return requirementNames(content);
  }
  if (base === "pyproject.toml") {
    return pyprojectDeps(content);
  }
  if (base === "go.mod") {
    return goDeps(content);
  }
  if (base === "cargo.toml") {
    return cargoDeps(content);
  }
  if (base === "gemfile") {
    return gemNames(content);
  }
  return [];
}

function requirementNames(content: string): string[] {
  const names: string[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) {
      continue;
    }
    const name = /^[A-Za-z0-9_.-]+/.exec(trimmed)?.[0];
    if (name) {
      names.push(name);
    }
  }
  return unique(names).slice(0, 40);
}

function pyprojectDeps(content: string): string[] {
  const names: string[] = [];
  for (const line of content.split("\n")) {
    const match = /^\s*"?([A-Za-z0-9_.-]+)"?\s*=\s*["'][^"']+["']/.exec(line);
    if (match && match[1] !== "name" && match[1] !== "version") {
      names.push(match[1]);
    }
  }
  return unique(names).slice(0, 40);
}

function goDeps(content: string): string[] {
  const names: string[] = [];
  for (const line of content.split("\n")) {
    const match = /^\s*([A-Za-z0-9_./-]+)\s+v\d/.exec(line.trim());
    if (match) {
      names.push(match[1]);
    }
  }
  return unique(names).slice(0, 40);
}

function cargoDeps(content: string): string[] {
  const names: string[] = [];
  let inDeps = false;
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (/^\[.*\]$/.test(trimmed)) {
      inDeps = /^\[(dependencies|dev-dependencies|workspace\.dependencies)\]/.test(trimmed);
      continue;
    }
    if (!inDeps) {
      continue;
    }
    const match = /^([A-Za-z0-9_-]+)\s*=/.exec(trimmed);
    if (match) {
      names.push(match[1]);
    }
  }
  return unique(names).slice(0, 40);
}

function gemNames(content: string): string[] {
  const names: string[] = [];
  for (const match of content.matchAll(/gem\s+["']([^"']+)["']/g)) {
    names.push(match[1]);
  }
  return unique(names).slice(0, 40);
}

function makefileTargets(digest: RepoDigest): string[] {
  const makefile = digest.keyFiles.find((file) => basename(file.path) === "makefile");
  if (!makefile) {
    return [];
  }
  const targets: string[] = [];
  for (const line of makefile.content.split("\n")) {
    const match = /^([A-Za-z0-9_-]+):/.exec(line);
    if (match && match[1] !== ".PHONY") {
      targets.push(match[1]);
    }
  }
  return unique(targets).slice(0, 12);
}

function envKeys(content: string): string[] {
  const keys: string[] = [];
  for (const line of content.split("\n")) {
    const match = /^([A-Z][A-Z0-9_]*)=/.exec(line.trim());
    if (match) {
      keys.push(match[1]);
    }
  }
  return unique(keys).slice(0, 24);
}

function codeEnvKeys(content: string): string[] {
  const keys: string[] = [];
  for (const match of content.matchAll(/\bprocess\.env\.([A-Z][A-Z0-9_]*)/g)) {
    keys.push(match[1]);
  }
  return keys;
}

function isEnvExample(path: string): boolean {
  const base = basename(path);
  return base === ".env.example" || base === ".env.sample" || base === ".env.template";
}

function isManifestPath(path: string): boolean {
  const base = basename(path);
  return (
    base === "package.json" ||
    base === "pyproject.toml" ||
    base === "requirements.txt" ||
    base === "go.mod" ||
    base === "cargo.toml" ||
    base === "gemfile" ||
    base.endsWith(".csproj")
  );
}

function readmeExcerpt(readme: string | null): string {
  if (!readme) {
    return "";
  }
  for (const line of readme.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      return trimmed.slice(0, 280);
    }
  }
  return "";
}

function groupByTop(paths: readonly string[]): string[] {
  const groups = new Map<string, string[]>();
  for (const path of paths) {
    const top = path.includes("/") ? path.slice(0, path.indexOf("/")) : "(root)";
    const list = groups.get(top) ?? [];
    list.push(path);
    groups.set(top, list);
  }
  return [...groups.entries()].map(([top, list]) => `- ${top}: ${list.join(", ")}`);
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  const cleaned = content.replace(/\n…\[(truncated|summary)\]$/, "");
  try {
    const value: unknown = JSON.parse(cleaned);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function objectKeys(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.keys(value);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function basename(path: string): string {
  return path.split("/").pop()?.toLowerCase() ?? "";
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
