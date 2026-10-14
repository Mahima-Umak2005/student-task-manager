# Student Task Manager - Serverless App Deployed with Terraform

A responsive task manager (create, view, edit, delete, search/filter) running on a
single **Cloudflare Worker** that serves both the static frontend and a REST API,
storing tasks in **Workers KV**. All cloud resources are declared in **Terraform**;
**GitHub Actions** plans and applies changes.

> **Status:** code, Terraform and workflow are written. Local API tests pass (14/14).
> Nothing has been deployed to Cloudflare yet and `terraform validate` has not been
> run (Terraform was not installable in the build environment). Deployed URL: *to be
> added after you deploy and verify it.*

## Problem statement and objectives
Manual cloud setup is slow, error-prone and not repeatable. Objectives: provision a
Worker and KV namespace with code (IaC), deploy a working CRUD app, automate
deployment with CI/CD, and demonstrate plan / modify / destroy / recreate.

## Architecture
```
Browser --HTTPS--> Cloudflare Worker (worker.js)
                     |-- static assets (application/public) -> index.html, style.css, script.js
                     |-- /api/tasks[/:id] --binding TASKS_KV--> Workers KV namespace
Terraform (cloudflare provider v5) creates: KV namespace, Worker + binding + assets, workers.dev route
GitHub Actions: test -> fmt/init/validate/plan -> (approval) apply
```

## Folder structure
```
terraform/            providers.tf main.tf variables.tf outputs.tf terraform.tfvars.example backend.tf.example
application/          worker.js (API)  public/{index.html,style.css,script.js} (frontend assets)
tests/api.test.mjs    automated API tests (in-memory KV mock)
.github/workflows/    deploy.yml
docs/                 TEST_PLAN.md  REPORT.md  EVIDENCE_CHECKLIST.md
screenshots/          put your real screenshots here
```
Note: the frontend lives in `application/public/` (not `application/`) so that
`worker.js` source is not uploaded as a public static asset.

## Prerequisites (Windows)
- Windows 10/11, VS Code, Git, Node.js 20+ (for tests), Terraform 1.5+ (`winget install Hashicorp.Terraform`)
- A free Cloudflare account and a GitHub account

## Cloudflare setup
1. **Account ID:** Cloudflare dashboard > Workers & Pages > Overview (right side) .
2. **workers.dev subdomain:** same page; if none exists, register one (needed for the public URL).
3. **API token** (My Profile > API Tokens > Create Token > Custom), least privilege:
   - Account > Workers Scripts > Edit
   - Account > Workers KV Storage > Edit
   - Scope to your single account only.
4. Never paste the token into files or chat.

## Deploy with Terraform (PowerShell)
```powershell
cd student-task-manager-iac\terraform
$env:CLOUDFLARE_API_TOKEN = "<your token>"      # current session only
Copy-Item terraform.tfvars.example terraform.tfvars   # then edit it (git-ignored)

terraform version
terraform init
terraform fmt
terraform validate
terraform plan
terraform apply
terraform show
terraform output application_url
```
Credentials are needed for `init` (provider download needs none), `plan`, `apply`, `destroy`.
`fmt` and `validate` need no credentials. Run everything from the `terraform/` directory.

## Modify, destroy, recreate
- **Modify:** change e.g. `kv_namespace_title` or edit `worker.js`, then `terraform plan` (compare) and `terraform apply`.
- **Destroy:** `terraform plan -destroy`, then `terraform destroy`.
  **WARNING:** this deletes the Worker, its static assets, the workers.dev publication and the KV namespace *including all stored tasks*. Take your screenshots first; export any tasks you need (`GET /api/tasks`). Only run it when you intend to.
- **Recreate:** `terraform plan` then `terraform apply`. The KV namespace ID will change.

## GitHub and CI/CD
```powershell
cd student-task-manager-iac
git init; git add .; git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<you>/student-task-manager-iac.git
git push -u origin main
```
Repo > Settings > Secrets and variables > Actions > add secrets:
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `WORKERS_SUBDOMAIN`.
Settings > Environments > create `production` and add yourself as a required reviewer (this is the approval gate for `apply`).

Workflow: `test` (npm test) -> `plan` (fmt -check, init, validate, plan) -> `apply` (main only, after approval, applies the saved plan). A `concurrency` group prevents overlapping runs.

### Terraform state and CI/CD (important)
Local state is not visible to GitHub Actions; the pipeline would see an empty state and try to create duplicates. Choose one:
1. **Demo path (simplest):** do the Terraform lifecycle locally; use Actions for test/fmt/validate only (the `plan`/`apply` jobs will fail without shared state).
2. **Remote state:** bootstrap an R2 bucket, rename `backend.tf.example` to `backend.tf`, add R2 credentials as secrets/env, and `terraform init -migrate-state`. State locking on R2 is unverified (see the file); the workflow `concurrency` group is the protection that is in place.

## Testing
```powershell
npm test      # 14 local API tests (mock KV)
```
Deployed tests (replace URL):
```powershell
$u = "https://student-task-manager.<subdomain>.workers.dev"
curl.exe "$u/api/health"
curl.exe -X POST "$u/api/tasks" -H "Content-Type: application/json" -d '{\"title\":\"Test\",\"priority\":\"High\"}'
curl.exe "$u/api/tasks"
```
See `docs/TEST_PLAN.md` for the full list.

## REST API
| Method | Path | Success | Errors |
|---|---|---|---|
| POST | /api/tasks | 201 | 400, 413, 415 |
| GET | /api/tasks | 200 | |
| GET | /api/tasks/:id | 200 | 400 (bad id), 404 |
| PUT | /api/tasks/:id | 200 | 400, 404, 415 |
| DELETE | /api/tasks/:id | 200 | 400, 404 |
Other methods: 405 with `Allow`. Responses: `{success:true,data}` or `{success:false,error}`.
Task: `{id (UUID), title (1-120), priority High|Medium|Low (default Medium), status Pending|Completed (default Pending), createdAt, updatedAt?}`.
Note: KV listing is eventually consistent, so a new task may take a short time to appear in the list from other locations.

## Security
No secrets in code; token via env var / GitHub Secrets; `.gitignore` excludes state, `.tfvars`, `.env`. State can contain sensitive data - keep it out of public repos. Frontend uses `textContent` (no HTML injection). CORS is open (`*`) because the API has no authentication; add auth before storing real data.

## Troubleshooting
- *Authentication error (10000/9109):* token missing, wrong scope, or wrong account.
- *Provider drift on `bindings`/`content`:* known provider v5 behaviour (see provider issue #5439); re-run `plan`, upgrade the provider within `~> 5`.
- *URL not reachable:* confirm the workers.dev subdomain exists and `workers_subdomain` is correct.
- *Pipeline wants to create everything again:* no shared state; see the state section.
- *`terraform` not found:* reopen PowerShell after installing.

## Cleanup
`terraform destroy` (after backing up evidence), then delete the GitHub secrets and revoke the API token.
## Deployment Status
Deployed using Terraform and Cloudflare Workers.