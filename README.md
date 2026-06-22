# Smart Electricity Billing & Prepaid Metering System

A production-grade, highly available microservices-based application for managing electricity consumers, smart meters, prepaid billing, and real-time alerts.

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
