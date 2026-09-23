"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Hero } from "@/components/Hero";
import { Progress } from "@/components/Progress";
import { RepoHeader } from "@/components/RepoHeader";
import { ResultTabs } from "@/components/ResultTabs";
import { analyzeResultSchema, type AnalyzeResult } from "@/lib/schemas";

export function Analyzer() {
  const [url, setUrl] = useState("");
  const [mock, setMock] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [stage, setStage] = useState(0);
  const [requestId, setRequestId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (status !== "loading") {
      return;
    }
    const first = window.setTimeout(() => setStage(1), 800);
    const second = window.setTimeout(() => setStage(2), 1700);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, [status, requestId]);

  function analyze(nextUrl: string) {
    const submitted = nextUrl.trim();
    if (!submitted) {
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setUrl(submitted);
    setRequestId((current) => current + 1);
    setStage(0);
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

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    analyze(url);
  }

  return (
    <div className="analyzer">
      <Hero
        url={url}
        mock={mock}
        loading={status === "loading"}
        onUrlChange={setUrl}
        onMockChange={setMock}
        onSubmit={onSubmit}
        onExample={analyze}
      />

      {status === "idle" ? (
        <p className="empty-state">
          Nothing analyzed yet. The master rebuild prompt shows up here, with a short explainer.
        </p>
      ) : null}

      {status === "loading" ? <Progress stage={stage} /> : null}

      {status === "error" && error ? (
        <div className="banner" role="alert">
          <p className="banner-title">Analysis failed</p>
          <p>{error}</p>
        </div>
      ) : null}

      {result ? (
        <div className="results">
          <RepoHeader
            owner={result.owner}
            repo={result.repo}
            branch={result.defaultBranch}
            source={result.source}
          />
          {result.description ? <p className="repo-description">{result.description}</p> : null}
          <p className="digest-note">
            {result.source === "mock"
              ? "This sample did not fetch the repository. The master prompt is a fixture, and the raw tree is never sent to the browser."
              : "Built from a capped server-side digest of ranked manifests, entrypoints, and config. The raw tree stays on the server."}
          </p>
          <ResultTabs result={result} />
        </div>
      ) : null}
    </div>
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
