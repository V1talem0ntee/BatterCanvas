import "./App.css";
import { Link } from "react-router-dom";

function FAQ() {
  return (
    <main className="faq-page">
      <section className="faq-hero">
        <h2>Need Help?</h2>
        <p>
          Find answers to common questions about signing up, logging in,
          and using course search in BigBacks Edu.
        </p>
      </section>

      <section className="faq-grid">
        <div className="faq-card">
          <h3>How do I create an account?</h3>
          <p>
            Navigate to {" "}
            <Link to="/signup" className="card-link" style={{ fontSize: '0.9rem' }}>
              Sign Up
            </Link>{" "} and complete the required
            registration form to create your account.
          </p>
        </div>

        <div className="faq-card">
          <h3>Why does my account require approval?</h3>
          <p>
            New accounts must be <strong>approved by an administrator</strong> before they can
            be used to sign in. This helps verify that each account belongs to
            an authorized user.
          </p>
        </div>

        <div className="faq-card">
          <h3>Which email address should I use?</h3>
          <p>
            Use the <strong>school email address</strong> connected to your student or
            administrator account. Personal email addresses may not be
            accepted.
          </p>
        </div>

        <div className="faq-card">
          <h3>How do I go back to my dashboard?</h3>
          <p>
            Click on your <strong>avatar icon on the top right</strong> and click on your<strong> Portal</strong>. Students will be
            taken back to the Student Portal, while administrators will be taken back to
            the Admin Dashboard.
          </p>
        </div>

        <div className="faq-card">
          <h3>How do I search for courses?</h3>
          <p>
            Open the <strong>Student Academics</strong> page and search using a course
            code, subject, or keyword.
          </p>
        </div>

        <div className="faq-card">
          <h3>What if no courses appear?</h3>
          <p>
            Double-check your spelling or try using a different course code or
            keyword to broaden your search. <strong>Clicking on the search button brings up all courses in our database.</strong>
          </p>
        </div>

        <div className="faq-card">
          <h3>How does schedule conflict detection work?</h3>
          <p>
            When you add classes to your planned schedule, BigBacks Edu checks whether
            <strong>any meeting times overlap</strong> and warns you about <strong>possible schedule conflicts</strong>.
          </p>
        </div>

        <div className="faq-card">
          <h3>How is walking time between classes calculated?</h3>
          <p>
            BigBacks Edu uses the <strong>locations of campus buildings</strong> to estimate the walking
            time between consecutive classes and help identify schedules with limited
            travel time.
          </p>
        </div>

        <div className="faq-card">
          <h3>Where can I learn about the team?</h3>
          <p>
            Visit the{" "}
            <Link to="/about" className="card-link" style={{ fontSize: '0.9rem' }}>
              About Us
            </Link>{" "}
            page to learn more about the BigBacks development team.
          </p>
        </div>
      </section>
    </main>
  );
}

export default FAQ;