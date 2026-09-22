import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, generateText, NoObjectGeneratedError, Output } from "ai";
import type { RepoDigest } from "@/lib/github";
import { formatDigest } from "@/lib/github";
import { readMermaidSource } from "@/lib/mermaid-text";
import {
  analyzeResultSchema,
  modelAnalysisSchema,
  type AnalyzeResult,
} from "@/lib/schemas";

const DEFAULT_MODEL = "gpt-6";

const INSTRUCTIONS = `You are RepoLens. Explain a public GitHub repository to a developer who has not opened the code.

Use only the digest. Do not invent files, commands, frameworks, or scripts that the digest does not support. If evidence is thin, say what is known and what is uncertain.
explain.summary is plain English, two to four sentences, with no markdown headings.
explain.stack lists only languages, frameworks, and tools the digest supports.
mermaid is one flowchart or graph. It must be valid Mermaid, with no code fences, no styling directives, and no click events.
run.steps are the practical way to install and start the project. If the package manager or scripts are not in the digest, say what is missing instead of guessing.
run.keyPaths must be real paths from the digest.
Do not write HTML.`;

export class AnalysisError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AnalysisError";
    this.status = status;
  }
}

export async function analyzeDigest(digest: RepoDigest): Promise<AnalyzeResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AnalysisError(
      "OPENAI_API_KEY is not set. Add it for live analysis, or enable mock mode.",
      500,
    );
  }

  const modelId = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const provider = createOpenAI({ apiKey });

  let output: unknown;
  try {
    const result = await generateText({
      model: provider(modelId),
      instructions: INSTRUCTIONS,
      prompt: `Digest of a public GitHub repository. Write the analysis from this digest only.\n\n${formatDigest(digest)}`,
      output: Output.object({
        name: "RepositoryAnalysis",
        description:
          "Plain-English repository analysis with a Mermaid diagram and a run guide.",
        schema: modelAnalysisSchema,
      }),
      abortSignal: AbortSignal.timeout(50_000),
      maxRetries: 1,
    });
    output = result.output;
  } catch (error) {
    throw mapModelError(error, modelId);
  }

  const mermaid = readMermaidSource(
    output && typeof output === "object" && "mermaid" in output && typeof output.mermaid === "string"
      ? output.mermaid
      : "",
  );
  const candidate = {
    ...(output && typeof output === "object" ? output : {}),
    mermaid: mermaid ?? "",
    owner: digest.owner,
    repo: digest.repo,
    defaultBranch: digest.defaultBranch,
    description: digest.description || readDescription(output),
    source: "live" as const,
  };
  const parsed = analyzeResultSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new AnalysisError(
      "The model returned an analysis that did not match the expected shape.",
      502,
    );
  }
  return parsed.data;
}

function readDescription(output: unknown): string {
  if (!output || typeof output !== "object" || !("description" in output)) {
    return "";
  }
  return typeof output.description === "string" ? output.description : "";
}

function mapModelError(error: unknown, modelId: string): AnalysisError {
  if (error instanceof AnalysisError) {
    return error;
  }
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return new AnalysisError("The model took too long to respond. Try again.", 504);
  }
  if (NoObjectGeneratedError.isInstance(error)) {
    return new AnalysisError(
      "The model did not return a valid analysis. Try again.",
      502,
    );
  }
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401) {
      return new AnalysisError("OpenAI rejected the API key. Check OPENAI_API_KEY.", 502);
    }
    if (error.statusCode === 404) {
      return new AnalysisError(
        `OpenAI model "${modelId}" was not found. Set OPENAI_MODEL to a model your key can use.`,
        502,
      );
    }
    return new AnalysisError("OpenAI could not complete the analysis. Try again in a moment.", 502);
  }
  console.error("RepoLens analysis failed", error instanceof Error ? error.message : "unknown");
  return new AnalysisError("OpenAI could not complete the analysis. Try again in a moment.", 502);
}
