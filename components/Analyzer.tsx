"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Explain } from "@/components/Explain";
import { RunGuide } from "@/components/RunGuide";
import { analyzeResultSchema, type AnalyzeResult } from "@/lib/schemas";

const Diagram = dynamic(
  () => import("@/components/Diagram").then((module) => module.Diagram),
  {
    ssr: false,
    loading: () => <DiagramFallback />,
  },
);

export function Analyzer() {
  const [url, setUrl] = useState("");
  const [mock, setMock] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitted = url.trim();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("loading");
    setError(null);
    setResult(null);

    void requestAnalysis(submitted, mock, controller.signal)
      .then((analysis) => {
        if (controller.signal.aborted) {
          return;
        }
        setResult(analysis);
        setStatus("ready");
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted || isAbortError(caught)) {
          return;
        }
        setStatus("error");
        setError(caught instanceof Error ? caught.message : "Analysis failed.");
      });
  }

  return (
    <div className="analyzer">
      <form className="query" onSubmit={onSubmit}>
        <label htmlFor="repo-url">GitHub repository</label>
        <div className="query-row">
          <input
            id="repo-url"
            name="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="github.com/owner/repo"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            required
          />
          <button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Analyzing…" : "Analyze"}
          </button>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={mock}
            onChange={(event) => setMock(event.target.checked)}
          />
          Sample response
        </label>
        <p className="hint">
          Sample mode skips GitHub and OpenAI and returns a deterministic analysis. Live mode
          uses OPENAI_API_KEY. Set REPOLENS_MOCK=1 to force the sample on the server.
        </p>
      </form>

      {status === "loading" ? (
        <p className="status" role="status">
          Reading the repository and preparing the three panels…
        </p>
      ) : null}
      {error ? (
        <p className="banner" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="results">
          <header className="result-head">
            <div>
              <p className="eyebrow">
                {result.source === "mock" ? "Sample" : "Live analysis"}
              </p>
              <p className="repo-title">
                <a
                  href={`https://github.com/${encodeURIComponent(result.owner)}/${encodeURIComponent(result.repo)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {result.owner}/{result.repo}
                </a>
              </p>
              {result.description ? <p>{result.description}</p> : null}
            </div>
            <p className="branch">
              Branch <code>{result.defaultBranch}</code>
            </p>
          </header>
          <p className="digest-note">
            {result.source === "mock"
              ? "This sample did not fetch the repository. The raw tree is never sent to the browser."
              : "Built from a server-side digest of the tree, README, and key files. The raw tree stays on the server."}
          </p>
          <div className="panels">
            <Explain explain={result.explain} />
            <Diagram chart={result.mermaid} />
            <RunGuide
              run={result.run}
              owner={result.owner}
              repo={result.repo}
              branch={result.defaultBranch}
              source={result.source}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DiagramFallback() {
  return (
    <section className="panel panel-diagram" aria-busy="true">
      <div className="panel-kicker">
        <span>02</span>
        <h2>Mermaid</h2>
      </div>
      <p className="muted">Loading diagram renderer…</p>
    </section>
  );
}

async function requestAnalysis(
  url: string,
  mock: boolean,
  signal: AbortSignal,
): Promise<AnalyzeResult> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mock ? { url, mock: true } : { url }),
    signal,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(readError(payload, response.status));
  }
  const parsed = analyzeResultSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("The server returned an unexpected analysis.");
  }
  return parsed.data;
}

function readError(payload: unknown, status: number): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string" &&
    payload.error.trim()
  ) {
    return payload.error;
  }
  if (status === 404) {
    return "Repository not found or private. RepoLens only reads public repositories.";
  }
  return "Analysis failed.";
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
