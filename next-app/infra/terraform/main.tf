terraform { required_version = ">= 1.6.0" required_providers { google = { source = "hashicorp/google" version = "~> 6.0" } } }
variable "project_id" { type = string }
variable "region" { type = string default = "asia-northeast1" }
variable "environment" { type = string validation { condition = contains(["dev", "stg", "prod"], var.environment) error_message = "environment must be dev, stg, or prod" } }
variable "image" { type = string validation { condition = can(regex("^[^:]+:[^:]+$", var.image)) && !strcontains(var.image, "REPLACE") error_message = "image must be a concrete registry image tag; REPLACE is not allowed" } }
provider "google" { project = var.project_id region = var.region }
resource "google_artifact_registry_repository" "app" { location = var.region repository_id = "inspection-assist-${var.environment}" format = "DOCKER" }
resource "google_firestore_database" "app" { project = var.project_id name = "(default)" location_id = var.region type = "FIRESTORE_NATIVE" deletion_policy = "ABANDON" }
resource "google_cloud_run_v2_service" "app" { name = "inspection-assist-${var.environment}" location = var.region deletion_protection = var.environment == "prod" template { service_account = google_service_account.runtime.email containers { image = var.image ports { container_port = 8080 } } } }
resource "google_service_account" "runtime" { account_id = "inspection-assist-${var.environment}" display_name = "Inspection Assist ${var.environment} runtime" }
resource "google_project_iam_member" "runtime_firestore" { project = var.project_id role = "roles/datastore.user" member = "serviceAccount:${google_service_account.runtime.email}" }
