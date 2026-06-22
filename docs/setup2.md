# SmartGrid Platform - Manual Infrastructure Setup Guide (Post Terraform Re-apply)

This guide lists the precise step-by-step manual configuration you must perform **every time** you run a `terraform destroy` followed by a `terraform apply`. 

Since a destroy-apply cycle completely deletes and recreates all EC2 instances, S3 buckets, and Secrets Manager configurations, you must re-install the environment packages, configure the MySQL database, and bootstrap the initial data.

---

## Pre-requisites & Target Outputs

After running `terraform apply`, note down the outputs from your terminal:
- `external_alb_dns_name` (e.g., `smartgrid-external-alb-123456789.ap-south-1.elb.amazonaws.com`)
- `internal_alb_dns_name` (e.g., `internal-smartgrid-internal-alb-123456789.ap-south-1.elb.amazonaws.com`)
- `bastion_public_ip` (e.g., `43.205.212.126`)
- `frontend_public_ip` (e.g., `43.204.29.125`)
- `backend_private_ip` (e.g., `10.0.11.160`)
- `database_private_ip` (e.g., `10.0.21.109`)

*Ensure your SSH Key Pair (e.g., `Likhitha-pem` / `key.pem`) is available on your local terminal.*

---

## Step 0: Manually Configure AWS Secrets Manager Secret

Terraform provisions the secret container under the name `smartgrid/config` but does **not** populate it automatically. You must manually add your environment configurations to this secret via the AWS Console or the AWS CLI.

### Option A: Using the AWS Secrets Manager Console
1. Open the **AWS Secrets Manager Console**.
2. Search and click on the secret named **`smartgrid/config`**.
3. Under the **Secret value** section, click **Retrieve secret value** and then click **Edit**.
4. Choose the **Key/value** tab and enter the following key-value pairs exactly:
   
   | Key | Value | Notes |
   | --- | --- | --- |
   | `NODE_ENV` | `production` | Environment type |
   | `DB_HOST` | `<database_private_ip>` | The new private IP of your DB instance (e.g. `10.0.21.109`) |
   | `DB_PORT` | `3306` | MySQL database port |
   | `DB_USER` | `smartgrid_user` | MySQL user created in Step 1 |
   | `DB_PASSWORD` | `password` | MySQL password configured in Step 1 |
   | `DB_NAME` | `smartgrid` | MySQL schema name |
   | `JWT_SECRET` | `a2b53cdd87431e5630283c448f72ee7b2c91b5da8d1234c9fb66b3f7efc4901f` | Any secure 32+ character random string |
   | `SMTP_HOST` | `smtp.mailtrap.io` | Mail server address |
   | `SMTP_PORT` | `2525` | Mail server port |
   | `SMTP_USER` | `(your_smtp_user)` | Leave empty if simulating in console logs |
   | `SMTP_PASS` | `(your_smtp_password)` | Leave empty if simulating in console logs |
   | `SENDER_EMAIL` | `noreply@smartgrid.com` | Alert sender email address |
   | `S3_BUCKET_NAME` | `smartgrid-bills-bucket-<suffix>` | The bucket name created by Terraform (found in TF outputs or console) |
   | `AWS_REGION` | `ap-south-1` | AWS deployment region |

5. Click **Save** to create the new secret version.

### Option B: Using the AWS CLI
Run this command from your local machine (replacing DB IP, S3 Bucket name, etc. with actual outputs):
```bash
aws secretsmanager put-secret-value \
  --secret-id "smartgrid/config" \
  --secret-string '{"NODE_ENV":"production","DB_HOST":"<database_private_ip>","DB_PORT":"3306","DB_USER":"smartgrid_user","DB_PASSWORD":"password","DB_NAME":"smartgrid","JWT_SECRET":"a2b53cdd87431e5630283c448f72ee7b2c91b5da8d1234c9fb66b3f7efc4901f","SMTP_HOST":"smtp.mailtrap.io","SMTP_PORT":"2525","SMTP_USER":"","SMTP_PASS":"","SENDER_EMAIL":"noreply@smartgrid.com","S3_BUCKET_NAME":"<s3_bucket_name>","AWS_REGION":"ap-south-1"}'
```

---

## Step 1: Configure the Database Server

Since the database EC2 instance is recreated, MySQL must be installed and configured.

1. **SSH into the Database Server**:
   Connect via the Bastion Host:
   ```bash
   ssh -i Likhitha-pem.pem ubuntu@<bastion_public_ip>
   # From Bastion, SSH into Database Private IP:
   ssh -i Likhitha-pem.pem ubuntu@<database_private_ip>
   ```
2. **Clone the Git Repository**:
   ```bash
   git clone <your-git-repository-url>
   cd smartgrid-utility-platform
   ```
3. **Run the Database Setup Script**:
   ```bash
   chmod +x scripts/database-install.sh
   sudo ./scripts/database-install.sh
   ```
   Provide the credentials when prompted:
   - **Database Name**: `smartgrid` (Press Enter)
   - **Database Username**: `smartgrid_user` (Press Enter)
   - **Database Password**: `password` (Press Enter)
   
   > [!IMPORTANT]
   > Ensure these credentials match the defaults defined in Secrets Manager. If you change them during the interactive prompts, you must log into the AWS Secrets Manager console and update the corresponding key-values in the `smartgrid/config` secret!

---

## Step 2: Configure the Backend Server

The backend microservices need to be cloned, package dependencies installed, and PM2 processes configured. 

1. **SSH into the Backend Server**:
   Connect via the Bastion Host:
   ```bash
   ssh -i Likhitha-pem.pem ubuntu@<bastion_public_ip>
   # From Bastion, SSH into Backend Private IP:
   ssh -i Likhitha-pem.pem ubuntu@<backend_private_ip>
   ```
2. **Clone the Git Repository**:
   ```bash
   git clone <your-git-repository-url>
   cd smartgrid-utility-platform
   ```
3. **Run the Backend Setup Script**:
   ```bash
   chmod +x scripts/backend-install.sh
   sudo ./scripts/backend-install.sh
   ```
   Provide the configuration options:
   - **Database Private IP**: Enter the new `<database_private_ip>` from Terraform output.
   - **Database Port**: `3306` (Press Enter)
   - **Database Name**: `smartgrid` (Press Enter)
   - **Database User**: `smartgrid_user` (Press Enter)
   - **Database Password**: `password` (Press Enter)
   - **SMTP Host/Port**: (Press Enter for defaults)
   
4. **Bootstrap the Administrator Account**:
   During the execution of the backend setup script, the interactive admin bootstrapper will execute:
   - **Enter Admin Name**: Enter your name
   - **Enter Admin Email**: `admin@smartgrid.com`
   - **Enter Admin Password**: `password123` (minimum 6 characters)
   
   *This account will be stored in your new database and serves as your primary login credential.*

---

## Step 3: Configure the Frontend Server

The frontend server serves the React production bundle via Nginx. Since low-tier EC2 instances (like `t2.micro` or `t3.micro`) only have 1GB of RAM, Vite builds may get **Killed** by the Linux Out-Of-Memory (OOM) killer. You must enable Swap space before compiling.

1. **SSH directly into the Frontend Server**:
   ```bash
   ssh -i Likhitha-pem.pem ubuntu@<frontend_public_ip>
   ```
2. **Enable 2GB of Swap Space**:
   Run the following commands on the server to provision virtual RAM on the disk:
   ```bash
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```
3. **Clone the Git Repository**:
   ```bash
   git clone <your-git-repository-url>
   cd smartgrid-utility-platform
   ```
4. **Run the Frontend Setup Script**:
   ```bash
   chmod +x scripts/frontend-install.sh
   sudo ./scripts/frontend-install.sh
   ```
    Provide the Backend Server Private IP or Internal ALB DNS Name when prompted:
    - **Are you using an Internal Load Balancer?**: Enter `y`.
    - **Enter Internal ALB DNS Name**: Enter the `internal_alb_dns_name` output value.

---

## Step 4: Verify Routing & Start Using the Platform

1. **Access the Portal**:
   Open a web browser and navigate to the ALB DNS name:
   `http://<external_alb_dns_name>`
2. **Perform Initial Login**:
   Log in with the **Admin credentials** configured in **Step 2.4**.
3. **Run the Verification Checklist**:
   Follow Section 7 of [setup.md](file:///c:/Users/admin/Desktop/grid/docs/setup.md) to register a consumer, assign a meter, submit consumption, recharge, and download the monthly statement from S3.
