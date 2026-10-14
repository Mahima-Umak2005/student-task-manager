variable "cloudflare_account_id" {
  description = "Cloudflare account ID (Workers & Pages overview page, or dashboard URL)."
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{32}$", var.cloudflare_account_id))
    error_message = "cloudflare_account_id must be a 32-character lowercase hex string."
  }
}

variable "worker_name" {
  description = "Name of the Cloudflare Worker (becomes part of the workers.dev URL)."
  type        = string
  default     = "student-task-manager"

  validation {
    condition     = can(regex("^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$", var.worker_name))
    error_message = "worker_name must be lowercase letters, digits and hyphens (max 63 chars)."
  }
}

variable "kv_namespace_title" {
  description = "Title of the Workers KV namespace that stores tasks."
  type        = string
  default     = "student-task-manager-tasks"
}

variable "compatibility_date" {
  description = "Workers runtime compatibility date (YYYY-MM-DD)."
  type        = string
  default     = "2025-09-01"
}

variable "workers_subdomain" {
  description = "Your account's workers.dev subdomain (the part before .workers.dev; see Workers & Pages > Overview). Used only to build the application_url output."
  type        = string
  default     = ""
}
