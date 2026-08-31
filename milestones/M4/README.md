# CSC 648 / CSC 848 — Milestone 4

![Course](https://img.shields.io/badge/Course-CSC648%20%2F%20CSC848-blue)
![Milestone](https://img.shields.io/badge/Milestone-4-informational)
![Checkpoints](https://img.shields.io/badge/Checkpoints-3-orange)
![Focus](https://img.shields.io/badge/Focus-Beta%20Prototype%20%26%20Testing-blueviolet)
![Evaluation](https://img.shields.io/badge/Evaluation-Industry%20Aligned-critical)

This milestone consists of **three required checkpoints**.

All team members are expected to read this document in full.

The Team Lead is responsible for coordination, quality control, and final submission.

---

## Checkpoint 1: Technical Documentation (4 points)

### Objective

This checkpoint finalizes your engineering commitment and verifies that the system is ready for beta testing.

During this milestone, we will:

- Make a final commitment to all Priority 1 and Priority 2 functionality.
- Verify that non-functional requirements are satisfied or on track.
- Define formal usability and QA test plans.
- Perform structured code reviews.
- Validate security practices.
- Verify team contributions and ownership.

The Milestone 4 documentation must be consistent with **Milestone 3 Version 2**, while reflecting discoveries made during implementation and instructor feedback.

---

### Collaboration Expectations

- The Team Lead assigns a **Technical Writer** to coordinate the document.
- Work is divided by sections, but testing of critical features must be collaborative.
- The Technical Writer ensures consistency, formatting, and integration.
- The Team Lead approves the final submission.

Recommended tools include GitBook, Notion, or Google Docs.

---

### Required Document Structure (`M4v1.pdf`)

Submit a single PDF named `M4v1.pdf` containing the following sections **in the exact order listed**.

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

3. **Product Summary**
   - Product name
   - Final list of Priority 1 and Priority 2 functional requirements
   - Description of unique or superior features
   - Deployment URL (must match the main README)

4. **Usability Test Plan**
   - Select five major functions excluding login and registration.
   - Test participants must not be members of the development team.
   - Include:
     - Test objectives
     - Test setup and user profile
     - Effectiveness measurements
     - Efficiency measurements
     - User satisfaction survey using a Likert scale

5. **QA Test Plan**
   - Select five non functional requirements from different categories.
   - For each requirement, define:
     - Test objectives
     - HW and SW setup
     - Feature under test
     - At least three test cases with expected results and outcomes
   - Execute tests across supported browsers and environments.

6. **AI Feature Testing and Ethics Review**
   - Identify all AI assisted or AI powered features.
   - Define test cases validating:
     - Correctness and consistency of outputs
     - Bias and fairness considerations
     - Input validation and prompt constraints
     - Transparency of AI behavior to users
     - Failure modes and safe degradation
   - Confirm AI is used as an assistant, not a decision maker, where applicable.
   - Document ethical considerations and mitigation strategies.

7. **Localization Testing**
   - Define a localization test plan.
   - Provide test cases for text, formatting, layout, and directionality.
   - Record and analyze results.

8. **Code Review**
   - Document internal team code review practices.
   - Include screenshots of pull requests and review comments.
   - Perform an external code review for another team and include evidence.

9. **Security Self Check**
   - List protected assets.
   - Document password encryption strategy with screenshots.
   - Provide examples of input validation, including search inputs.

10. **Non Functional Requirements Status**
   - Copy original non functional requirements from Milestone 1 Version 2.
   - Mark each as DONE, ON TRACK, or ISSUE with justification.

11. **Team Contributions**
   - Team Lead documents detailed contributions and assigns scores.
   - All team members submit confidential feedback using the following [form](https://docs.google.com/forms/d/e/1FAIpQLSdJvLYO2UiAZyPgD6BVVzhdtwVGLYfRAwXmfTN9UTm12THizw/viewform)

---

### Submission Instructions for Checkpoint 1

**Team Lead Requirement**
- Upload `M3v2.pdf` to the Milestone 3 folder with all the revisions given to `M3v1.pdf` addressed. This file is ready for grading.
- Upload `M4v1.pdf` to the Milestone 4 folder.
- Email the instructor and TA with a link to your repository.
- Do not attach the PDF.

---

### Feedback

- Feedback for your work in `M4v1.pdf` is provided during a team meeting with the instructor.
- Be prepared to explain and defend scope decisions, priorities, architecture, and design choices.
- Individual grades depend on demonstrated ownership and contribution.

---

## Checkpoint 2: Beta Prototype (BP)

### Objective

Deliver a near final version of the application suitable for beta testing.

---

### Beta Prototype Scope

**Functional Coverage**
- Unique or superior features fully implemented and testable.

**System Integration**
- Stable frontend, backend, and database integration.
- Graceful error handling and validation.
- No critical crashes or blocking bugs.

**Non Functional Requirements**
- Performance, security, and usability requirements enforced.
- Stable behavior under normal usage conditions.

**AI Features**
- AI outputs must be explainable and constrained.
- AI failures must be handled safely.
- AI interactions must not mislead users.

---

### Testing Expectations

Teams must demonstrate:

- Functional testing
- Regression testing
- Cross browser testing
- Error handling and edge case testing
- AI specific testing and ethical validation

---

### Submission Instructions for Checkpoint 2

- All code must be deployed to the cloud instance.
- Only work in the default branch will be graded.
- The Team Lead emails the instructor with:
  - Prototype URL
  - Confirmation that it matches the main README
  - Any setup notes or known issues

---

## Checkpoint 3: Demo Presentation (3 points)

### Objective

Demonstrate the beta prototype in a live, industry style presentation.

---

### Presentation Guidelines

- All team members must be present.
- The demo must run from the deployed cloud instance.
- Unique features must be demonstrated.
- The system must handle real time interaction and errors.
- No live fixes during the demo.

Evaluation focuses on:

- Feature completeness
- Stability and robustness
- Usability and clarity
- Performance under realistic use

---

## Final Notes

Milestone 4 represents a beta level engineering deliverable.

At this point, your system should resemble something a real software team would confidently put in front of users for feedback.

---

© 2026 **BigBacks**. All rights reserved.
