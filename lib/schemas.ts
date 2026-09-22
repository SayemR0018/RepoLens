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
    "ChatGPT-astra rebuild prompt with identity, stack, module map, entry points, runtime, interfaces, data, rebuild order, and honesty.",
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
    .describe("Section 1. Repository identity for the ChatGPT-astra rebuild prompt. Grounded in the digest."),
  stack: z
    .string()
    .describe("Section 2. Languages, frameworks, and dependencies named by manifests. No guessed packages."),
  moduleMap: z.string().describe("Section 3. How directories and packages relate."),
  entryPoints: z
    .string()
    .describe("Section 4. Process and UI entry files that exist in the digest."),
  runtime: z
    .string()
    .describe(
      "Section 5. Install, build, test, and start commands evidenced by manifests or the README. Say what is missing instead of inventing scripts.",
    ),
  interfaces: z
    .string()
    .describe("Section 6. Env vars, config files, and external interfaces named in the digest."),
  data: z
    .string()
    .describe("Section 7. Data stores and side effects evidenced by paths or fetched files."),
  rebuildOrder: z
    .string()
    .describe(
      "Section 8. Phased file-create list. Manifests first, then config, entrypoints, then other known paths.",
    ),
});

export const modelAnalysisSchema = z.object({
  master: modelMasterSchema.describe(
    "Primary artefact. Prompt-ready sections for ChatGPT-astra. Do not write the honesty section; the server appends real omissions.",
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
