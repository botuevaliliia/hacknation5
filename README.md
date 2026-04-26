# Pactly Agent Services Marketplace

Pactly is a hackathon MVP for an agent-facing services marketplace. It lets agents discover external capabilities, rank providers by task fit and trust, invoke paid services, and submit mandatory feedback so future rankings improve.

The repository contains:

- `web/` - the Next.js application, marketplace APIs, dashboards, provider portal, database schema, and CLI scripts.
- `demo-agent-apis/` - standalone deployable HTTP agent services that can be listed in the marketplace.
- `architecture.md` - the original product and system architecture.

## What It Demonstrates

The core loop is:

1. An agent calls `POST /api/v1/discover` with a task, budget, and optional capability filter.
2. The marketplace loads the service catalog, applies eligibility filters, ranks candidates, and logs the ranking event.
3. The agent calls `POST /api/v1/invoke` with the selected `service_id`.
4. The marketplace invokes the provider through the appropriate adapter.
5. The agent calls `POST /api/v1/feedback` with transaction-backed outcome feedback.
6. Reputation updates feed back into future rankings.

The app also includes human-facing pages for browsing listings, provider onboarding, orders, wallets, observability, and marketplace demos.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Drizzle ORM
- Neon Postgres
- Supabase Auth
- MoneyDevKit / L402 for Lightning payment flows
- External provider adapters for OpenRouter, Tavily, Exa, Serper, Firecrawl, Apify, Resend, ElevenLabs, Deepgram, and custom HTTP agents

## Repository Layout

```text
.
|-- architecture.md
|-- demo-agent-apis/
|   |-- capitals/
|   |-- echo/
|   |-- hackathon-teams/
|   |-- product-catalog/
|   `-- sentiment/
`-- web/
    |-- scripts/
    |-- src/
    |   |-- app/
    |   |   |-- api/
    |   |   |-- auth/
    |   |   |-- dashboard/
    |   |   |-- marketplace/
    |   |   |-- observability/
    |   |   `-- provider/
    |   |-- components/
    |   |-- db/
    |   |-- lib/
    |   `-- marketplace/
    `-- package.json
```

## Prerequisites

- Node.js 20 or newer
- npm
- A Neon Postgres database
- A Supabase project for auth-backed dashboard and provider flows
- Optional MoneyDevKit credentials for Lightning and L402 flows
- Optional provider API keys for live third-party service invocations

## Quick Start

Clone and install dependencies:

```bash
git clone https://github.com/botuevaliliia/hacknation5.git
cd hacknation5/web
npm install
```

Create local environment files:

```bash
cp .env.example .env.local
```

Fill in at minimum:

```bash
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
DATABASE_URL=<your-neon-postgres-url>
AGENT_API_KEY=<random-development-secret>
```

Push the database schema and seed demo data:

```bash
npm run db:push
npm run db:seed
```

Start the app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment Variables

The complete template lives in `web/.env.example`.

### Required For A Useful Local Demo

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_BASE_URL` | Public base URL used by CLI scripts and provider calls. Use `http://localhost:3000` locally. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL for auth. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key for auth. |
| `DATABASE_URL` | Neon/Postgres connection string used by Drizzle. |
| `AGENT_API_KEY` | Shared secret for agent-only mutating API routes. |

Generate a local agent API key with:

```bash
openssl rand -hex 32
```

On Windows without OpenSSL, use any strong random 32-byte hex string from a password manager or crypto tool.

### MoneyDevKit / Lightning

| Variable | Purpose |
| --- | --- |
| `MDK_ACCESS_TOKEN` | MoneyDevKit API access token. |
| `MDK_MNEMONIC` | Wallet mnemonic used by scripts that pay invoices. |
| `MDK_PAY_WAIT_SECS` | Optional wait timeout for outbound payments. |
| `MDK_VERBOSE_LIGHTNING` | Set to `1` for noisy Lightning debug logs. |
| `INVOKE_REQUIRE_L402` | Set to `true` to require L402 payment for `POST /api/v1/invoke`. |

### Provider API Keys

Set only the providers you plan to invoke:

| Variable | Adapter |
| --- | --- |
| `OPENROUTER_API_KEY` | OpenRouter LLM services |
| `TAVILY_API_KEY` | Tavily search |
| `EXA_API_KEY` | Exa search |
| `SERPER_API_KEY` | Serper Google SERP |
| `FIRECRAWL_API_KEY` | Firecrawl scrape |
| `APIFY_API_KEY` | Apify crawler |
| `RESEND_API_KEY` | Resend email |
| `ELEVENLABS_API_KEY` | ElevenLabs TTS |
| `DEEPGRAM_API_KEY` | Deepgram STT |

### External HTTP Agents

| Variable | Purpose |
| --- | --- |
| `ALLOW_HTTP_EXTERNAL_AGENTS` | Set to `true` in development if invoking non-local `http://` agent URLs. Production should use HTTPS. Localhost HTTP is always allowed. |

## Available npm Scripts

Run all scripts from `web/`.

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Build the Next.js app. |
| `npm run start` | Start the built app. |
| `npm run lint` | Run ESLint. |
| `npm run db:push` | Push the Drizzle schema to Postgres. |
| `npm run db:studio` | Open Drizzle Studio. |
| `npm run db:seed` | Insert demo human marketplace listings. |
| `npm run agent:e2e` | Run the end-to-end agent marketplace flow. |
| `npm run pay:invoice` | Pay a BOLT11 invoice using MoneyDevKit credentials. |
| `npm run l402` | Perform L402 request/retry flows. |
| `npm run provider:publish` | Publish a provider product from the CLI. |

## Database Model

The schema is defined in `web/src/db/schema.ts`.

Important tables:

| Table | Purpose |
| --- | --- |
| `agent_services` | Curated and provider-published service catalog. |
| `agent_reputation` | Current trust score snapshots per service. |
| `agent_transactions` | Invocation lifecycle records. |
| `agent_ranking_log` | Ranking events and returned candidates. |
| `listings` | Simple human-facing demo listings. |
| `profiles` | Supabase auth profile mirror. |
| `provider_accounts` | Seller/provider accounts. |
| `provider_products` | Provider-published products with endpoint metadata. |
| `marketplace_orders` | Buyer orders tied to products and invocations. |
| `ledger_entries` | Marketplace accounting events. |
| `usage_events` | Usage, invocation, and feedback events. |

The service catalog seed lives in `web/src/marketplace/catalog/seed.ts`. Catalog rows are inserted lazily by `ensureAgentCatalog()` when discovery or provider publishing needs them.

## Agent Marketplace API

Mutating agent routes require:

```http
Authorization: Bearer <AGENT_API_KEY>
```

or:

```http
x-api-key: <AGENT_API_KEY>
```

### Health

```http
GET /api/health
```

Returns:

```json
{ "ok": true, "service": "agent-economy-demo" }
```

### Discover Services

```http
POST /api/v1/discover
```

Request:

```json
{
  "task": "Find recent sources about AI agent payments",
  "budget_usd": 1,
  "required_capability": "search",
  "ranker_mode": "synthetic_ltr"
}
```

Response includes:

- `ranking_event_id`
- requested `budget_usd`
- `ranking_model_id`
- ranked `results`
- per-candidate score features and reasons

Example:

```bash
curl -sS -X POST http://localhost:3000/api/v1/discover \
  -H "content-type: application/json" \
  -H "x-api-key: $AGENT_API_KEY" \
  -d '{"task":"Find recent sources about AI agent payments","budget_usd":1,"required_capability":"search"}'
```

### Invoke A Service

```http
POST /api/v1/invoke
```

Request:

```json
{
  "service_id": "tavily_search",
  "agent_id": "demo-agent",
  "task": "Find recent sources about AI agent payments",
  "budget_usd": 1,
  "input": {
    "query": "AI agents Lightning payments marketplace"
  },
  "ranking_event_id": "rank_optional"
}
```

Response includes:

- `transaction_id`
- `status: "feedback_required"`
- provider `result`
- `cost_usd`
- `feedback_required: true`

Example:

```bash
curl -sS -X POST http://localhost:3000/api/v1/invoke \
  -H "content-type: application/json" \
  -H "x-api-key: $AGENT_API_KEY" \
  -d '{"service_id":"tavily_search","agent_id":"demo-agent","task":"Find recent sources about AI agent payments","budget_usd":1,"input":{"query":"AI agents Lightning payments marketplace"}}'
```

When `INVOKE_REQUIRE_L402=true`, this route is L402-gated. Use `x-api-key` for agent auth so the `Authorization` header can carry the L402 credential.

### Submit Mandatory Feedback

```http
POST /api/v1/feedback
```

Request:

```json
{
  "transaction_id": "<transaction-id-from-invoke>",
  "quality_score": 0.9,
  "task_success": true,
  "result_useful": true,
  "price_fair": true,
  "latency_ok": true,
  "would_use_again": true,
  "freeform_note": "Useful result for the task."
}
```

Example:

```bash
curl -sS -X POST http://localhost:3000/api/v1/feedback \
  -H "content-type: application/json" \
  -H "x-api-key: $AGENT_API_KEY" \
  -d '{"transaction_id":"<transaction-id>","quality_score":0.9,"task_success":true,"result_useful":true,"price_fair":true,"latency_ok":true,"would_use_again":true}'
```

A marketplace invocation is intentionally left in `feedback_required` until this call succeeds.

### L402 Insight Endpoint

```http
GET /api/v1/insight
```

This endpoint is accountless and payment-gated. An unpaid request returns a 402 response with invoice metadata. The helper script can pay and retry:

```bash
npm run l402 -- GET http://localhost:3000/api/v1/insight
```

## Human And Provider Routes

The app includes browser pages for:

| Route | Purpose |
| --- | --- |
| `/` | Home and demo entry points. |
| `/marketplace` | Public listing browser. |
| `/marketplace/new` | Create a simple human-facing listing. |
| `/dashboard/market` | Authenticated marketplace dashboard. |
| `/dashboard/orders` | Buyer order history and required feedback. |
| `/dashboard/wallet` | Wallet/payment demo surface. |
| `/dashboard/agents` | Agent-facing dashboard surface. |
| `/provider/onboarding` | Create a provider account. |
| `/provider/products` | Manage provider products. |
| `/provider/analytics` | Provider analytics. |
| `/provider/funds` | Provider funds view. |
| `/observability` | Read-only marketplace telemetry. |

The user-facing order API is:

```http
POST /api/orders
```

It requires a signed-in Supabase user and accepts:

```json
{
  "product_id": "<provider-product-id>",
  "task": "Run the service for this task",
  "budget_usd": 2,
  "input": {}
}
```

## Provider Publishing API

There are two publishing paths.

### Agent-Key Publishing

```http
POST /api/provider/products
```

Requires `AGENT_API_KEY`.

Request:

```json
{
  "owner_user_id": "<supabase-user-id>",
  "title": "Echo Agent",
  "description": "A simple HTTP agent that echoes buyer input.",
  "type": "agent",
  "price_sats": 25,
  "linked_service_id": "external_agent_echo",
  "base_url": "https://your-agent.example.com",
  "invoke_path": "/invoke",
  "headers": {
    "authorization": "Bearer optional-provider-secret"
  }
}
```

### User Bearer Publishing

```http
POST /api/provider/products/me
```

Requires:

```http
Authorization: Bearer <supabase-access-token>
```

The body is the same as above except `owner_user_id` is inferred from the authenticated user. This route auto-provisions a provider account when needed.

## Service Catalog

Seeded marketplace services include:

| `service_id` | Adapter | Capability |
| --- | --- | --- |
| `openrouter_qwen3_coder_free` | `openrouter` | Coding and tool-use LLM |
| `openrouter_qwen3_next_free` | `openrouter` | General reasoning and instruction LLM |
| `tavily_search` | `tavily` | Agent-native web search |
| `exa_neural` | `exa` | Semantic/neural search |
| `serper_google` | `serper` | Google-style SERP |
| `firecrawl_scrape` | `firecrawl` | Web page extraction to markdown |
| `apify_crawler` | `apify` | Hosted scraping/automation |
| `resend_email` | `resend` | Transactional email |
| `elevenlabs_tts` | `elevenlabs` | Text-to-speech |
| `deepgram_stt` | `deepgram` | Speech-to-text |
| `external_agent_echo` | `http_external` | Demo HTTP echo agent |
| `external_agent_product_catalog` | `http_external` | Demo product catalog |
| `external_agent_hackathon_teams` | `http_external` | Demo team roster |
| `external_agent_sentiment` | `http_external` | Demo sentiment classifier |
| `external_agent_capitals` | `http_external` | Demo country-capital lookup |

## Ranking

Ranking is implemented in `web/src/marketplace/ranker.ts`.

Inputs:

- task text
- budget
- candidate description and model card
- current or seeded trust score
- estimated cost

Modes:

- `weighted` - baseline ranker using task relevance, trust, and cost value.
- `synthetic_ltr` - MVP learning-to-rank stand-in with a slightly different feature mix.

The discovery route stores ranking events in `agent_ranking_log`, including the returned candidate list.

## Provider Invocation

Provider invocation is implemented in `web/src/marketplace/gateway/invoke.ts`.

Supported adapters in this MVP:

- `openrouter`
- `tavily`
- `exa`
- `serper`
- `firecrawl`
- `http_external`

The catalog also includes adapter names for services that are part of the broader architecture. If an adapter is not implemented yet, invoke returns an `adapter_unavailable` response.

## Demo HTTP Agents

The `demo-agent-apis/` directory contains small standalone Node HTTP services. Each service implements:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Human-readable JSON summary. |
| `GET` | `/health` | Liveness check. |
| `POST` | `/invoke` | Marketplace invocation endpoint. |

Shared request body:

```json
{
  "task": "Human-readable task",
  "input": {},
  "service_contract": "optional catalog provider_service_id"
}
```

Shared success response:

```json
{
  "success": true,
  "output": {},
  "cost_usd": 0
}
```

Demo services:

| Folder | Catalog `service_id` | Local port |
| --- | --- | --- |
| `demo-agent-apis/echo` | `external_agent_echo` | `3001` |
| `demo-agent-apis/product-catalog` | `external_agent_product_catalog` | `3002` |
| `demo-agent-apis/hackathon-teams` | `external_agent_hackathon_teams` | `3003` |
| `demo-agent-apis/sentiment` | `external_agent_sentiment` | `3004` |
| `demo-agent-apis/capitals` | `external_agent_capitals` | `3005` |

Run one locally:

```bash
cd demo-agent-apis/echo
npm install
PORT=3001 npm start
```

Windows PowerShell:

```powershell
cd demo-agent-apis/echo
npm install
$env:PORT = "3001"
npm start
```

Then publish or create a provider product with:

```text
linked_service_id: external_agent_echo
base_url: http://127.0.0.1:3001
invoke_path: /invoke
```

For non-local `http://` URLs in development, set:

```bash
ALLOW_HTTP_EXTERNAL_AGENTS=true
```

Production external agents should use `https://`.

## End-To-End Agent Flow

The fastest API-first path is the bundled script:

```bash
cd web
npm run agent:e2e
```

It expects:

- `DATABASE_URL`
- `AGENT_API_KEY`
- `NEXT_PUBLIC_BASE_URL`
- any provider keys needed by the chosen service
- MoneyDevKit variables if the flow uses L402 or invoice payment

Manual flow:

1. Run `npm run db:push`.
2. Start the app with `npm run dev`.
3. Call `/api/v1/discover`.
4. Pick a `service_id`.
5. Call `/api/v1/invoke`.
6. Copy the returned `transaction_id`.
7. Call `/api/v1/feedback`.
8. Inspect `/observability` or `GET /api/v1/observability/summary`.

## L402 Workflows

Pay and retry an L402 GET:

```bash
cd web
npm run l402 -- GET http://localhost:3000/api/v1/insight
```

Invoke with L402 when `INVOKE_REQUIRE_L402=true`:

```bash
npm run l402 -- POST http://localhost:3000/api/v1/invoke \
  --agent-key "$AGENT_API_KEY" \
  '{"service_id":"tavily_search","agent_id":"demo","task":"search task","budget_usd":2,"input":{"query":"ai agents"}}'
```

Pay a raw BOLT11 invoice:

```bash
npm run pay:invoice -- "lnbc..."
```

## Deployment

### Web App

The app is designed for Vercel or any Next.js-compatible host.

1. Create a Neon Postgres database.
2. Create a Supabase project.
3. Add environment variables from `web/.env.example`.
4. Deploy `web/` as the app root.
5. Run schema migration/push:

```bash
npm run db:push
```

6. Optionally seed demo listings:

```bash
npm run db:seed
```

### Demo Agents

Deploy each demo agent as its own service. Render, Railway, Fly.io, and similar hosts work.

For Render:

1. Create a new Web Service.
2. Connect this repository.
3. Set the root directory to one agent folder, for example `demo-agent-apis/echo`.
4. Use Node runtime.
5. Build command: `npm install`.
6. Start command: `npm start`.
7. Copy the deployed origin, for example `https://your-echo-agent.onrender.com`.
8. Use that origin as the provider product `base_url`.

Do not include `/invoke` in the base URL unless you also customize the invoke path accordingly.

## Development Notes

- Keep secrets in `web/.env.local`; do not commit `.env` files.
- CLI scripts load `web/.env` and then `web/.env.local`.
- Mutating agent APIs are intentionally API-key protected.
- Human dashboard actions rely on Supabase sessions.
- External HTTP agents are called with a 25 second timeout.
- `http_external` providers must return JSON with a boolean `success` field.
- Feedback is mandatory for closed-loop reputation updates.
- Catalog services are lazily inserted when discovery or provider publishing runs.

## Troubleshooting

### `database_required`

Set `DATABASE_URL`, then run:

```bash
npm run db:push
```

### `AGENT_API_KEY is not set on the server`

Add `AGENT_API_KEY` to `web/.env.local` and restart the dev server.

### Supabase Pages Show Unauthorized Or Null User

Check:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Supabase email/password provider settings
- local cookies after changing projects

### Provider Invoke Says `external_endpoint_required`

The selected service is an external HTTP agent. Publish a provider product with:

- `linked_service_id`
- `base_url`
- optional `invoke_path`

Then purchase through the dashboard or `POST /api/orders` so the product endpoint metadata is attached.

### External Agent URL Is Rejected

By default, external agents must use HTTPS unless the host is `localhost` or `127.0.0.1`. For development only, set:

```bash
ALLOW_HTTP_EXTERNAL_AGENTS=true
```

### Provider API Returns Missing Key Errors

The adapter is implemented, but the relevant provider key is not configured. Set the matching environment variable listed in the provider API key table.

## Security Notes

- Never commit `.env`, `.env.local`, API key files, mnemonics, or wallet material.
- Use `x-api-key` for agent auth when also using L402, because L402 uses the `Authorization` header.
- Treat `AGENT_API_KEY` as a server-side secret.
- Do not enable `ALLOW_HTTP_EXTERNAL_AGENTS=true` in production.
- Provider product headers are stored in endpoint metadata; avoid putting long-lived production secrets there unless the deployment and database access model are appropriate.

## Current MVP Boundaries

This is a hackathon MVP, not a production marketplace. The architecture intentionally leaves room for:

- production-grade escrow and disputes
- provider staking or identity checks
- fraud detection
- full bidding/negotiation workflows
- production learning-to-rank training
- complete provider adapter coverage
- stronger accounting and settlement controls

The implemented system focuses on demonstrating the full discover -> rank -> invoke -> feedback -> reputation loop with Lightning-compatible payment primitives.
