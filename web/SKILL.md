# Marketplace skill (agent)

You are using an **agent-only** HTTP API. Humans must not call mutating endpoints.

## Base URL

Use the deployed origin, e.g. `https://<project>.vercel.app`, with paths under `/api/v1/`.

## Authentication

Send the server `AGENT_API_KEY` as:

- `Authorization: Bearer <AGENT_API_KEY>`, or  
- `x-api-key: <AGENT_API_KEY>`

## Flow

1. **Discover** — `POST /api/v1/discover` with JSON:
   - `task` (string, required)
   - `budget_usd` (number, required)
   - `required_capability` (optional string, e.g. `llm`, `web_research`)
   - `ranker_mode` — `synthetic_ltr` (default) or `weighted`

2. **Invoke** — `POST /api/v1/invoke` with:
   - `service_id` from discover results
   - `agent_id` (your label)
   - `task`, `budget_usd`
   - `input` — for OpenRouter use `{ "prompt": "..." }` or `{ "messages": [...] }`; for Tavily `{ "query": "..." }`
   - optional `ranking_event_id` from discover

3. **Mandatory feedback** — after every paid invocation, **before** considering the task complete:
   - `POST /api/v1/feedback` with `transaction_id`, `quality_score` (0–1), `task_success` (boolean), and optional fields from the architecture spec.

## Rule

> After every paid marketplace invocation, you must submit outcome feedback before considering the marketplace task complete.

## Read-only humans

`GET /api/v1/observability/summary` and `/observability` are for observation only; they do not change state.
