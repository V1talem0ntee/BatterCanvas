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

export default function Departments() {
  const { data, error, loading, reload } = useAdminData(
    "/api/admin/departments",
  );
  const refs = useAdminData("/api/admin/reference-data");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState("");
  const fields = useMemo(
    () => [
      {
        name: "schoolId",
        label: "School",
        type: "select",
        required: true,
        options: (refs.data?.schools || []).map((s) => ({
          value: s.schoolId,
          label: s.name,
        })),
      },
      {
        name: "buildingId",
        label: "Office building",
        type: "select",
        required: true,
        options: (refs.data?.buildings || []).map((b) => ({
          value: b.buildingId,
          label: b.name,
        })),
      },
      { name: "name", label: "Department name", required: true },
      {
        name: "officeEmail",
        label: "Office email",
        type: "email",
        required: true,
      },
      { name: "officePhone", label: "Office phone", required: true },
    ],
    [refs.data],
  );
  const save = async (v, item) => {
    const body = {
      ...v,
      schoolId: Number(v.schoolId),
      buildingId: Number(v.buildingId),
    };
    await api(
      item
        ? `/api/admin/departments/${item.departmentId}`
        : "/api/admin/departments",
      { method: item ? "PATCH" : "POST", body: JSON.stringify(body) },
    );
    setCreating(false);
    setEditing(null);
    setNotice("Department saved.");
    reload();
  };
  return (
    <>
      <Header
        eyebrow="Academic organization"
        title="Departments"
        description="Manage academic departments and their campus contact information."
        action={
          <button className="admin-button" onClick={() => setCreating(true)}>
            + Add department
          </button>
        }
      />
      {notice && <div className="admin-alert success">{notice}</div>}
      <PageState loading={loading} error={error}>
        {data?.departments?.length ? (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>School</th>
                  <th>Office</th>
                  <th>Contact</th>
                  <th>Majors</th>
                  <th>Courses</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.departments.map((d) => (
                  <tr key={d.departmentId}>
                    <td>
                      <strong>{d.name}</strong>
                    </td>
                    <td>{d.schoolName}</td>
                    <td>{d.buildingName}</td>
                    <td>
                      {d.officeEmail}
                      <small>{d.officePhone}</small>
                    </td>
                    <td>{d.majorCount}</td>
                    <td>{d.courseCount}</td>
                    <td className="row-actions">
                      <button
                        className="admin-link"
                        onClick={() => setEditing(d)}
                      >
                        Edit
                      </button>
                      <ConfirmButton
                        onConfirm={async () => {
                          try {
                            await api(
                              `/api/admin/departments/${d.departmentId}`,
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
          <Empty text="No departments found. Add one before creating majors or courses." />
        )}
      </PageState>
      <Dialog
        title="Add department"
        open={creating}
        onClose={() => setCreating(false)}
      >
        <AdminForm
          fields={fields}
          onCancel={() => setCreating(false)}
          onSubmit={(v) => save(v, null)}
        />
      </Dialog>
      <Dialog
        title="Edit department"
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
