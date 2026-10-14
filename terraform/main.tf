# --- Workers KV namespace (persistent task storage) -------------------------
resource "cloudflare_workers_kv_namespace" "tasks" {
  account_id = var.cloudflare_account_id
  title      = var.kv_namespace_title
}

# --- Worker: REST API + static frontend (Workers Static Assets) -------------
# worker.js implements /api/tasks; files in application/public are uploaded as
# static assets and served by the same Worker. The KV namespace is bound to
# the Worker under the name TASKS_KV.
resource "cloudflare_workers_script" "app" {
  account_id  = var.cloudflare_account_id
  script_name = var.worker_name

  content_file   = "${path.module}/../application/worker.js"
  content_sha256 = filesha256("${path.module}/../application/worker.js")
  main_module    = "worker.js"

  compatibility_date = var.compatibility_date

  bindings = [
    {
      name         = "TASKS_KV"
      type         = "kv_namespace"
      namespace_id = cloudflare_workers_kv_namespace.tasks.id
    }
  ]

  assets = {
    directory = "${path.module}/../application/public"
    config = {
      html_handling      = "auto-trailing-slash"
      not_found_handling = "none"
    }
  }
}

# --- Publish the Worker on <worker_name>.<subdomain>.workers.dev ------------
resource "cloudflare_workers_script_subdomain" "app" {
  account_id       = var.cloudflare_account_id
  script_name      = cloudflare_workers_script.app.script_name
  enabled          = true
  previews_enabled = false
}
