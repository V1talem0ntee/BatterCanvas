import { NavLink } from "react-router-dom";
import { useState } from "react";
import { ConfirmButton, Header, PageState } from "../AdminComponents.jsx";
import { api, useAdminData } from "../adminApi.js";

export default function Dashboard() {
  // Statistics are live database counts rather than frontend mock values.
  const { data, error, loading } = useAdminData("/api/admin/dashboard");
  const semesters = useAdminData("/api/semesters");
  const references = useAdminData("/api/admin/reference-data");
  const [semesterChoice, setSemesterChoice] = useState("");
  const [semesterNotice, setSemesterNotice] = useState("");
  const [semesterSaving, setSemesterSaving] = useState(false);
  const [showSemesterForm, setShowSemesterForm] = useState(false);
  const [newSemester, setNewSemester] = useState({ year: 2026, type: "Fall", startDate: "", endDate: "", addDropDeadline: "", withdrawalDeadline: "" });
  const stats = data?.statistics;
  const activeSemester = semesters.data?.semesters?.find((semester) => semester.isActive);
  const selectedSemesterId = semesterChoice;
  const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
  async function updateActiveSemester(semesterId, isActive) {
    setSemesterSaving(true);
    setSemesterNotice("");
    try {
      await api(`/api/admin/semesters/${semesterId}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      });
      setSemesterNotice(isActive ? "Active semester updated." : "All semesters are now view-only.");
      await semesters.reload();
    } catch (requestError) {
      setSemesterNotice(requestError.message || "Unable to update the active semester.");
    } finally {
      setSemesterSaving(false);
    }
  }
  async function submitSemester(event) {
    event.preventDefault();
    const schoolId = references.data?.schools?.[0]?.schoolId;
    setSemesterSaving(true);
    setSemesterNotice("");
    try {
      await api("/api/admin/semesters", {
        method: "POST",
        body: JSON.stringify({ ...newSemester, schoolId }),
      });
      setSemesterNotice(`${newSemester.type} ${newSemester.year} created. You can now set it active.`);
      setShowSemesterForm(false);
      await semesters.reload();
    } catch (requestError) {
      setSemesterNotice(requestError.message || "Unable to create semester.");
    } finally {
      setSemesterSaving(false);
    }
  }
  return (
    <>
      <Header
        eyebrow="Administration"
        title={`Welcome back${user.firstName ? `, ${user.firstName}` : ""}`}
        description="Manage the academic data students rely on."
      />
      <PageState loading={loading} error={error}>
        {stats && (
          <>
            <section className="admin-stat-grid">
              {[
                ["Active students", stats.activeStudents, "Student records"],
                ["Courses", stats.totalCourses, "Catalog entries"],
                ["Class sections", stats.totalSections, "All terms"],
                [
                  "Pending invitations",
                  stats.pendingInvitations,
                  "Awaiting activation",
                ],
              ].map(([label, value, note]) => (
                <article className="admin-stat" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>{note}</small>
                </article>
              ))}
            </section>
            <div className="admin-dashboard-grid">
              <section className="admin-card active-semester-card">
                <h2>Active semester</h2>
                {semesters.error && <p className="admin-error-text">{semesters.error} Run the active-semester database migration, then restart the backend.</p>}
                <p>{activeSemester ? `${activeSemester.type} ${activeSemester.year} is open for student schedule changes.` : "No semester is active. All student schedules are view-only."}</p>
                <select value={selectedSemesterId} onChange={(event) => setSemesterChoice(event.target.value)}>
                  {!semesters.data?.semesters?.length && <option value="">No semesters available</option>}
                  {(semesters.data?.semesters || []).map((semester) => <option key={semester.semesterId} value={semester.semesterId}>
                    {semester.type} {semester.year}{semester.isActive ? " — Active" : ""}
                  </option>)}
                </select>
                <div className="admin-form-actions">
                  <button className="admin-button" disabled={semesterSaving || !selectedSemesterId || String(activeSemester?.semesterId) === String(selectedSemesterId)} onClick={() => updateActiveSemester(selectedSemesterId, true)}>Set active</button>
                  <button className="admin-button secondary" disabled={semesterSaving || !activeSemester} onClick={() => updateActiveSemester(activeSemester.semesterId, false)}>Deactivate current</button>
                  <ConfirmButton label="Delete semester" disabled={semesterSaving || !selectedSemesterId} onConfirm={async () => {
                    setSemesterSaving(true);
                    setSemesterNotice("");
                    try {
                      await api(`/api/admin/semesters/${selectedSemesterId}`, { method: "DELETE" });
                      setSemesterChoice("");
                      setSemesterNotice("Semester deleted.");
                      await semesters.reload();
                    } catch (requestError) {
                      setSemesterNotice(requestError.message || "Unable to delete semester.");
                    } finally {
                      setSemesterSaving(false);
                    }
                  }} />
                  <button className="admin-button secondary" type="button" onClick={() => setShowSemesterForm((visible) => !visible)}>{showSemesterForm ? "Cancel" : "Add semester"}</button>
                </div>
                {showSemesterForm && <form className="semester-create-form" onSubmit={submitSemester}>
                  <label>Term<select value={newSemester.type} onChange={(event) => setNewSemester({ ...newSemester, type: event.target.value })}>
                    {['Spring', 'Summer', 'Fall', 'Winter'].map((type) => <option key={type}>{type}</option>)}
                  </select></label>
                  <label>Year<input type="number" min="2000" max="2200" required value={newSemester.year} onChange={(event) => setNewSemester({ ...newSemester, year: Number(event.target.value) })} /></label>
                  <label>Start date<input type="date" required value={newSemester.startDate} onChange={(event) => setNewSemester({ ...newSemester, startDate: event.target.value })} /></label>
                  <label>End date<input type="date" required value={newSemester.endDate} onChange={(event) => setNewSemester({ ...newSemester, endDate: event.target.value })} /></label>
                  <label>Add/drop deadline<input type="date" required value={newSemester.addDropDeadline} onChange={(event) => setNewSemester({ ...newSemester, addDropDeadline: event.target.value })} /></label>
                  <label>Withdrawal deadline<input type="date" required value={newSemester.withdrawalDeadline} onChange={(event) => setNewSemester({ ...newSemester, withdrawalDeadline: event.target.value })} /></label>
                  <button className="admin-button" disabled={semesterSaving || !references.data?.schools?.length}>Create semester</button>
                </form>}
                {semesterNotice && <small className="admin-success-text">{semesterNotice}</small>}
              </section>
              <section className="admin-card">
                <h2>Section status</h2>
                <div className="status-bars">
                  {Object.entries(stats.sectionsByStatus).map(
                    ([status, count]) => (
                      <div key={status}>
                        <span>
                          <b className={`status-dot ${status}`} />
                          {status}
                        </span>
                        <strong>{count}</strong>
                      </div>
                    ),
                  )}
                </div>
              </section>
              <section className="admin-card">
                <h2>Quick actions</h2>
                <div className="quick-actions">
                  <NavLink to="/admin/invitations">
                    Invite a user <span>→</span>
                  </NavLink>
                  <NavLink to="/admin/courses">
                    Add a course <span>→</span>
                  </NavLink>
                  <NavLink to="/admin/sections">
                    Create a section <span>→</span>
                  </NavLink>
                </div>
              </section>
            </div>
          </>
        )}
      </PageState>
    </>
  );
}
