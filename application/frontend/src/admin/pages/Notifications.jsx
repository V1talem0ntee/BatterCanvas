import { useState } from "react";
import {
  Empty,
  Header,
  PageState,
} from "../AdminComponents.jsx";
import { api, useAdminData } from "../adminApi.js";

function studentLabel(student) {
  const firstName =
    student.firstName ||
    student.first_name ||
    "";

  const lastName =
    student.lastName ||
    student.last_name ||
    "";

  const email =
    student.email ||
    student.institutionalEmail ||
    student.institutional_email ||
    "";

  const name = `${firstName} ${lastName}`.trim();

  if (name && email) {
    return `${name} — ${email}`;
  }

  if (name) {
    return name;
  }

  if (email) {
    return email;
  }

  return `Student ${student.studentId}`;
}

export default function Notifications() {
  const students = useAdminData("/api/admin/students?pageSize=100");
  const [sendToAll, setSendToAll] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [notificationType, setNotificationType] =
    useState("admin-message");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function sendNotification(event) {
    event.preventDefault();

    setNotice("");
    setActionError("");

    if (!sendToAll && !studentId) {
      setActionError("Choose a student or send to all students.");
      return;
    }

    if (!title.trim() || !message.trim()) {
      setActionError("Title and message are required.");
      return;
    }

    setSubmitting(true);

    try {
      const result = await api("/api/admin/notifications", {
        method: "POST",
        body: JSON.stringify({
          sendToAll,
          studentId: studentId ? Number(studentId) : null,
          notificationType,
          title,
          message,
        }),
      });

      setNotice(
        result.createdCount
          ? `Notification sent to ${result.createdCount} student(s).`
          : "Notification sent."
      );

      setTitle("");
      setMessage("");

      if (!sendToAll) {
        setStudentId("");
      }
    } catch (error) {
      setActionError(
        error.message || "Unable to send notification."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Header
        eyebrow="Communication"
        title="Notifications"
        description="Send announcements, reminders, or messages to one student or all students."
      />

      {notice && (
        <div className="admin-alert success">
          {notice}
        </div>
      )}

      {actionError && (
        <div className="admin-alert error">
          {actionError}
        </div>
      )}

      <PageState loading={students.loading} error={students.error}>
        {(students.data?.students || []).length ? (
          <section className="admin-card">
            <form className="admin-form" onSubmit={sendNotification}>
              <label className="admin-field">
                <span>Send to all students</span>

                <input
                  type="checkbox"
                  checked={sendToAll}
                  onChange={(event) => {
                    setSendToAll(event.target.checked);

                    if (event.target.checked) {
                      setStudentId("");
                    }
                  }}
                />
              </label>

              <label className="admin-field">
                <span>Student</span>

                <select
                  value={studentId}
                  disabled={sendToAll}
                  onChange={(event) => {
                    setStudentId(event.target.value);
                  }}
                >
                  <option value="">
                    Select a student...
                  </option>

                  {(students.data?.students || []).map((student) => (
                    <option
                      key={student.studentId}
                      value={student.studentId}
                    >
                      {studentLabel(student)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Notification type</span>

                <select
                  value={notificationType}
                  onChange={(event) => {
                    setNotificationType(event.target.value);
                  }}
                >
                  <option value="admin-message">
                    Admin
                  </option>
                  <option value="announcement">
                    Announcement
                  </option>
                  <option value="deadline">
                    Deadline
                  </option>
                  <option value="enrollment">
                    Enrollment
                  </option>
                </select>
              </label>

              <label className="admin-field">
                <span>Title</span>

                <input
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                  }}
                  placeholder="Example: Registration reminder"
                />
              </label>

              <label className="admin-field">
                <span>Message</span>

                <textarea
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value);
                  }}
                  placeholder="Write the notification message..."
                  rows={6}
                />
              </label>

              <div className="admin-form-actions">
                <button
                  type="submit"
                  className="admin-button"
                  disabled={submitting}
                >
                  {submitting ? "Sending..." : "Send notification"}
                </button>
              </div>
            </form>
          </section>
        ) : (
          <Empty text="No students found." />
        )}
      </PageState>
    </>
  );
}