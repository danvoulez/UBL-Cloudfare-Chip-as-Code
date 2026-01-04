# Cloudflare Terraform — UBL Flagship

terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

variable "cloudflare_account_id" {
  type = string
}

variable "domain" {
  type = string
  default = "ubl.example.com"
}

# R2 Bucket para eventos e logs
resource "cloudflare_r2_bucket" "flagship" {
  account_id = var.cloudflare_account_id
  name       = "ubl-flagship"
  location   = "weur"
}

# Queue para eventos
resource "cloudflare_queue" "policy_events" {
  account_id = var.cloudflare_account_id
  name       = "ubl-policy-events"
}

# Access Application
resource "cloudflare_access_application" "flagship" {
  account_id = var.cloudflare_account_id
  name       = "UBL Flagship"
  domain     = var.domain
  
  session_duration = "24h"
}

# Access Group: ubl-ops
resource "cloudflare_access_group" "ubl_ops" {
  account_id = var.cloudflare_account_id
  name       = "ubl-ops"
  
  include {
    email = ["*@ubl.example.com"]
  }
}

# Access Group: ubl-ops-breakglass
resource "cloudflare_access_group" "ubl_ops_breakglass" {
  account_id = var.cloudflare_account_id
  name       = "ubl-ops-breakglass"
  
  include {
    email = ["ops-lead@ubl.example.com"]
  }
}

# Access Policy: Admin paths
resource "cloudflare_access_policy" "admin" {
  account_id     = var.cloudflare_account_id
  application_id = cloudflare_access_application.flagship.id
  name           = "Admin Access"
  
  decision = "allow"
  
  include {
    group = [cloudflare_access_group.ubl_ops.id]
  }
  
  precedence = 1
}

# WAF Rules (via API ou dashboard)
# Rate Limiting
# Bot Management
