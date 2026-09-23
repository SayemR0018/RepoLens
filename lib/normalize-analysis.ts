import type { RepoDigest } from "./github";
import {
  assembleMasterPrompt,
  mergeMasterSections,
  readModelSections,
  sectionsFromDigest,
} from "./masterPrompt";

const STACK_LIMIT = 12;
const SUMMARY_SENTENCES = 4;

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
  const summary = shortSummary(explain?.summary, line);
  const stack = strings(explain?.stack, STACK_LIMIT);

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
      stack: stack.length > 0 ? stack : [line],
    },
  };
}

function groundedLine(digest: RepoDigest): string {
  const subject = `${digest.owner.trim()}/${digest.repo.trim()}`;
  const description = digest.description.trim().replace(/\s+/g, " ");
  return description ? `${subject}: ${description}` : `${subject}: See README`;
}

function shortSummary(value: unknown, fallback: string): string {
  const text = trimmed(value).replace(/\s+/g, " ");
  const clipped = clipSentences(text, SUMMARY_SENTENCES);
  return clipped || fallback;
}

function clipSentences(text: string, max: number): string {
  if (!text) {
    return "";
  }
  const parts = text.match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g);
  if (!parts) {
    return text;
  }
  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .slice(0, max)
    .join(" ");
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
