import type { AnalyzeResult } from "@/lib/schemas";

export function RepoHeader({
  owner,
  repo,
  branch,
  source,
}: {
  owner: string;
  repo: string;
  branch: string;
  source: AnalyzeResult["source"];
}) {
  return (
    <header className="repo-header">
      <div>
        <p className="eyebrow">{source === "mock" ? "Sample" : "Live analysis"}</p>
        <h2 className="repo-title">
          <a
            href={`https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`}
            target="_blank"
            rel="noreferrer"
          >
            {owner}/{repo}
          </a>
        </h2>
      </div>
      <p className="branch">
        Branch <code>{branch}</code>
      </p>
    </header>
  );
}
