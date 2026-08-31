import { useMemo, useState } from "react";
import {
  AdminForm,
  ConfirmButton,
  Dialog,
  Empty,
  Header,
  PageState,
} from "../AdminComponents.jsx";
import { api, useAdminData } from "../adminApi.js";

function semesterKey(item) {
  return item?.termYear && item?.termType ? `${item.termYear}-${item.termType}` : "";
}

export default function Students() {
  // Submit search separately so typing does not issue a request per keystroke.
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [resultsStudent, setResultsStudent] = useState(null);
  const [resultSectionId, setResultSectionId] = useState("");
  const [resultGrade, setResultGrade] = useState("A");
  const [resultNotice, setResultNotice] = useState("");
  const [resultError, setResultError] = useState("");
  const [selectedResultSemester, setSelectedResultSemester] = useState("");
  const [requestNotes, setRequestNotes] = useState({});
  const [requestNotice, setRequestNotice] = useState("");
  const [requestError, setRequestError] = useState("");
  const path = `/api/admin/students?search=${encodeURIComponent(query)}`;
  const { data, error, loading, reload } = useAdminData(path);
  const refs = useAdminData("/api/admin/reference-data");
  const programs = useAdminData("/api/admin/degree-programs");
  const sections = useAdminData("/api/admin/sections?pageSize=100");
  const majorRequests = useAdminData("/api/admin/major-change-requests?status=pending");

  async function reviewMajorRequest(requestId, decision) {
    setRequestNotice("");
    setRequestError("");
    try {
      const result = await api(`/api/admin/major-change-requests/${requestId}`, {
        method: "PATCH",
        body: JSON.stringify({ decision, reviewNote: requestNotes[requestId] || "" }),
      });
      setRequestNotice(result.message);
      await majorRequests.reload();
      reload();
    } catch (err) {
      setRequestError(err.message || "Unable to review major change request.");
    }
  }
  const fields = useMemo(
    () => [
      { name: "schoolStudentId", label: "Student ID", required: true },
      {
        name: "institutionalEmail",
        label: "School email",
        type: "email",
        required: true,
      },
      {
        name: "academicLevel",
        label: "Academic level",
        type: "select",
        options: ["freshman", "sophomore", "junior", "senior", "graduate"].map(
          (v) => ({ value: v, label: v }),
        ),
      },
      {
        name: "studentType",
        label: "Student type",
        type: "select",
        options: ["first-time", "continuing", "transfer", "international"].map(
          (v) => ({ value: v, label: v }),
        ),
      },
      {
        name: "degreeProgramId",
        label: "Degree program",
        type: "select",
        options: (programs.data?.degreePrograms || []).map((p) => ({
          value: p.degreeProgramId,
          label: `${p.majorName} ${p.degreeType} (${p.catalogYear})`,
        })),
      },
      {
        name: "expectedGraduationSemesterId",
        label: "Expected graduation",
        type: "select",
        options: (refs.data?.semesters || []).map((s) => ({
          value: s.semesterId,
          label: `${s.type} ${s.year}`,
        })),
      },
      { name: "totalCredits", label: "Total credits", type: "number", min: 0 },
    ],
    [refs.data, programs.data],
  );
  const resultSemesters = useMemo(() => {
    const byKey = new Map();
    for (const semester of refs.data?.semesters || []) {
      const item = { termYear: semester.year, termType: semester.type };
      byKey.set(semesterKey(item), item);
    }
    for (const item of [...(resultsStudent?.selectedSections || []), ...(resultsStudent?.enrollments || [])]) {
      if (semesterKey(item)) byKey.set(semesterKey(item), { termYear: item.termYear, termType: item.termType });
    }
    const termOrder = { Winter: 4, Fall: 3, Summer: 2, Spring: 1 };
    return [...byKey.values()].sort((left, right) =>
      Number(right.termYear) - Number(left.termYear) || (termOrder[right.termType] || 0) - (termOrder[left.termType] || 0));
  }, [refs.data, resultsStudent]);
  const visibleSelectedSections = (resultsStudent?.selectedSections || [])
    .filter((item) => semesterKey(item) === selectedResultSemester);
  const visibleEnrollments = (resultsStudent?.enrollments || [])
    .filter((item) => semesterKey(item) === selectedResultSemester);
  const visibleCatalogSections = (sections.data?.sections || [])
    .filter((item) => semesterKey(item) === selectedResultSemester);

  async function openResults(student) {
    const result = await api(`/api/admin/students/${student.studentId}`);
    setResultsStudent(result.student);
    const firstStudentTerm = result.student.selectedSections?.[0] || result.student.enrollments?.[0];
    const firstCatalogTerm = refs.data?.semesters?.[0];
    setSelectedResultSemester(firstStudentTerm
      ? semesterKey(firstStudentTerm)
      : firstCatalogTerm ? `${firstCatalogTerm.year}-${firstCatalogTerm.type}` : "");
    setResultNotice("");
    setResultError("");
  }

  async function reloadResults() {
    const result = await api(`/api/admin/students/${resultsStudent.studentId}`);
    setResultsStudent(result.student);
  }
  async function dropSection(classSectionId) {
    try {
      setResultError("");
      setResultNotice("");
      await api(`/api/admin/students/${resultsStudent.studentId}/sections/${classSectionId}`, { method: "DELETE" });
      setResultNotice("Student dropped from the section.");
      if (String(resultSectionId) === String(classSectionId)) setResultSectionId("");
      await reloadResults();
    } catch (requestError) {
      setResultError(requestError.message || "Unable to drop this student from the section.");
    }
  }
  return (
    <>
      <Header
        eyebrow="People"
        title="Students"
        description="Find students and maintain their academic profile."
      />
      <section className="admin-card major-change-admin-card">
        <div className="student-results-section-title">
          <div>
            <strong>Pending major change requests</strong>
            <small>Approving a request updates the student's degree program.</small>
          </div>
          <span>{majorRequests.data?.requests?.length || 0} pending</span>
        </div>
        {requestNotice && <div className="admin-alert success">{requestNotice}</div>}
        {requestError && <div className="admin-alert error">{requestError}</div>}
        {majorRequests.data?.requests?.length ? (
          <div className="admin-table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Current program</th><th>Requested program</th><th>Reason</th><th>Review</th></tr></thead>
              <tbody>{majorRequests.data.requests.map((request) => (
                <tr key={request.requestId}>
                  <td><strong>{request.studentName}</strong><small>{request.schoolStudentId}</small></td>
                  <td>{request.currentProgram ? `${request.currentProgram.majorName} ${request.currentProgram.degreeType}` : "Undeclared"}</td>
                  <td><strong>{request.requestedProgram.majorName} {request.requestedProgram.degreeType}</strong><small>Catalog {request.requestedProgram.catalogYear}</small></td>
                  <td>{request.reason || "No reason provided"}</td>
                  <td className="major-request-actions">
                    <input placeholder="Review note (optional)" value={requestNotes[request.requestId] || ""} onChange={(event) => setRequestNotes((current) => ({ ...current, [request.requestId]: event.target.value }))} />
                    <div><button className="admin-button" onClick={() => reviewMajorRequest(request.requestId, "approved")}>Approve</button><button className="admin-link danger" onClick={() => reviewMajorRequest(request.requestId, "denied")}>Deny</button></div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <Empty text="No pending major change requests." />}
      </section>
      <div className="admin-toolbar">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search);
          }}
        >
          <input
            aria-label="Search students"
            placeholder="Search name, email, or student ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="admin-button">Search</button>
        </form>
      </div>
      <PageState loading={loading} error={error}>
        {data?.students?.length ? (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>ID</th>
                  <th>Academic profile</th>
                  <th>Degree program</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.students.map((student) => (
                  <tr key={student.studentId}>
                    <td>
                      <strong>
                        {student.firstName} {student.lastName}
                      </strong>
                      <small>{student.institutionalEmail}</small>
                    </td>
                    <td>{student.schoolStudentId}</td>
                    <td>
                      {student.academicLevel || "Not set"}
                      <small>{student.studentType || "Type not set"}</small>
                    </td>
                    <td>
                      {student.degreeProgram
                        ? `${student.degreeProgram.majorName} ${student.degreeProgram.degreeType}`
                        : "Not declared"}
                    </td>
                    <td>
                      <button
                        className="admin-link"
                        onClick={() => openResults(student)}
                      >
                        Course results
                      </button>
                      <button
                        className="admin-link"
                        onClick={() => setEditing(student)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="No students match this search." />
        )}
      </PageState>
      <Dialog
        title="Edit academic profile"
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <AdminForm
            fields={fields}
            initial={{
              ...editing,
              degreeProgramId: editing.degreeProgram?.degreeProgramId || "",
              expectedGraduationSemesterId:
                editing.expectedGraduationSemester?.semesterId || "",
            }}
            onCancel={() => setEditing(null)}
            onSubmit={async (values) => {
              const body = {
                ...values,
                degreeProgramId: values.degreeProgramId
                  ? Number(values.degreeProgramId)
                  : null,
                expectedGraduationSemesterId:
                  values.expectedGraduationSemesterId
                    ? Number(values.expectedGraduationSemesterId)
                    : null,
                totalCredits: Number(values.totalCredits || 0),
              };
              await api(`/api/admin/students/${editing.studentId}/profile`, {
                method: "PATCH",
                body: JSON.stringify(body),
              });
              setEditing(null);
              reload();
            }}
          />
        )}
      </Dialog>
      <Dialog
        title="Student course results"
        size="wide"
        open={Boolean(resultsStudent)}
        onClose={() => setResultsStudent(null)}
      >
        {resultsStudent && (
          <div className="student-results-manager">
            <div>
              <strong>{resultsStudent.firstName} {resultsStudent.lastName}</strong>
              <small>{resultsStudent.schoolStudentId}</small>
            </div>
            <div className="student-semester-toolbar">
              <label>
                <span>Semester view</span>
                <select value={selectedResultSemester} onChange={(event) => {
                  setSelectedResultSemester(event.target.value);
                  setResultSectionId("");
                }}>
                  {resultSemesters.map((semester) => <option key={semesterKey(semester)} value={semesterKey(semester)}>
                    {semester.termType} {semester.termYear}
                  </option>)}
                </select>
              </label>
              <span>Showing {visibleSelectedSections.length} selected · {visibleEnrollments.length} course results</span>
            </div>
            {resultNotice && <div className="admin-alert success">{resultNotice}</div>}
            {resultError && <div className="admin-alert error">{resultError}</div>}
            <section className="student-selected-sections">
              <div className="student-results-section-title">
                <div><strong>Selected in Schedule</strong><small>Choose one of the student's current Class Cart sections to record its result.</small></div>
                <span>{visibleSelectedSections.length} selected</span>
              </div>
              {visibleSelectedSections.length ? (
                <div className="student-selected-grid">
                  {visibleSelectedSections.map((section) => (
                    <div className="student-selected-item" key={section.classSectionId}>
                    <button type="button"
                      className={String(resultSectionId) === String(section.classSectionId) ? "selected" : ""}
                      onClick={() => setResultSectionId(String(section.classSectionId))}>
                      <strong>{section.subjectCode} {section.courseNumber}</strong>
                      <span>{section.termType} {section.termYear} · Section {section.sectionNumber}</span>
                    </button>
                    <ConfirmButton label="Drop" onConfirm={() => dropSection(section.classSectionId)} />
                    </div>
                  ))}
                </div>
              ) : <p className="admin-picker-empty">This student has no sections in the current Schedule/Class Cart.</p>}
            </section>
            <div className="admin-table-wrap">
              <table>
                <thead><tr><th>Course</th><th>Term</th><th>Grade</th><th>Result</th><th /></tr></thead>
                <tbody>
                  {visibleEnrollments.map((item) => (
                    <tr key={item.classSectionId}>
                      <td><strong>{item.subjectCode} {item.courseNumber}</strong><small>{item.title}</small></td>
                      <td>{item.termType} {item.termYear}<small>Section {item.sectionNumber}</small></td>
                      <td>{item.grade || "—"}</td>
                      <td><span className={`result-badge ${item.passed ? "passed" : "not-passed"}`}>{item.passed ? "Passed" : item.status === "completed" ? "Not passed" : item.status}</span></td>
                      <td className="row-actions">
                        {item.status === "enrolled" ? (
                          <ConfirmButton label="Drop" onConfirm={() => dropSection(item.classSectionId)} />
                        ) : item.status === "completed" ? <>
                        <button className="admin-link" onClick={() => { setResultSectionId(String(item.classSectionId)); setResultGrade(item.grade || "A"); }}>Edit</button>
                        <ConfirmButton label="Remove result" onConfirm={async () => {
                          try {
                            setResultError("");
                            await api(`/api/admin/students/${resultsStudent.studentId}/results/${item.classSectionId}`, { method: "DELETE" });
                            await reloadResults();
                          } catch (requestError) { setResultError(requestError.message); }
                        }} />
                        </> : <span className="admin-muted-action">{item.status}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!visibleEnrollments.length && <Empty text="No course results recorded for this student in this semester." />}
            <div className="student-result-form">
              <label className="admin-field"><span>Course section</span>
                <select value={resultSectionId} onChange={(event) => setResultSectionId(event.target.value)}>
                  <option value="">Select a course section…</option>
                  {visibleSelectedSections.length > 0 && <optgroup label="Student's Schedule / Class Cart">
                    {visibleSelectedSections.map((section) => (
                      <option key={`selected-${section.classSectionId}`} value={section.classSectionId}>
                        {section.subjectCode} {section.courseNumber} — {section.title} · {section.termType} {section.termYear} · Sec. {section.sectionNumber}
                      </option>
                    ))}
                  </optgroup>}
                  <optgroup label="All class sections">
                  {visibleCatalogSections.map((section) => (
                    <option key={section.classSectionId} value={section.classSectionId}>
                      {section.courseCode} — {section.courseTitle} · {section.termType} {section.termYear} · Sec. {section.sectionNumber}
                    </option>
                  ))}
                  </optgroup>
                </select>
              </label>
              <label className="admin-field"><span>Final grade</span>
                <select value={resultGrade} onChange={(event) => setResultGrade(event.target.value)}>
                  {["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F", "P", "NP"].map((grade) => <option key={grade}>{grade}</option>)}
                </select>
              </label>
              <button className="admin-button" disabled={!resultSectionId} onClick={async () => {
                try {
                  setResultError(""); setResultNotice("");
                  await api(`/api/admin/students/${resultsStudent.studentId}/results/${resultSectionId}`, {
                    method: "PUT", body: JSON.stringify({ grade: resultGrade }),
                  });
                  setResultNotice("Course result saved.");
                  setResultSectionId(""); setResultGrade("A");
                  await reloadResults();
                } catch (requestError) {
                  setResultError(requestError.message || "Unable to save this course result.");
                }
              }}>Save result</button>
            </div>
            <p className="admin-form-help">A, P, and passing letter grades count toward Degree Progress. F and NP are recorded as completed attempts but do not earn degree credit.</p>
          </div>
        )}
      </Dialog>
    </>
  );
}
