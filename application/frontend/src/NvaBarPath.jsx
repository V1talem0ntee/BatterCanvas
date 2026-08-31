import { Link, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import "./NvaBarPath.css";

const pageNames = {

  "/student-portal": "",
  "/cart": "Cart",
  "/courses": "Course Search",
  "/degree-planner": "Degree Planner",
  "/degree-progress": "Degree Progress",
  "/notifications": "Notifications",
  "/profile": "Profile",
  "/schedule": "Schedule",

};

function NvaBarPath() {

  const location = useLocation();

  const { role } = useAuth();

  const pageName = pageNames[location.pathname];

  if (pageName === undefined) {

    return null;

  }

  if (location.pathname === "/courses" && role !== "student") {

    return null;

  }

  return (

    <div className="nvabarpathBackground">
      <nav className="NvaBarPathe" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden="true">›</span>
        <Link to="/student-portal" aria-current={pageName ? undefined : "page"}>
          Student
        </Link>
        {pageName && <span aria-hidden="true">›</span>}
        {pageName && <strong aria-current="page">{pageName}</strong>}
      </nav>
    </div>
    
  );
}

export default NvaBarPath;
