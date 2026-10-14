# Mini-Project Report (Draft)

**Automated Deployment of a Serverless Student Task Management Application Using Terraform-Based Infrastructure as Code**

*Items marked **[ADD]** must be completed by you after real execution.*

## 1. Introduction
Overview of the project: a serverless task manager on Cloudflare Workers and Workers KV, provisioned with Terraform and deployed through GitHub Actions. **[ADD]** your name, course, guide, institution, date.

## 2. Background of Cloud Computing and Infrastructure as Code
Cloud computing delivers compute and storage on demand. Serverless platforms run code without managing servers. Infrastructure as Code (IaC) describes infrastructure in version-controlled files so it is repeatable, reviewable and auditable. Terraform is declarative: you state the desired resources and it computes a plan (init, plan, apply, destroy) against recorded state. **[ADD]** references.

## 3. Problem Statement
Manually creating cloud resources through a dashboard is slow, inconsistent and hard to reproduce. The project automates provisioning and deployment of a CRUD application using IaC.

## 4. Proposed Architecture
One Worker serves static assets and `/api/tasks`; tasks live in a KV namespace bound as `TASKS_KV`. Terraform creates the namespace, Worker, binding, assets and workers.dev publication. See the diagram in README.md. **[ADD]** a drawn diagram if required.

## 5. Technologies Used
Terraform and the Cloudflare provider v5; Cloudflare Workers, Workers KV, Static Assets; HTML/CSS/JavaScript; Git/GitHub; GitHub Actions; Node.js test runner; VS Code on Windows.

## 6. Terraform Configuration
Files: `providers.tf` (provider pin, token from environment), `variables.tf` (validated inputs), `main.tf` (`cloudflare_workers_kv_namespace`, `cloudflare_workers_script` with `kv_namespace` binding and `assets`, `cloudflare_workers_script_subdomain`), `outputs.tf`. **[ADD]** screenshots of init, validate, plan, apply, show.

## 7. Application Implementation
Worker validates input (title 1-120 chars, priority, status, UUID ids), returns consistent JSON and status codes, and stores records as `task:<id>` in KV. The frontend uses `fetch` against the API with loading, success and error messages, search and filters. **[ADD]** CRUD screenshots.

## 8. CI/CD Implementation
Workflow stages: tests, `fmt -check`, `init`, `validate`, `plan`, approval-gated `apply` of the saved plan, with a concurrency group and secrets from GitHub Actions Secrets. Remote state is required for pipeline applies. **[ADD]** screenshot of a successful run and your state approach.

## 9. Testing and Results
Local: 14 automated API tests passed against an in-memory KV mock. **[ADD]** deployed test results (persistence in real KV, binding check, frontend-to-Worker calls, Terraform lifecycle outcomes) after you run them. See `docs/TEST_PLAN.md`.

## 10. Conclusion and Future Scope
**[ADD]** your conclusions after deployment. Future scope: authentication, per-user task lists, due dates, remote state with locking, Durable Objects or D1 for stronger consistency, staging environment.
