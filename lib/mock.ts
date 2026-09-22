import type { RepoRef } from "@/lib/github";
import type { AnalyzeResult } from "@/lib/schemas";

export function buildMockResult(ref: RepoRef): AnalyzeResult {
  return {
    owner: ref.owner,
    repo: ref.repo,
    defaultBranch: "main",
    description: "Deterministic sample. GitHub and OpenAI were not called.",
    source: "mock",
    explain: {
      summary: `Sample explainer for ${ref.owner}/${ref.repo}. RepoLens skipped the model and returned this fixed analysis so the three panels can be reviewed without an API key. The same repository always produces the same sample while mock mode is on.`,
      purpose:
        "Show the Explain, Mermaid, and How to run panels with a stable payload.",
      audience: "Developers trying RepoLens locally, in CI, or before adding an OpenAI key.",
      stack: ["Next.js", "TypeScript", "OpenAI structured outputs"],
      highlights: [
        "Live mode summarizes the tree, README, and a few key files on the server.",
        "The browser receives the structured analysis only, not the raw file tree.",
        "Mock mode is selected with REPOLENS_MOCK=1 or with mock set to true.",
      ],
    },
    mermaid: `flowchart TD
  paste[Paste GitHub URL] --> api[Analyze request]
  api --> digest[Server-side digest]
  digest --> model[Structured output]
  model --> explain[Explain]
  model --> diagram[Mermaid]
  model --> run[How to run]`,
    run: {
      prerequisites: [
        "Node.js 22 or newer",
        "An OpenAI API key when you leave mock mode",
      ],
      steps: [
        {
          title: "Install dependencies",
          detail: "npm install",
        },
        {
          title: "Configure environment",
          detail:
            "Copy .env.example to .env.local. Set OPENAI_API_KEY for live analysis, or set REPOLENS_MOCK=1 to keep this sample.",
        },
        {
          title: "Start the app",
          detail: "npm run dev, then open the printed local URL.",
        },
        {
          title: "Analyze a repository",
          detail: `Submit ${ref.owner}/${ref.repo}. Turn off the sample checkbox for a live reading of a public repository.`,
        },
      ],
      keyPaths: [
        {
          path: "app/api/analyze/route.ts",
          why: "Accepts the repository URL and returns the three-panel analysis.",
        },
        {
          path: "lib/github.ts",
          why: "Builds the server-side digest from the GitHub API.",
        },
        {
          path: "lib/openai.ts",
          why: "Requests structured JSON from OPENAI_MODEL.",
        },
        {
          path: "components/Diagram.tsx",
          why: "Renders the Mermaid diagram in the browser.",
        },
      ],
    },
  };
}
