# SmartGrid Utility Management Platform - Architectural Specification

This document provides a comprehensive technical breakdown of the **SmartGrid Utility Management Platform**, a production-ready, full-stack microservices application designed to automate prepaid electricity metering and billing. 

---

## 1. Executive Summary

The **SmartGrid Utility Management Platform** is a cloud-native, distributed software system designed to manage modern electrical grids under a prepaid utility model. Modern municipalities, private grids, and national energy conglomerates are transitioning from postpaid billing models to real-time, smart-meter-managed prepaid models. 

Prepaid electricity metering allows consumers to purchase utility tokens or account balance upfront. Power delivery is dynamically linked to the consumer's positive account balance. By integrating real-time balance calculations, automated over-the-air grid disconnections, and prompt reconnection cycles upon payment, utility providers eliminate bad debt and overhead costs while consumers gain unprecedented visibility into their energy consumption.

The core value proposition of the SmartGrid Platform lies in its automation, reliability, and security. Built on a modular microservices architecture, the platform guarantees that consumption tracking, balance calculations, automated email alerts, and fraud/tamper inspections execute independently yet with transaction-level consistency. The platform is designed to be fully cloud-ready and deployable entirely on private network subnets in cloud providers like AWS, resolving the core operational and financial leakages that have plagued utility providers for decades.

---

## 2. Business Problem Statement

Traditional utility distribution companies face massive financial and operational inefficiencies due to outdated infrastructure and billing methodologies.

```
Postpaid Model:
[Consume Power] ──> [Inspect Reading] ──> [Generate Bill] ──> [Wait for Payment] ──> [Collection/Bad Debt]
                                                                                      (30-90 Days Lag)
```

### 2.1 Revenue Leakage & Delayed Revenue Collection
In traditional postpaid utility models, electricity is delivered to customers for a 30-day billing cycle before a bill is generated. Customers are then granted an additional 15 to 30 days to clear their statements. This introduces a 45-to-60-day lag between energy delivery and revenue collection. 
When customers default or make late payments, utility companies suffer cash flow constraints, bad debt, and high collection overhead (such as sending legal notifications or manual grid disconnect crews).

### 2.2 Manual Meter Reading
Legacy grids rely on physical utility operators walking door-to-door to manually record dial values from analog meters. This method presents several severe challenges:
* **High Operational Costs**: Transport, labor, and safety overhead for field technicians.
* **Delayed Readings**: Readings are only recorded once a month, preventing dynamic tariff applications.
* **Human Errors**: Typographical mistakes in manual transcription lead to incorrect billing, customer disputes, and costly resolution processes.

### 2.3 Electricity Theft & Tampering
Unauthorized electricity consumption via meter bypassing, shunt installation, or physical casing tampering accounts for billions of dollars in losses globally (often categorized as non-technical losses). Legacy grids cannot detect these events in real-time, only identifying them months later during periodic safety checks.

### 2.4 Customer Bill Shock
Because postpaid customers have no daily or weekly visibility into their energy consumption, they are unable to audit their usage. This leads to "bill shock" at the end of the month, resulting in customer service backlog, high dispute rates, and payment defaults.

---

## 3. Proposed Solution

The **SmartGrid Utility Management Platform** directly resolves these legacy constraints by replacing postpaid cycles with a real-time, automated, prepaid IoT-integrated workflow.

```
SmartGrid Prepaid Model:
[Recharge Balance] ──> [Record Consumption] ──> [Real-time Deduction] ──> [Zero Balance] ──> [Auto-Disconnect]
          ▲                                                                                       │
          └─────────────────────────── [Refill Balance] ──────────────────────────────────────────┘
```

### 3.1 Core Solutions & Workflows

#### 1. Prepaid Billing
Consumers purchase balance upfront. Electricity delivery is contingent on maintaining a positive balance. The utility provider secures cash flow *before* service delivery, completely eliminating bad debt, collections agencies, and default risks.

#### 2. Smart Meter Integration
Digital smart meters record consumption in real-time and upload reading packages to the cloud via cellular or mesh network APIs. The system automates reading storage and eliminates manual data entry entirely.

#### 3. Real-Time Balance Deduction
Every time a reading package is received, the system queries the active tariff rate, calculates the consumption cost, and deducts the amount from the consumer's prepaid balance in a secure database transaction:
$$\text{Deduction Amount} = \text{Units Consumed (kWh)} \times \text{Tariff Rate (\$/kWh)}$$

#### 4. Automated Notifications & Low Balance Alerts
If a consumer's balance drops below a threshold (e.g. `$15.00`), the platform logs a notification in the database and dispatches an email alert via SMTP, giving the consumer ample time to refill their account.

#### 5. Automatic Disconnection & Reconnection
- The moment a consumer's balance hits **`$0.00` or below**, the system marks their connection status as `DISCONNECTED`. In a physical environment, this triggers a digital cutoff signal to the smart meter.
- When the consumer completes a digital recharge, if their balance returns above `$0.00`, the system automatically changes their connection status back to `CONNECTED`, sending a restore signal.

#### 6. Monthly Statement Generation
At the end of each calendar month, the system aggregates consumption data, generates an invoice, writes it locally as an HTML file in `/storage/bills/`, and logs a notification for download.

---

## 4. System Architecture

The SmartGrid Utility Management Platform uses a decoupled, three-tier microservices architecture to enforce boundaries, isolate failures, and enable independent scaling.

```
       [ Client Browser / Portal UI ]
                     │ (HTTP / HTTPS)
                     ▼
       [ Nginx Reverse Proxy / Port 80 ]
                     │
         ┌───────────┼───────────┬───────────┬───────────┐
         │ (3001)    │ (3002)    │ (3003)    │ (3004)    │ (3005)
         ▼           ▼           ▼           ▼           ▼
     ┌───────┐   ┌────────┐   ┌───────┐   ┌─────────┐ ┌───────┐
     │ Auth  │   │Consumer│   │ Meter │   │ Billing │ │ Alert │
     │Service│   │Service │   │Service│   │ Service │ │Service│
     └───────┘   └────────┘   └───────┘   └─────────┘ └───────┘
         │           │           │           │           │
         └───────────┼───────────┼───────────┼───────────┘
                     │ (MySQL Protocol / Port 3306)
                     ▼
           [ MySQL Database Server ]
```

### 4.1 System Layers

#### 1. Frontend Presentation Layer
Built using React, Vite, and Material-UI. It is deployed as static assets compiled into HTML, CSS, and JS. All browser requests are routed through Nginx on Port 80. The UI uses client-side routing (`React Router`) and state management (`Redux Toolkit`).

#### 2. Reverse Proxy & Routing Layer
Nginx runs on the Frontend Server. It serves static frontend assets and acts as a reverse proxy. Any request starting with `/api/` is parsed and forwarded to the Backend Server over the private subnet on the corresponding microservice port:
- `/api/auth/*` $\rightarrow$ Auth Service (Port 3001)
- `/api/consumers/*` $\rightarrow$ Consumer Service (Port 3002)
- `/api/meters/*` $\rightarrow$ Meter Service (Port 3003)
- `/api/tariffs` | `/api/recharges` | `/api/bills` $\rightarrow$ Billing Service (Port 3004)
- `/api/alerts` | `/api/inspections` $\rightarrow$ Alert Service (Port 3005)

#### 3. Microservices Layer
Node.js and Express.js applications managed by **PM2**. The microservices are stateless, loading configuration from local `.env` files. They communicate with other services asynchronously via database state updates or direct HTTP API calls.

#### 4. Shared Database Layer
A single MySQL Database Server running on Server 1. All microservices access the database on Port `3306` over the private network. The database schema, constraints, and relationships are defined centrally in `shared/database/models.js` and synchronized programmatically.

---

## 5. Technology Stack

| Technology | Layer / Category | Selection Rationale |
| --- | --- | --- |
| **React (v18)** | Frontend UI | Component-driven architecture, virtual DOM for high responsiveness, and a robust ecosystem for complex dashboards. |
| **Vite** | Frontend Build | Next-generation build tool utilizing native ES modules for fast Hot Module Replacement (HMR) and optimized Rollup builds. |
| **Material UI (MUI)** | Component Library | Premium design assets and custom themes (Dark Cyan) matching enterprise dashboard specifications out of the box. |
| **Redux Toolkit** | State Management | Centralized state store for user sessions, authentication tokens, and global cache control. |
| **Axios** | API Client | Promise-based HTTP requests, request interceptors (for JWT attachments), and centralized error handling. |
| **Recharts** | Analytics Charts | Declarative SVG chart library for React, enabling rendering of consumer consumption and supervisor workloads. |
| **Node.js** | Backend Runtime | Non-blocking, event-driven I/O built on Chrome's V8 engine, ideal for low-latency JSON REST microservices. |
| **Express.js** | Backend Web Framework | Minimalist, unopinionated framework for handling routes, middlewares, helmet headers, and REST controllers. |
| **PM2** | Process Manager | Production process monitor with cluster mode, auto-restarts, log rotation, and real-time status reporting. |
| **JWT** | Authentication | Compact, URL-safe JSON Web Tokens enabling secure stateless authentication across microservices. |
| **Bcryptjs** | Password Hashing | Cryptographic salt-and-hash algorithm written in pure Javascript, ensuring security without compile dependencies. |
| **MySQL (v8)** | Relational DB | ACID-compliant relational database ensuring transactions and foreign key constraints for financials. |
| **Sequelize ORM** | Database Mapping | Promise-based Node.js Object-Relational Mapper, supporting transactions, migrations, and model associations. |
| **Nginx** | Reverse Proxy / Static Host | High-performance HTTP server capable of serving static frontend assets and routing API requests with low overhead. |
| **Nodemailer** | Alert Dispatcher | Standard Node.js email sending module, offering SMTP protocol bindings for real-time customer communications. |

---

## 6. Microservices Breakdown

Each microservice is fully containerized in its own folder, running independently on dedicated ports.

---

### 6.1 Auth Service (Port 3001)
The authentication microservice handles security, session creation, password security, and role management.

#### Key Endpoints:
- `POST /api/auth/register`: Creates a user account.
  ```json
  // Request Body
  {
    "name": "Jane Doe",
    "email": "jane@doe.com",
    "password": "secretpassword",
    "role": "CONSUMER",
    "address": "456 Grid Ave",
    "phone": "555-0199"
  }
  ```
- `POST /api/auth/login`: Validates credentials, returning a signed JWT token containing user details.
- `GET /api/auth/profile`: Retrives user profile details. Requires a valid JWT token.

#### Security & Request Flow:
1. When a client requests login, the service queries `users` by email.
2. If found, it uses `bcrypt.compare` to match the password.
3. If valid, it signs a JWT containing the user ID, email, and role, set to expire in 24 hours.

---

### 6.2 Consumer Service (Port 3002)
Responsible for onboarding customers, managing consumer contact details, and assigning smart meters.

#### Key Endpoints:
- `GET /api/consumers`: Returns a list of all consumer profiles (accessible to Staff, Supervisors, and Admins).
- `GET /api/consumers/me`: Fetches profile details for the logged-in consumer.
- `PUT /api/consumers/:id`: Updates a consumer's address or phone number.
- `POST /api/consumers/assign-meter`: Links an active meter to a consumer profile.
  ```json
  // Request Body
  {
    "consumerId": 2,
    "meterId": 5,
    "installationDate": "2026-06-08"
  }
  ```

---

### 6.3 Meter Service (Port 3003)
Handles smart meter tracking, reading storage, consumption metrics, and grid tamper alerts.

#### Key Endpoints:
- `POST /api/meters`: Creates a new meter serial record (Staff and Admins only).
- `PUT /api/meters/:id`: Updates meter status (`ACTIVE`, `INACTIVE`, `TAMPERED`).
- `POST /api/meters/:id/readings`: Uploads consumption data from smart meters.
  ```json
  // Request Body
  {
    "units_consumed": 22.45
  }
  ```

#### Consumption Processing & Tamper Request Flow:
1. When a reading is posted, the service fetches the latest active tariff rate.
2. It calculates the cost and deducts it from the consumer's balance.
3. If the balance drops below `$0.00`, the connection status is set to `DISCONNECTED` and a service disconnect alert is sent.
4. If a meter's status is changed to `TAMPERED`, the service creates a physical **Inspection** record and sends a high-priority tamper alert.

---

### 6.4 Billing Service (Port 3004)
Manages pricing tariffs, customer recharges, statement generation, and PDF billing invoices.

#### Key Endpoints:
- `POST /api/tariffs`: Establishes a new tariff rate (Admins only).
- `POST /api/recharges`: Processes payments to refill consumer balances.
  ```json
  // Request Body
  {
    "consumer_id": 2,
    "amount": 50.00
  }
  ```
- `POST /api/bills/generate`: Triggers monthly bill aggregation and HTML/PDF statement compilation.
- `GET /api/bills/:id/download`: Downloads a generated billing statement.

#### Recharge Reconnection Logic:
If a consumer has been `DISCONNECTED` due to an insufficient balance, completing a recharge that brings their balance above `$0.00` automatically sets their status back to `CONNECTED`, restoring power.

---

### 6.5 Alert Service (Port 3005)
Manages notification logs, email dispatches, and field inspection tickets.

#### Key Endpoints:
- `POST /api/alerts`: Records a notification and sends an email via SMTP.
- `GET /api/inspections`: Lists all scheduled physical inspections.
- `PUT /api/inspections/:id`: Updates an inspection's status (`PENDING`, `COMPLETED`, `CANCELLED`) or assigns it to a technician.

---

## 7. Database Design

The platform uses a relational MySQL database to guarantee data integrity, relational constraints, and transaction control.

```
+------------------+         +------------------+         +------------------+
|      users       |         |    consumers     |         |      meters      |
+------------------+         +------------------+         +------------------+
| id (PK)          | <-----+ | id (PK)          | <-----+ | id (PK)          |
| name             |         | user_id (FK)     |         | meter_number     |
| email            |         | consumer_number  |         | consumer_id (FK) |
| password_hash    |         | address          |         | status           |
| role             |         | phone            |         +------------------+
| status           |         | connection_status|                  │
+------------------+         | balance          |                  ▼
                             +------------------+         +------------------+
                                      │                   |  meter_readings  |
                                      ├───┐               +------------------+
                                      │   │               | id (PK)          |
                                      ▼   ▼               | meter_id (FK)    |
                             +------------+ +-----------+ | units_consumed   |
                             |   bills    | | recharges | | reading_date     |
                             +------------+ +-----------+ +------------------+
                             | id (PK)    | | id (PK)   |
                             | consumer_id| | consumer_i|
                             | billing_mth| | amount    |
                             | units_used | +-----------+
                             | amount     |
                             +------------+
```

### 7.1 Database Table Dictionary

#### 1. `users`
Stores system accounts.
- `id` (INT, Primary Key, Auto Increment)
- `name` (VARCHAR, Not Null)
- `email` (VARCHAR, Unique, Not Null)
- `password_hash` (VARCHAR, Not Null)
- `role` (ENUM: `CONSUMER`, `STAFF`, `SUPERVISOR`, `ADMIN`, Not Null)
- `status` (ENUM: `ACTIVE`, `INACTIVE`, Default: `ACTIVE`)

#### 2. `consumers`
Tracks consumer profile details, connection state, and prepaid balance.
- `id` (INT, Primary Key)
- `user_id` (INT, Foreign Key referencing `users.id`)
- `consumer_number` (VARCHAR, Unique, Not Null)
- `address` (TEXT, Not Null)
- `phone` (VARCHAR, Not Null)
- `connection_status` (ENUM: `CONNECTED`, `DISCONNECTED`, Default: `CONNECTED`)
- `balance` (DECIMAL(10,2), Default: 0.00)

#### 3. `meters`
Tracks smart meters deployed in the field.
- `id` (INT, Primary Key)
- `meter_number` (VARCHAR, Unique, Not Null)
- `consumer_id` (INT, Nullable, Foreign Key referencing `consumers.id`)
- `installation_date` (DATEONLY, Nullable)
- `status` (ENUM: `ACTIVE`, `INACTIVE`, `TAMPERED`, Default: `ACTIVE`)

#### 4. `meter_readings`
Stores historical consumption readings.
- `id` (INT, Primary Key)
- `meter_id` (INT, Foreign Key referencing `meters.id`)
- `units_consumed` (DECIMAL(10,2), Not Null)
- `reading_date` (DATETIME, Not Null)

#### 5. `tariffs`
Tracks pricing structures.
- `id` (INT, Primary Key)
- `tariff_name` (VARCHAR, Not Null)
- `rate_per_unit` (DECIMAL(10,2), Not Null)
- `effective_date` (DATEONLY, Not Null)

#### 6. `recharges`
Logs balance recharges.
- `id` (INT, Primary Key)
- `consumer_id` (INT, Foreign Key referencing `consumers.id`)
- `amount` (DECIMAL(10,2), Not Null)
- `balance_added` (DECIMAL(10,2), Not Null)

#### 7. `bills`
Logs monthly billing aggregates.
- `id` (INT, Primary Key)
- `consumer_id` (INT, Foreign Key referencing `consumers.id`)
- `billing_month` (VARCHAR, Not Null)
- `units_used` (DECIMAL(10,2), Not Null)
- `amount` (DECIMAL(10,2), Not Null)
- `status` (ENUM: `PAID`, `UNPAID`, Default: `PAID`)
- `pdf_path` (VARCHAR, Nullable)

#### 8. `notifications`
System logs and email records.
- `id` (INT, Primary Key)
- `user_id` (INT, Foreign Key referencing `users.id`)
- `title` (VARCHAR, Not Null)
- `message` (TEXT, Not Null)
- `type` (ENUM: `LOW_BALANCE`, `TAMPER`, `RECHARGE`, `BILL`, `SYSTEM`, `INSPECTION`)

#### 9. `inspections`
Tracks technician field inspection tickets.
- `id` (INT, Primary Key)
- `consumer_id` (INT, Foreign Key referencing `consumers.id`)
- `reason` (TEXT, Not Null)
- `status` (ENUM: `PENDING`, `COMPLETED`, `CANCELLED`, Default: `PENDING`)
- `assigned_to` (INT, Nullable, Foreign Key referencing `users.id`)

---

## 8. End-to-End Business Workflow

This section details how data flows through the system during common operations.

### 8.1 Onboarding & Meter Activation
1. **User Signup**: A customer signs up via the React UI, triggering a POST to `/api/auth/register`. 
2. **Profile Generation**: The **Auth Service** creates a record in `users` and a corresponding profile in `consumers` with a generated unique ID (e.g. `CON-10029342`).
3. **Meter Provisioning**: Staff provisions a meter (e.g., `MTR-900`) and associates it with the consumer via the `/api/consumers/assign-meter` endpoint, changing the meter's status to `ACTIVE`.

### 8.2 Real-time Billing and Disconnection Cycle
The diagram below details the real-time billing loop:

```
[Smart Meter] ──> Uploads 20 kWh Reading to Meter Service
                       │
                       ▼
             [Query Active Tariff] ──> Rate is $0.15/kWh
                       │
                       ▼
           [Calculate Cost: $3.00]
                       │
                       ▼
          [Apply Sequelize Transaction]
          - Insert reading record
          - Deduct $3.00 from consumer balance
                       │
                       ├──────────────────────────┐
                       ▼ (If Balance > $15)       ▼ (If Balance <= $0)
               [Keep Connected]             [Service Disconnected]
                                            - Status: DISCONNECTED
                                            - Send cut-off signal
                                            - Dispatch alert email
```

### 8.3 Recharge & Reconnection
1. **Payment Submitted**: A disconnected consumer recharges `$50.00` via the portal.
2. **Deductions Cleared**: The **Billing Service** adds `$50.00` to the consumer's balance.
3. **Automatic Reconnection**: Because the new balance is positive, the system updates the consumer's status to `CONNECTED` and fires a grid reconnection signal.
4. **Email Confirmation**: The **Alert Service** sends a payment confirmation email via SMTP.

### 8.4 Monthly Statement Compilation
1. **Aggregation**: A cron job or manual trigger calls `/api/bills/generate` for the current month.
2. **Querying Readings**: The service aggregates all consumption readings for the consumer's active meters during the month.
3. **HTML Invoice Creation**: The system compiles the data into a styled HTML statement and saves it to disk (e.g., `/storage/bills/bill_CON-10029342_2026-06.html`).
4. **Statement Logged**: A bill record is created in the database and a notification is sent to the consumer, making the bill downloadable.

---

## 9. Security Architecture

The platform implements strict security policies to protect user accounts, transaction data, and internal communications.

```
[ Client Request ] ──> [ Nginx Proxy ] ──> JWT Authenticate Middleware ──> RBAC Verification ──> [ Microservice Controller ]
```

### 9.1 Stateless JWT Authentication
All API routes (except registration and login) require JSON Web Tokens.
- The **Auth Service** signs a token containing the user's ID, email, role, and consumer ID.
- In subsequent requests, the client attaches this token in the `Authorization: Bearer <TOKEN>` header.
- The receiving microservice verifies the token using the shared `JWT_SECRET`. If valid, the request proceeds.

### 9.2 Cryptographic Password Hashing
User passwords are encrypted before storage using **bcryptjs** with a salt factor of 10. Passwords are never stored or transmitted in plain text.

### 9.3 Role-Based Access Control (RBAC)
The application enforces strict permissions based on four roles:
- **`CONSUMER`**: Can view their own balance, profile, bills, recharges, and alerts, and submit payments.
- **`STAFF`**: Can register consumers, provision meters, assign meters, upload readings, and generate statements.
- **`SUPERVISOR`**: Can assign field inspections, view tamper alerts, and view analytics.
- **`ADMIN`**: Full platform control, user management, tariff adjustments, and system settings modifications.

### 9.4 Backend & Route Protection
Middlewares verify role permissions on the backend:
- `authenticate`: Validates the JWT signature.
- `authorize(['ADMIN', 'STAFF'])`: Restricts path access to specific roles.

### 9.5 Internal Network Security
In a production deployment, the database is locked to the private network. Only the Backend Server is allowed to communicate with the Database Server on Port `3306`.

---

## 10. AWS Deployment Architecture

For validation, the platform is designed to be deployed across three Ubuntu 22.04 LTS servers using private subnet routing:

```
[ Internet Gateway ]
       │ (Port 80 / Port 22 SSH)
       ▼
┌───────────────────────────────────────┐
│ Server 3: Frontend Server (Public Sub)│
│ - React Production Build              │
│ - Nginx Web Server                    │
└───────────────────────────────────────┘
       │ (Private Subnet Ports 3001-3005)
       ▼
┌───────────────────────────────────────┐
│ Server 2: Backend Server (Private Sub)│
│ - Node.js microservices (PM2)        │
└───────────────────────────────────────┘
       │ (Private Subnet Port 3306)
       ▼
┌───────────────────────────────────────┐
│ Server 1: Database Server (Private Sub)│
│ - MySQL Server                        │
└───────────────────────────────────────┘
```

### 10.1 Network Topology & Subnets
- **Public Subnet (Frontend Server)**: Accessible from the public internet. Houses Nginx and serves static assets on Port 80.
- **Private Subnet 1 (Backend Server)**: Hidden from the public internet. Contains the Node.js microservices, which are only accessible from the Frontend Server via the private network on ports 3001-3005.
- **Private Subnet 2 (Database Server)**: Contains the MySQL Database. It is locked down to only accept incoming connections from the Backend Server on Port 3306.

### 10.2 Security Group Policies

#### Database Server Security Group:
- **Inbound**: Allow TCP `3306` from the Backend Server Private IP.
- **Inbound**: Allow TCP `22` (SSH) from the Bastion Host.
- **Outbound**: None (or restricted updates).

#### Backend Server Security Group:
- **Inbound**: Allow TCP `3001–3005` from the Frontend Server Private IP.
- **Inbound**: Allow TCP `22` (SSH) from the Bastion Host.
- **Outbound**: Allow TCP `3306` to the Database Server Private IP.

#### Frontend Server Security Group:
- **Inbound**: Allow TCP `80` / `443` from anywhere (0.0.0.0/0).
- **Inbound**: Allow TCP `22` (SSH) from your administrator IP.
- **Outbound**: Allow TCP `3001–3005` to the Backend Server Private IP.

---

## 11. DevOps & Operations Workflow

The DevOps pipeline supports continuous updates with minimal service disruption.

```
Local Workspace ──> Push to GitHub ──> SSH to Server ──> Run Maintenance Scripts ──> Live Update
```

### 11.1 Maintenance & Update Scripts

#### 1. Frontend Update (`frontend-update.sh`)
Pulls the latest frontend changes, runs `npm run build` using the memory limit configuration (`NODE_OPTIONS="--max-old-space-size=1024"`), copies the new bundle to `/var/www/smartgrid/html`, and reloads Nginx.

#### 2. Backend Update (`backend-update.sh`)
Pulls the latest backend changes, installs dependencies, runs Sequelize migrations to synchronize schemas, and reloads the PM2 process pool:
```bash
pm2 reload all
```
Using `pm2 reload` restarts processes sequentially, ensuring zero downtime for your APIs.

#### 3. Database Update (`database-update.sh`)
Pulls database schema updates and runs migrations to synchronize tables.

### 11.2 Production Monitoring
- **PM2 Monitoring**: Monitor backend processes with `pm2 status`, and view logs using `pm2 logs`.
- **Nginx Logs**: Monitor web traffic and proxy errors in `/var/log/nginx/access.log` and `/var/log/nginx/error.log`.

---

## 12. Scalability Considerations

To scale the SmartGrid Platform to support millions of consumers, several changes should be made to the infrastructure:

```
                  [ DNS Route 53 ]
                         │
                         ▼
             [ AWS Application Load Balancer ]
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
    [ Nginx Node 1 ]                [ Nginx Node 2 ]
         │                               │
         └───────────────┬───────────────┘
                         ▼
               [ ALB (Internal) ]
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
  [ Backend Node 1 ]              [ Backend Node 2 ]
         │                               │
         └───────────────┬───────────────┘
                         ▼
              [ Redis Caching Layer ]
                         │
                         ▼
            [ AWS Aurora Cluster (DB) ]
```

### 12.1 Load Balancing and Clustering
- **Frontend Layer**: Multiple instances of the Frontend Server can be deployed behind an AWS Application Load Balancer (ALB).
- **Backend Layer**: Microservices can be scaled horizontally. Run multiple instances of the backend services on an Auto Scaling group behind an internal ALB, and configure PM2 in cluster mode to use all CPU cores on each server.

### 12.2 Caching Strategy
A **Redis** cache layer can be added to reduce database load. Since tariff rates and consumer profile details do not change frequently, caching these lookups can reduce query latency from milliseconds to microseconds.

### 12.3 Managed Database & Replication
Replace the standalone MySQL server with **Amazon Aurora MySQL**. Configure read replicas to offload read traffic (like dashboard metrics and billing history lookups) from the primary writer node.

### 12.4 Message Queues
To handle high volumes of smart meter uploads, integrate **Amazon SQS** or **Apache Kafka**. Rather than writing readings directly to the database synchronously, the Meter Service can push readings to a queue. Worker processes can then consume and process readings asynchronously, protecting the database from traffic spikes.

---

## 13. Conclusion

The **SmartGrid Utility Management Platform** is a modern, cloud-native prepaid utility solution. By replacing postpaid billing cycles with a real-time, prepaid metering model, the platform guarantees revenue collection, eliminates bad debt, and reduces operational overhead. 

Its modular microservices architecture, secure database design, automated update scripts, and robust error handling ensure the platform remains stable, reliable, and ready to scale.
