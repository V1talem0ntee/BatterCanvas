# CSC 648 / CSC 848 — Milestone 1

![Course](https://img.shields.io/badge/Course-CSC648%20%2F%20CSC848-blue)
![Milestone](https://img.shields.io/badge/Milestone-1-informational)
![Points](https://img.shields.io/badge/Points-14-success)
![Structure](https://img.shields.io/badge/Structure-3%20Checkpoints-orange)
![Focus](https://img.shields.io/badge/Focus-Requirements%20%26%20Architecture-blueviolet)
![Evaluation](https://img.shields.io/badge/Evaluation-Industry%20Aligned-critical)


This milestone is composed of **three required checkpoints**.  
All team members are expected to read this document in full.

The Team Lead is responsible for coordinating the work and ensuring all requirements are met.

---

## Checkpoint 1: Brainstorming and Technology Selection

### Objective

- Brainstorm and validate a project idea.
- Define an initial executive vision, personas, and use cases.
- Select a software stack and obtain instructor approval.  
  For this milestone, the instructor acts as the CTO.

---

### Brainstorming the Project Idea

Before working on technical details, teams must agree on a clear project direction.

- Teams must collaboratively brainstorm project ideas during a team meeting with all members present.
- Discussion should focus on high level goals, target users, and potential use cases.
- The purpose is to evaluate feasibility, scope, and alignment between the idea and the proposed technology stack.
- The instructor will provide guidance and feedback during this process.

You do not submit your idea separately.  
Your motivation and reasoning must be documented in the **Executive Summary** of the Milestone 1 document.

---

### Submitting the Software Stack for Approval

Once your team has agreed on the project idea and high level requirements, you must select a software stack.

The stack **must be approved** before any infrastructure work begins.

#### Approved Technologies

- **Cloud Providers:** AWS, Google Cloud, Microsoft Azure  
  - Other providers require prior approval.
  - Students are responsible for staying within free tier limits. Neither the university nor the instructor is responsible for incurred costs.

- **Backend Languages:** Java, JavaScript, TypeScript, Python, Go, Rust, C++, C#, PHP  

- **Frontend Languages and Frameworks:** No restrictions  

- **APIs:** Open source only  

- **Databases:** Relational databases only  
  - MySQL and PostgreSQL are recommended.
  - NoSQL databases are not permitted for this course.

- **AI Tools and Frameworks (Approved Examples):**
  - **AI APIs:** OpenAI API, Google Gemini API, Hugging Face Inference API (open or documented models only)
  - **AI Libraries:** LangChain, LlamaIndex, Hugging Face Transformers, OpenAI SDKs

- **AI Use Cases and Restrictions:**
  - AI may be used as an assistant for prototyping, exploration, refactoring, documentation support, and productivity.
  - Prototypes or systems generated primarily through prompt driven, trial and error coding without clear understanding, design intent, or ownership of the resulting code are **not allowed** in this class.
  - All AI assisted work must be intentionally designed, reviewed, understood, and owned by the team. Students must be able to explain and defend the architecture, trade offs, and implementation decisions behind any AI assisted component.



---

### Tech Stack Approval Email

The **Team Lead** must email the instructor and cc all team members.

**Email requirements:**

- **To:** jortizco@sfsu.edu  
- **Cc:** All team members  
- **Subject:** CSC 648-848 Section 03 Team Alias — Tech Stack Approval  

Include the following:

- Cloud provider, instance size, CPU and RAM
- Operating system and version
- Database and version
- Web server and version
- Backend languages, frameworks, and versions
- Frontend languages, frameworks, and versions
- AI models and frameworks
- Any additional significant tools or packages
- A familiarity rating (1–5) for each team member across the selected technologies

Balanced teams are strongly recommended.

Once approved, teams may begin infrastructure setup while continuing documentation work.

---

## Checkpoint 2: Technical Documentation (7 points)

### Objective

Develop the foundational documentation that will guide the entire project lifecycle.

---

### Required Document Structure

Submit a single PDF named `M1v1.pdf` containing the following sections **in the exact order listed**.

1. **Title Page**
   - Course name and section
   - Project title
   - Team number
   - Team member names, roles, and Team Lead email
   - Milestone number
   - Date
   - Revision history table

2. **Table of Contents**
   - Must include page numbers and internal links.

3. **Executive Summary**
   - Up to one page.
   - Written for a non-technical executive audience.
   - Explain motivation, value, and uniqueness of the product.

4. **Main Use Cases**
   - Describe user categories and their goals.
   - Provide 8–10 primary use cases.
   - Focus on **what users do**, not implementation details.
   - Include both textual descriptions and diagrams.

5. **Main Data Items and Entities**
   - Define key concepts and entities at a logical level.
   - Use consistent terminology across all documents and interfaces.

6. **Functional Requirements**
   - High level system functionality.
   - Grouped by actor or entity.
   - Each requirement must have a unique identifier.
   - Aim for completeness, not over specification.

7. **Non Functional Requirements**
   - Include performance, reliability, security, usability, scalability, maintainability, and compliance.
   - These requirements guide all future design decisions.

8. **Competitive Analysis**
   - Analyze at least five competing products.
   - Include comparison tables.
   - Identify at least five unique or improved features in your product.

9. **Project Readiness Checklist**
   - Meeting schedule established
   - Roles assigned
   - Tools selected and understood
   - Repository organized correctly

10. **High Level Architecture and Technologies**
    - List only instructor approved technologies.

11. **Team Contributions**
    - Team Lead assigns contribution scores.
    - All team members submit confidential feedback via the [provided form](https://docs.google.com/forms/d/e/1FAIpQLSdJvLYO2UiAZyPgD6BVVzhdtwVGLYfRAwXmfTN9UTm12THizw/viewform?usp=sharing&ouid=113166225611484967377).

---

### Collaboration Expectations

- A Technical Writer should coordinate document assembly.
- All team members are expected to contribute content.
- The Team Lead approves the final submission.
- Quality, consistency, and clarity matter.

---

### Feedback

- The team will receive feedback from the instructor for `M1v1.pdf`. The feedback is provided during a team meeting with
  the instructor. Be ready to defend your work, requirement's choices and take ownership of your work.
- Individual grades depend on demonstrated contribution and ownership.


---

### Submission Instructions (Checkpoint 2)

- Upload `M1v1.pdf` to the Milestone 1 folder.
- Email the instructor with a link to your repository.
- Do not attach the PDF to the email.

---

## Checkpoint 3: Infrastructure and Throwaway Prototype

**You may not begin this checkpoint until your tech stack is approved.**

### Objective

- Configure cloud infrastructure.
- Prepare credentials documentation.
- Build a simple throwaway prototype.

---

### Cloud Server Setup

Backend team responsibilities:

- Create a free tier instance.
- Install all approved technologies.
- Configure firewall rules for:
  - SSH
  - Web server
  - Database access
- Verify the server is running and accessible.

---

### Credentials Folder

The folder `application/credentials/` must contain documentation for:

- SSH access
- Database access
- API keys and secrets management

This folder must always remain accurate and up to date.

---

### Throwaway Prototype

The prototype should be a simple About page that:

- Displays all team members
- Is deployed to the cloud instance
- Confirms that all tools and dependencies work correctly

All team members must make measurable contributions.

---

### Submission Instructions (Checkpoint 3)

The Team Lead emails the instructor with:

- Website URL
- SSH access information
- Database access information
- Any relevant notes for grading

Only work in the default branch will be graded.

---

## Final Notes

This milestone sets the foundation for the entire project.

Decisions made here will carry forward. Treat them as engineering decisions, not temporary placeholders.

---

© 2026 **BigBacks**. All rights reserved.
