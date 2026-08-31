import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AdminForm,
  ConfirmButton,
  Dialog,
  Header,
  PageState,
} from "../AdminComponents.jsx";
import { api, useAdminData } from "../adminApi.js";

export default function Locations() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useAdminData("/api/admin/buildings");
  const refs = useAdminData("/api/admin/reference-data");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("success");
  const [distanceSaving, setDistanceSaving] = useState(false);

  const fields = [
    {
      name: "schoolId",
      label: "School",
      type: "select",
      required: true,
      options: (refs.data?.schools || []).map((school) => ({
        value: school.schoolId,
        label: school.name,
      })),
    },
    {
      name: "name",
      label: "Building name",
      required: true,
    },
    {
      name: "mapElementId",
      label: "Map element ID",
      required: true,
    },
    {
      name: "latitude",
      label: "Latitude",
      type: "number",
      step: "0.0000001",
      placeholder: "Example: 37.7240000",
    },
    {
      name: "longitude",
      label: "Longitude",
      type: "number",
      step: "0.0000001",
      placeholder: "Example: -122.4780000",
    },
  ];

  const save = async (values, building) => {
    await api(
      building
        ? `/api/admin/buildings/${building.buildingId}`
        : "/api/admin/buildings",
      {
        method: building ? "PATCH" : "POST",
        body: JSON.stringify({
          ...values,
          schoolId: Number(values.schoolId),
          latitude: values.latitude === "" ? null : Number(values.latitude),
          longitude: values.longitude === "" ? null : Number(values.longitude),
        }),
      }
    );

    setEditing(null);
    setCreating(false);
    setNoticeType("success");
    setNotice(building ? "Building updated." : "Building created.");
    reload();
  };

  async function generateBuildingDistances() {
    setDistanceSaving(true);
    setNotice("");

    try {
      const result = await api("/api/admin/building-distances/generate", {
        method: "POST",
      });

      setNoticeType("success");
      setNotice(
        `Walking distances generated for ${result.updatedCount || 0} building pairs.`
      );

      reload();
    } catch (err) {
      setNoticeType("error");
      setNotice(err.message || "Unable to generate walking distances.");
    } finally {
      setDistanceSaving(false);
    }
  }

  return (
    <>
      <Header
        eyebrow="Campus"
        title="Locations"
        description="Select a building to manage its classrooms, map position, and walking distance data."
        action={
          <>
            <button
              className="admin-button secondary"
              type="button"
              disabled={distanceSaving}
              onClick={generateBuildingDistances}
            >
              {distanceSaving ? "Generating..." : "Generate walking distances"}
            </button>

            <button
              className="admin-button"
              type="button"
              onClick={() => setCreating(true)}
            >
              + Add building
            </button>
          </>
        }
      />

      {notice && (
        <div className={`admin-alert ${noticeType}`}>
          {notice}
        </div>
      )}

      <PageState loading={loading} error={error}>
        <div className="location-grid">
          {data?.buildings?.map((building) => (
            <article
              className="admin-card location-card building-summary-card"
              key={building.buildingId}
            >
              <button
                className="building-card-link"
                type="button"
                onClick={() => navigate(`/admin/locations/${building.buildingId}`)}
              >
                <span className="admin-eyebrow">
                  {building.types.join(" · ") || "Campus building"}
                </span>

                <h2>{building.name}</h2>

                <p>
                  {building.classrooms.length} classroom
                  {building.classrooms.length === 1 ? "" : "s"}
                </p>

                <small>Open building →</small>
              </button>

              <div className="row-actions">
                <button
                  className="admin-link"
                  type="button"
                  onClick={() => setEditing(building)}
                >
                  Edit building
                </button>

                <ConfirmButton
                  onConfirm={async () => {
                    try {
                      await api(`/api/admin/buildings/${building.buildingId}`, {
                        method: "DELETE",
                      });

                      reload();
                    } catch (err) {
                      setNoticeType("error");
                      setNotice(err.message);
                    }
                  }}
                />
              </div>
            </article>
          ))}
        </div>
      </PageState>

      <Dialog
        title="Add building"
        open={creating}
        onClose={() => setCreating(false)}
      >
        <AdminForm
          fields={fields}
          onCancel={() => setCreating(false)}
          onSubmit={(values) => save(values, null)}
        />
      </Dialog>

      <Dialog
        title="Edit building"
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <AdminForm
            fields={fields}
            initial={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(values) => save(values, editing)}
          />
        )}
      </Dialog>
    </>
  );
}