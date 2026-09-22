# RepoLens

Paste a public GitHub URL and get three panels:

1. **Explain** — a plain-English reading of the project
2. **Mermaid** — an architecture diagram rendered in the browser
3. **How to run** — setup steps and the paths that matter

The server fetches the repository tree, README, and a handful of key files, then sends a clipped digest to OpenAI structured outputs. The browser receives only that analysis. The raw tree is not returned to the UI.

## Requirements

- Node.js 22 or newer
- An OpenAI API key for live analysis

## Local setup

```bash
npm install
cp .env.example .env.local
```

Set `OPENAI_API_KEY` in `.env.local`. `OPENAI_MODEL` defaults to `gpt-6`. `GITHUB_TOKEN` is optional; public repositories work without it.

```bash
npm run dev
```

Open the URL printed by Next.js. Submit `github.com/owner/repo` or `owner/repo`.

### Sample mode

Either of these skips GitHub and OpenAI and returns a deterministic sample:

- check **Sample response** in the form (`{ "url", "mock": true }`)
- set `REPOLENS_MOCK=1`

## API

`POST /api/analyze`

```json
{ "url": "github.com/owner/repo", "mock": false }
```

`mock` is optional. A successful response matches the `AnalyzeResult` schema: repository identity plus `explain`, `mermaid`, and `run`.

Errors:

| Status | When |
| --- | --- |
| 400 | Missing or invalid URL, or a non-JSON body |
| 404 | Repository not found or private |
| 409 | Repository has no commits |
| 429 | GitHub rate limit (set `GITHUB_TOKEN`) |
| 500 | `OPENAI_API_KEY` is missing in live mode |
| 502 | GitHub or OpenAI failed |

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Deploy on Vercel

1. Push this repository to GitHub.
2. In Vercel, choose **Add New… → Project** and import the RepoLens repository.
3. Framework preset: **Next.js**. Build command `npm run build`, output handled by Next.js. No extra install flags.
4. Add environment variables:
   - `OPENAI_API_KEY` — your key
   - `OPENAI_MODEL` — `gpt-6` (or another model your key can call)
   - `GITHUB_TOKEN` — optional, recommended for rate limits
   - `REPOLENS_MOCK` — leave empty for live analysis, or `1` to force the sample
5. Deploy. Open the deployment URL, paste a public repository, and confirm the three panels.

Do not commit `.env`, `.env.local`, or real API keys. `.env.example` lists the variable names only.

## Smoke checklist

- `npm run build` completes
- `POST /api/analyze` with `{ "url": "owner/repo", "mock": true }` returns `explain`, `mermaid`, and `run`
- An unknown repository returns a not-found or private error
- Live mode without `OPENAI_API_KEY` names the missing key and does not invent panels
- The page shows all three panels for a sample response, and the diagram renders
