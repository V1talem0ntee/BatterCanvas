import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authFetch } from "./AuthContext.jsx";
import "./DegreeProgress.css";

const LABELS = {
  "major-core": "Major Core",
  "major-elective": "Major Electives",
  "ge-area": "General Education",
  "university-requirement": "University Requirements",
};

const COURSE_LIST_FIELDS = [
  "requiredCourses",
  "completedCourses",
  "inProgressCourses",
  "plannedCourses",
  "missingCourses",
];

function unitValue(value) {
  const units = Number(value);
  return Number.isFinite(units) ? units : 0;
}

function normalizeRequirement(requirement = {}) {
  const normalized = {
    ...requirement,
    requiredUnits: unitValue(requirement.requiredUnits),
    completedUnits: unitValue(requirement.completedUnits),
    inProgressUnits: unitValue(requirement.inProgressUnits),
    plannedUnits: unitValue(requirement.plannedUnits),
    status: requirement.status === "planned" ? "on-track" : requirement.status || "missing",
    completionRule: requirement.completionRule ||
      (requirement.type === "major-core" ? "all-courses" : "minimum-units"),
  };

  for (const field of COURSE_LIST_FIELDS) {
    normalized[field] = Array.isArray(requirement[field]) ? requirement[field] : [];
  }
  return normalized;
}

function categoryFromRequirements(requirements, types) {
  const items = requirements.filter((requirement) => types.includes(requirement.type));
  const requiredUnits = items.reduce((sum, item) => sum + item.requiredUnits, 0);
  const completedUnits = items.reduce((sum, item) => sum + item.completedUnits, 0);
  const inProgressUnits = items.reduce((sum, item) => sum + item.inProgressUnits, 0);
  const plannedUnits = items.reduce((sum, item) => sum + item.plannedUnits, 0);
  return {
    requiredUnits,
    completedUnits,
    inProgressUnits,
    plannedUnits,
    remainingUnits: Math.max(requiredUnits - completedUnits - inProgressUnits - plannedUnits, 0),
    status: items.length > 0 && items.every((item) => item.status === "completed")
      ? "completed"
      : items.length > 0 && items.every((item) => item.status !== "missing")
        ? "on-track"
        : "missing",
  };
}

// Keep the page usable while the frontend and backend are deployed separately.
// The previous API response did not include categorySummary.
function normalizeProgress(body) {
  const requirements = (Array.isArray(body?.requirements) ? body.requirements : [])
    .map(normalizeRequirement);
  const fallbackCategories = {
    major: categoryFromRequirements(requirements, ["major-core", "major-elective"]),
    ge: categoryFromRequirements(requirements, ["ge-area", "university-requirement"]),
  };
  const summary = body?.summary || {};
  const requiredUnits = unitValue(summary.requiredUnits);
  const completedUnits = unitValue(summary.completedUnits);

  return {
    ...body,
    requirements,
    categorySummary: {
      major: body?.categorySummary?.major || fallbackCategories.major,
      ge: body?.categorySummary?.ge || fallbackCategories.ge,
    },
    summary: {
      requiredUnits,
      completedUnits,
      inProgressUnits: unitValue(summary.inProgressUnits),
      plannedUnits: unitValue(summary.plannedUnits),
      remainingUnits: unitValue(summary.remainingUnits),
      percentComplete: Number.isFinite(Number(summary.percentComplete))
        ? Math.min(Math.max(Number(summary.percentComplete), 0), 100)
        : requiredUnits ? Math.round((completedUnits / requiredUnits) * 100) : 0,
    },
  };
}

function Course({ course, fallbackStatus = "missing" }) {
  const status = course.status || fallbackStatus;
  return (
    <div className="course-card">
      <div className="status-indicator">
        <span className={`status-icon ${status}`}>{status === "completed" ? "✓" : status === "in-progress" ? "IP" : ""}</span>
      </div>
      <div className="course-details">
        <span className="course-code">{course.subjectCode} {course.courseNumber}</span>
        <span className="course-name">{course.title}</span>
        {course.prerequisites?.length > 0 && (
          <small className="prerequisite-line">
            Prerequisites: {course.prerequisites.map((item) =>
              `${item.subjectCode} ${item.courseNumber}${item.minimumGrade ? ` (${item.minimumGrade} or better)` : ""}${item.satisfied ? " ✓" : " — missing"}`
            ).join(", ")}
          </small>
        )}
      </div>
      <div className="course-meta">
        <span className="course-units">{course.units} units</span>
        <span className={`status-badge ${status}`}>{status.replace("-", " ")}</span>
      </div>
    </div>
  );
}

function Requirement({ requirement }) {
  const visible = [
    ...requirement.completedCourses,
    ...requirement.inProgressCourses,
    ...requirement.plannedCourses,
    ...requirement.missingCourses.map((course) => ({ ...course, status: "missing" })),
  ];
  return (
    <section className="category-group">
      <div className="requirement-heading">
        <div>
          <span className="requirement-type">{LABELS[requirement.type] || requirement.type}</span>
          <h3 className="category-title">{requirement.name}</h3>
        </div>
        <div className="requirement-summary">
          <span className={`requirement-status ${requirement.status}`}>{requirement.status.replace("-", " ")}</span>
          <strong>{requirement.completedUnits}/{requirement.requiredUnits} completed</strong>
          {(requirement.inProgressUnits > 0 || requirement.plannedUnits > 0) &&
            <small>+{requirement.inProgressUnits} in progress · +{requirement.plannedUnits} planned</small>}
        </div>
      </div>
      <p className="requirement-rule">
        {requirement.completionRule === "all-courses"
          ? "Every listed course must be passed."
          : `Complete any approved courses until ${requirement.requiredUnits} units are earned.`}
      </p>
      <div className="course-list">
        {visible.length ? visible.map((course) =>
          <Course key={`${requirement.requirementId}-${course.courseId}-${course.status}`} course={course} />
        ) : <p className="degree-empty">No courses have been assigned to this requirement.</p>}
      </div>
    </section>
  );
}

export default function DegreeProgress() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authFetch("/api/degree-progress");
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Unable to load degree progress.");
      setData(normalizeProgress(body));
    } catch (requestError) {
      setError(requestError.message || "Unable to load degree progress.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(load, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  if (loading) return <main className="degree-page-state">Loading degree progress…</main>;
  if (error) return <main className="degree-page-state error">{error}<button onClick={load}>Try again</button></main>;
  if (!data?.degreeProgram) return (
    <main className="degree-page-state">
      <h1>Degree Progress</h1>
      <p>No degree program is assigned to your student profile.</p>
      <Link to="/profile">Open profile</Link>
    </main>
  );

  const { degreeProgram, summary, categorySummary, requirements } = data;
  return (
    <main className="degree-checklist-container">
      <header className="checklist-header">
        <div className="header-title">
          <h1>Degree Progress Report</h1>
          <p>{degreeProgram.majorName} {degreeProgram.degreeType} · Catalog {degreeProgram.catalogYear}</p>
        </div>
        <div className="progress-summary-card">
          <div className="progress-text"><strong>{summary.percentComplete}% completed</strong><span>{summary.completedUnits} of {summary.requiredUnits} units earned</span></div>
          <div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width: `${summary.percentComplete}%` }} /></div>
          <div className="degree-summary-grid">
            <span>Major <strong>{categorySummary.major.completedUnits}/{categorySummary.major.requiredUnits}</strong></span>
            <span>GE <strong>{categorySummary.ge.completedUnits}/{categorySummary.ge.requiredUnits}</strong></span>
            <span>In progress <strong>{summary.inProgressUnits}</strong></span>
            <span>Planned <strong>{summary.plannedUnits}</strong></span>
            <span>Remaining <strong>{summary.remainingUnits}</strong></span>
          </div>
        </div>
      </header>
      <div className="checklist-legend">
        <span className="legend-item"><i className="icon completed">✓</i> Completed</span>
        <span className="legend-item"><i className="icon in-progress">●</i> In progress</span>
        <span className="legend-item"><i className="icon planned">○</i> Planned in Schedule</span>
      </div>
      {requirements.length ? requirements.map((requirement) =>
        <Requirement key={requirement.requirementId} requirement={requirement} />
      ) : <p className="degree-empty">The administrator has not configured requirements for this program.</p>}
    </main>
  );
}
