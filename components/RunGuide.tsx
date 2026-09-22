"use client";

import { CopyButton } from "@/components/CopyButton";
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
    <div className="panel-body">
      {run.prerequisites.length > 0 ? (
        <>
          <h3>Prerequisites</h3>
          <ul className="points">
            {run.prerequisites.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}
      <h3>Steps</h3>
      <ol className="steps">
        {run.steps.map((step, index) => (
          <li key={`${step.title}:${step.detail}:${index}`}>
            <div className="step-row">
              <p className="step-title">{step.title}</p>
              <CopyButton text={step.detail} label="Copy" />
            </div>
            <p>{step.detail}</p>
          </li>
        ))}
      </ol>
      <h3>Key paths</h3>
      <ul className="paths">
        {run.keyPaths.map((item, index) => (
          <li key={`${item.path}:${item.why}:${index}`}>
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
    </div>
  );
}

function blobUrl(owner: string, repo: string, branch: string, path: string): string {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/blob/${encodeURIComponent(branch)}/${encodedPath}`;
}
