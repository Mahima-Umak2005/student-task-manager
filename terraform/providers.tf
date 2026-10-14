terraform {
  required_version = ">= 1.5.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.25"
    }
  }

  # State is LOCAL by default (terraform.tfstate in this directory, git-ignored).
  # For CI/CD, use a remote backend with locking - see README, section
  # "Terraform state and CI/CD".
}

# Credentials are NEVER written here. The provider reads the API token from
# the CLOUDFLARE_API_TOKEN environment variable.
provider "cloudflare" {}
