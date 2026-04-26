# Country → capital lookup agent API

`input.country` must be one of: `france`, `japan`, `kenya`, `brazil`, `canada` (default `france`).

## Example

```bash
curl -sS -X POST http://127.0.0.1:3005/invoke \
  -H 'content-type: application/json' \
  -d '{"task":"lookup","input":{"country":"japan"}}'
```

## Marketplace

- Catalog **service_id**: `external_agent_capitals`
