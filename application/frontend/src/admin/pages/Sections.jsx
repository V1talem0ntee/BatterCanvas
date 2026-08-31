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

export default function Sections() {
  // Lookup APIs populate course, term, instructor, and classroom form options.
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [semester, setSemester] = useState("");
  const [notice, setNotice] = useState("");
  const { data, error, loading, reload } = useAdminData(
    `/api/admin/sections${semester ? `?semesterId=${semester}` : ""}`,
  );
  const refs = useAdminData("/api/admin/reference-data");
  const courses = useAdminData("/api/admin/courses?pageSize=100");
  const fields = useMemo(
    () => [
      {
        name: "courseId",
        label: "Course",
        type: "select",
        required: true,
        options: (courses.data?.courses || []).map((c) => ({
          value: c.courseId,
          label: `${c.subjectCode} ${c.courseNumber} — ${c.title}`,
        })),
      },
      {
        name: "semesterId",
        label: "Semester",
        type: "select",
        required: true,
        options: (refs.data?.semesters || []).map((s) => ({
          value: s.semesterId,
          label: `${s.type} ${s.year} (${String(s.startDate).slice(0, 10)} – ${String(s.endDate).slice(0, 10)})`,
        })),
      },
      {
        name: "instructorId",
        label: "Instructor",
        type: "select",
        required: true,
        options: (refs.data?.instructors || []).map((i) => ({
          value: i.instructorId,
          label: `${i.firstName} ${i.lastName}`,
        })),
      },
      {
        name: "classroomId",
        label: "Classroom (optional)",
        type: "select",
        options: (refs.data?.classrooms || []).map((r) => ({
          value: r.classroomId,
          label: `${r.buildingName} — Room ${r.roomNumber}`,
        })),
      },
      { name: "sectionNumber", label: "Section number", required: true },
      {
        name: "meetingStartTime",
        label: "Start time",
        type: "time",
        required: true,
      },
      {
        name: "meetingEndTime",
        label: "End time",
        type: "time",
        required: true,
      },
      {
        name: "meetingDays",
        label: "Meeting days",
        type: "checkbox-group",
        required: true,
        options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => ({ value: day, label: day })),
      },
      {
        name: "modality",
        label: "Modality",
        type: "select",
        required: true,
        options: ["in-person", "online", "hybrid"].map((v) => ({
          value: v,
          label: v,
        })),
      },
      {
        name: "meetingType",
        label: "Meeting type",
        type: "select",
        required: true,
        options: ["synchronous", "asynchronous"].map((v) => ({
          value: v,
          label: v,
        })),
      },
      {
        name: "capacity",
        label: "Capacity",
        type: "number",
        min: 0,
        required: true,
      },
      { name: "enrolledCount", label: "Enrolled", type: "number", min: 0 },
      {
        name: "waitlistCapacity",
        label: "Waitlist capacity",
        type: "number",
        min: 0,
      },
      {
        name: "waitlistCount",
        label: "Waitlist count",
        type: "number",
        min: 0,
      },
      {
        name: "status",
        label: "Status",
        type: "select",
        required: true,
        options: ["open", "closed", "waitlist", "cancelled"].map((v) => ({
          value: v,
          label: v,
        })),
      },
    ],
    [refs.data, courses.data],
  );
  const body = (v) => {
    const values = { ...v };
    delete values.startDate;
    delete values.endDate;
    return ({
    ...values,
    courseId: Number(v.courseId),
    semesterId: Number(v.semesterId),
    instructorId: Number(v.instructorId),
    classroomId: v.classroomId ? Number(v.classroomId) : null,
    capacity: Number(v.capacity),
    enrolledCount: Number(v.enrolledCount || 0),
    waitlistCapacity: Number(v.waitlistCapacity || 0),
    waitlistCount: Number(v.waitlistCount || 0),
    meetingDays: v.meetingDays || [],
  });
  };
  const save = async (v, item) => {
    const b = body(v);
    await api(
      item
        ? `/api/admin/sections/${item.classSectionId}`
        : `/api/admin/courses/${b.courseId}/sections`,
      { method: item ? "PATCH" : "POST", body: JSON.stringify(b) },
    );
    setEditing(null);
    setCreating(false);
    setNotice("Class section saved.");
    reload();
  };
  return (
    <>
      <Header
        eyebrow="Scheduling"
        title="Class Sections"
        description="Manage teaching assignments, meeting times, capacity, and status."
        action={
          <button className="admin-button" onClick={() => setCreating(true)}>
            + Add section
          </button>
        }
      />
      {notice && <div className="admin-alert success">{notice}</div>}
      <div className="admin-toolbar">
        <select value={semester} onChange={(e) => setSemester(e.target.value)}>
          <option value="">All semesters</option>
          {refs.data?.semesters?.map((s) => (
            <option value={s.semesterId} key={s.semesterId}>
              {s.type} {s.year}
            </option>
          ))}
        </select>
      </div>
      <PageState loading={loading} error={error}>
        {data?.sections?.length ? (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Term</th>
                  <th>Meeting</th>
                  <th>Instructor</th>
                  <th>Enrollment</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.sections.map((s) => (
                  <tr key={s.classSectionId}>
                    <td>
                      <strong>
                        {s.courseCode}-{s.sectionNumber}
                      </strong>
                      <small>{s.courseTitle}</small>
                    </td>
                    <td>
                      {s.termType} {s.termYear}
                    </td>
                    <td>
                      {s.meetingDays.join(", ") || "No days"}
                      <small>
                        {s.meetingStartTime}–{s.meetingEndTime}
                      </small>
                    </td>
                    <td>{s.instructorName}</td>
                    <td>
                      {s.enrolledCount}/{s.capacity}
                      <small>
                        Waitlist {s.waitlistCount}/{s.waitlistCapacity}
                      </small>
                    </td>
                    <td>
                      <span className={`admin-badge ${s.status}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="row-actions">
                      <button
                        className="admin-link"
                        onClick={() =>
                          setEditing({
                            ...s,
                            meetingDays: s.meetingDays,
                          })
                        }
                      >
                        Edit
                      </button>
                      <ConfirmButton
                        onConfirm={async () => {
                          try {
                            await api(
                              `/api/admin/sections/${s.classSectionId}`,
                              { method: "DELETE" },
                            );
                            reload();
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
        ) : (
          <Empty text="No class sections found." />
        )}
      </PageState>
      <Dialog
        title="Add class section"
        open={creating}
        onClose={() => setCreating(false)}
        size="wide"
      >
        <AdminForm
          fields={fields}
          initial={{
            modality: "in-person",
            meetingType: "synchronous",
            status: "open",
            capacity: 30,
            enrolledCount: 0,
            waitlistCapacity: 0,
            waitlistCount: 0,
          }}
          onCancel={() => setCreating(false)}
          onSubmit={(v) => save(v, null)}
        />
      </Dialog>
      <Dialog
        title="Edit class section"
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        size="wide"
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
