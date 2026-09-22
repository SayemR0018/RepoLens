import type { RepoDigest } from "./github";
import {
  assembleMasterPrompt,
  mergeMasterSections,
  readModelSections,
  sectionsFromDigest,
} from "./masterPrompt";
import { flowchartFromRootFolders, readMermaidSource } from "./mermaid-text";

const LIMITS = {
  stack: 12,
  highlights: 8,
  prerequisites: 8,
  steps: 10,
  keyPaths: 12,
} as const;

export type AnalysisShapeError = {
  issues: ReadonlyArray<{
    path: ReadonlyArray<PropertyKey>;
    message: string;
  }>;
};

/**
 * First Zod issue, so a 502 tells the client which field failed.
 * `error` is the object returned by `safeParse` (`ZodError` in Zod 4).
 */
export function analysisShapeErrorMessage(error: AnalysisShapeError): string {
  const issue = error.issues[0];
  const path =
    issue && issue.path.length > 0
      ? issue.path.map((part) => String(part)).join(".")
      : "(root)";
  const detail = issue?.message ?? "Invalid value.";
  return `The model returned an analysis that did not match the expected shape. ${path}: ${detail}`;
}

export function normalizeAnalysis(output: unknown, digest: RepoDigest) {
  const record = asRecord(output);
  const explain = asRecord(record?.explain);
  const run = asRecord(record?.run);
  const line = groundedLine(digest);

  const description = digest.description.trim() || trimmed(record?.description);
  const sections = mergeMasterSections(
    sectionsFromDigest(digest),
    readModelSections(asRecord(record?.master)),
  );
  const masterPrompt = assembleMasterPrompt(digest.owner, digest.repo, sections);
  const omissions = digest.omissions
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 40);
  const summary = trimmed(explain?.summary) || line;
  const purpose = trimmed(explain?.purpose) || line;
  const audience = trimmed(explain?.audience) || line;
  const stack = strings(explain?.stack, LIMITS.stack);
  const highlights = strings(explain?.highlights, LIMITS.highlights);
  const prerequisites = strings(run?.prerequisites, LIMITS.prerequisites);
  const steps = normalizeSteps(run?.steps, digest, line);
  const keyPaths = normalizeKeyPaths(run?.keyPaths, digest, line);
  const mermaid =
    readMermaidSource(trimmed(record?.mermaid)) ??
    flowchartFromRootFolders(
      `${digest.owner.trim()}/${digest.repo.trim()}`,
      digest.topLevel.filter((entry) => entry.kind === "dir").map((entry) => entry.name),
    );

  return {
    owner: digest.owner.trim(),
    repo: digest.repo.trim(),
    defaultBranch: digest.defaultBranch.trim(),
    description,
    source: "live" as const,
    masterPrompt,
    omissions,
    explain: {
      summary,
      purpose,
      audience,
      stack: stack.length > 0 ? stack : [line],
      highlights: highlights.length > 0 ? highlights : [line],
    },
    mermaid,
    run: {
      prerequisites,
      steps,
      keyPaths,
    },
  };
}

function groundedLine(digest: RepoDigest): string {
  const subject = `${digest.owner.trim()}/${digest.repo.trim()}`;
  const description = digest.description.trim().replace(/\s+/g, " ");
  return description ? `${subject}: ${description}` : `${subject}: See README`;
}

function normalizeSteps(
  value: unknown,
  digest: RepoDigest,
  line: string,
): Array<{ title: string; detail: string }> {
  const steps: Array<{ title: string; detail: string }> = [];
  if (Array.isArray(value)) {
    for (const entry of value) {
      const record = asRecord(entry);
      if (!record) {
        continue;
      }
      const title = trimmed(record.title);
      const detail = trimmed(record.detail);
      if (!title && !detail) {
        continue;
      }
      steps.push({
        title: title || `Review ${digest.owner.trim()}/${digest.repo.trim()}`,
        detail: detail || line,
      });
      if (steps.length >= LIMITS.steps) {
        break;
      }
    }
  }
  if (steps.length > 0) {
    return steps;
  }
  const file = digest.keyFiles.find((item) => item.path.trim().length > 0);
  return [
    {
      title: file
        ? `Open ${file.path.trim()}`
        : `Review ${digest.owner.trim()}/${digest.repo.trim()}`,
      detail: line,
    },
  ];
}

function normalizeKeyPaths(
  value: unknown,
  digest: RepoDigest,
  line: string,
): Array<{ path: string; why: string }> {
  const paths: Array<{ path: string; why: string }> = [];
  if (Array.isArray(value)) {
    for (const entry of value) {
      const record = asRecord(entry);
      if (!record) {
        continue;
      }
      const path = trimmed(record.path);
      if (!path) {
        continue;
      }
      paths.push({
        path,
        why: trimmed(record.why) || line,
      });
      if (paths.length >= LIMITS.keyPaths) {
        break;
      }
    }
  }
  if (paths.length > 0) {
    return paths;
  }

  const fromKeyFiles = digest.keyFiles
    .map((file) => file.path.trim())
    .filter((path) => path.length > 0)
    .slice(0, LIMITS.keyPaths)
    .map((path) => ({
      path,
      why: `Key file from the ${digest.owner.trim()}/${digest.repo.trim()} digest.`,
    }));
  if (fromKeyFiles.length > 0) {
    return fromKeyFiles;
  }

  const fromNotable = digest.notablePaths
    .map((path) => path.trim())
    .filter((path) => path.length > 0)
    .slice(0, LIMITS.keyPaths)
    .map((path) => ({
      path,
      why: `Notable path from the ${digest.owner.trim()}/${digest.repo.trim()} digest.`,
    }));
  if (fromNotable.length > 0) {
    return fromNotable;
  }

  return [{ path: "README", why: line }];
}

function strings(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const items: string[] = [];
  for (const entry of value) {
    const text = trimmed(entry);
    if (!text) {
      continue;
    }
    items.push(text);
    if (items.length >= max) {
      break;
    }
  }
  return items;
}

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}
