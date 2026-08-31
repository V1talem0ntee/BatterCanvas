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

const CSV_COLUMNS = ["department", "subjectCode", "courseNumber", "title", "description", "units", "level", "category", "geArea", "sectionType", "repeatable"];

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') { field += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { row.push(field.trim()); field = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field.trim()); field = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += character;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  if (quoted) throw new Error("The CSV contains an unclosed quoted value.");
  if (rows.length < 2) throw new Error("The CSV must include a header and at least one course.");
  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, ""));
  const missing = CSV_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length) throw new Error(`Missing CSV columns: ${missing.join(", ")}.`);
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

export default function Courses() {
  // This page coordinates catalog search, creation, editing, and deletion.
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState("");
  const [importError, setImportError] = useState("");
  const [savingImport, setSavingImport] = useState(false);
  const [prerequisiteCourse, setPrerequisiteCourse] = useState(null);
  const [prerequisiteId, setPrerequisiteId] = useState("");
  const [minimumGrade, setMinimumGrade] = useState("C");
  const [prerequisiteError, setPrerequisiteError] = useState("");
  const [savingPrerequisite, setSavingPrerequisite] = useState(false);
  const [notice, setNotice] = useState("");
  const { data, error, loading, reload } = useAdminData(
    `/api/admin/courses?search=${encodeURIComponent(query)}&subjectCode=${encodeURIComponent(subjectFilter)}&page=${page}&pageSize=10`,
  );
  // Prerequisite choices must not be limited by the course-table search.
  const courseOptions = useAdminData("/api/admin/courses?pageSize=100");
  const refs = useAdminData("/api/admin/reference-data");
  const fields = useMemo(
    () => [
      {
        name: "departmentId",
        label: "Department",
        type: "select",
        required: true,
        options: (refs.data?.departments || []).map((d) => ({
          value: d.departmentId,
          label: d.name,
        })),
      },
      { name: "subjectCode", label: "Subject code", required: true },
      { name: "courseNumber", label: "Course number", required: true },
      { name: "title", label: "Title", required: true },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        required: true,
      },
      { name: "units", label: "Units", type: "number", min: 1, required: true },
      {
        name: "category", label: "Course category", type: "select", required: true,
        options: [{ value: "major-core", label: "Major Core" },
          { value: "major-elective", label: "Major Elective" },
          { value: "ge", label: "General Education" }],
      },
      {
        name: "geAreaId", label: "GE Area (required for GE)", type: "select",
        options: (refs.data?.geAreas || []).map((area) => ({ value: area.geAreaId, label: `Area ${area.code} — ${area.name}` })),
      },
      {
        name: "level",
        label: "Level",
        type: "select",
        required: true,
        options: ["lower_division", "upper_division", "graduate"].map((v) => ({
          value: v,
          label: v.replace("_", " "),
        })),
      },
      {
        name: "sectionType",
        label: "Section type",
        type: "select",
        required: true,
        options: ["lecture", "lab"].map((v) => ({ value: v, label: v })),
      },
      {
        name: "repeatable",
        label: "Repeatable",
        type: "checkbox",
        options: [],
      },
    ],
    [refs.data],
  );
  const save = async (values, course) => {
    if (values.category === "ge" && !values.geAreaId) throw new Error("Select Area A, B, C, or D for a GE course.");
    const body = {
      ...values,
      departmentId: Number(values.departmentId),
      units: Number(values.units),
      geAreaId: values.category === "ge" ? Number(values.geAreaId) : null,
    };
    await api(
      course ? `/api/admin/courses/${course.courseId}` : "/api/admin/courses",
      { method: course ? "PATCH" : "POST", body: JSON.stringify(body) },
    );
    setEditing(null);
    setCreating(false);
    setNotice("Course saved.");
    await Promise.all([reload(), courseOptions.reload()]);
  };
  const openPrerequisites = async (course) => {
    setPrerequisiteError("");
    setPrerequisiteId("");
    try {
      const result = await api(`/api/admin/courses/${course.courseId}`);
      setPrerequisiteCourse(result.course);
    } catch (error) {
      setNotice(error.message || "Unable to load course prerequisites.");
    }
  };
  const reloadPrerequisites = async () => {
    const result = await api(`/api/admin/courses/${prerequisiteCourse.courseId}`);
    setPrerequisiteCourse(result.course);
  };
  const addPrerequisite = async () => {
    if (!prerequisiteId || savingPrerequisite) return;
    setSavingPrerequisite(true);
    setPrerequisiteError("");
    try {
      await api(`/api/admin/courses/${prerequisiteCourse.courseId}/prerequisites/${prerequisiteId}`, {
        method: "PUT",
        body: JSON.stringify({ minimumGrade }),
      });
      setPrerequisiteId("");
      await reloadPrerequisites();
    } catch (error) {
      setPrerequisiteError(error.message || "Unable to save prerequisite.");
    } finally {
      setSavingPrerequisite(false);
    }
  };
  const subjectCodes = [...new Set((courseOptions.data?.courses || [])
    .map((course) => course.subjectCode)
    .filter(Boolean))].sort();
  const visibleCourses = data?.courses || [];
  const totalPages = data?.pagination?.totalPages || 0;
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);
  const importCourses = async () => {
    setSavingImport(true); setImportError("");
    try {
      const result = await api("/api/admin/courses/import", { method: "POST", body: JSON.stringify({ courses: importRows }) });
      setImporting(false); setImportRows([]); setPage(1);
      setNotice(`${result.imported} courses imported successfully.`);
      await Promise.all([reload(), courseOptions.reload()]);
    } catch (error) {
      setImportError(error.message);
    } finally { setSavingImport(false); }
  };
  return (
    <>
      <Header
        eyebrow="Catalog"
        title="Courses"
        description="Maintain the course catalog and its academic metadata."
        action={<div className="admin-header-actions">
          <button className="admin-button secondary" onClick={() => { setImporting(true); setImportError(""); }}>Import CSV</button>
          <button className="admin-button" onClick={() => setCreating(true)}>+ Add course</button>
        </div>}
      />
      {notice && <div className="admin-alert success">{notice}</div>}
      <div className="admin-toolbar">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(search);
          }}
        >
          <select
            className="admin-subject-filter"
            aria-label="Filter courses by subject"
            value={subjectFilter}
            onChange={(event) => { setSubjectFilter(event.target.value); setPage(1); }}
          >
            <option value="">All subjects</option>
            {subjectCodes.map((subjectCode) => (
              <option key={subjectCode} value={subjectCode}>{subjectCode}</option>
            ))}
          </select>
          <input
            placeholder="Search course code or title"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="admin-button">Search</button>
        </form>
      </div>
      <PageState loading={loading} error={error}>
        {visibleCourses.length ? (
          <div className="admin-paginated-table">
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Title</th>
                  <th>Department</th>
                  <th>Units</th>
                  <th>Category</th>
                  <th>Sections</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibleCourses.map((c) => (
                  <tr key={c.courseId}>
                    <td>
                      <strong>
                        {c.subjectCode} {c.courseNumber}
                      </strong>
                      <small>{c.level?.replace("_", " ")}</small>
                    </td>
                    <td>{c.title}</td>
                    <td>{c.departmentName}</td>
                    <td>{c.units}</td>
                    <td>{c.category === "ge" ? `GE ${c.geAreas?.map((area) => area.code).join(", ")}`
                      : c.category === "major-elective" ? "Major Elective" : "Major Core"}</td>
                    <td>{c.sectionCount}</td>
                    <td className="row-actions">
                      <button
                        className="admin-link"
                        onClick={() => openPrerequisites(c)}
                      >
                        Prerequisites
                      </button>
                      <button
                        className="admin-link"
                        onClick={() => setEditing(c)}
                      >
                        Edit
                      </button>
                      <ConfirmButton
                        onConfirm={async () => {
                          try {
                            await api(`/api/admin/courses/${c.courseId}`, {
                              method: "DELETE",
                            });
                            await Promise.all([reload(), courseOptions.reload()]);
                          } catch (err) {
                            setNotice(err.message);
                          }
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && <nav className="admin-pagination" aria-label="Course pages">
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
            {pageNumbers.map((pageNumber) => <button type="button" key={pageNumber}
              className={pageNumber === page ? "active" : ""}
              aria-current={pageNumber === page ? "page" : undefined}
              onClick={() => setPage(pageNumber)}>{pageNumber}</button>)}
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</button>
          </nav>}
          </div>
        ) : (
          <Empty text="No courses found." />
        )}
      </PageState>
      <Dialog title="Import courses from CSV" open={importing} onClose={() => setImporting(false)} size="wide">
        <div className="course-import-dialog">
          <p>Upload a CSV with these columns:</p>
          <code>{CSV_COLUMNS.join(",")}</code>
          <input type="file" accept=".csv,text/csv" onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setImportError(""); setImportFileName(file.name);
            try { setImportRows(parseCsv(await file.text())); }
            catch (error) { setImportRows([]); setImportError(error.message); }
          }} />
          {importRows.length > 0 && <>
            <strong>{importFileName}: {importRows.length} courses ready</strong>
            <div className="admin-table-wrap course-import-preview"><table><thead><tr><th>Course</th><th>Title</th><th>Department</th><th>Category</th></tr></thead>
              <tbody>{importRows.slice(0, 10).map((row, index) => <tr key={`${row.subjectCode}-${row.courseNumber}-${index}`}>
                <td>{row.subjectCode} {row.courseNumber}</td><td>{row.title}</td><td>{row.department}</td><td>{row.category}</td>
              </tr>)}</tbody></table></div>
            {importRows.length > 10 && <small>Previewing the first 10 of {importRows.length} rows.</small>}
          </>}
          {importError && <div className="admin-alert error">{importError}</div>}
          <div className="admin-form-actions">
            <button className="admin-button secondary" type="button" onClick={() => setImporting(false)}>Cancel</button>
            <button className="admin-button" type="button" disabled={!importRows.length || savingImport} onClick={importCourses}>
              {savingImport ? "Importing..." : `Import ${importRows.length || ""} courses`}
            </button>
          </div>
        </div>
      </Dialog>
      <Dialog
        title="Add course"
        open={creating}
        onClose={() => setCreating(false)}
      >
        <AdminForm
          fields={fields}
          initial={{ repeatable: false, category: "major-core" }}
          onCancel={() => setCreating(false)}
          onSubmit={(v) => save(v, null)}
        />
      </Dialog>
      <Dialog title="Course prerequisites" open={Boolean(prerequisiteCourse)} onClose={() => setPrerequisiteCourse(null)}>
        {prerequisiteCourse && <div className="requirement-manager">
          <div><strong>{prerequisiteCourse.subjectCode} {prerequisiteCourse.courseNumber}</strong><small>{prerequisiteCourse.title}</small></div>
          <small>Add prerequisites one at a time. Every saved course will remain listed below.</small>
          <div className="requirement-course-pool">
            {(prerequisiteCourse.prerequisites || []).map((item) => <span key={item.courseId}>
              {item.subjectCode} {item.courseNumber}{item.minimumGrade ? ` (${item.minimumGrade} or better)` : ""}
              <button aria-label="Remove prerequisite" onClick={async () => {
                await api(`/api/admin/courses/${prerequisiteCourse.courseId}/prerequisites/${item.courseId}`, { method: "DELETE" });
                await reloadPrerequisites();
              }}>×</button>
            </span>)}
          </div>
          <div className="admin-inline-add">
            <select value={prerequisiteId} onChange={(event) => setPrerequisiteId(event.target.value)}>
              <option value="">Select prerequisite…</option>
              {(courseOptions.data?.courses || []).filter((course) => course.courseId !== prerequisiteCourse.courseId && !(prerequisiteCourse.prerequisites || []).some((item) => item.courseId === course.courseId)).map((course) =>
                <option key={course.courseId} value={course.courseId}>{course.subjectCode} {course.courseNumber} — {course.title}</option>)}
            </select>
            <select value={minimumGrade} onChange={(event) => setMinimumGrade(event.target.value)}>
              {["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "P"].map((grade) => <option key={grade}>{grade}</option>)}
            </select>
            <button className="admin-button" disabled={!prerequisiteId || savingPrerequisite} onClick={addPrerequisite}>
              {savingPrerequisite ? "Adding…" : "Add"}
            </button>
          </div>
          {prerequisiteError && <div className="admin-alert error">{prerequisiteError}</div>}
        </div>}
      </Dialog>
      <Dialog
        title="Edit course"
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <AdminForm
            fields={fields}
            initial={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(v) => save(v, editing)}
          />
        )}
      </Dialog>
    </>
  );
}
