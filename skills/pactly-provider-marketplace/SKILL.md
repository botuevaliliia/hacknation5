---
name: pactly-provider-marketplace
description: Use when a provider/seller agent has an API, agent, dataset, or tool that other agents should be able to buy, and needs to validate the endpoint, publish it, or register it as a Pactly marketplace product.
---

Use this provider marketplace when you have a capability other agents should be able to buy, and you need to validate its endpoint, publish the listing, or make the service invokable through Pactly.

# Pactly Provider Marketplace

## Purpose

Use this skill as the provider-side marketplace client. It wraps validation of deployable HTTP agents and provider product publishing through Pactly's HTTP API.

Provider products should expose a stable origin and a JSON `POST /invoke` endpoint before publication.

## Configuration

Use these environment variables, or pass equivalent CLI flags:

```text
PACTLY_BASE_URL or NEXT_PUBLIC_BASE_URL                 Marketplace origin, default http://localhost:3000
PACTLY_SUPABASE_ACCESS_TOKEN or SUPABASE_ACCESS_TOKEN   User JWT for /api/provider/products/me
PACTLY_AGENT_API_KEY or AGENT_API_KEY                   Operator key for /api/provider/products
```

The wrapper auto-loads `web/.env`, `web/.env.local`, `.env`, and `.env.local` when the skill lives inside this repository.

## Wrapper

Run from any working directory:

```bash
node {baseDir}/scripts/pactly-provider.mjs <command> [flags]
```

Common flags:

```text
--marketplace-url <url>      Override Pactly marketplace origin
--json                       Print compact JSON
```

## Validate An HTTP Agent

Before publishing, validate the provider service:

```bash
node {baseDir}/scripts/pactly-provider.mjs validate-agent \
  --base-url https://your-agent.example.com \
  --invoke-path /invoke \
  --task "provider validation" \
  --input-json '{"message":"hello"}'
```

Validation performs:

```text
GET  <base-url>/health
POST <base-url><invoke-path>
```

The invoke response must be JSON. The preferred contract is:

```json
{
  "success": true,
  "output": {},
  "cost_usd": 0
}
```

If the service requires private headers, pass:

```bash
--headers-json '{"authorization":"Bearer provider-secret"}'
```

For shells that mangle inline JSON, pass `@file.json` or `-` to read JSON from stdin:

```bash
--input-json @sample-input.json
--headers-json @headers.json
```

## Publish With User Auth

Use this mode when the provider agent has a Supabase access token for the seller:

```bash
node {baseDir}/scripts/pactly-provider.mjs publish \
  --access-token "$SUPABASE_ACCESS_TOKEN" \
  --linked-service-id my_agent_v1 \
  --title "My agent" \
  --description "Does one specific useful task." \
  --base-url https://your-agent.example.com \
  --invoke-path /invoke \
  --price-sats 100
```

This calls:

```text
POST /api/provider/products/me
```

The marketplace infers `owner_user_id` from the Supabase bearer token and auto-provisions the provider account if needed.

## Publish With Operator Auth

Use this mode only when operating on behalf of a provider and an `owner_user_id` is known:

```bash
node {baseDir}/scripts/pactly-provider.mjs publish \
  --owner-user-id "<supabase-user-id>" \
  --agent-key "$AGENT_API_KEY" \
  --linked-service-id my_agent_v1 \
  --title "My agent" \
  --description "Does one specific useful task." \
  --base-url https://your-agent.example.com \
  --invoke-path /invoke \
  --price-sats 100
```

This calls:

```text
POST /api/provider/products
```

## Validate And Publish

Prefer this flow for new external HTTP agents:

```bash
node {baseDir}/scripts/pactly-provider.mjs validate-and-publish \
  --access-token "$SUPABASE_ACCESS_TOKEN" \
  --linked-service-id my_agent_v1 \
  --title "My agent" \
  --description "Does one specific useful task." \
  --base-url https://your-agent.example.com \
  --invoke-path /invoke \
  --price-sats 100 \
  --input-json '{"message":"hello"}'
```

This validates health and invoke first, then publishes only if validation succeeds.

## Check Marketplace Health

```bash
node {baseDir}/scripts/pactly-provider.mjs marketplace-health
```

This calls:

```text
GET /api/health
```

## Service ID Guidance

Use stable, lowercase service IDs such as:

```text
my_agent_v1
external_agent_echo
acme_research_agent_v1
```

Avoid changing `linked_service_id` after buyers have discovered or purchased the service.

## Safety Rules

- Validate the deployed agent before publishing.
- Use HTTPS for deployed external agents; only use HTTP for localhost development.
- Do not place long-lived production secrets in `headers` unless the database access model is acceptable.
- Do not publish a product whose `/invoke` endpoint returns non-JSON or omits success/failure state.
- Do not use operator auth when user bearer auth is available.
