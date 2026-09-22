import { z } from "zod";

export const analyzeRequestSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Enter a GitHub repository URL.")
    .describe("Public GitHub URL or owner/repo shorthand."),
  mock: z
    .boolean()
    .optional()
    .describe("When true, return the deterministic sample and skip OpenAI."),
});

const nonEmpty = z.string().trim().min(1);

export const explainPanelSchema = z.object({
  summary: nonEmpty.describe("Plain-English overview in a few sentences."),
  purpose: nonEmpty.describe("What a user of this project gets from it."),
  audience: nonEmpty.describe("Who the project is for."),
  stack: z
    .array(nonEmpty)
    .min(1)
    .max(12)
    .describe("Languages, frameworks, and tools evidenced by the digest."),
  highlights: z
    .array(nonEmpty)
    .min(1)
    .max(8)
    .describe("Concrete observations, one sentence each."),
});

export const runStepSchema = z.object({
  title: nonEmpty,
  detail: nonEmpty.describe("What to do, including commands when the digest supports them."),
});

export const keyPathSchema = z.object({
  path: nonEmpty.describe("Repository-relative path."),
  why: nonEmpty.describe("Why this path matters."),
});

export const runGuideSchema = z.object({
  prerequisites: z.array(nonEmpty).max(8),
  steps: z.array(runStepSchema).min(1).max(10),
  keyPaths: z.array(keyPathSchema).min(1).max(12),
});

export const analyzeResultSchema = z.object({
  owner: nonEmpty,
  repo: nonEmpty,
  defaultBranch: nonEmpty,
  description: z.string(),
  source: z.enum(["mock", "live"]),
  masterPrompt: nonEmpty.describe(
    "Rebuild brief with identity, stack, module map, entry points, runtime, interfaces, data, rebuild order, and honesty.",
  ),
  omissions: z
    .array(nonEmpty)
    .max(40)
    .describe("Paths and limits the digest skipped, clipped, or left unfetched."),
  explain: explainPanelSchema,
  mermaid: nonEmpty.describe(
    "A single valid Mermaid flowchart or graph with no code fences.",
  ),
  run: runGuideSchema,
});

/**
 * Shape requested from the model. Identity fields are filled from GitHub
 * after the call so the model cannot rename the repository.
 * Constraints that OpenAI strict JSON Schema rejects (min/max) stay on
 * `analyzeResultSchema`, which validates the response before it is returned.
 */
export const modelMasterSchema = z.object({
  identity: z
    .string()
    .describe(
      "Section 1 body only. One fact per line: repository, branch, description, language, license, topics, README purpose. No heading.",
    ),
  stack: z
    .string()
    .describe(
      "Section 2 body only. Language, package manager if evidenced, then dependencies named by each fetched manifest. No guessed packages. No heading.",
    ),
  moduleMap: z
    .string()
    .describe(
      "Section 3 body only. Top level, module roots, then notable paths grouped by directory. Mark unfetched paths. No heading.",
    ),
  entryPoints: z
    .string()
    .describe(
      "Section 4 body only. One entry path per line, marked fetched or listed-only. No heading.",
    ),
  runtime: z
    .string()
    .describe(
      "Section 5 body only. Install, Build, Test, then Start, quoting script bodies. Say when a command is missing. No heading.",
    ),
  interfaces: z
    .string()
    .describe(
      "Section 6 body only. Config paths and env key names, never values. Say when none were found. No heading.",
    ),
  data: z
    .string()
    .describe(
      "Section 7 body only. Schemas, migrations, network calls, and filesystem writes that the digest evidences. No heading.",
    ),
  rebuildOrder: z
    .string()
    .describe(
      "Section 8 body only. Phases 1-5: manifests, config, entry points, other known paths, then runtime commands. Real paths only. No heading.",
    ),
});

export const modelAnalysisSchema = z.object({
  master: modelMasterSchema.describe(
    "Primary artefact. Checklist bodies for the rebuild brief. Do not write headings or the honesty section; the server appends real omissions.",
  ),
  description: z
    .string()
    .describe("One-sentence description grounded in the digest. Empty if unknown."),
  explain: z.object({
    summary: z.string().describe("Plain-English overview in a few sentences."),
    purpose: z.string().describe("What a user of this project gets from it."),
    audience: z.string().describe("Who the project is for."),
    stack: z
      .array(z.string())
      .describe("Languages, frameworks, and tools evidenced by the digest."),
    highlights: z
      .array(z.string())
      .describe("Concrete observations, one sentence each."),
  }),
  mermaid: z
    .string()
    .describe("Valid Mermaid flowchart or graph. No markdown fences, no styling, no click events."),
  run: z.object({
    prerequisites: z.array(z.string()),
    steps: z.array(
      z.object({
        title: z.string(),
        detail: z.string(),
      }),
    ),
    keyPaths: z.array(
      z.object({
        path: z.string(),
        why: z.string(),
      }),
    ),
  }),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type AnalyzeResult = z.infer<typeof analyzeResultSchema>;
export type ModelAnalysis = z.infer<typeof modelAnalysisSchema>;
