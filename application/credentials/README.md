# Infrastructure Credentials and Access Instructions

## Project Information

- Course: CSC 648 / CSC 848
- Team: BigBacks-04
- Project: Better Student Center
- Prototype URL: `http://18.226.97.234`

---

## Public Prototype URL

```text
http://18.226.97.234
```

The prototype home page provides access to the required functionality:

- Signup / registration
- Login
- Course search

---

## Demo Login Accounts

The following accounts can be used to test the login functionality without creating a new account.

### System Administrator

```text
Email: admin@sfsu.edu
Password: adminaccess
```

### Demo Student

```text
Email: student@sfsu.edu
Password: demostudent
```

---

## Prototype Testing Flow

To test the complete prototype, please follow the steps below:

1. Open the prototype URL:

```text
http://18.226.97.234
```

2. Log in using the **System Administrator** account.

3. Create or invite a new user account through the Admin interface.

4. Log out.

5. Open the **Sign Up** page and register using the invited account information.

6. Log in using the newly created account.

7. Navigate to **Course Search** and search for:

```text
CSC
```

8. Verify that course results are returned successfully.

Following this workflow ensures that the signup process matches the implemented invitation-based registration system.

---

## Backend Service

The backend is managed using **PM2** on the EC2 server.

PM2 keeps the Express backend running after SSH sessions disconnect or after server restarts. This allows the public prototype to remain available without manually starting the backend.

Useful commands:

```bash
pm2 list
pm2 logs backend
pm2 restart backend
pm2 stop backend
```

The backend should always appear as:

```text
backend    online
```

If the backend is stopped, the frontend may still load, but API requests (signup, login, course search, etc.) will return **502 Bad Gateway** through Nginx.

---

## EC2 Server Access

The project is deployed on an AWS EC2 Ubuntu server.

```text
EC2 Public IP: 18.226.97.234
SSH Username: ubuntu
PEM Key File: bigbacks-professor-access.pem
```

Run the following command from the `application/credentials` folder:

```bash
ssh -i bigbacks-professor-access.pem ubuntu@18.226.97.234
```

For Windows PowerShell:

```powershell
ssh -i ".\bigbacks-professor-access.pem" ubuntu@18.226.97.234
```

---

## Deployed Application Paths on EC2

```text
Repository path:
/home/ubuntu/csc648-848-su26-project-BigBacks-04

Frontend path:
/home/ubuntu/csc648-848-su26-project-BigBacks-04/application/frontend

Backend path:
/home/ubuntu/csc648-848-su26-project-BigBacks-04/application/backend

Nginx public frontend directory:
/var/www/html
```

---

## Backend API Access

The Express backend runs on port `3001` on the EC2 server.

To verify the backend from inside EC2:

```bash
curl http://localhost:3001/api/health
```

To verify the backend publicly:

```bash
curl http://18.226.97.234/api/health
```

Expected result:

```json
{"status":"ok","database":"connected"}
```

Nginx is configured to forward public `/api/` requests to the Express backend on port `3001`.

Example:

```text
http://18.226.97.234/api/health
```

forwards to:

```text
http://localhost:3001/api/health
```

---

## Public API Verification

Health check:

```bash
curl http://18.226.97.234/api/health
```

Expected result:

```json
{"status":"ok","database":"connected"}
```

Course search API test:

```bash
curl "http://18.226.97.234/api/courses?search=CSC"
```

Signup, login, and course search can also be tested through the frontend pages.

---

## Database Access

The project uses Amazon RDS PostgreSQL.

Important note:

```text
The active project database is better_student_center.
```

The earlier `postgres` database is not the active project database and may not contain the required project tables or seed data.

```text
RDS Endpoint: student-center-db.chwwk2s88tac.us-east-2.rds.amazonaws.com
Port: 5432
Database Name: better_student_center
Application Schema: public
```

Reviewer database account:

```text
User: instructor_verifier
Password: professoronly
```

Developer database account:

```text
User: team_developer
Password: databaseaccess
```

---

## Accessing RDS Through SSH Tunnel

The RDS database is private and should not be opened directly to the public internet. To access it locally through DataGrip or another database client, use an SSH tunnel.

From the `application/credentials` folder, run:

```powershell
ssh -i ".\bigbacks-professor-access.pem" -L 5433:student-center-db.chwwk2s88tac.us-east-2.rds.amazonaws.com:5432 ubuntu@18.226.97.234
```

Leave this terminal window open while using the database client.

Then connect using the following settings:

```text
Host: localhost
Port: 5433
Database: better_student_center
User: instructor_verifier
Password: professoronly
Schema: public
```

If using the developer account:

```text
Host: localhost
Port: 5433
Database: better_student_center
User: team_developer
Password: databaseaccess
Schema: public
```

SSL may need to be enabled depending on the database client.

---

## Useful Database Verification Queries

After connecting to the database, verify the active database and user:

```sql
SELECT current_database(), current_user;
```

Expected database:

```text
better_student_center
```

Check available tables:

```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Check course data:

```sql
SELECT COUNT(*) FROM public.course;
```

View sample course records:

```sql
SELECT *
FROM public.course
LIMIT 10;
```

---

## Backend Environment Configuration on EC2

The backend `.env` file on EC2 should point to the `better_student_center` database:

```env
PORT=3001
DATABASE_URL=postgresql://team_developer:databaseaccess@student-center-db.chwwk2s88tac.us-east-2.rds.amazonaws.com:5432/better_student_center
DATABASE_SSL=true
```

Do not use `/postgres` for the deployed backend because the active project tables and seed data are stored in the `better_student_center` database.

---

## Correct API Routes

The frontend should call the following backend API routes:

```text
Signup: /api/auth/signup
Login: /api/auth/login
Course Search: /api/courses?search=CSC
Health Check: /api/health
```

---

### Verified Prototype Functions

The following prototype functions have been successfully tested:

- Public frontend URL loads successfully.
- PM2 keeps the backend running after SSH disconnects.
- Nginx forwards `/api` requests to the backend.
- Backend health check returns `database connected`.
- Backend connects to the `better_student_center` RDS database.
- Login works with demo accounts.
- Admin can invite/create an account invitation.
- Invited account can complete signup.
- Newly created account can log in.
- Course Search returns database-backed results.

### Final Verification Status

```text
Frontend: Working
Nginx API Proxy: Working
PM2 Backend Service: Working
RDS Database Connection: Working
Login: Working
Invitation-Based Signup: Working
Course Search: Working
```

---

## Known Notes

- The site currently uses HTTP, not HTTPS.
- RDS is private and should be accessed through EC2 or an SSH tunnel.
- The `postgres` database is not the active project database for the prototype.
- The active database for grading and testing is `better_student_center`.
- If no course results appear, verify that the backend `.env` points to `better_student_center`.
- If signup or login fails, verify that the frontend is calling the correct API route.
