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

export default function Majors() {
  const [department, setDepartment] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState("");
  const { data, error, loading, reload } = useAdminData(
    `/api/admin/majors${department ? `?departmentId=${department}` : ""}`,
  );
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
      { name: "name", label: "Major name", required: true },
    ],
    [refs.data],
  );
  const save = async (v, item) => {
    await api(
      item ? `/api/admin/majors/${item.majorId}` : "/api/admin/majors",
      {
        method: item ? "PATCH" : "POST",
        body: JSON.stringify({ ...v, departmentId: Number(v.departmentId) }),
      },
    );
    setCreating(false);
    setEditing(null);
    setNotice("Major saved.");
    reload();
  };
  return (
    <>
      <Header
        eyebrow="Academic organization"
        title="Majors"
        description="Maintain majors before creating catalog-year degree programs."
        action={
          <button className="admin-button" onClick={() => setCreating(true)}>
            + Add major
          </button>
        }
      />
      {notice && <div className="admin-alert success">{notice}</div>}
      <div className="admin-toolbar">
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        >
          <option value="">All departments</option>
          {refs.data?.departments?.map((d) => (
            <option value={d.departmentId} key={d.departmentId}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <PageState loading={loading} error={error}>
        {data?.majors?.length ? (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Major</th>
                  <th>Department</th>
                  <th>Degree programs</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.majors.map((m) => (
                  <tr key={m.majorId}>
                    <td>
                      <strong>{m.name}</strong>
                    </td>
                    <td>{m.departmentName}</td>
                    <td>{m.programCount}</td>
                    <td className="row-actions">
                      <button
                        className="admin-link"
                        onClick={() => setEditing(m)}
                      >
                        Edit
                      </button>
                      <ConfirmButton
                        onConfirm={async () => {
                          try {
                            await api(`/api/admin/majors/${m.majorId}`, {
                              method: "DELETE",
                            });
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
          <Empty text="No majors found for this department." />
        )}
      </PageState>
      <Dialog
        title="Add major"
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
        title="Edit major"
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
