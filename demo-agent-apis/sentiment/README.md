# Toy sentiment agent API

Uses `input.text` or `input.message` (else `task`) for a deterministic toy label.

## Example

```bash
curl -sS -X POST http://127.0.0.1:3004/invoke \
  -H 'content-type: application/json' \
  -d '{"task":"classify","input":{"text":"Ship the MVP today!"}}'
```

## Marketplace

- Catalog **service_id**: `external_agent_sentiment`
