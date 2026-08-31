import "./App.css";

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './Home.jsx';
import Login from './Login.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';
import Navbar from './Navbar.jsx';
import Signup from './Signup.jsx';
import AboutUs from './AboutUs.jsx';
import AdminInterface from './AdminInterface.jsx';
import StudentInterface from './StudentInterface.jsx';
import CourseSearch from "./CourseSearch.jsx"
import FAQ from "./FAQ.jsx";
import StudentProfile from "./StudentProfile.jsx";
import Schedule from "./Schedule.jsx";
import Notifications from "./Notifications.jsx";
import DegreePlanner from "./DegreePlanner.jsx";
import { AuthProvider } from "./AuthContext.jsx";
import Cart from "./Cart.jsx";
import DegreeProgress from "./DegreeProgress.jsx";

import NvaBarPath from "./NvaBarPath.jsx";

// Additional help from Miguel Grinberg's tutorial site:
// https://blog.miguelgrinberg.com/post/the-react-mega-tutorial-chapter-4-routing-and-page-navigation

// This serves as the main "hub" of all the different pages.
// Changing different pages will update this "view" state, which will
// trigger a re-render and display the appropriate page.
// 
// In other words, we can think of this as a "wall" of the website application,
// and the other pages will change its wallpaper.
// 
// This way, we can avoid messy page clutter, and we can let the application itself run without
// accidental interruptions or forum submission errors.

const Unauthorized = () => (
  <main><h2>403 - You do not have permission to view this page.</h2></main>
);

function App() {
  return (
    <BrowserRouter>

      <AuthProvider>

        <Navbar />
        <NvaBarPath />

        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/courses" element={<CourseSearch />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/degree-progress" element={<ProtectedRoute allowedRoles={['student']}><DegreeProgress /></ProtectedRoute>} />
          <Route path="/faq" element={<FAQ />} />
          <Route
            path="/degree-planner"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <DegreePlanner />
              </ProtectedRoute>
            }
          />

          {/* Student-Only Route */}
          <Route
            path="/student-portal"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentInterface />
              </ProtectedRoute>
            }
          />

          <Route
            path="/schedule"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <Schedule />
              </ProtectedRoute>
            }
          />

          {/* Preserve old bookmarks while the feature name changes. */}
          <Route path="/planned-schedule" element={<Navigate to="/schedule" replace />} />

          <Route
            path="/cart"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <Cart />
              </ProtectedRoute>
            }
          />

          <Route
            path="/notifications"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <Notifications />
              </ProtectedRoute>
            }
          />

          {/* Student-Profile Route */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentProfile />
              </ProtectedRoute>
            }
          />

          {/* Admin-only workspace. Student pages use separate protected routes. */}
          {[
            "/admin",
            "/admin/students",
            "/admin/departments",
            "/admin/majors",
            "/admin/courses",
            "/admin/sections",
            "/admin/locations",
            "/admin/locations/:buildingId",
            "/admin/degree-programs",
            "/admin/notifications",
          ].map((path) => (
            <Route
              key={path}
              path={path}
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminInterface />
                </ProtectedRoute>
              }
            />
          ))}

          <Route
            path="/admin/invitations"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminInterface />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/invitations/manage"
            element={<Navigate to="/admin/invitations" replace />}
          />

          {/* Catch-all fallback for typos: redirects to Home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
