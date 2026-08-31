import './Navbar.css';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import useRequestCooldown from './useRequestCooldown.js';
import logo from './assets/logo.svg';
import avatar from './assets/avatar.png';
import { authFetch, useAuth } from './AuthContext.jsx';

function Navbar() {
  const navigate = useNavigate();

  const { token, role: userRole, clearSession } = useAuth();

/*
  const homePath =
    userRole === "student"
      ? "/student-portal"
      : userRole === "admin"
        ? "/admin"
        : "/";
*/

// Site logo will now always take the user to the front page home
  const homePath = "/";

  const {
    isCoolingDown: logoutCoolingDown,
    startCooldown: startLogoutCooldown,
  } = useRequestCooldown();

  const handleLogout = async () => {
    if (!startLogoutCooldown()) {
      return;
    }

    try {
      if (token) {
        await authFetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } finally {
      clearSession();
      navigate('/login');
    }
  };

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!token || userRole !== "student") {
      return undefined;
    }

    async function checkNotifications(syncFirst) {
      try {
        if (syncFirst) {
          await authFetch("/api/notifications/sync", {
            method: "POST",
          });
        }

        const response = await authFetch("/api/notifications");
        const data = await response.json();
        if (response.ok) {
          setNotificationCount((data.notifications || []).length);
        }
      } catch {
        setNotificationCount(0);
      }
    }

    function updateNotificationCount() {
      checkNotifications(false);
    }

    checkNotifications(true);
    window.addEventListener("Newnoticification", updateNotificationCount);

    return () => {
      window.removeEventListener("Newnoticification", updateNotificationCount);
    };
  }, [token, userRole]);

  useEffect( () =>
    {
    function handleClickOutside(event)
    {
      // If dropdownRef exists AND the clicked element is NOT inside dropdownRef:
      if (dropdownRef.current && !dropdownRef.current.contains(event.target))
      {
        setIsDropdownOpen(false); // Close the dropdown
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };

    },[]);
  
return (
<nav className="nav-span">
<nav className="top-navbar">


{/* ------------------------ LEFT SECTION ------------------------ */}
      
<div className="nav-left">

  {/* Logo and name visible no matter what */}
  <NavLink to={homePath} className="nav-logo">
    <img src={logo} alt="Logo" className="logo-img" />
    <span className="nav-logo-text">BBEdu</span>
  </NavLink>

</div>

{/* ------------------------ CENTER SECTION (Nothing needed at the moment)------------------------ */}
<div className="nav-center">

</div>


{/* ------------------------ RIGHT SECTION ------------------------ */}
<div className="nav-right">

  <NavLink to="/faq" className={({ isActive }) => isActive ? "nav-btn active" : "nav-btn"}>
    FAQ
  </NavLink>

  {/* Available if the user is logged in as a student */}
  {userRole === 'student' && (
    <>

      <NavLink to="/notifications" className={({ isActive }) => isActive ? "nav-btn notification-link active" : "nav-btn notification-link"}>
        Notifications
        {notificationCount > 0 && (
          <span
            className="notification-badge"
            aria-label={`${notificationCount} active notifications`}
          >
            {notificationCount > 99 ? "99+" : notificationCount}
          </span>
        )}
      </NavLink>
    </>
  )}

  {/* Login/Logout section */}
  {/* Not logged in vs logged in switch */}
  {!token ?
  (
  <>
    <NavLink to="/login" className={({ isActive }) => isActive ? "nav-btn active" : "nav-btn"}>
      Log In
    </NavLink>
    <NavLink to="/signup" className={({ isActive }) => isActive ? "nav-btn active" : "nav-btn"}>
      Sign Up
    </NavLink>
  </>
  )
  :
  (
  <div className="profile-menu-container" ref={dropdownRef}>    
    {/* AVATAR PICTURE */}
    <button 
      className="avatar-btn" 
      onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
      <img src={avatar} className="avatar-img" />

    </button>



    {/* Dropdown Menu Toggle */}
      {isDropdownOpen && (
        <div className="dropdown-menu">
          


      {userRole === 'student' &&
      (
        <>
          <Link 
            to="/student-portal" 
            className="dropdown-item" 
            onClick={() => setIsDropdownOpen(false)}
          >
            Student Portal
          </Link>

          <Link 
            to="/profile" 
            className="dropdown-item" 
            onClick={() => setIsDropdownOpen(false)}
          >
            Profile
          </Link>

          <hr className="dropdown-divider" />

        </>
      )
      }  

      {userRole === 'admin' &&
      (
        <>
          <Link 
            to="/admin" 
            className="dropdown-item" 
            onClick={() => setIsDropdownOpen(false)}
          >
            Admin Portal
          </Link>

          <hr className="dropdown-divider" />

        </>
      )
      }  

          {/* LOGOUT */}
          <button
            onClick={handleLogout}
            className="dropdown-item logout-btn" 
            disabled={logoutCoolingDown}
          >
            {logoutCoolingDown ? 'Logging out...' : 'Log Out'}
          </button>

        </div>
      )}

    </div>
  )

  }




  {/* Student and Admin workspaces are intentionally separate. */}
  {/* {userRole === 'student' && (
    <NavLink to="/student-portal" className={({ isActive }) => isActive ? "nav-btn active" : "nav-btn"}>
      Student Portal
    </NavLink>
  )} */}
  {/* Conditionally show Admin Panel */}
  {/* {userRole === 'admin' && (
    <NavLink to="/admin" className={({ isActive }) => isActive ? "nav-btn active" : "nav-btn"}>
      Admin Panel
    </NavLink>
  )} */}



</div>


</nav>
</nav>
);

}

export default Navbar;


/*
      <NavLink to="/" className={({ isActive }) => isActive ? "nav-btn active" : "nav-btn"}>
        Home
      </NavLink>


<button
onClick={handleLogout}
className="nav-btn logout-btn"
disabled={logoutCoolingDown}
>
  {logoutCoolingDown ? 'Logging out...' : 'Log Out'}
</button>

*/
