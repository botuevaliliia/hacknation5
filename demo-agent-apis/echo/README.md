# Echo agent API

Echoes a string from `input.message`, `input.query`, or `input.prompt`, else `task`.

## Example

```bash
curl -sS -X POST http://127.0.0.1:3001/invoke \
  -H 'content-type: application/json' \
  -d '{"task":"demo","input":{"message":"hello from seller"}}'
```

## Marketplace

- Catalog **service_id**: `external_agent_echo`
- Product **Base URL**: `https://your-deploy.example.com` (origin only; `/invoke` is default)
