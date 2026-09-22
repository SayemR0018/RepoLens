# RepoLens

Paste a public GitHub URL. The primary result is a **master prompt** for ChatGPT-astra that can rebuild the project. The same response also includes:

1. **Explain** — a plain-English reading of the project
2. **Diagram** — an architecture diagram rendered in the browser
3. **Run** — setup steps and the paths that matter

The server does not send the repository to the model. It ranks manifests, entrypoints, and config, fetches a capped set of those files, summarizes anything that would overflow the digest, and records omissions (binaries, Git LFS pointers, lockfiles, unread paths, a truncated tree, clipped text). Private repositories fail closed.

## Requirements

- Node.js 22 or newer
- An OpenAI API key for live analysis

## Local setup

```bash
npm install
cp .env.example .env.local
```

Set `OPENAI_API_KEY` in `.env.local`. `OPENAI_MODEL` defaults to `gpt-5.6-luna`. Set `GITHUB_TOKEN` for live multi-file fetch. Without it, a GitHub rate limit fails the request and names the missing token. Delete `REPOLENS_MOCK` (or leave it empty) for live analysis.

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

`mock` is optional. A successful response matches the `AnalyzeResult` schema: repository identity, `masterPrompt` (required), `omissions`, plus `explain`, `mermaid`, and `run`. The master prompt has nine sections: identity, stack and dependencies, module map, entry points, runtime (install, build, test, start), interfaces and env, data and side effects, phased rebuild order, and an honesty block built from `omissions`.

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
   - `OPENAI_MODEL` — `gpt-5.6-luna` (or another model your key can call)
   - `GITHUB_TOKEN` — set this for live multi-file fetch; without it a rate limit returns a clear error
   - `REPOLENS_MOCK` — delete or leave empty for live analysis, or `1` to force the sample
5. Deploy. Open the deployment URL, paste a public repository, and confirm Master Prompt, Explain, Diagram, and Run.

Do not commit `.env`, `.env.local`, or real API keys. `.env.example` lists the variable names only. The browser never receives `OPENAI_API_KEY` or `GITHUB_TOKEN`.

### Redeploy the existing project

The live app is the Vercel project `repo-lens` at https://repo-lens-nine-iota.vercel.app. Use that project. Do not create a second one, and do not put API keys in the client.

1. Merge this change to `main`. If the Git integration auto-deploys `main`, wait for that deployment. Otherwise open the project and redeploy by hand.
2. In Vercel, open **repo-lens → Settings → Environment Variables** and confirm Production has `OPENAI_API_KEY`. Set `OPENAI_MODEL` to `gpt-5.6-luna` and set `GITHUB_TOKEN` so live multi-file fetch stays under the higher rate limit. Delete `REPOLENS_MOCK` for live analysis.
3. Open **Deployments**, select the latest `main` deployment, and choose **Redeploy**. Redeploy uses the existing project settings.
4. When the deployment is Ready, open https://repo-lens-nine-iota.vercel.app.
5. Turn on **Sample response**, analyze `owner/repo`, and confirm Master Prompt is the first panel with a copy button. The Diagram tab should show labeled boxes rather than an empty frame.
6. Turn sample mode off and analyze `SayemR0018/dokanBhai__dbmsLAB`. The live diagram should be a `flowchart TD` whose nodes include Browser, React, and Supabase.

## Smoke checklist

- `npm run build` completes
- `POST /api/analyze` with `{ "url": "owner/repo", "mock": true }` returns `masterPrompt`, `omissions`, `explain`, `mermaid`, and `run` without calling GitHub or OpenAI
- An unknown repository returns a not-found or private error
- Live mode without `OPENAI_API_KEY` names the missing key and does not invent panels
- Sample mode shows a visible diagram: flowchart boxes and labels, not an empty panel
- Live mermaid for `SayemR0018/dokanBhai__dbmsLAB` is a `flowchart TD` with Browser → React → Supabase
- While a request is in flight the page shows Fetching tree, Reading files, and Generating — not a blank screen
