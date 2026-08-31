/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const AuthContext = createContext(null);
const AUTH_CHANGED = "bbedu:auth-changed";
const AUTH_FAILURE = "bbedu:auth-failure";

function storedUser() {
  // Corrupt or manually edited local storage behaves like no saved user.
  try { return JSON.parse(localStorage.getItem("currentUser") || "null"); }
  catch { return null; }
}

export function clearStoredSession() {
  // Clear current and legacy keys so stale role information cannot survive.
  localStorage.removeItem("authToken");
  localStorage.removeItem("currentUser");
  localStorage.removeItem("userRole");
}

export function storeSession(token, user) {
  // Notify mounted navigation and route components without reloading the page.
  localStorage.setItem("authToken", token);
  localStorage.setItem("currentUser", JSON.stringify(user));
  localStorage.setItem("userRole", user.role);
  window.dispatchEvent(new Event(AUTH_CHANGED));
}

export async function authFetch(input, init = {}) {
  const token = localStorage.getItem("authToken") || "";
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  // Central notification keeps expired-session and wrong-role redirects
  // consistent across every page that uses authFetch.
  if (response.status === 401 || response.status === 403) {
    window.dispatchEvent(new CustomEvent(AUTH_FAILURE, { detail: { status: response.status } }));
  }
  return response;
}

export function AuthProvider({ children }) {
  // Prevent protected pages from rendering until a restored token is verified.
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(storedUser);
  const [checking, setChecking] = useState(Boolean(localStorage.getItem("authToken")));

  const clearSession = useCallback(() => {
    clearStoredSession();
    setUser(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const token = localStorage.getItem("authToken");
    if (!token) { clearSession(); setChecking(false); return false; }
    setChecking(true);
    try {
      const response = await fetch("/api/auth/session", { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Session is no longer valid.");
      const session = await response.json();
      // Preserve display fields returned at login, but trust the server for the
      // user ID and role whenever a saved session is restored.
      const existing = storedUser() || {};
      const verified = { ...existing, userId: session.userId, role: session.role };
      localStorage.setItem("currentUser", JSON.stringify(verified));
      localStorage.setItem("userRole", session.role);
      setUser(verified);
      return true;
    } catch {
      clearSession();
      return false;
    } finally { setChecking(false); }
  }, [clearSession]);

  // Session validation is the external synchronization performed by this effect.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refreshSession(); }, [refreshSession]);
  useEffect(() => {
    // Login/logout and API authentication failures are coordinated centrally.
    const changed = () => { setUser(storedUser()); setChecking(false); };
    const failed = (event) => {
      if (event.detail?.status === 401) {
        clearSession();
        navigate("/login", { replace: true, state: { from: location.pathname, message: "Your session expired. Please log in again." } });
      } else if (event.detail?.status === 403) {
        navigate("/unauthorized", { replace: true });
      }
    };
    window.addEventListener(AUTH_CHANGED, changed);
    window.addEventListener(AUTH_FAILURE, failed);
    return () => { window.removeEventListener(AUTH_CHANGED, changed); window.removeEventListener(AUTH_FAILURE, failed); };
  }, [clearSession, location.pathname, navigate]);

  const value = useMemo(() => ({ user, role: user?.role || null, token: localStorage.getItem("authToken"), checking, refreshSession, clearSession }), [user, checking, refreshSession, clearSession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
