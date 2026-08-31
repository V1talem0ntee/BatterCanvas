import { NavLink, useLocation } from "react-router-dom";
import "./Admin.css";
import AdminInvitations from "./AdminInvitations.jsx";
import Dashboard from "./admin/pages/Dashboard.jsx";
import Students from "./admin/pages/Students.jsx";
import Departments from "./admin/pages/Departments.jsx";
import Majors from "./admin/pages/Majors.jsx";
import Courses from "./admin/pages/Courses.jsx";
import Sections from "./admin/pages/Sections.jsx";
import Locations from "./admin/pages/Locations.jsx";
import BuildingDetails from "./admin/pages/BuildingDetails.jsx";
import DegreePrograms from "./admin/pages/DegreePrograms.jsx";
import Notifications from "./admin/pages/Notifications.jsx";

const navigation = [
  ["/admin", "Dashboard", "⌂"],
  ["/admin/invitations", "Invitations", "✉"],
  ["/admin/students", "Students", "◎"],
  ["/admin/departments", "Departments", "D"],
  ["/admin/majors", "Majors", "M"],
  ["/admin/courses", "Courses", "▤"],
  ["/admin/sections", "Class Sections", "▦"],
  ["/admin/locations", "Locations", "⌖"],
  ["/admin/degree-programs", "Degree Programs", "◇"],
  ["/admin/notifications", "Notifications", "☷"],
];

function AdminContent() {
  const path = useLocation().pathname;

  if (path === "/admin/students") return <Students />;
  if (path === "/admin/departments") return <Departments />;
  if (path === "/admin/majors") return <Majors />;
  if (path === "/admin/courses") return <Courses />;
  if (path === "/admin/sections") return <Sections />;
  if (path === "/admin/locations") return <Locations />;
  if (/^\/admin\/locations\/\d+$/.test(path)) return <BuildingDetails />;
  if (path === "/admin/degree-programs") return <DegreePrograms />;
  if (path === "/admin/notifications") return <Notifications />;
  if (path === "/admin/invitations") return <AdminInvitations />;

  return <Dashboard />;
}

export default function AdminInterface() {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-title">
          <span>BB</span>
          <div>
            <strong>BBEdu</strong>
            <small>Administration</small>
          </div>
        </div>

        <nav>
          {navigation.map(([to, label, icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/admin"}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <span>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          Academic operations console
        </div>
      </aside>

      <main className="admin-main">
        <AdminContent />
      </main>
    </div>
  );
}