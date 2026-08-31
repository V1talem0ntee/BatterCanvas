import { Link } from 'react-router-dom';
import './Portal.css';

function StudentInterface() {
  return (
    <div className="portal-wrapper">
      {/* LEFT PRIMARY PANEL */}
      <div className="panel-left">
        <header className="welcome">
          <h1>Welcome Back, Student</h1>
          <p>
            Plan your courses, manage your schedule, and track your progress toward
            graduation.
          </p>
        </header>

        {/* Grid of boxes */}
        <section className="actions-grid">
          <div className="action-box">
            <h3>Student Academics</h3>
            <p>Browse available courses and explore an interactive map of campus buildings.</p>
            <Link to="/courses" className="action-btn">
              View Student Academics
            </Link>
          </div>

          <div className="action-box">
            <h3>Schedule</h3>
            <p>View your enrolled and classes in cart in a weekly calendar view.</p>
            <Link to="/schedule" className="action-btn">
              View Schedule
            </Link>
          </div>

          <div className="action-box">
            <h3>Cart</h3>
            <p>Review alerts and classes you've selected before enrolling.</p>
            <Link to="/cart" className="action-btn">
              View Cart
            </Link>
          </div>

          <div className="action-box">
            <h3>Profile Management</h3>
            <p>View and update your personal and student information.</p>
            <Link to="/profile" className="action-btn">
              Update Profile
            </Link>
          </div>

          <div className="action-box">
            <h3>Degree Planner</h3>
            <p>
              Create, plan, and organize your academic journey.
            </p>
            <Link to="/degree-planner" className="action-btn">
              Open Degree Planner
            </Link>
          </div>

          <div className="action-box">
            <h3>Degree Progress</h3>
            <p>
              Track your progress toward graduation.
            </p>
            <Link to="/degree-progress" className="action-btn">
              View Degree Progress
            </Link>
          </div>

        </section>
      </div>
    </div>
  );
}

export default StudentInterface;
