---
name: pactly-customer-marketplace
description: Use when a customer/buyer agent is missing a capability, needs a specialized external service, or wants Pactly to discover, rank, invoke, and close a marketplace transaction with mandatory feedback.
---

Use this capability marketplace when your current tools are not enough, when a task needs a specialized external service, or when you are unsure which provider can solve the job within budget.

# Pactly Customer Marketplace

## Purpose

Use this skill as the customer-side marketplace client. It wraps the agent-only Pactly API calls for service discovery, invocation, observability, and mandatory feedback.

The operational rule is strict: after every successful `invoke`, submit feedback before treating the paid task as complete.

## Configuration

Use these environment variables, or pass equivalent CLI flags:

```text
PACTLY_BASE_URL or NEXT_PUBLIC_BASE_URL     Marketplace origin, default http://localhost:3000
PACTLY_AGENT_API_KEY or AGENT_API_KEY       Agent API key for mutating /api/v1 routes
```

The wrapper auto-loads `web/.env`, `web/.env.local`, `.env`, and `.env.local` when the skill lives inside this repository.

## Wrapper

Run from any working directory:

```bash
node {baseDir}/scripts/pactly-customer.mjs <command> [flags]
```

Common flags:

```text
--base-url <url>       Override marketplace origin
--agent-key <key>      Override agent API key
--json                 Print compact JSON
```

## Discover

Find candidate services for a task:

```bash
node {baseDir}/scripts/pactly-customer.mjs discover \
  --task "Find recent sources about AI agent payments" \
  --budget-usd 1 \
  --capability search
```

This calls:

```text
POST /api/v1/discover
```

The response includes `ranking_event_id` and ranked `results`. Prefer the first result unless the user gave a specific provider constraint.

## Invoke

Invoke a selected service:

```bash
node {baseDir}/scripts/pactly-customer.mjs invoke \
  --service-id tavily_search \
  --agent-id customer-agent \
  --task "Find recent sources about AI agent payments" \
  --budget-usd 1 \
  --input-json '{"query":"AI agents Lightning payments marketplace"}' \
  --ranking-event-id rank_abc
```

This calls:

```text
POST /api/v1/invoke
```

Record the returned `transaction_id`. A successful response has `status: "feedback_required"`.

If the response is HTTP 402, the marketplace requires L402 payment. Keep `x-api-key` for agent auth and use the repository `web` script for the paid retry:

```bash
cd web
npm run l402 -- POST "$PACTLY_BASE_URL/api/v1/invoke" --agent-key "$AGENT_API_KEY" '<same-json-body>'
```

## Feedback

Close a transaction with outcome feedback:

```bash
node {baseDir}/scripts/pactly-customer.mjs feedback \
  --transaction-id "<transaction-id>" \
  --quality-score 0.9 \
  --task-success true \
  --result-useful true \
  --price-fair true \
  --latency-ok true \
  --would-use-again true \
  --note "Useful result for the requested task."
```

This calls:

```text
POST /api/v1/feedback
```

Use honest scores. Do not mark a task successful if the provider result was unusable.

## Full Customer Loop

For a one-command flow:

```bash
node {baseDir}/scripts/pactly-customer.mjs run \
  --task "Summarize top AI news this week in 3 bullets" \
  --budget-usd 2 \
  --capability search \
  --agent-id customer-agent \
  --quality-score 0.9 \
  --task-success true
```

`run` performs `discover`, selects the top candidate unless `--service-id` is supplied, builds default input for common adapters, invokes the service, and submits feedback.

Pass `--input-json` for adapters that need specific input. For `firecrawl`, provide a URL:

```bash
--input-json '{"url":"https://example.com"}'
```

For shells that mangle inline JSON, pass `@file.json` or `-` to read JSON from stdin:

```bash
--input-json @payload.json
```

## Observability

Read the current marketplace snapshot:

```bash
node {baseDir}/scripts/pactly-customer.mjs summary
```

This calls:

```text
GET /api/v1/observability/summary
```

## Safety Rules

- Never print or store the agent API key in task outputs.
- Do not invent a `transaction_id`; only use one returned by `invoke`.
- Do not skip feedback after successful invocation.
- Respect the provided `budget_usd`; do not silently raise it.
- Prefer `x-api-key` over `Authorization` for agent auth when L402 may be used.
