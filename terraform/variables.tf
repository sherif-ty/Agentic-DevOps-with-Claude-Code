variable "region" {
  description = "AWS region for the S3 bucket"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Project name, used for resource naming and tagging"
  type        = string
  default     = "portfolio-site"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

variable "domain_name" {
  description = "Optional custom domain name (unused when empty)"
  type        = string
  default     = ""
}

variable "github_repo" {
  description = "GitHub repository (owner/name) allowed to deploy via OIDC"
  type        = string
  default     = "sherif-ty/Ultimate-Agentic-DevOps-with-Claude-Code"
}

variable "github_branch" {
  description = "Branch allowed to assume the deploy role"
  type        = string
  default     = "main"
}
