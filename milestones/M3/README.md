# CSC 648 / CSC 848 — Milestone 3

![Course](https://img.shields.io/badge/Course-CSC648%20%2F%20CSC848-blue)
![Milestone](https://img.shields.io/badge/Milestone-3-informational)
![Checkpoints](https://img.shields.io/badge/Checkpoints-3-orange)
![Focus](https://img.shields.io/badge/Focus-UI%20%7C%20Architecture%20%7C%20Code-blueviolet)
![Evaluation](https://img.shields.io/badge/Evaluation-Industry%20Aligned-critical)

This milestone consists of **three required checkpoints**.

All team members are expected to read this document in full.

The Team Lead is responsible for coordination, quality control, and final submission.

---

## Checkpoint 1: Technical Documentation

### Objective

This checkpoint finalizes what your team is committing to deliver.

During this milestone, we will:

- Reach a clear agreement on the final scope of the product, especially Priority 1 functionality.
- Verify that software development is on track and that major components are installed, integrated, and functional.
- Review the horizontal prototype to evaluate UI flow and usability.
- Review software architecture, database design, and algorithms at a high level.
- Verify that basic security practices are in place.
- Confirm that teamwork is effective and contributions are balanced.
- Evaluate engineering practices, coding standards, and use of development tools.

The Milestone 3 documentation must be consistent with **Milestone 2 Version 2**, while reflecting the iterative nature of software engineering. Changes are allowed when justified by implementation realities or instructor feedback.

---

### Collaboration Expectations

- The Team Lead assigns a **Technical Writer** to coordinate the document.
- Work is divided by sections, but critical decisions must be discussed as a team.
- Major architectural, scope, and priority decisions must be agreed upon collectively.
- The Technical Writer ensures consistency, formatting, and integration.
- The Team Lead approves the final submission.

Recommended tools include GitBook, Notion, or Markdown

---

### Required Document Structure (`M3v1.pdf`)

Submit a single PDF named `M3v1.pdf` containing the following sections **in the exact order listed**.

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
   - Final version of data definitions refined from Milestone 2 Version 2.
   - These definitions will be implemented in the final system.
   - If unchanged from M2V2, they may be reused directly.

4. **Prioritized High Level Functional Requirements**
   - Review all functional requirements as a team.
   - Decide which requirements are finalized as Priority 1 and Priority 2.
   - Priority 3 requirements will not be implemented in this course.
   - Changes to priority must be justified and documented.
   - Focus on realism, feasibility, and quality over ambition.

5. **UI and UX Wireframes**
   - Updated wireframes based on feedback from Milestone 2.
   - Wireframes must clearly show user flows and screen transitions.
   - Each wireframe must align with defined use cases and data definitions.
   - Wireframes must be easy to read and suitable for grading.
   - Provide a link to the Figma workspace, including the final version of your wireframes.

6. **High Level System Design**

   **Database Architecture**
   - Revised ERD from Milestone 2 Version 2.
   - Enhanced EER diagram modeling all database tables.
   - Diagrams should accurately reflect intended implementation.

   **Backend Architecture**
   - Expanded backend architecture based on current implementation.
   - Include any new services, components, or integrations.
   - Architecture must support current scope and future scalability.

7. **Team Contributions**
   - The Team Lead documents detailed contributions for each team member.
   - Contribution scores are assigned on a scale of 1–10.
   - Misrepresentation of contributions will negatively impact the team grade.
   - All team members submit [confidential feedback](https://docs.google.com/forms/d/e/1FAIpQLSdJvLYO2UiAZyPgD6BVVzhdtwVGLYfRAwXmfTN9UTm12THizw/viewform?usp=sharing&ouid=113166225611484967377) to the instructor.

---

### Submission Instructions for Checkpoint 1

**Team Lead Requirement**
- Upload `M2v2.pdf` to the Milestone 2 folder with all the revisions given to `M2v1.pdf` addressed. This file is ready for grading.
- Upload `M3v1.pdf` to the Milestone 3 folder.
- Email the instructor and TA with a link to your repository.
- Do not attach the PDF.

---

### Feedback

- Feedback for your work in `M3v1.pdf` is provided during a team meeting with the instructor.
- Be prepared to explain and defend scope decisions, priorities, architecture, and design choices.
- Individual grades depend on demonstrated ownership and contribution.

---

## Checkpoint 2: Horizontal Prototype (HP)

### Objective

Develop a horizontal prototype that implements the UI and UX defined by your wireframes.

This prototype focuses on **breadth of functionality**, not backend completeness.

---

### Scope

**User Interface**
- Navigation between major sections defined in the wireframes.
- Forms for login and registration.
- Interactive elements implemented consistently with approved wireframes.

**User Experience**
- Clear and predictable navigation flow.
- Consistent terminology, layout, and behavior across screens.
- Usability and clarity prioritized over visual polish.

**Backend**
- Database implementation expanded to fully support Priority 1 functional requirements based on defined database architecture and design 
- Consistent enforcement of the most important non-functional requirements, such as validation, correctness, and basic security.
- End-to-end connectivity between frontend, backend, and database must be stable, validated, and demonstrable.


---

### Collaboration Expectations

- Assign responsibilities based on expertise.
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

## Checkpoint 3: Software Review and Backend Components

### Objective

Evaluate the current state of the codebase and backend implementation using industry expectations.

This checkpoint focuses on **engineering discipline**, not feature count.

---

### Evaluation Areas

**GitHub Organization**
- Clear repository structure.
- Meaningful commit messages.
- Appropriate use of branches and pull requests.

**Coding Standards**
- Consistent formatting and naming.
- Readable, maintainable code.
- Appropriate comments and documentation.

**Framework Deployment**
- Correct installation and configuration of frameworks.
- Proper integration across system components.

**Database Organization**
- Logical schema design.
- Normalization and consistency.
- Alignment with documented data definitions.

**Security Practices**
- Secure handling of credentials.
- Basic access control.
- Awareness of common vulnerabilities.

---

## Final Notes

Milestone 3 is a checkpoint to test your product maturity. 

By the end of this milestone, your project should reflect what a real engineering team would confidently commit to 
delivering. Scope, priorities, architecture, and code quality matter more than unfinished features.

---

© 2026 **BigBacks**. All rights reserved.
