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

const INSTRUCTIONS = `You are RepoLens. Your primary job is a master rebuild prompt an expert software engineer can follow to rebuild this public repository. A short explainer is secondary and must come from the same digest.

Use only the digest. Do not invent files, commands, frameworks, packages, ports, secrets, or scripts the digest does not support. If evidence is thin, say what is known and what is uncertain. Public sources only.
The digest is a hybrid sample: ranked manifests, entrypoints, and config, plus an omissions list. It is not a full repository dump. File bodies may already be deterministic summaries.

Return master section bodies only. Do not add markdown headings, a preamble, or a honesty section. The server adds the preamble, the nine numbered headings, and the honesty block from real omissions.

Each master section is a concrete checklist, one fact or command per line, in this order:
- identity: repository, default branch, description, language, license, topics, then what the README says the project does.
- stack: language, package manager when a lockfile or manifest shows it, then dependencies named in each fetched manifest (name the file). If a manifest was fetched and listed none, say so. If a manifest was only listed, say it was not fetched.
- moduleMap: top-level entries, module roots, then notable paths grouped by directory. Mark paths that were not fetched.
- entryPoints: one path per line, fetched or listed-only. If none, say not to invent a main file.
- runtime: Install, Build, Test, then Start. Quote the script body when the manifest has one. If a command is missing, say it is missing.
- interfaces: config paths, env key names from examples (never values), and env names seen in fetched code. If none, say not to invent environment variables.
- data: schemas, migrations, network calls, and filesystem writes evidenced by paths or fetched files. If none, say not to add a database.
- rebuildOrder: Phase 1 manifests, Phase 2 config and env examples, Phase 3 entry points, Phase 4 other known paths, Phase 5 the commands from runtime. Use real paths and mark fetched versus listed. Say to regenerate lockfiles rather than paste them.

explain.summary is plain English, two to four sentences, with no markdown headings.
explain.stack lists only languages, frameworks, and tools the digest supports.
Do not add any other fields. Do not write HTML. Do not name a model, vendor, or chat product in any field.`;

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
      prompt: `Hybrid digest of a public GitHub repository. Write the master rebuild sections first, then the short explainer, from this digest only.\n\n${fitted.text}`,
      output: Output.object({
        name: "RepositoryAnalysis",
        description:
          "Master rebuild prompt for an expert software engineer, plus a short plain-English explainer.",
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
