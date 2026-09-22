import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, generateText, NoObjectGeneratedError, Output } from "ai";
import type { RepoDigest } from "@/lib/github";
import { analysisShapeErrorMessage, normalizeAnalysis } from "@/lib/normalize-analysis";
import { fitDigest } from "@/lib/summarize";
import {
  analyzeResultSchema,
  modelAnalysisSchema,
  type AnalyzeResult,
} from "@/lib/schemas";

const DEFAULT_MODEL = "gpt-5.6-luna";

const INSTRUCTIONS = `You are RepoLens. Your primary job is a master rebuild prompt for ChatGPT-astra. Explain, diagram, and run guide are secondary and must come from the same digest.

Use only the digest. Do not invent files, commands, frameworks, packages, or scripts the digest does not support. If evidence is thin, say what is known and what is uncertain.
The digest is a hybrid sample: ranked manifests, entrypoints, and config, plus an omissions list. It is not a full repository dump. File bodies may already be deterministic summaries.

master.identity, master.stack, master.moduleMap, master.entryPoints, master.runtime, master.interfaces, master.data, and master.rebuildOrder are prompt-ready prose for ChatGPT-astra.
master.runtime must cover install, build, test, and start, and must say when a command is missing.
master.rebuildOrder is a phased file-create list using real paths.
Do not write a honesty section. The server appends real omissions.

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
  const fitted = fitDigest(digest);

  let output: unknown;
  try {
    const result = await generateText({
      model: provider(modelId),
      instructions: INSTRUCTIONS,
      prompt: `Hybrid digest of a public GitHub repository. Write the master rebuild sections first, then the secondary panels, from this digest only.\n\n${fitted.text}`,
      output: Output.object({
        name: "RepositoryAnalysis",
        description:
          "Master rebuild prompt for ChatGPT-astra, plus a plain-English explainer, Mermaid diagram, and run guide.",
        schema: modelAnalysisSchema,
      }),
      abortSignal: AbortSignal.timeout(50_000),
      maxRetries: 1,
    });
    output = result.output;
  } catch (error) {
    throw mapModelError(error, modelId);
  }

  const parsed = analyzeResultSchema.safeParse(normalizeAnalysis(output, fitted.digest));
  if (!parsed.success) {
    throw new AnalysisError(analysisShapeErrorMessage(parsed.error), 502);
  }
  return parsed.data;
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
