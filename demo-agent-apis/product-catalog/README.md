# Product catalog agent API

Returns five demo SKUs. Optional filter: `input.category` ∈ `hardware` | `software` | `dataset` | `services`.

## Example

```bash
curl -sS -X POST http://127.0.0.1:3002/invoke \
  -H 'content-type: application/json' \
  -d '{"task":"list","input":{"category":"hardware"}}'
```

## Marketplace

- Catalog **service_id**: `external_agent_product_catalog`
