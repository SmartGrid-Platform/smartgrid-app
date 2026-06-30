<div align="center">

# smartgrid-app

**Application source repository — SmartGrid Utility Management Platform**

[![CI Pipeline](https://github.com/SmartGrid-Platform/smartgrid-app/actions/workflows/main.yml/badge.svg?branch=dev)](https://github.com/SmartGrid-Platform/smartgrid-app/actions/workflows/main.yml)
[![SonarCloud](https://img.shields.io/badge/SonarCloud-Analysed-blue?logo=sonarcloud)](https://sonarcloud.io/project/overview?id=likhi161_smartgrid-app)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-green?logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Containerised-2496ED?logo=docker)](https://www.docker.com/)

</div>

---

## What Is This Repository?

This repository contains all **application-layer source code** for the SmartGrid Platform — a production-grade, cloud-native prepaid electricity metering and billing system. It contains:

- A **React 18 SPA** for consumer self-service and utility staff operations
- **6 Node.js microservices** (auth, consumer, metering, billing, alerts, AI assistant)
- **3 AWS Lambda functions** for serverless compute offload (unit calculation, tariff resolution, invoice generation)
- A **shared Sequelize ORM layer** with all 9 database models and AWS SDK helpers
- **GitHub Actions CI** that builds, Trivy-scans, and pushes each service to Amazon ECR on every commit to `dev`

> **Deployment:** This repo contains only application code. For infrastructure (Terraform/AWS) see [smartgrid-infra](https://github.com/SmartGrid-Platform/smartgrid-infra). For Kubernetes delivery (Helm/ArgoCD) see [smartgrid-helm](https://github.com/SmartGrid-Platform/smartgrid-helm).

---

## Repository Structure

```
smartgrid-app/
├── frontend/                       # React 18 SPA (Vite)
│   ├── src/
│   │   ├── pages/                  # Full-page components per role
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── ConsumerDashboard.jsx
│   │   │   ├── ConsumerBills.jsx
│   │   │   ├── ConsumerBillDetails.jsx
│   │   │   ├── ConsumerAssistant.jsx   # AI chat + PDF upload
│   │   │   ├── StaffDashboard.jsx
│   │   │   ├── SupervisorDashboard.jsx
│   │   │   └── AdminDashboard.jsx
│   │   ├── components/
│   │   │   ├── Layout.jsx              # Nav wrapper
│   │   │   └── ErrorBoundary.jsx
│   │   ├── store/                      # Redux Toolkit slices
│   │   └── utils/                      # API helpers, token management
│   ├── Dockerfile
│   └── package.json
│
├── services/
│   ├── auth-service/               # JWT auth, user management            [port 3001]
│   ├── consumer-service/           # Consumer profiles, meter assignment   [port 3002]
│   ├── meter-service/              # Meter readings, balance engine, SNS   [port 3003]
│   ├── billing-service/            # Tariffs, recharges, PDF invoices, S3  [port 3004]
│   ├── alert-service/              # Notifications, inspections, SMTP      [port 3005]
│   └── ai-assistant-service/       # Bedrock chatbot, PDF analysis         [port 4004]
│
├── lambdas/
│   └── bill_generator/             # PDF generation → S3 upload
│       (unit_calculator and tariff_engine are in-repo, zipped by Terraform CI)
│
├── shared/
│   └── database/                   # Sequelize models, migrations, AWS helpers
│       ├── models.js               # All 9 ORM models + associations
│       ├── migrations.js           # Schema sync runner
│       ├── admin-bootstrap.js      # Admin seed script
│       ├── aws-helpers.js          # Lambda + SNS invocation with fallbacks
│       ├── s3-helper.js            # Bill upload/download
│       └── secrets-manager.js      # Runtime credential injection
│
├── scripts/
│   ├── backend-install.sh          # Bare-metal PM2 deployment
│   ├── backend-update.sh
│   ├── frontend-install.sh
│   └── database-install.sh
│
├── docs/
│   ├── PROJECT_ARCHITECTURE.md     # 31 KB detailed architecture specification
│   └── setup.md                    # Full server deployment walkthrough
│
├── docker-compose.yml              # Full local stack (DB + all services + frontend)
├── sonar-project.properties        # SonarCloud configuration
├── .trivyignore                    # Accepted CVE exceptions (npm toolchain only)
└── .github/workflows/
    ├── main.yml                    # Entry point: triggers all 6 service CI jobs
    ├── ci-template.yml             # Reusable: build → scan → push → smoke test
    ├── ci-auth-service.yml         # Calls ci-template for auth-service
    ├── ci-consumer-service.yml
    ├── ci-meter-service.yml
    ├── ci-billing-service.yml
    ├── ci-alert-service.yml
    ├── ci-ai-assistant-service.yml
    ├── deploy-eks.yml              # Frontend S3 upload + CloudFront invalidation
    └── notify-failure.yml          # Posts failure summary to Actions summary
```

---

## Microservices

All services are **Node.js 18 / Express** applications. Each is independently containerised, published to Amazon ECR, and deployed on EKS with a minimum of 2 replicas. Every service exposes `/health`, `/healthz`, and `/ready` endpoints.

---

### auth-service — Port 3001

**Responsibility:** Identity and access management for all roles across the platform.

**Endpoints:**

| Method | Path | Auth Required | Description |
|--------|------|--------------|-------------|
| `POST` | `/api/auth/register` | ADMIN | Register new user. Only ADMIN can create non-consumer roles. Auto-generates `CON-[8 digits]` consumer number. Creates User + Consumer atomically in a DB transaction. |
| `POST` | `/api/auth/login` | Public | Email + password. Returns 24-hour JWT: `{ id, name, email, role, consumerId }`. |
| `GET` | `/api/auth/profile` | Any | Authenticated user profile with nested Consumer data. Excludes `password_hash`. |
| `GET` | `/api/auth/users` | ADMIN | List all users. |
| `GET` | `/api/auth/users/:id` | ADMIN | Fetch single user. |
| `PUT` | `/api/auth/users/:id` | ADMIN / Self | Update name, email, password. ADMIN can additionally change `status`. |

**Security:**
- Passwords: bcryptjs, 10 salt rounds
- Rate limit: **1,000 req / 15 min** per IP
- AWS Secrets Manager for credential injection (graceful console-fallback if offline)

---

### consumer-service — Port 3002

**Responsibility:** Consumer account lifecycle — profile management, meter assignment, and cascade deletion.

**Endpoints:**

| Method | Path | Auth Required | Description |
|--------|------|--------------|-------------|
| `GET` | `/api/consumers` | STAFF/ADMIN | All consumers with nested User and Meter associations. |
| `GET` | `/api/consumers/me` | CONSUMER | Own profile and meter list. |
| `GET` | `/api/consumers/:id` | Any | Consumer by ID. CONSUMER role scoped to own record. |
| `PUT` | `/api/consumers/:id` | STAFF/ADMIN / Self | Update address and phone. |
| `PUT` | `/api/consumers/:id/status` | STAFF/ADMIN | Toggle `connection_status` or manually adjust `balance`. |
| `POST` | `/api/consumers/assign-meter` | STAFF/ADMIN | Assign a provisioned meter to a consumer. Returns `tariffId` and `installation_date`. |
| `DELETE` | `/api/consumers/:id` | STAFF/ADMIN | Hard delete with cascade: Bills, Recharges, Inspections, Notifications. |

**Rate limit:** 150 req / 15 min per IP

---

### meter-service — Port 3003

**Responsibility:** Smart meter lifecycle, reading ingestion, and the core **prepaid balance deduction engine**. This is the highest-traffic service and has HPA enabled (2–6 replicas on CPU/memory thresholds).

**Endpoints:**

| Method | Path | Auth Required | Description |
|--------|------|--------------|-------------|
| `GET` | `/api/meters` | STAFF/ADMIN | All meters. |
| `GET` | `/api/meters/consumer/:consumerId` | Any | Meters for a consumer. Scoped for CONSUMER role. |
| `GET` | `/api/meters/:id` | Any | Meter details with Tariff and Consumer. |
| `POST` | `/api/meters` | STAFF/ADMIN | Provision a meter. Unique `meter_number`. Defaults: type=SMART, status=ACTIVE. |
| `PUT` | `/api/meters/:id` | STAFF/ADMIN | Update status. **On TAMPERED:** creates Notification + Inspection (PENDING) automatically. |
| `GET` | `/api/meters/:id/readings` | Any | Paginated reading history, descending by date. |
| `POST` | `/api/meters/:id/readings` | STAFF/ADMIN | **Submit a reading — triggers the full balance deduction pipeline (see below).** |
| `DELETE` | `/api/meters/:id` | STAFF/ADMIN | Delete meter and all associated MeterReading records. |

**Reading submission — full pipeline:**

```
POST /api/meters/:id/readings  { reading_date, current_reading }
  │
  ├─ 1. Invoke Lambda: unit_calculator      → { units_consumed }
  ├─ 2. Fetch Tariff; invoke tariff_engine  → { rate_per_unit }
  ├─ 3. Invoke Lambda: bill_generator       → { amount, s3_key }  (PDF uploaded to S3)
  │
  ├─ 4. DB TRANSACTION  →  Consumer.balance -= amount
  │
  ├─ 5a. balance ≤ 0    →  connection_status = DISCONNECTED
  │                     →  Notification (LOW_BALANCE)
  │                     →  SNS publish → SNS_DISCONNECTION_ARN (email alert)
  │
  ├─ 5b. balance crosses below ₹15 (first time)
  │                     →  Notification (LOW_BALANCE)
  │                     →  SNS publish → SNS_LOW_BALANCE_ARN (warning email)
  │
  └─ 6. Store MeterReading record  →  response 201
```

Lambda calls use `invokeLambda(name, payload, localFallbackFn)` — if `SKIP_LAMBDA=true`, the fallback computes locally (for development).

**Rate limit:** 200 req / 15 min per IP

---

### billing-service — Port 3004

**Responsibility:** Tariff management, consumer recharge processing, bill retrieval, and PDF invoice lifecycle. Also HPA-enabled (2–6 replicas).

**Endpoints:**

| Method | Path | Auth Required | Description |
|--------|------|--------------|-------------|
| `GET` | `/api/tariffs` | Any | List all tariffs. |
| `POST` | `/api/tariffs` | ADMIN | Create tariff with rate per unit, fixed charge, effective date. |
| `PUT` | `/api/tariffs/:id` | ADMIN | Update tariff or toggle `status`. |
| `GET` | `/api/bills` | Any | Bill list. CONSUMER scoped to own. |
| `GET` | `/api/bills/:id` | Any | Bill detail. Returns a pre-signed S3 URL for the invoice PDF. |
| `POST` | `/api/recharges` | CONSUMER | Add prepaid balance. Creates Recharge, updates balance, auto-reconnects if balance was 0, creates Notification (RECHARGE). |
| `GET` | `/api/recharges` | Any | Recharge history. CONSUMER scoped to own. |

**PDF invoice (pdfkit):** A4 format — consumer info, usage table, totals box (energy charge, fixed charge, tax, total), payment status banner. Uploaded to S3 as `bill_<consumerNumber>_<billingMonth>.pdf`.

**Rate limit:** 200 req / 15 min per IP

---

### alert-service — Port 3005

**Responsibility:** In-app notifications, SMTP email dispatch, and meter tamper inspection workflows for field staff.

**Endpoints:**

| Method | Path | Auth Required | Description |
|--------|------|--------------|-------------|
| `GET` | `/api/alerts` | STAFF/ADMIN | System-wide alerts (TAMPER, INSPECTION, SYSTEM). Includes nested User. |
| `GET` | `/api/alerts/user/:userId` | Any | User's notification feed. CONSUMER scoped to own. |
| `POST` | `/api/alerts` | Any | Create notification + async email dispatch (non-blocking). |
| `GET` | `/api/inspections` | STAFF/ADMIN | All inspection records with Consumer and assigned staff User. |
| `POST` | `/api/inspections` | STAFF/ADMIN | Create manual inspection task. `assigned_to` must be STAFF role. |
| `PUT` | `/api/inspections/:id` | STAFF/ADMIN | Update status (PENDING → COMPLETED / CANCELLED) or reassign. |

**Notification types:** `LOW_BALANCE`, `TAMPER`, `RECHARGE`, `BILL`, `SYSTEM`, `INSPECTION`

**Email:** Nodemailer + configurable SMTP. Falls back to console logging if SMTP credentials are absent (no crash). Default dev SMTP: `localhost:1025` (MailHog compatible).

**Rate limit:** 200 req / 15 min per IP

---

### ai-assistant-service — Port 4004

**Responsibility:** AI-powered customer support chatbot. Answers consumer questions about balance, bills, and usage by calling internal microservices in real time via a LangChain agent graph.

**Endpoints:**

| Method | Path | Auth Required | Description |
|--------|------|--------------|-------------|
| `POST` | `/api/assistant/chat` | Any | Multi-turn conversational chat. Maintains up to 15 messages in session. Auto-creates `sessionId` if absent. 50s timeout. Returns `{ reply, sessionId }`. |
| `POST` | `/api/assistant/explain-bill` | Any | Takes `billId`. AI returns: usage breakdown, comparison to past usage, energy-saving recommendations. |
| `POST` | `/api/assistant/upload-bill` | Any | Multipart PDF upload (max 10 MB). Extracts text via pdf-parse; falls back to AWS Textract for image/scanned PDFs (< 50 chars heuristic). Returns structured summary + insights. |
| `GET` | `/api/assistant/health` | Public | Bedrock connectivity, internal service reachability, model availability. |
| `GET` | `/api/assistant/debug` | Any | JWT validity, Bedrock status, service connectivity, graph init status. |

**AWS Bedrock models:**

| Model | Role | ID |
|-------|------|----|
| Amazon Nova Pro v1 | Primary (high reasoning) | `us.amazon.nova-pro-v1:0` |
| Amazon Nova Lite v1 | Fallback (throttle / cost) | `us.amazon.nova-lite-v1:0` |

Bedrock is invoked in `us-east-1` (model availability requirement). Error codes: **504** on timeout, **429** on Bedrock throttle.

**LangChain agent tools:** The agent can call consumer-service, meter-service, and billing-service with the authenticated user's Bearer token forwarded — enabling real-time personalised answers.

**Session store:** In-memory Map. Production deployments should use a persistent store (Redis) to survive pod restarts.

---

## Lambda Functions

### unit_calculator

Computes electricity units consumed between two meter readings.

**Input → Output:**
```json
{ "current_reading": 1250, "previous_reading": 1100 }
→
{ "units_consumed": 150 }
```

### tariff_engine

Resolves the applicable rate per unit for a meter's assigned tariff. Supports dynamic logic (tiered pricing, time-of-use) for future extension.

**Input → Output:**
```json
{ "tariff_name": "Standard", "rate_per_unit": 6.50, "fixed_charge": 50 }
→
{ "rate_per_unit": 6.50 }
```

### bill_generator

Calculates the total amount and generates a professional PDF invoice uploaded to S3.

**Input:**
```json
{
  "units": 150, "rate": 6.50, "fixedCharge": 50,
  "consumerNumber": "CON-12345678", "billingMonth": "2026-06",
  "consumerName": "Ravi Kumar", "consumerEmail": "ravi@example.com",
  "consumerPhone": "9876543210", "consumerAddress": "123 Main Street",
  "meterNumber": "MTR-001", "tariffPlan": "Standard Residential",
  "previousReading": 1100, "currentReading": 1250,
  "tax": 0, "paymentStatus": "PAID"
}
```

**Processing:** amount = (units × rate) + fixedCharge → A4 PDF (pdfkit) → S3 upload

**Output:**
```json
{ "amount": 1025.00, "s3_key": "bill_CON-12345678_2026-06.pdf" }
```

**S3 key format:** `bill_<consumerNumber>_<billingMonth>.pdf`  
**Bucket:** `BILLS_BUCKET_NAME` env var (default: `smartgrid-dev-billing-bucket`)

---

## Shared Database Layer

All 6 services import this module from `/shared/database`.

**ORM:** Sequelize v6 · **Database:** MySQL 8.0

### Models

| Model | Key Fields | Notes |
|-------|-----------|-------|
| **User** | `id`, `email` (unique), `password_hash`, `role` (CONSUMER/STAFF/ADMIN), `status` | 1:1 Consumer |
| **Consumer** | `consumer_number` (CON-xxxxxxxx), `connection_status`, `balance` (DECIMAL 10,2 ₹) | Prepaid balance in rupees |
| **Meter** | `meter_number` (unique), `consumer_id` (nullable), `tariff_id`, `status` (ACTIVE/INACTIVE/TAMPERED) | Can exist unassigned |
| **MeterReading** | `units_consumed` (DECIMAL 10,2), `reading_date` | Immutable after creation |
| **Tariff** | `tariff_name`, `rate_per_unit`, `fixed_charge`, `status`, `effective_date` | Multiple active tariffs supported |
| **Recharge** | `amount`, `balance_added` | Immutable audit record |
| **Bill** | `billing_month` (YYYY-MM), `units_used`, `amount`, `status` (PAID/UNPAID), `s3_key` | PDF link cached in s3_key |
| **Notification** | `title`, `message`, `type` (LOW_BALANCE/TAMPER/RECHARGE/BILL/SYSTEM/INSPECTION) | Immutable audit trail |
| **Inspection** | `reason`, `status` (PENDING/COMPLETED/CANCELLED), `assigned_to` (User FK) | Field staff task |

### AWS Helpers

```js
// aws-helpers.js
invokeLambda(functionName, payload, localFallbackFn)
// Calls AWS Lambda; if SKIP_LAMBDA=true, runs localFallbackFn() instead

publishSNS(topicArn, message, subject)
// Publishes to SNS; if SKIP_SNS=true, console.logs instead
```

```bash
npm run migrate    # Sequelize sync — creates / alters all tables
npm run bootstrap  # Seeds the initial admin user account
```

---

## Frontend

**Framework:** React 18.3 · **Build:** Vite · **UI:** Material-UI v5

| Library | Purpose |
|---------|---------|
| MUI v5 | Component system and theming |
| Redux Toolkit | Global state (auth, consumer data) |
| react-router-dom v6 | Client-side routing |
| axios | HTTP client with JWT interceptor |
| recharts v2 | Usage and billing data charts |

**Role-based pages:**

| Page | Roles | Description |
|------|-------|-------------|
| Login / Register | Public | Auth entry points |
| ConsumerDashboard | CONSUMER | Balance widget, recent consumption, quick recharge |
| ConsumerBills | CONSUMER | Bill history, PDF download |
| ConsumerBillDetails | CONSUMER | Full bill breakdown |
| ConsumerAssistant | CONSUMER | AI chat (text + PDF bill upload) |
| StaffDashboard | STAFF | Meter provisioning, reading submission, consumer lookup |
| SupervisorDashboard | SUPERVISOR | Inspection tracking, alert feed, reports |
| AdminDashboard | ADMIN | User management, tariff CRUD, system-wide inspections |

**Auth flow:** JWT → localStorage → Axios interceptor adds `Authorization: Bearer <token>` to all requests → Role-based route guarding.

---

## Key Business Workflows

### Prepaid Meter Reading → Automatic Balance Deduction

```
Staff submits meter reading
  → unit_calculator Lambda  (kWh consumed)
  → tariff_engine Lambda    (cost per unit)
  → bill_generator Lambda   (total amount, PDF → S3)
  → DB transaction: balance -= amount
  → balance ≤ 0     → DISCONNECTED + disconnection SNS
  → balance ≤ ₹15   → LOW_BALANCE notification + SNS warning
```

### Consumer Recharge → Automatic Reconnection

```
Consumer tops up balance (POST /api/recharges)
  → Consumer.balance += amount
  → If balance > 0: connection_status = CONNECTED
  → Notification (RECHARGE) created
```

### Meter Tamper → Inspection Assignment

```
Staff marks meter as TAMPERED
  → Notification (TAMPER) created and emailed
  → Inspection record created (status: PENDING)
  → Field staff assigned via PUT /api/inspections/:id
  → Resolved as COMPLETED
```

### AI Bill Analysis via PDF Upload

```
Consumer uploads bill PDF
  → pdf-parse extracts text
  → If text < 50 chars: AWS Textract OCR fallback
  → LangChain agent + Bedrock Nova Pro
  → Returns: structured summary + 3 actionable insights
  → Saved to session for multi-turn follow-up
```

---

## CI/CD Pipeline

On every `git push` to `dev`, **6 parallel service CI jobs** run:

```
push → dev
  ├── ci-auth-service          ─┐
  ├── ci-consumer-service      ─┤
  ├── ci-meter-service         ─┼─ parallel: build → Trivy scan → push ECR → smoke test
  ├── ci-billing-service       ─┤
  ├── ci-alert-service         ─┤
  └── ci-ai-assistant-service  ─┘
          │
          ▼  (all 6 pass)
  update-helm-values
    → commits new imageTag (7-char SHA) to smartgrid-helm/values.yaml
          │
          ▼
  ArgoCD detects commit → Helm release synced to EKS → new pods rolled out
```

**Per-service CI steps (`ci-template.yml`):**
1. Checkout code
2. AWS ECR authentication
3. Docker build (SHA tag + `:latest`)
4. **Trivy vulnerability scan** — HIGH/CRITICAL; exits 1 on failure
5. Push to ECR
6. **Smoke test** — `SKIP_SECRETS_MANAGER=true`, poll `/healthz` (20 × 1s), assert HTTP 200

**`.trivyignore` rationale:** All accepted CVEs are inside `/usr/local/lib/node_modules/npm` (npm itself), not in runtime application code. The container entrypoint is `node server.js` — npm is never invoked at runtime.

**Additional workflows:**
- `deploy-eks.yml` — Vite build → S3 sync → CloudFront invalidation + Checkov IaC + Trivy filesystem scan
- `notify-failure.yml` — Writes failure summary to GitHub Actions job summary

---

## Local Development

### Start the full stack

```bash
git clone https://github.com/SmartGrid-Platform/smartgrid-app.git
cd smartgrid-app
docker-compose up
```

All containers start on a shared bridge network (service discovery by name).

| Service | URL |
|---------|-----|
| Frontend | http://localhost:80 |
| auth-service | http://localhost:3001 |
| consumer-service | http://localhost:3002 |
| meter-service | http://localhost:3003 |
| billing-service | http://localhost:3004 |
| alert-service | http://localhost:3005 |
| ai-assistant-service | http://localhost:4004 |

### Database bootstrap

```bash
cd shared/database
npm run migrate     # Create all tables
npm run bootstrap   # Seed admin user
```

### Run a single service (without Docker)

```bash
cd services/auth-service
npm install
JWT_SECRET=dev-secret \
  DB_HOST=localhost DB_USER=smartgrid_user \
  DB_PASSWORD=smartgrid_password DB_NAME=smartgrid_dev \
  SKIP_LAMBDA=true SKIP_SNS=true \
  node server.js
```

---

## Environment Variables

### All services

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | `development` or `production` | Yes |
| `DB_HOST` | MySQL host | Yes |
| `DB_PORT` | MySQL port (default: 3306) | Yes |
| `DB_NAME` | Database name | Yes |
| `DB_USER` | Database username | Yes |
| `DB_PASSWORD` | Database password | Yes |
| `JWT_SECRET` | HS256 signing secret (min 32 chars) | Yes |
| `AWS_REGION` | AWS region (default: `ap-south-1`) | Yes |
| `SKIP_SECRETS_MANAGER` | Bypass AWS Secrets Manager (local dev) | No |

### meter-service / billing-service

| Variable | Description |
|----------|-------------|
| `LAMBDA_UNIT_CALCULATOR` | Lambda function name |
| `LAMBDA_TARIFF_ENGINE` | Lambda function name |
| `LAMBDA_BILL_GENERATOR` | Lambda function name |
| `BILLS_BUCKET_NAME` | S3 bucket for invoices |
| `SNS_LOW_BALANCE_ARN` | SNS topic ARN |
| `SNS_DISCONNECTION_ARN` | SNS topic ARN |
| `SKIP_LAMBDA` | Use local fallback instead of Lambda |
| `SKIP_SNS` | Log SNS events instead of publishing |

### alert-service

| Variable | Description |
|----------|-------------|
| `SMTP_HOST` | SMTP relay host |
| `SMTP_PORT` | SMTP port (587 for TLS) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SENDER_EMAIL` | From address |

### ai-assistant-service

| Variable | Description |
|----------|-------------|
| `BEDROCK_REGION` | `us-east-1` (required for Nova models) |
| `BEDROCK_MODEL_PRIMARY` | `us.amazon.nova-pro-v1:0` |
| `BEDROCK_MODEL_FALLBACK` | `us.amazon.nova-lite-v1:0` |
| `CONSUMER_SERVICE_URL` | Internal consumer-service URL |
| `BILLING_SERVICE_URL` | Internal billing-service URL |
| `METER_SERVICE_URL` | Internal meter-service URL |

---

## Security

| Layer | Mechanism |
|-------|-----------|
| Authentication | JWT (HS256, 24h expiry) |
| Password storage | bcryptjs, 10 salt rounds |
| Authorisation | Role-based middleware on every route (CONSUMER / STAFF / ADMIN) |
| Rate limiting | Per-service, per-IP (150–1,000 req / 15 min) |
| Secrets | AWS Secrets Manager at runtime; no secrets in Git or env files |
| Vulnerability scanning | Trivy on every Docker image; CI blocks on HIGH/CRITICAL |
| Static analysis | SonarCloud SAST (project: `likhi161_smartgrid-app`) |
| Container hardening | Non-root user UID 1000 enforced in all Kubernetes deployments |
| Audit trail | Immutable records: MeterReading, Recharge, Bill, Notification, Inspection |

---

## Related Repositories

| Repository | Purpose |
|------------|---------|
| [smartgrid-infra](https://github.com/SmartGrid-Platform/smartgrid-infra) | Terraform — full AWS infrastructure (VPC, EKS, RDS, CloudFront, IAM, Lambda, SNS, SQS) |
| [smartgrid-helm](https://github.com/SmartGrid-Platform/smartgrid-helm) | Helm charts and ArgoCD applications for Kubernetes delivery |

## 🚀 Application Overview

The **SmartGrid Platform** is designed to modernize utility management. It provides a secure portal for consumers to check usage, recharge balances, and view bills, while offering an administrative dashboard for utility staff to provision smart meters, record consumption readings, and manage dynamic tariffs.

### Architecture Highlights
- **Frontend**: React.js SPA (Vite)
- **Backend Microservices**: Node.js, Express, Sequelize ORM
- **Database**: Managed Relational Database (MySQL)
- **Asynchronous Processing**: Serverless Event-Driven compute
- **Infrastructure as Code**: Fully automated deployment via Terraform

---

## ☁️ Cloud Infrastructure & Services Incorporated

This application is deployed entirely on AWS using a highly secure, modular architecture with separate `dev` and `prod` environments managed by **Terraform Workspaces**.

### Edge & Content Delivery
* **Amazon CloudFront**: Acts as the global CDN and reverse proxy. It serves the static React frontend from S3 with ultra-low latency and seamlessly routes `/api/*` requests directly to the internal Load Balancer.
* **AWS WAFv2**: Web Application Firewall attached to CloudFront protecting the platform from DDoS attacks, SQL injection, and rate-limiting abusive IP addresses.

### Compute & Microservices
* **Application Load Balancer (ALB)**: Public-facing entry point for API traffic. Dynamically routes incoming HTTP requests to the appropriate Target Groups for each specific microservice.
* **EC2 Auto Scaling Group (ASG)**: Hosts the Node.js backend. Instances run in Private Subnets for security. They utilize a custom `user_data.sh` script to automatically install dependencies, pull the latest code, execute database migrations, and boot up 5 PM2 microservices on startup.
* **NAT Gateway**: Allows EC2 instances in private subnets to securely download packages and contact external AWS APIs without exposing them to inbound internet traffic.

### Serverless Lambdas (In-built Modules)
To prevent the main API servers from bogging down during heavy operations, intensive tasks are offloaded to **AWS Lambda**:
1. **`smartgrid-unit-calculator`**: Triggered when a new meter reading is submitted. It instantly calculates the consumed units.
2. **`smartgrid-tariff-engine`**: Calculates the monetary cost of the consumed units based on the consumer's active tariff rate and tier.
3. **`smartgrid-bill-generator`**: Generates a PDF/HTML monthly invoice statement and securely uploads it to an S3 bucket for consumer retrieval.

### Event-Driven Alerts
* **Amazon SNS (Simple Notification Service)**: Integrated directly into the backend code. 
  - **Low Balance Alerts**: If a meter deduction causes a consumer's balance to drop below ₹15, the API fires an event to the `low-balance` SNS topic, which asynchronously sends warning emails to the consumer.
  - **Disconnection Notices**: If the balance drops below ₹0, an event is sent to the `disconnection` SNS topic.

### Storage & Security
* **Amazon S3 (Simple Storage Service)**: 
  - **Frontend Bucket**: Hosts the React UI. Completely private, accessible only via CloudFront Origin Access Control (OAC).
  - **Bills Bucket**: Securely stores generated monthly invoices.
* **Amazon RDS (MySQL)**: Fully managed, Multi-AZ relational database residing in isolated database subnets.
* **AWS Secrets Manager**: Eliminates hardcoded passwords. The database credentials and JWT signing keys are stored here and dynamically injected into the EC2 instances at runtime.
* **Terraform Remote State (S3 & DynamoDB)**: Infrastructure state is securely stored in a remote S3 bucket, with state-locking managed by a DynamoDB table to prevent concurrent modification errors across development teams.

---

## 🏗️ Project Structure

The repository is organized into distinct domains:

```text
/frontend          # React SPA (Consumer Portal & Staff Dashboard)
/services
  /auth-service      # JWT Authentication, Staff/Consumer Roles
  /consumer-service  # Consumer Profiles, History
  /meter-service     # Meter Provisioning, Readings, Direct Balance Deductions
  /billing-service   # Tariffs, Payments, Recharges
  /alert-service     # Dashboard Notifications
/lambdas
  /unit_calculator   # Lambda: Calculates units
  /tariff_engine     # Lambda: Resolves tariff price
  /bill_generator    # Lambda: Creates statements
/shared            # Shared database models and migrations
/terraform
  /backend-setup     # Bootstraps the S3 remote state and DynamoDB locks
  /modules
    /smartgrid-core  # Reusable module containing the entire AWS architecture
  main.tf            # Workspace environment orchestration
```

## 🛠️ Automated Deployment (Terraform)

The infrastructure is 100% automated. Deployment requires zero manual SSH intervention.

1. `terraform init` (Initializes S3 backend)
2. `terraform workspace select dev` (Select environment)
3. `terraform apply`

**What happens on apply?**
- Terraform builds the VPC, Database, ASG, and CDN.
- Terraform executes a `local-exec` provisioner that compiles the Vite React app (`npm run build`) and uploads it to the S3 bucket.
- The EC2 instances boot, clone this repository, fetch secrets, run database migrations, seed the initial `admin` user, and start the PM2 services.
- The CloudFront URL is outputted to the console for instant access.
