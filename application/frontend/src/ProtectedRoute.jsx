import {Navigate} from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";

// This is the function for the ProtectedRoute component,
// which is used to protect certain routes in the application based on user roles.
// We will be using this to make sure only people with permission to access the
// admin portal can do so.
function ProtectedRoute({ children, allowedRoles })
{
    // Obtaining the value of the user's role
    const { role: userRole, token, checking } = useAuth();

    if (checking) {
        return <main aria-live="polite"><p>Verifying your session…</p></main>;
    }

    // If they aren't logged in:
    if (!token)
    {
        return <Navigate to="/login" replace />;
    }

    // If they are logged in, but don't have the right role:
    if (allowedRoles && !allowedRoles.includes(userRole))
    {
        return <Navigate to="/unauthorized" replace />;
    }

    return children;
}

export default ProtectedRoute;
