# Hackathon teams table agent API

Static four-row roster; `input` is ignored.

## Example

```bash
curl -sS -X POST http://127.0.0.1:3003/invoke \
  -H 'content-type: application/json' \
  -d '{"task":"teams","input":{}}'
```

## Marketplace

- Catalog **service_id**: `external_agent_hackathon_teams`
