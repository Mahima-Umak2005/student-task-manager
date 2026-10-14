# Test Plan

Legend: **Local** = run in the build environment; **Deployed** = needs your Cloudflare account.
Results below reflect what was actually run. Items marked PENDING have NOT been run.

| # | Test | Type | How | Result |
|---|---|---|---|---|
| 1 | Create task | Local | `npm test` | PASS |
| 2 | List tasks | Local | `npm test` | PASS |
| 3 | Get by ID | Local | `npm test` | PASS |
| 4 | Update task | Local | `npm test` | PASS |
| 5 | Delete task | Local | `npm test` | PASS |
| 6 | Nonexistent ID -> 404, bad ID -> 400 | Local | `npm test` | PASS |
| 7 | Invalid data rejected, 415/405/CORS | Local | `npm test` | PASS |
| 8 | Frontend JS syntax | Local | `node --check` | PASS (syntax only; not run in a browser) |
| 9 | Workflow YAML parses | Local | PyYAML | PASS (syntax only; not run on GitHub) |
| 10 | `terraform fmt -check`, `validate` | Your PC | see README | PENDING |
| 11 | `terraform plan` shows 3 resources to add | Your PC | `terraform plan` | PENDING |
| 12 | Tasks persist in real KV (create, reload page, redeploy, still there) | Deployed | browser + curl | PENDING |
| 13 | Frontend calls deployed Worker | Deployed | browser DevTools Network tab | PENDING |
| 14 | KV binding present | Deployed | dashboard > Worker > Settings > Bindings; `GET /api/health` shows `kvBound: true` | PENDING |
| 15 | GitHub Actions run | GitHub | push to main | PENDING |
| 16 | Destroy / recreate | Your PC | README | PENDING |
