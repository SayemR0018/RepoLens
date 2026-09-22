import { AnalysisError, analyzeDigest } from "@/lib/openai";
import { buildDigest, GitHubError, parseGitHubUrl } from "@/lib/github";
import { buildMockResult } from "@/lib/mock";
import { analyzeRequestSchema, analyzeResultSchema } from "@/lib/schemas";

export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = analyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Provide a GitHub repository URL.";
    return Response.json({ error: message }, { status: 400 });
  }

  try {
    const ref = parseGitHubUrl(parsed.data.url);
    const useMock = process.env.REPOLENS_MOCK === "1" || parsed.data.mock === true;
    if (useMock) {
      return Response.json(analyzeResultSchema.parse(buildMockResult(ref)));
    }
    const digest = await buildDigest(ref);
    const result = await analyzeDigest(digest);
    return Response.json(result);
  } catch (error) {
    if (error instanceof GitHubError || error instanceof AnalysisError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("RepoLens request failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "Analysis failed." }, { status: 500 });
  }
}
