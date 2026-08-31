# CSC 648 / CSC 848 — Milestone 2

![Course](https://img.shields.io/badge/Course-CSC648%20%2F%20CSC848-blue)
![Milestone](https://img.shields.io/badge/Milestone-2-informational)
![Checkpoints](https://img.shields.io/badge/Checkpoints-2-orange)
![Focus](https://img.shields.io/badge/Focus-Design%20%26%20Architecture-blueviolet)
![Evaluation](https://img.shields.io/badge/Evaluation-Industry%20Aligned-critical)

This milestone consists of **two required checkpoints**.  

All team members are expected to read this document in full.

The Team Lead is responsible for coordination, quality control, and final submission.

---

## Checkpoint 1: Technical Documentation

### Objective

Refine the system design and requirements established in Milestone 1 and move from conceptual planning to concrete architectural decisions.

This checkpoint focuses on:

- Expanded data definitions
- Prioritized functional requirements
- UI mockups and storyboards
- High level backend, database, and network design
- Identification of real project risks
- Project management practices
- Documented team contributions

The Milestone 2 documentation must be consistent with **Milestone 1 Version 2**, while reflecting the iterative nature of software engineering. Changes are allowed when they are justified by design insights or instructor feedback.

---

### Collaboration Expectations

- The Team Lead assigns a **Technical Writer** to coordinate the document.
- Work is divided by sections, but key decisions must be discussed as a team.
- Prioritization of functional requirements must be done collaboratively.
- The Technical Writer is responsible for consistency, formatting, and integration.
- The Team Lead approves the final submission.

Recommended tools include GitBook, Notion, or Google Docs.

---

### Required Document Structure (`M2v1.pdf`)

Submit a single PDF named `M2v1.pdf` containing the following sections **in the exact order listed**.

1. **Title Page**
   - Course and section
   - Project name
   - Team number
   - Team members and roles
   - Team Lead email
   - Milestone number
   - Date
   - Revision history table (sorted newest first)

2. **Table of Contents**
   - Must include page numbers and internal links.

3. **Data Definitions**
   - Expanded and refined from Milestone 1 Version 2.
   - Fully define major data items and attributes.
   - Use consistent terminology across documentation, UI, backend, and database.
   - Focus on critical and differentiating data elements.

4. **Prioritized High Level Functional Requirements**
   - Expand functional requirements from Milestone 1.
   - Maintain original numbering; use sub numbering for refinements.
   - Assign priorities:
     - Priority 1: Critical
     - Priority 2: Important
     - Priority 3: Nice to have
   - Group requirements first by priority, then by entity.
   - Priorities reflect commitment and will be enforced in later milestones.

5. **Mockups and Storyboards**
   - One to two mockups per page.
   - Black and white wire style; no visual polish.
   - Organized by use case and navigation flow.
   - Must use terminology defined in Data Definitions.
   - Readability matters.

6. **High Level System Design**

   **Database Architecture**
   - Initial database requirements driven by Priority 1 needs.
   - DBMS selection with brief justification.
   - ERD representing entities, relationships, and domains.
   - Decision on media storage strategy.

   **Backend Architecture**
   - Scalability diagrams including services, load balancing, and replication.
   - Architectural summary covering reliability, security, containers, and consistency.
   - UML class diagrams for key components and APIs.
   - Justification of design patterns used.

   **Network and Deployment Design**
   - Application network diagram including protocols and security.
   - Deployment diagram mapping services to infrastructure.
   - External dependencies must be represented accurately.

   **High Level APIs and Algorithms**
   - Description of major APIs and non trivial algorithms.
   - Any new tools must be approved by the instructor.

7. **Key Project Risks**
   - Identify concrete risks in skills, schedule, technology, teamwork, and legal constraints.
   - Brief mitigation strategies for each risk.

8. **Project Management**
   - Describe how work was managed for Milestone 2.
   - Explain how future milestones will be managed.
   - Use Notion and invite the instructor to the workspace.

9. **Team Contributions**
    - Team Lead assigns contribution scores.
    - All team members submit confidential feedback via the [provided form](https://docs.google.com/forms/d/e/1FAIpQLSdJvLYO2UiAZyPgD6BVVzhdtwVGLYfRAwXmfTN9UTm12THizw/viewform?usp=sharing&ouid=113166225611484967377).

---

### Submission Instructions for Checkpoint 1

**Team Lead Requirement**
- Upload `M1v2.pdf` to the Milestone 1 folder with all the revisions given to `M1v1.pdf` addressed. This file is ready for grading.
- Upload `M2v1.pdf` to the Milestone 2 folder.
- Email the instructor and TA with a link to your repository.
- Do not attach the PDF.

---

### Feedback

- After submission, the team will receive feedback from the instructor for `M2v1.pdf`. The feedback is provided during a team meeting with
the instructor. Be ready to defend your work, design and architectural choices and take ownership of your work.
- Individual grades in this milestone depend on demonstrated contribution and ownership.


---

## Checkpoint 2: Vertical Prototype (VP)

### Objective

Develop a vertical prototype that validates end to end connectivity and core algorithms.

This prototype serves as the foundation for your MVP.

---

### Scope

**Connectivity**
- Frontend to backend communication.
- Backend to database operations.
- Functional signup and search flows.

**Algorithms**
- Search functionality.
- Rating or ranking logic where applicable.
- Initial optimization considerations.

---

### Collaboration Expectations

- Assign responsibilities based on strengths.
- Hold regular integration focused meetings.
- Perform peer reviews before submission.
- All work must be documented and explainable.

---

### Submission Instructions for Checkpoint 2

- All code must be deployed to the cloud instance.
- Only work in the default branch will be graded.
- The Team Lead emails the instructor with:
  - Prototype URL
  - Confirmation that it matches the main README
  - Any relevant setup notes or known issues

---

## Final Notes

Milestone 2 is where design decisions become real constraints.

Choices made here directly affect feasibility, scalability, and future grading. Treat this milestone as an engineering commitment.

---

© 2026 **BigBacks**. All rights reserved.
