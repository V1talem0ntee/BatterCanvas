import "./App.css";
import "./StudentProfile.css";
import { authFetch } from "./AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
}

function capitalize(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatAddress(address) {
  if (!address || (!address.street && !address.city && !address.state && !address.zipCode)) {
    return "Not on file";
  }
  return [address.street, [address.city, address.state].filter(Boolean).join(", "), address.zipCode]
    .filter(Boolean)
    .join(" · ");
}

function StudentProfile() {
  const navigate = useNavigate();
  const token = localStorage.getItem("authToken") || "";

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [editingStudentInfo, setEditingStudentInfo] = useState(false);
  const [editingContactInfo, setEditingContactInfo] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [preferredName, setPreferredName] = useState("");
  const [walkingSpeedMps, setWalkingSpeedMps] = useState("");

  const [phoneNumber, setPhoneNumber] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipcode] = useState("");
  const [majorChangeData, setMajorChangeData] = useState({ programs: [], requests: [] });
  const [showMajorChange, setShowMajorChange] = useState(false);
  const [requestedProgramId, setRequestedProgramId] = useState("");
  const [majorChangeReason, setMajorChangeReason] = useState("");
  const [majorChangeWorking, setMajorChangeWorking] = useState(false);

  // Profile and request history are intentionally loaded once when this page opens.
  useEffect(() => {
    loadProfile();
    loadMajorChangeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMajorChangeData() {
    if (!token) return;
    try {
      const response = await authFetch("/api/student/major-change-requests");
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setMajorChangeData(data);
    } catch (err) {
      setMessage(err.message || "Unable to load major change requests.");
    }
  }

  async function submitMajorChange(event) {
    event.preventDefault();
    setMajorChangeWorking(true);
    setMessage("");
    try {
      const response = await authFetch("/api/student/major-change-requests", {
        method: "POST",
        body: JSON.stringify({ degreeProgramId: Number(requestedProgramId), reason: majorChangeReason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to submit request.");
      setMessage(data.message);
      setShowMajorChange(false);
      setRequestedProgramId("");
      setMajorChangeReason("");
      await loadMajorChangeData();
    } catch (err) {
      setMessage(err.message || "Unable to submit major change request.");
    } finally {
      setMajorChangeWorking(false);
    }
  }

  function populateFormFields(student) {
    setPreferredName(student.preferredName || "");
    setWalkingSpeedMps(student.walkingSpeedMps ?? "");
    setPhoneNumber(student.phoneNumber || "");
    setStreet(student.address?.street || "");
    setCity(student.address?.city || "");
    setState(student.address?.state || "");
    setZipcode(student.address?.zipCode || "");
  }

  async function loadProfile() {
    if (!token) {
      setMessage("Please log in first.");
      setLoading(false);
      return;
    }

    try {
      const response = await authFetch("/api/student/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load student profile.");
      }

      setProfile(data.student);
      populateFormFields(data.student);
    } catch (err) {
      setMessage(err.message || "An error occurred while loading the profile.");
    } finally {
      setLoading(false);
    }
  }

  async function saveFields(fields) {
    setSubmitting(true);
    setMessage("");

    try {
      const response = await authFetch("/api/student/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(fields),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to update student profile.");
      }

      setProfile(data.student);
      populateFormFields(data.student);
      setMessage("Profile updated successfully.");
      return true;
    } catch (err) {
      setMessage(err.message || "An error occurred while updating the profile.");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStudentInfoSubmit(event) {
    event.preventDefault();
    const speed = Number(walkingSpeedMps);
    if (!Number.isFinite(speed) || speed <= 0) {
      setMessage("Walking speed must be a positive number.");
      return;
    }

    const ok = await saveFields({ preferredName, walkingSpeedMps: speed });
    if (ok) setEditingStudentInfo(false);
  }

  async function handleContactInfoSubmit(event) {
    event.preventDefault();
    const ok = await saveFields({ phoneNumber, street, city, state, zipCode });
    if (ok) setEditingContactInfo(false);
  }

  if (loading) {
    return (
      <main className="profile-page">
        <div className="profile-loading">Loading your profile…</div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="profile-page">
        {message && <p className="profile-error">{message}</p>}
        <button type="button" className="profile-home-button" onClick={() => navigate("/")}>
          Home
        </button>
      </main>
    );
  }

  return (
    <main className="profile-page">
      <header className="profile-title">
        <h1>Student Profile</h1>
      </header>

      {message && <p className="profile-message">{message}</p>}

      <div className="profile-panel student-info-panel">
        <header>
          <h2>Student Information</h2>
          {!editingStudentInfo && (
            <button className="profile-update-button" onClick={() => setEditingStudentInfo(true)}>
              Update
            </button>
          )}
        </header>

        {editingStudentInfo ? (
          <form className="profile-form" onSubmit={handleStudentInfoSubmit}>
            <div className="profile-field readonly">
              <span className="profile-field-label">Full Name</span>
              <span className="profile-field-value">
                {profile.firstName} {profile.lastName}
              </span>
            </div>
            <div className="profile-field readonly">
              <span className="profile-field-label">ID</span>
              <span className="profile-field-value">{profile.displayId}</span>
            </div>

            <label className="profile-input-field">
              <span className="profile-field-label">Preferred Name</span>
              <input value={preferredName} onChange={(e) => setPreferredName(e.target.value)} />
            </label>

            <label className="profile-input-field">
              <span className="profile-field-label">Walking Speed (m/s)</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={walkingSpeedMps}
                onChange={(e) => setWalkingSpeedMps(e.target.value)}
              />
            </label>

            <div className="profile-field readonly">
              <span className="profile-field-label">Date Joined</span>
              <span className="profile-field-value">{formatDate(profile.createdAt)}</span>
            </div>

            <div className="profile-form-actions">
              <button type="submit" className="profile-save-button" disabled={submitting}>
                {submitting ? "Saving…" : "Save Changes"}
              </button>
              <button
                type="button"
                className="profile-cancel-button"
                onClick={() => {
                  populateFormFields(profile);
                  setEditingStudentInfo(false);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="profile-field-grid">
            <div className="profile-field">
              <span className="profile-field-label">Full Name</span>
              <span className="profile-field-value">
                {profile.firstName} {profile.lastName}
              </span>
            </div>
            <div className="profile-field">
              <span className="profile-field-label">ID</span>
              <span className="profile-field-value">{profile.displayId}</span>
            </div>
            <div className="profile-field">
              <span className="profile-field-label">Preferred Name</span>
              <span className="profile-field-value">{profile.preferredName || "Not set"}</span>
            </div>
            <div className="profile-field">
              <span className="profile-field-label">Walking Speed</span>
              <span className="profile-field-value">
                {profile.walkingSpeedMps ? `${profile.walkingSpeedMps} m/s` : "Not set"}
              </span>
            </div>
            <div className="profile-field">
              <span className="profile-field-label">Date Joined</span>
              <span className="profile-field-value">{formatDate(profile.createdAt)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="profile-bottom-row">
        <div className="profile-panel academic-info-panel">
          <header>
            <h2>Academic Information</h2>
            <button className="profile-update-button" onClick={() => setShowMajorChange((open) => !open)}>
              Request major change
            </button>
          </header>
          {majorChangeData.requests?.find((request) => request.status === "pending") && (
            <div className="major-change-status pending">
              <strong>Major change pending</strong>
              <span>
                Requested: {majorChangeData.requests.find((request) => request.status === "pending").requestedProgram.majorName}
              </span>
              <button type="button" onClick={async () => {
                const pending = majorChangeData.requests.find((request) => request.status === "pending");
                setMajorChangeWorking(true);
                try {
                  const response = await authFetch(`/api/student/major-change-requests/${pending.requestId}`, { method: "DELETE" });
                  if (!response.ok) throw new Error("Unable to withdraw request.");
                  setMessage("Major change request withdrawn.");
                  await loadMajorChangeData();
                } catch (err) { setMessage(err.message); }
                finally { setMajorChangeWorking(false); }
              }} disabled={majorChangeWorking}>Withdraw request</button>
            </div>
          )}
          {showMajorChange && (
            <form className="major-change-form" onSubmit={submitMajorChange}>
              <label>
                <span>Requested degree program</span>
                <select required value={requestedProgramId} onChange={(event) => setRequestedProgramId(event.target.value)}>
                  <option value="">Select a program...</option>
                  {(majorChangeData.programs || [])
                    .filter((program) => program.degreeProgramId !== profile.degreeProgram?.degreeProgramId)
                    .map((program) => (
                      <option key={program.degreeProgramId} value={program.degreeProgramId}>
                        {program.majorName} {program.degreeType} ({program.catalogYear})
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span>Reason (optional)</span>
                <textarea maxLength="1000" value={majorChangeReason} onChange={(event) => setMajorChangeReason(event.target.value)} />
              </label>
              <div className="profile-form-actions">
                <button className="profile-save-button" disabled={majorChangeWorking || majorChangeData.requests?.some((request) => request.status === "pending")}>
                  {majorChangeWorking ? "Submitting..." : "Submit for review"}
                </button>
                <button type="button" className="profile-cancel-button" onClick={() => setShowMajorChange(false)}>Cancel</button>
              </div>
            </form>
          )}
          <div className="profile-field-grid">
            <div className="profile-field">
              <span className="profile-field-label">Major</span>
              <span className="profile-field-value">
                {profile.degreeProgram?.major?.name || "Undeclared"}
              </span>
            </div>
            <div className="profile-field">
              <span className="profile-field-label">Academic Level</span>
              <span className="profile-field-value">{capitalize(profile.academicLevel) || "—"}</span>
            </div>
            <div className="profile-field">
              <span className="profile-field-label">Student Type</span>
              <span className="profile-field-value">{capitalize(profile.studentType) || "—"}</span>
            </div>
            <div className="profile-field">
              <span className="profile-field-label">Credits</span>
              <span className="profile-field-value">{profile.totalCredits}</span>
            </div>
            <div className="profile-field">
              <span className="profile-field-label">Expected Graduation</span>
              <span className="profile-field-value">
                {profile.expectedGraduationTerm
                  ? `${profile.expectedGraduationTerm.type} ${profile.expectedGraduationTerm.year}`
                  : "Not set"}
              </span>
            </div>
          </div>
        </div>

        <div className="profile-panel contact-info-panel">
          <header>
            <h2>Contact Information</h2>
            {!editingContactInfo && (
              <button className="profile-update-button" onClick={() => setEditingContactInfo(true)}>
                Update
              </button>
            )}
          </header>

          {editingContactInfo ? (
            <form className="profile-form" onSubmit={handleContactInfoSubmit}>
              <label className="profile-input-field">
                <span className="profile-field-label">Phone Number</span>
                <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
              </label>

              <label className="profile-input-field">
                <span className="profile-field-label">Street</span>
                <input value={street} onChange={(e) => setStreet(e.target.value)} />
              </label>

              <div className="profile-input-row">
                <label className="profile-input-field">
                  <span className="profile-field-label">City</span>
                  <input value={city} onChange={(e) => setCity(e.target.value)} />
                </label>
                <label className="profile-input-field">
                  <span className="profile-field-label">State</span>
                  <input value={state} onChange={(e) => setState(e.target.value)} />
                </label>
                <label className="profile-input-field">
                  <span className="profile-field-label">Zip Code</span>
                  <input value={zipCode} onChange={(e) => setZipcode(e.target.value)} />
                </label>
              </div>

              <div className="profile-field readonly">
                <span className="profile-field-label">Email</span>
                <span className="profile-field-value">{profile.email}</span>
              </div>

              <div className="profile-form-actions">
                <button type="submit" className="profile-save-button" disabled={submitting}>
                  {submitting ? "Saving…" : "Save Changes"}
                </button>
                <button
                  type="button"
                  className="profile-cancel-button"
                  onClick={() => {
                    populateFormFields(profile);
                    setEditingContactInfo(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="profile-field-grid">
              <div className="profile-field">
                <span className="profile-field-label">Phone Number</span>
                <span className="profile-field-value">{profile.phoneNumber || "Not on file"}</span>
              </div>
              <div className="profile-field">
                <span className="profile-field-label">Address</span>
                <span className="profile-field-value">{formatAddress(profile.address)}</span>
              </div>
              <div className="profile-field">
                <span className="profile-field-label">Email</span>
                <span className="profile-field-value">{profile.email}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default StudentProfile;
