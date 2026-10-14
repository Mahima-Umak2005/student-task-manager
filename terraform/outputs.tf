output "worker_name" {
  description = "Name of the deployed Worker."
  value       = cloudflare_workers_script.app.script_name
}

output "kv_namespace_id" {
  description = "ID of the Workers KV namespace."
  value       = cloudflare_workers_kv_namespace.tasks.id
}

output "kv_namespace_title" {
  description = "Title of the Workers KV namespace."
  value       = cloudflare_workers_kv_namespace.tasks.title
}

output "application_url" {
  description = "Public URL of the application (requires workers_subdomain to be set)."
  value = (
    var.workers_subdomain == ""
    ? "Set workers_subdomain to build the URL: https://${var.worker_name}.<your-subdomain>.workers.dev"
    : "https://${var.worker_name}.${var.workers_subdomain}.workers.dev"
  )
}
