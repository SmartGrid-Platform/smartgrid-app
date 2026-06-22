# SmartGrid — Repository Split Plan

**Status:** Phase 1 Preparation Complete — DO NOT execute split until Phase 4.
**Branch:** eksmigration
**Date:** 2026-06-23

---

## 1. Target Repository Structure

The monorepo splits into three purpose-built public repositories:

```
<org>/smartgrid-app    Application source code, CI pipelines
<org>/smartgrid-helm   Helm chart, ArgoCD application templates
<org>/smartgrid-infra  Terraform IaC, cluster bootstrap
```

All three repositories are **PUBLIC**. No ArgoCD repository credentials are
required — ArgoCD reads directly from public HTTPS URLs.

---

## 2. GitOps Deployment Flow

```
git push → smartgrid-app (dev branch)
    ↓
GitHub Actions (main.yml)
    ↓
Per-service CI (build Docker image)
    ↓
Trivy image scan
    ↓
SonarCloud SAST
    ↓
Snyk dependency scan
    ↓
Push image → ECR
    ↓
Update imageTag in smartgrid-helm/helm/smartgrid/values.yaml
    ↓
Commit + push to smartgrid-helm (dev branch)
    ↓
ArgoCD detects change (polls every 3 minutes)
    ↓
ArgoCD syncs Helm release
    ↓
EKS — 2 replicas of each SmartGrid service running
```

CI does NOT run `helm upgrade` or `kubectl apply`.
ArgoCD is the sole actor that deploys to EKS.

---

## 3. File Ownership Mapping

### smartgrid-app

| Source Path | Destination |
|---|---|
| `services/` | `services/` |
| `frontend/` | `frontend/` |
| `shared/` | `shared/` |
| `sonar-project.properties` | `sonar-project.properties` |
| `docker-compose.yml` | `docker-compose.yml` |
| `.github/workflows/main.yml` | `.github/workflows/main.yml` |
| `.github/workflows/ci-template.yml` | `.github/workflows/ci-template.yml` |
| `.github/workflows/ci-auth-service.yml` | `.github/workflows/ci-auth-service.yml` |
| `.github/workflows/ci-consumer-service.yml` | `.github/workflows/ci-consumer-service.yml` |
| `.github/workflows/ci-meter-service.yml` | `.github/workflows/ci-meter-service.yml` |
| `.github/workflows/ci-billing-service.yml` | `.github/workflows/ci-billing-service.yml` |
| `.github/workflows/ci-alert-service.yml` | `.github/workflows/ci-alert-service.yml` |
| `.github/workflows/ci-ai-assistant-service.yml` | `.github/workflows/ci-ai-assistant-service.yml` |
| `.github/workflows/notify-failure.yml` | `.github/workflows/notify-failure.yml` |
| `.github/workflows/deploy-eks.yml` | `.github/workflows/deploy-eks.yml` |

Default branch: `dev`

### smartgrid-helm

| Source Path | Destination |
|---|---|
| `helm/smartgrid/` | `helm/smartgrid/` |
| `argocd/application.yaml` | `argocd/application.yaml` |
| `argocd/application-prod.yaml` | `argocd/application-prod.yaml` |

Branches required: `dev` (auto-sync by ArgoCD), `prod` (manual-sync)
ArgoCD watches path `helm/smartgrid` on both branches.
Default branch: `dev`

### smartgrid-infra

| Source Path | Destination |
|---|---|
| `terraform/` | `terraform/` |
| `terraform/backend-setup/` | `terraform/backend-setup/` |
| `lambdas/` | `lambdas/` |
| `argocd/` | `argocd/` |
| `docs/PROJECT_ARCHITECTURE.md` | `docs/PROJECT_ARCHITECTURE.md` |
| `.github/workflows/infra.yml` | `.github/workflows/infra.yml` |
| `.github/workflows/bootstrap.yml` | `.github/workflows/bootstrap.yml` |

Default branch: `main`

---

## 4. Terraform Module Reorganization (Phase 4)

Current: single `modules/smartgrid-core` containing all resources.
Target: split into focused modules for separation of concerns.

```
terraform/
├── backend.tf
├── backend-setup/
├── main.tf              (calls all modules)
├── outputs.tf
├── providers.tf
├── variables.tf
├── terraform.tfvars
└── modules/
    ├── networking/      vpc.tf, security_groups.tf, alb.tf
    ├── eks/             eks.tf, iam.tf (IRSA roles, CA role, LBC role)
    ├── rds/             rds.tf
    ├── security/        guardduty.tf, cloudtrail.tf, backup.tf, kms (from s3.tf)
    ├── s3/              s3.tf (bills bucket, frontend bucket)
    ├── compute/         instances.tf (bastion), lambda_sns.tf, sqs.tf
    ├── observability/   monitoring.tf, cloudfront.tf
    └── config/          secrets_manager.tf, helm.tf, null_resources.tf
```

Refactor existing code — do not rebuild from scratch.
All variable types, outputs, and IRSA configurations are preserved.

---

## 5. Cross-Repository Dependency Map

```
smartgrid-infra
  ├── creates: VPC, EKS, RDS, ECR, Secrets Manager, Lambda, SQS, SNS, CloudFront
  ├── writes:  Terraform state → S3 backend
  └── no dependency on smartgrid-app or smartgrid-helm

smartgrid-app  (reads TF state; writes imageTag to smartgrid-helm)
  ├── reads:   Terraform outputs via S3 remote state (read-only)
  │            → cluster_name, k8s_namespace, ecr_registry_url,
  │              eks_pod_role_arn, secrets_manager_secret_name
  ├── writes:  imageTag to smartgrid-helm/helm/smartgrid/values.yaml
  └── no dependency on smartgrid-infra source code

smartgrid-helm  (no outbound code dependencies)
  ├── ArgoCD polls: this repo's dev and prod branches
  ├── Read:    Public HTTPS, no credentials required
  └── receives: imageTag commits from smartgrid-app CI
```

**Circular dependency check: NONE** ✅

---

## 6. Required GitHub Variables Per Repository

### smartgrid-infra

| Variable | Example Value | Required |
|---|---|---|
| `TF_STATE_BUCKET` | `smartgrid-tf-state-06vasp` | ✅ |
| `TF_STATE_LOCK_TABLE` | `smartgrid-tf-locks-06vasp` | ✅ |
| `GITHUB_ORG` | `Likhi161` | ✅ |
| `ARGOCD_CHART_VERSION` | `7.7.3` | ✅ |
| `CLUSTER_AUTOSCALER_CHART_VER` | `9.43.2` | ✅ |
| `CLUSTER_AUTOSCALER_IMAGE_TAG` | `v1.31.0` | ✅ |
| `ARGOCD_NAMESPACE` | `argocd` | optional (default: `argocd`) |
| `LBC_CHART_VERSION` | `1.8.1` | optional (default: `1.8.1`) |

### smartgrid-app

| Variable | Example Value | Required |
|---|---|---|
| `GITHUB_ORG` | `Likhi161` | ✅ |
| `TF_STATE_BUCKET` | `smartgrid-tf-state-06vasp` | ✅ |
| `TF_STATE_LOCK_TABLE` | `smartgrid-tf-locks-06vasp` | ✅ |
| `ECR_REPO_PREFIX` | `smartgrid-default` | ✅ |

### smartgrid-helm

No variables required (public, read-only for ArgoCD).

---

## 7. Required GitHub Secrets Per Repository

### smartgrid-infra

| Secret | Purpose |
|---|---|
| `AWS_ACCESS_KEY_ID` | Terraform and AWS CLI |
| `AWS_SECRET_ACCESS_KEY` | Terraform and AWS CLI |
| `AWS_REGION` | e.g. `ap-south-1` |
| `TF_VAR_RDS_PASSWORD` | RDS master password → `TF_VAR_db_password` |
| `TF_VAR_JWT_SECRET` | JWT signing secret → `TF_VAR_jwt_secret` |
| `TF_VAR_ADMIN_PASSWORD` | Bootstrap admin password → `TF_VAR_admin_password` |
| `TF_VAR_SMTP_USER` | SMTP username (optional) |
| `TF_VAR_SMTP_PASS` | SMTP password (optional) |
| `TF_VAR_NOTIFICATION_EMAIL` | SNS alert email (optional) |

### smartgrid-app

| Secret | Purpose |
|---|---|
| `AWS_ACCESS_KEY_ID` | ECR login, EKS access, S3 frontend upload |
| `AWS_SECRET_ACCESS_KEY` | As above |
| `AWS_REGION` | e.g. `ap-south-1` |
| `GH_PAT` | Push imageTag commit to smartgrid-helm |
| `SONAR_TOKEN` | SonarCloud SAST |
| `SNYK_TOKEN` | Snyk dependency scan (optional) |

### smartgrid-helm

No secrets required. ArgoCD reads via public HTTPS — no authentication.

---

## 8. Branch Strategy

| Repo | Branch | Purpose |
|---|---|---|
| smartgrid-infra | `main` | Terraform changes; PRs required |
| smartgrid-helm | `dev` | Auto-sync by ArgoCD (continuous deployment) |
| smartgrid-helm | `prod` | Manual-sync by ArgoCD (production gate) |
| smartgrid-app | `dev` | CI triggers here; default branch |
| smartgrid-app | `main` | Production release; PRs from dev |

---

## 9. ArgoCD Configuration (no credentials required)

Repositories are PUBLIC. ArgoCD Application CRs use plain HTTPS:

```yaml
spec:
  source:
    repoURL: https://github.com/${GITHUB_ORG}/smartgrid-helm.git
    targetRevision: dev
    path: helm/smartgrid
```

No `argocd repo add` step. No K8s Secret for repo credentials.
This is simpler and more secure (no PAT rotation risk).

---

## 10. Post-Split Workflow Changes Required (Phase 4)

| Workflow | File | Change Needed |
|---|---|---|
| `deploy-eks.yml` | trigger branch | Update `eksmigration` → `dev` |
| `main.yml` | trigger branch | Already targets `dev` ✅ |
| `ci-template.yml` | none | No change ✅ |
| `bootstrap.yml` | none | No change (already public-repo ready) ✅ |
| `infra.yml` | trigger branch | Already targets `main` ✅ |

---

## 11. Files NOT to Migrate (Remove in Phase 4)

### `kubernetes/` — LEGACY (delete entirely)
Superseded by `helm/smartgrid/`. Contains hardcoded account IDs from
before the EKS migration. Not migrated to any target repo.

### Root-level scratch/artifact files
Already gitignored in commit `151cd0f`. New repos start without them.

---

## 12. Phase 1 Preparation — Completed Fixes

| # | Fix | Commit | File |
|---|---|---|---|
| 1 | ECR prefix hardcoded `smartgrid-default-` | `151cd0f` | `ci-template.yml` |
| 2 | `configure-aws-credentials@v2` → `@v4` | `151cd0f` | `ci-template.yml` |
| 3 | Scratch files added to `.gitignore` | `151cd0f` | `.gitignore` |
| 4 | `deploy-eks.yml` `helm upgrade ./helm/smartgrid` removed | this commit | `deploy-eks.yml` |
| 5 | `deploy-eks.yml` `build-and-push-images` removed (handled by per-svc CI) | this commit | `deploy-eks.yml` |
| 6 | `bootstrap.yml` GH_PAT comment removed (public repos) | this commit | `bootstrap.yml` |
| 7 | `infra.yml` `TF_VAR_notification_email` mapping added | this commit | `infra.yml` |
| 8 | `sonar-project.properties` created | this commit | `sonar-project.properties` |
| 9 | `ai-assistant-service` root `/healthz` and `/ready` added | this commit | `app.js` |
| 10 | `SKIP_DB=true` alias added to secrets-manager | this commit | `secrets-manager.js` |

## 13. Pre-Split Checklist

- [x] Workflow breaking issues fixed (helm upgrade, ECR prefix, action versions)
- [x] SonarCloud configuration created
- [x] GitOps-only deployment flow documented and implemented
- [x] Public repo ArgoCD model confirmed (no credentials)
- [x] All 3 breaking gaps from audit resolved
- [x] `SKIP_DB=true` supported across all backend services
- [x] All health endpoints present across all 6 services
- [ ] `smartgrid-helm` GitHub repository created (Phase 3)
- [ ] `smartgrid-infra` GitHub repository created (Phase 3)
- [ ] `smartgrid-app` GitHub repository created (Phase 3)
- [ ] `dev` branch created in `smartgrid-app` and `smartgrid-helm` (Phase 3)
- [ ] `terraform plan` succeeds against live backend (Phase 2)
- [ ] `kubernetes/` legacy directory removed (Phase 4)
- [ ] Terraform module reorganization (Phase 4)
