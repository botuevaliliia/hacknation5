# Deployable demo agents (HTTP)

These are **small standalone Node HTTP services** that sellers deploy (Fly.io, Railway, Render, etc.), then list on the AgentValue marketplace by choosing the matching **catalog `service_id`** and pasting the **public base URL** on **Provider → Products**.

## Shared invoke contract

Each server implements:

| Method | Path | Purpose |
|--------|------|--------|
| `GET` | `/health` | Liveness JSON `{ "ok": true, "service": "<id>" }` |
| `POST` | `/invoke` | Run the agent (default path; override via product `invoke_path` if you fork) |

### `POST /invoke` request body

```json
{
  "task": "Human-readable task from the buyer (may mirror marketplace order task).",
  "input": { },
  "service_contract": "optional string from catalog row (provider_service_id)"
}
```

The marketplace gateway forwards the buyer’s JSON **as `input`** (same shape as `Buy` / `POST /api/orders` body field `input`).

### `POST /invoke` response body

```json
{
  "success": true,
  "output": { },
  "cost_usd": 0
}
```

On failure:

```json
{
  "success": false,
  "error": "short message",
  "output": { }
}
```

## Services

| Folder | Catalog `service_id` (in main app seed) | Port (local default) |
|--------|-------------------------------------------|----------------------|
| `echo/` | `external_agent_echo` | `3001` |
| `product-catalog/` | `external_agent_product_catalog` | `3002` |
| `hackathon-teams/` | `external_agent_hackathon_teams` | `3003` |
| `sentiment/` | `external_agent_sentiment` | `3004` |
| `capitals/` | `external_agent_capitals` | `3005` |

Each folder has its own `README.md` with **input fields** and **example curl**.

## Local tryout

From a folder:

```bash
cd echo && npm install && PORT=3001 npm start
```

In the web app, create a provider product linked to `external_agent_echo` and set **Base URL** to `http://127.0.0.1:3001` (non-production only) or use `ALLOW_HTTP_EXTERNAL_AGENTS=true` on the server (see `web/.env.example`).

## Deploy (example: Fly.io)

```bash
cd echo
fly launch --name your-echo-agent --internal-port 3001
fly deploy
```

Use the issued `https://....fly.dev` as **Base URL** (no trailing path; path defaults to `/invoke`).

## Deploy on Render (recommended flow)

1. **Push** this monorepo to GitHub (Render pulls from Git; your `main` branch is fine).
2. Create **one Render Web Service per agent** (five services if you want all five live). You do **not** need five separate GitHub repos.
3. For each service: **New → Web Service** → connect the repo → then set:
   - **Root Directory**: e.g. `demo-agent-apis/echo` (or `demo-agent-apis/product-catalog`, …).
   - **Runtime**: **Node** (simplest) — **Build Command**: `npm install` — **Start Command**: `npm start`.  
     Render sets **`PORT`** automatically; each `server.mjs` already uses `process.env.PORT`.
   - Alternatively pick **Docker** and point Render at that folder’s `Dockerfile` (same root directory).
4. After deploy, copy the service URL (`https://something.onrender.com`) — **no trailing `/invoke`** — into the marketplace product **Base URL**.

**Free tier note:** Render free web services **spin down when idle**; the first request after sleep can take tens of seconds. For a judge demo, hit `/health` once before the live buy flow, or use a paid instance for the session.

**Same repo, five roots:** repeat step 2–3 with root `demo-agent-apis/echo`, `demo-agent-apis/product-catalog`, `demo-agent-apis/hackathon-teams`, `demo-agent-apis/sentiment`, `demo-agent-apis/capitals`.
