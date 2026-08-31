
import { useMemo, useState } from "react";
import { AdminForm, ConfirmButton, Dialog, Empty, Header, PageState } from "../AdminComponents.jsx";
import { api, useAdminData } from "../adminApi.js";

const TYPES = ["major-core", "major-elective", "ge-area", "university-requirement"];
const GRADES = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "P"];

export default function DegreePrograms() {
  const { data, error, loading, reload } = useAdminData("/api/admin/degree-programs");
  const refs = useAdminData("/api/admin/reference-data");
  const courseData = useAdminData("/api/admin/courses?pageSize=100");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [managing, setManaging] = useState(null);
  const [requirementForm, setRequirementForm] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState({});
  const [subjectFilter, setSubjectFilter] = useState({});
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");

  const programFields = useMemo(() => [
    {
      name: "majorId", label: "Major", type: "select", required: true,
      options: (refs.data?.majors || []).map((m) => ({ value: m.majorId, label: m.name }))
    },
    {
      name: "degreeType", label: "Degree type", type: "select", required: true,
      options: ["BA", "BS", "BFA", "MA", "MS", "PHD"].map((v) => ({ value: v, label: v }))
    },
    { name: "catalogYear", label: "Catalog year", type: "number", required: true },
    { name: "requiredMajorUnits", label: "Major units", type: "number", min: 0, required: true },
    { name: "requiredGeUnits", label: "GE units", type: "number", min: 0, required: true },
  ], [refs.data]);

  const requirementFields = useMemo(() => [
    { name: "name", label: "Requirement name", required: true },
    {
      name: "type", label: "Category", type: "select", required: true,
      options: TYPES.map((value) => ({ value, label: value.replaceAll("-", " ") }))
    },
    {
      name: "completionRule", label: "Completion rule", type: "select", required: true,
      options: [{ value: "all-courses", label: "Pass every course in the pool" },
      { value: "minimum-units", label: "Earn minimum units from the pool" }]
    },
    { name: "requiredUnits", label: "Required units", type: "number", min: 0, required: true },
    {
      name: "minimumGrade", label: "Minimum grade", type: "select",
      options: [{ value: "", label: "Any passing grade" }, ...GRADES.map((value) => ({ value, label: value }))]
    },
    {
      name: "geAreaId", label: "GE area (GE requirements only)", type: "select",
      options: (refs.data?.geAreas || []).map((area) => ({ value: area.geAreaId, label: `${area.code} — ${area.name}` }))
    },
  ], [refs.data]);

  async function refreshManaged(programId = managing?.degreeProgramId) {
    if (!programId) return;
    const result = await api(`/api/admin/degree-programs/${programId}`);
    setManaging(result.degreeProgram);
    reload();
  }

  async function saveProgram(values, program) {
    const body = {
      ...values, majorId: Number(values.majorId), catalogYear: Number(values.catalogYear),
      requiredMajorUnits: Number(values.requiredMajorUnits), requiredGeUnits: Number(values.requiredGeUnits)
    };
    await api(program ? `/api/admin/degree-programs/${program.degreeProgramId}` : "/api/admin/degree-programs",
      { method: program ? "PATCH" : "POST", body: JSON.stringify(body) });
    setEditing(null); setCreating(false); setNotice("Degree program saved."); reload();
  }

  async function openRequirements(program) {
    setActionError("");
    try {
      const result = await api(`/api/admin/degree-programs/${program.degreeProgramId}`);
      setManaging(result.degreeProgram);
    } catch (error) {
      setActionError(error.message || "Unable to load degree requirements.");
    }
  }

  async function saveRequirement(values) {
    const existing = requirementForm?.degreeRequirementId;
    const body = {
      ...values, degreeProgramId: managing.degreeProgramId,
      requiredUnits: Number(values.requiredUnits), geAreaId: values.geAreaId ? Number(values.geAreaId) : null,
      minimumGrade: values.minimumGrade || null
    };
    await api(existing ? `/api/admin/degree-requirements/${existing}` : "/api/admin/degree-requirements",
      { method: existing ? "PATCH" : "POST", body: JSON.stringify(body) });
    setRequirementForm(null); await refreshManaged();
  }

  function toggleCourse(requirementId, courseId) {
    const current = selectedCourse[requirementId] || [];
    const next = current.includes(courseId)
      ? current.filter((id) => id !== courseId)
      : [...current, courseId];
    setSelectedCourse({ ...selectedCourse, [requirementId]: next });
  }

  async function addCourses(requirement) {
    const courseIds = selectedCourse[requirement.degreeRequirementId] || [];
    if (!courseIds.length) return;
    await Promise.all(courseIds.map((courseId) =>
      api(`/api/admin/degree-requirements/${requirement.degreeRequirementId}/courses/${courseId}`, { method: "PUT" })
    ));
    setSelectedCourse({ ...selectedCourse, [requirement.degreeRequirementId]: [] });
    await refreshManaged();
  }


  async function setRequirementGeArea(requirement, geAreaId) {
    await api(`/api/admin/degree-requirements/${requirement.degreeRequirementId}`, {
      method: "PATCH",
      body: JSON.stringify({ geAreaId: Number(geAreaId) }),
    });
    await refreshManaged();
  }

  return <>
    <Header eyebrow="Academics" title="Degree Programs"
      description="Configure major, core, elective, and GE graduation rules."
      action={<button className="admin-button" onClick={() => setCreating(true)}>+ Add program</button>} />
    {notice && <div className="admin-alert success">{notice}</div>}
    {actionError && <div className="admin-alert error">{actionError}</div>}
    <PageState loading={loading} error={error}>
      {data?.degreePrograms?.length ? <div className="admin-table-wrap"><table>
        <thead><tr><th>Program</th><th>Department</th><th>Catalog</th><th>Units</th><th>Requirements</th><th /></tr></thead>
        <tbody>{data.degreePrograms.map((program) => <tr key={program.degreeProgramId}>
          <td><strong>{program.majorName} {program.degreeType}</strong></td><td>{program.departmentName}</td>
          <td>{program.catalogYear}</td><td>{program.requiredMajorUnits} major + {program.requiredGeUnits} GE</td>
          <td>{program.requirementCount}</td><td className="row-actions">
            <button className="admin-link" onClick={() => openRequirements(program)}>
              {program.requirementCount ? "Manage requirements" : "+ Add requirements"}
            </button>
            <button className="admin-link" onClick={() => setEditing(program)}>Edit</button>
            <ConfirmButton onConfirm={async () => { await api(`/api/admin/degree-programs/${program.degreeProgramId}`, { method: "DELETE" }); reload(); }} />
          </td></tr>)}</tbody>
      </table></div> : <Empty text="No degree programs found." />}
    </PageState>

    <Dialog title="Add degree program" open={creating} onClose={() => setCreating(false)}>
      <AdminForm fields={programFields} onCancel={() => setCreating(false)} onSubmit={(v) => saveProgram(v, null)} />
    </Dialog>
    <Dialog title="Edit degree program" open={Boolean(editing)} onClose={() => setEditing(null)}>
      {editing && <AdminForm fields={programFields} initial={editing} onCancel={() => setEditing(null)} onSubmit={(v) => saveProgram(v, editing)} />}
    </Dialog>
    <Dialog title="Degree requirements" open={Boolean(managing)} onClose={() => setManaging(null)} size="wide">
      {managing && <div className="requirement-manager">
        <div className="admin-modal-toolbar"><div><strong>{managing.majorName} {managing.degreeType}</strong><small>{managing.requiredMajorUnits} major + {managing.requiredGeUnits} GE units</small></div>
          <button className="admin-button" onClick={() => setRequirementForm({ type: "major-core", completionRule: "all-courses", minimumGrade: "C" })}>+ Add requirement</button></div>
        {(managing.requirements || []).length ? managing.requirements.map((requirement) => {
          const assigned = new Set(requirement.courses.map((course) => course.courseId));
          const assignedToOtherRequirement = new Set(
            managing.requirements
              .filter((other) => other.degreeRequirementId !== requirement.degreeRequirementId)
              .flatMap((other) => other.courses.map((course) => course.courseId))
          );
          const isGeArea = requirement.type === "ge-area";
          const geAreaCourses = isGeArea && requirement.geAreaId
            ? (courseData.data?.courses || []).filter((course) =>
              (course.geAreas || []).some((area) => Number(area.geAreaId) === Number(requirement.geAreaId)))
            : [];
          const displayedPool = isGeArea ? geAreaCourses : requirement.courses;
          const poolUnits = displayedPool.reduce((sum, course) => sum + Number(course.units || 0), 0);
          const availableCourses = (courseData.data?.courses || [])
            .filter((course) => !assigned.has(course.courseId) && !assignedToOtherRequirement.has(course.courseId));
          const subjectCodes = [...new Set(availableCourses.map((course) => course.subjectCode))]
            .sort((left, right) => left.localeCompare(right));
          const selectedSubject = subjectFilter[requirement.degreeRequirementId] || "";
          const filteredCourses = availableCourses
            .filter((course) => course.subjectCode === selectedSubject)
            .sort((left, right) => String(left.courseNumber).localeCompare(String(right.courseNumber), undefined, { numeric: true }));
          return <section className="admin-requirement-card" key={requirement.degreeRequirementId}>
            <div className="admin-requirement-heading"><div><strong>{requirement.name}</strong><small>{requirement.type.replaceAll("-", " ")} · {requirement.completionRule === "all-courses" ? "all courses required" : `${requirement.requiredUnits} units required`} · pool {poolUnits} units</small></div>
              <div className="row-actions"><button className="admin-link" onClick={() => setRequirementForm(requirement)}>Edit</button>
                <ConfirmButton onConfirm={async () => { await api(`/api/admin/degree-requirements/${requirement.degreeRequirementId}`, { method: "DELETE" }); await refreshManaged(); }} /></div></div>
            {isGeArea && <div className="admin-ge-area-picker">
              <label htmlFor={`ge-area-${requirement.degreeRequirementId}`}>GE course pool</label>
              <select id={`ge-area-${requirement.degreeRequirementId}`} value={requirement.geAreaId || ""}
                onChange={(event) => setRequirementGeArea(requirement, event.target.value)}>
                <option value="" disabled>Select GE A, B, C, or D...</option>
                {(refs.data?.geAreas || []).map((area) =>
                  <option key={area.geAreaId} value={area.geAreaId}>{area.code} — {area.name}</option>)}
              </select>
              <small>{requirement.geAreaId
                ? `${geAreaCourses.length} eligible courses are included automatically.`
                : "Choose an area to include every course assigned to that GE area."}</small>
            </div>}
            <div className="requirement-course-pool">{displayedPool.map((course) => <span key={course.courseId}>{course.subjectCode} {course.courseNumber} ({course.units}u)
              {!isGeArea && <button aria-label="Remove course" onClick={async () => { await api(`/api/admin/degree-requirements/${requirement.degreeRequirementId}/courses/${course.courseId}`, { method: "DELETE" }); await refreshManaged(); }}>×</button>}</span>)}</div>
            {!isGeArea && <details className="admin-course-dropdown">
              <summary>Add courses to this requirement</summary>
              <div className="admin-course-picker">
                <label className="admin-subject-filter">
                  <span>Course code</span>
                  <select value={selectedSubject} onChange={(event) => setSubjectFilter({ ...subjectFilter, [requirement.degreeRequirementId]: event.target.value })}>
                    <option value="">Select a code…</option>
                    {subjectCodes.map((code) => <option key={code} value={code}>{code}</option>)}
                  </select>
                </label>
                {selectedSubject ? <div className="admin-checkbox-list">
                  {filteredCourses.map((course) => {
                    const checked = (selectedCourse[requirement.degreeRequirementId] || []).includes(course.courseId);
                    return <label key={course.courseId} className="admin-course-checkbox">
                      <input type="checkbox" checked={checked} onChange={() => toggleCourse(requirement.degreeRequirementId, course.courseId)} />
                      <span><strong>{course.subjectCode} {course.courseNumber}</strong> — {course.title} ({course.units}u)</span>
                    </label>;
                  })}
                  {!filteredCourses.length && <p className="admin-picker-empty">No available {selectedSubject} courses.</p>}
                </div> : <p className="admin-picker-empty">Select a course code to show its courses.</p>}
                <button className="admin-button secondary" disabled={!(selectedCourse[requirement.degreeRequirementId] || []).length} onClick={() => addCourses(requirement)}>
                  Add selected ({(selectedCourse[requirement.degreeRequirementId] || []).length})
                </button>
              </div>
            </details>}
          </section>;
        }) : <Empty text="No requirements yet. Select Add requirement to create a major-core rule, then add its required courses." />}
      </div>}
    </Dialog>
    <Dialog title={requirementForm?.degreeRequirementId ? "Edit requirement" : "Add requirement"} open={Boolean(requirementForm)} onClose={() => setRequirementForm(null)}>
      {requirementForm && <AdminForm fields={requirementFields} initial={requirementForm} onCancel={() => setRequirementForm(null)} onSubmit={saveRequirement} />}
    </Dialog>
  </>;
}