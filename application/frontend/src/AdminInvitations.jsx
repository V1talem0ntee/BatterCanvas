import { useCallback, useEffect, useState } from "react";
import useRequestCooldown from "./useRequestCooldown.js";
import { authFetch } from "./AuthContext.jsx";

async function invitationRequest(path, options = {}) {
  const response = await authFetch(path, options);
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "The invitation request could not be completed.");
  return data;
}

export default function AdminInvitations() {
  const [role, setRole] = useState("students");
  const [form, setForm] = useState({ externalId: "", firstName: "", lastName: "", email: "", phoneNumber: "", zipCode: "" });
  const [invitations, setInvitations] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { isCoolingDown, startCooldown } = useRequestCooldown();

  // Keep invitation loading within the Admin shell so navigation stays visible.
  const loadInvitations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await invitationRequest("/api/admin/invitations");
      setInvitations(data.invitations || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(loadInvitations, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadInvitations]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    const body = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      institutionalEmail: form.email.trim(),
      phoneNumber: form.phoneNumber.trim(),
      zipCode: form.zipCode.trim(),
      ...(role === "students" ? { studentId: form.externalId.trim() } : { adminId: form.externalId.trim() }),
    };

    setSubmitting(true);
    try {
      await invitationRequest(`/api/admin/${role}`, { method: "POST", body: JSON.stringify(body) });
      setForm({ externalId: "", firstName: "", lastName: "", email: "", phoneNumber: "", zipCode: "" });
      setMessage("Invitation created successfully.");
      await loadInvitations();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(invitationId) {
    if (!startCooldown() || !window.confirm("Revoke this invitation?")) return;
    setMessage("");
    setError("");
    try {
      await invitationRequest(`/api/admin/invitations/${invitationId}`, { method: "DELETE" });
      setMessage("Invitation revoked.");
      await loadInvitations();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return <>
    <header className="admin-page-header">
      <div><span className="admin-eyebrow">Access management</span><h1>Invitations</h1><p>Invite students and administrators, then monitor account activation.</p></div>
    </header>

    {error && <div className="admin-alert error">{error}</div>}
    {message && <div className="admin-alert success">{message}</div>}

    <div className="invitation-layout">
      <section className="admin-card invitation-form-card">
        <div className="admin-section-heading"><div><h2>Create invitation</h2><p>The recipient uses this information during signup.</p></div></div>
        <form className="admin-form" onSubmit={handleSubmit}>
          <div className="admin-form-grid">
            <label className="admin-field"><span>Account type</span><select value={role} onChange={(event) => setRole(event.target.value)}><option value="students">Student</option><option value="admins">Administrator</option></select></label>
            <label className="admin-field"><span>{role === "students" ? "Student ID" : "Employee ID"}</span><input required value={form.externalId} onChange={(event) => update("externalId", event.target.value)} /></label>
            <label className="admin-field"><span>First name</span><input required value={form.firstName} onChange={(event) => update("firstName", event.target.value)} /></label>
            <label className="admin-field"><span>Last name</span><input required value={form.lastName} onChange={(event) => update("lastName", event.target.value)} /></label>
            <label className="admin-field"><span>Institutional email</span><input type="email" required={role === "students"} value={form.email} onChange={(event) => update("email", event.target.value)} /></label>
            {role === "students" && <><label className="admin-field"><span>Phone number</span><input required value={form.phoneNumber} onChange={(event) => update("phoneNumber", event.target.value)} /></label><label className="admin-field"><span>ZIP code</span><input required value={form.zipCode} onChange={(event) => update("zipCode", event.target.value)} /></label></>}
          </div>
          <div className="admin-form-actions"><button className="admin-button" disabled={submitting}>{submitting ? "Creating…" : "Create invitation"}</button></div>
        </form>
      </section>

      <section className="admin-card invitation-list-card">
        <div className="admin-section-heading"><div><h2>Existing invitations</h2><p>{invitations.length} total invitation{invitations.length === 1 ? "" : "s"}</p></div><button type="button" className="admin-button secondary" onClick={loadInvitations}>Refresh</button></div>
        {loading ? <div className="admin-state">Loading invitations…</div> : invitations.length === 0 ? <div className="admin-empty">No invitations found.</div> : <div className="invitation-list">{invitations.map((invitation) => {
          const claimed = Boolean(invitation.claimed_at);
          return <article className="invitation-item" key={invitation.invitation_id}>
            <div className="invitation-avatar">{(invitation.first_name?.[0] || "?")}{(invitation.last_name?.[0] || "")}</div>
            <div className="invitation-copy"><strong>{invitation.first_name} {invitation.last_name}</strong><span>{invitation.institutional_email || "No email provided"}</span><small>ID {invitation.external_id} · {invitation.user_role}</small></div>
            <span className={`admin-badge ${claimed ? "claimed" : "open"}`}>{claimed ? "Claimed" : "Available"}</span>
            {!claimed && <button type="button" className="admin-link danger" disabled={isCoolingDown} onClick={() => handleDelete(invitation.invitation_id)}>Revoke</button>}
          </article>;
        })}</div>}
      </section>
    </div>
  </>;
}
