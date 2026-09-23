"use client";

import type { FormEvent } from "react";

const EXAMPLES = [
  "vercel/next.js",
  "fastapi/fastapi",
  "facebook/react",
  "microsoft/vscode",
  "django/django",
] as const;

export function Hero({
  url,
  mock,
  loading,
  onUrlChange,
  onMockChange,
  onSubmit,
  onExample,
}: {
  url: string;
  mock: boolean;
  loading: boolean;
  onUrlChange: (value: string) => void;
  onMockChange: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onExample: (repo: string) => void;
}) {
  return (
    <section className="hero">
      <h1>Rebuild any public repository.</h1>
      <p className="hero-lead">
        A master rebuild prompt, plus a short plain-English reading of the stack.
      </p>
      <form className="hero-form" onSubmit={onSubmit}>
        <label htmlFor="repo-url">Repository</label>
        <div className="hero-row">
          <input
            id="repo-url"
            name="url"
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder="github.com/owner/repo"
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={mock}
            onChange={(event) => onMockChange(event.target.checked)}
          />
          Sample response
        </label>
        <p className="hint">
          Sample mode skips the network and returns a master prompt. Live mode uses the
          keys configured on the server.
        </p>
      </form>
      <div className="examples">
        <p>Try a repository</p>
        <ul>
          {EXAMPLES.map((repo) => (
            <li key={repo}>
              <button type="button" onClick={() => onExample(repo)} disabled={loading}>
                {repo}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p className="url-trick">
        owner/repo, a github.com link, a /blob/ URL, or git@github.com:owner/repo.git.
      </p>
    </section>
  );
}
