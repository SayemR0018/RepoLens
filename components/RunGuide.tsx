import type { AnalyzeResult } from "@/lib/schemas";

export function RunGuide({
  run,
  owner,
  repo,
  branch,
  source,
}: {
  run: AnalyzeResult["run"];
  owner: string;
  repo: string;
  branch: string;
  source: AnalyzeResult["source"];
}) {
  return (
    <section className="panel" aria-labelledby="run-heading">
      <div className="panel-kicker">
        <span>03</span>
        <h2 id="run-heading">How to run</h2>
      </div>
      {run.prerequisites.length > 0 ? (
        <>
          <h3>Prerequisites</h3>
          <ul className="points">
            {run.prerequisites.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}
      <h3>Steps</h3>
      <ol className="steps">
        {run.steps.map((step) => (
          <li key={`${step.title}:${step.detail}`}>
            <p className="step-title">{step.title}</p>
            <p>{step.detail}</p>
          </li>
        ))}
      </ol>
      <h3>Key paths</h3>
      <ul className="paths">
        {run.keyPaths.map((item) => (
          <li key={`${item.path}:${item.why}`}>
            {source === "live" ? (
              <a
                href={blobUrl(owner, repo, branch, item.path)}
                target="_blank"
                rel="noreferrer"
              >
                <code>{item.path}</code>
              </a>
            ) : (
              <code>{item.path}</code>
            )}
            <p>{item.why}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function blobUrl(owner: string, repo: string, branch: string, path: string): string {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/blob/${encodeURIComponent(branch)}/${encodedPath}`;
}
