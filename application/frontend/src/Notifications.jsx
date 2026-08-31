import { useCallback, useEffect, useMemo, useState } from "react";
import "./Notifications.css";
import { authFetch } from "./AuthContext.jsx";

const TYPE_LABELS = {
  "admin-message": "Admin",
  enrollment: "Enrollment",
  deadline: "Deadline",
  "schedule-conflict": "Schedule conflict",
  "walking-time-conflict": "Walking time",
  payment: "Payment",
  general: "General",
};

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    // hour12: true,
  }).format(new Date(value));
}

function Notifications() {
  const token = localStorage.getItem("authToken") || "";
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const syncResponse = await authFetch("/api/notifications/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!syncResponse.ok) {
        const syncData = await syncResponse.json();
        throw new Error(syncData.message || "Unable to update notifications.");
      }

      const response = await authFetch("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load notifications.");
      }

      setNotifications(data.notifications || []);
      window.dispatchEvent(new Event("Newnoticification"));
    } catch (requestError) {
      setError(requestError.message || "Unable to connect to notifications.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timeoutId = window.setTimeout(loadNotifications, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadNotifications]);

  const types = useMemo(
    () => Array.from(new Set(notifications.map((item) => item.type))),
    [notifications]
  );

  const visibleNotifications = useMemo(
    () =>
      filter === "all"
        ? notifications
        : notifications.filter((item) => item.type === filter),
    [filter, notifications]
  );

  async function dismissOne(notificationId) {
    setWorkingId(notificationId);
    setError("");

    try {
      const response = await authFetch(`/api/notifications/${notificationId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Unable to dismiss notification.");
      }

      setNotifications((current) =>
        current.filter((item) => item.notificationId !== notificationId)
      );
      window.dispatchEvent(new Event("Newnoticification"));
    } catch (requestError) {
      setError(requestError.message || "Unable to dismiss notification.");
    } finally {
      setWorkingId(null);
    }
  }

  async function dismissAll() {
    setWorkingId("all");
    setError("");

    try {
      const response = await authFetch("/api/notifications", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Unable to dismiss notifications.");
      }

      setNotifications([]);
      window.dispatchEvent(new Event("Newnoticification"));
    } catch (requestError) {
      setError(requestError.message || "Unable to dismiss notifications.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <main className="notifications-page">
      <header className="notifications-header">
        <div>
          <p>Student updates</p>
          <h1>Notifications</h1>
          <span>Enrollment windows, deadlines, conflicts, and system messages.</span>
        </div>
        {notifications.length > 0 && (
          <button type="button" disabled={workingId === "all"} onClick={dismissAll}>
            {workingId === "all" ? "Dismissing…" : "Dismiss all"}
          </button>
        )}
      </header>

      <section className="notification-summary" aria-label="Notification summary">
        <strong>{notifications.length}</strong>
        <span>active {notifications.length === 1 ? "notification" : "notifications"}</span>
      </section>

      {error && (
        <div className="notifications-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={loadNotifications}>Try again</button>
        </div>
      )}

      {types.length > 1 && (
        <div className="notification-filters" aria-label="Filter notifications">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button>
          {types.map((type) => (
            <button key={type} className={filter === type ? "active" : ""} onClick={() => setFilter(type)}>
              {TYPE_LABELS[type] || type}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="notifications-empty">Loading notifications…</div>
      ) : visibleNotifications.length === 0 ? (
        <div className="notifications-empty">
          <span aria-hidden="true">✓</span>
          <h2>You're all caught up</h2>
          <p>New academic reminders and alerts will appear here.</p>
        </div>
      ) : (
        <section className="notification-list" aria-label="Notifications">
          {visibleNotifications.map((notification) => (
            <article className={`notification-card type-${notification.type}`} key={notification.notificationId}>
              <div className="notification-type-icon" aria-hidden="true">!</div>
              <div className="notification-copy">
                <div>
                  <span>{TYPE_LABELS[notification.type] || notification.type}</span>
                  <time dateTime={notification.createdAt}>{formatDate(notification.createdAt)}</time>
                </div>
                <h2>{notification.title}</h2>
                <p>{notification.message}</p>
              </div>
              <button
                type="button"
                disabled={workingId === notification.notificationId}
                onClick={() => dismissOne(notification.notificationId)}
              >
                {workingId === notification.notificationId ? "…" : "Dismiss"}
              </button>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

export default Notifications;
