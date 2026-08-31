# Better Student Center

## Project Info

This directory contains the complete source code for the Better Student Center project.

This README serves as the main entry point for the application and is intended to be the primary documentation for users, reviewers, and potential employers. The document will continue to evolve as the project moves from a course prototype into a more complete software project.

The Technical Writer and GitHub Master are responsible for keeping this document accurate and up to date throughout the project lifecycle.

---

## About the Project

Better Student Center is a web application designed to improve the student academic planning experience. Many existing student center systems provide course registration, schedules, degree information, and financial information in separate areas, which can make planning difficult for students.

This project focuses on creating a more connected student center experience. The application helps students search for courses, plan schedules, view degree progress, and connect class schedules with campus location information.

The target users are students and administrators. Students use the system to plan courses, view schedules, check degree requirements, and access student center information. Administrators use the system to manage academic data such as courses, class sections, buildings, classrooms, degree requirements, and student information.

The core value of the system is that it combines academic planning, schedule planning, degree requirement guidance, and campus navigation into one connected application.

---

## Features

Current and planned features include:

* User login and role-based access for Student and Admin users
* Student profile viewing and editing
* Course search and filtering
* Course details with course code, title, units, description, prerequisites, and available sections
* Class section information, including instructor name, meeting time, modality, location, enrollment status, and seat availability
* Weekly schedule for comparing cart and enrolled class sections
* Schedule conflict detection
* Weekly calendar view for cart and enrolled class sections
* Campus map support for displaying building and classroom locations
* Degree Progress Tree for showing completed, planned, and remaining requirements
* Course recommendations for remaining degree requirements
* Cart support for selected class sections before enrollment
* Admin management for courses, class sections, buildings, classrooms, and degree requirements
* Student financial information display, including charges and financial aid records
* Notifications for deadlines, enrollment windows, schedule conflicts, and system messages

Some features are planned for later milestones and may not be fully implemented in the current prototype.

---

## Installation and Setup

### Prerequisites

Before running the application locally, make sure the following tools are installed:

* Node.js
* npm
* Git
* PostgreSQL or access to the project’s Amazon RDS PostgreSQL database

### Clone the Repository

```bash
git clone <repository-url>
cd csc648-848-su26-project-BigBacks-04/application
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The local frontend development server will start using Vite. The terminal will show the local URL, usually:

```text
http://localhost:5173
```

### Backend Setup

The backend will use Node.js and Express. Backend setup instructions will be updated as backend implementation is completed.

Expected setup pattern:

```bash
cd backend
npm install
npm run dev
```

### Database Setup

The project uses PostgreSQL hosted on Amazon RDS for the deployed environment. Local development may use either a local PostgreSQL database or the team’s configured development database.

Database credentials and secrets should be stored in environment variables and should not be committed to GitHub.

---

## Usage

To use the application locally:

1. Start the frontend development server.
2. Start the backend server when backend implementation is available.
3. Open the frontend URL in a browser.
4. Log in as a Student or Admin user.
5. Use the available features, such as course search, weekly schedule, course details, and student profile.

Example student workflows:

* Search for a course by subject, course number, title, or department.
* View course details and available class sections.
* Add a class section to the Cart and compare it with enrolled classes.
* Check whether selected classes have time conflicts.
* View Cart and Enrolled classes in a weekly calendar.
* View building or classroom location information through the campus map.
* Review degree progress and remaining requirements.

Example admin workflows:

* Manage course information.
* Manage class section information.
* Manage building and classroom data.
* Manage degree requirement information.
* Review or update student-related academic information.

---

## Configuration

The application may require environment variables for backend and database configuration.

Example configuration values may include:

```text
PORT=
DATABASE_URL=
DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=
JWT_SECRET=
```

Do not include real secrets, database passwords, private keys, or `.env` files in the repository.

For the deployed prototype, Amazon RDS PostgreSQL is private and should be accessed through the EC2 server or an authorized SSH tunnel.

---

## Project Structure

```text
application/
├── credentials/
│   ├── README.md
│   └── bigbacks-professor-access.pem
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── backend/
│   └── backend source files
└── README.md
```

### Key Folders

| Folder             | Purpose                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| `credentials/`     | Contains instructor access instructions and required verification files |
| `frontend/`        | Contains the React/Vite frontend application                            |
| `frontend/src/`    | Contains frontend source code, components, pages, and assets            |
| `frontend/public/` | Contains static public frontend assets                                  |
| `backend/`         | Contains the planned Node.js/Express backend source code                |
| `docs/`            | Contains feature behavior, API contracts, and verification notes       |
| `README.md`        | Main application documentation                                          |

### Feature Documentation

* [Schedule](docs/schedule.md) — weekly calendar, cart and enrolled classes, and conflict checking
* [Notifications](docs/notifications.md) — notification behavior, API endpoints, and database limitation
* [Admin Portal](docs/admin.md) — protected academic data management and API overview

---

## Contributing

Team members should follow the project workflow below:

1. Pull the latest code before starting work.
2. Create or use the assigned branch for the task.
3. Make changes only related to the assigned feature or section.
4. Test changes locally before pushing.
5. Commit changes with a clear commit message.
6. Push changes to GitHub.
7. Open a pull request when possible.
8. Request review from at least one teammate before merging major changes.

### Code Style Expectations

* Use clear file and folder names.
* Keep components and functions organized.
* Avoid committing unused code or temporary files.
* Do not commit `.env` files, passwords, database credentials, or private keys unless explicitly required by the instructor for verification.
* Keep frontend, backend, and database changes organized in their correct folders.

### Pull Request Expectations

Each pull request should include:

* A short summary of the change
* The feature or section affected
* Any setup or testing notes
* Screenshots if the change affects the user interface

---

## License

No open-source license has been selected yet.

Until a license is chosen, this project should be treated as an academic team project and should not be reused or redistributed without permission from the team.

---

## Credits

### Team BigBacks-04

| Team Member   | Role                             |
| ------------- | -------------------------------- |
| Wen Chien Yen | Team Lead / Scrum Master         |
| Oscar Wang    | Frontend Lead / Technical Writer |
| Banghao Yuan  | Software Architect               |
| Sean Wang     | Database Administrator           |
| Enoch Lin     | GitHub Master                    |
| Kashif Zada   | Backend Lead                     |

### Course

CSC 648/848 Software Engineering
San Francisco State University

### Technologies

This project uses or plans to use the following technologies:

* React
* Vite
* Node.js
* Express.js
* PostgreSQL
* Amazon RDS
* AWS EC2
* Nginx
* GitHub Actions
* HTML
* CSS
* JavaScript
