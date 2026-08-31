import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AdminForm, ConfirmButton, Dialog, Header, PageState } from "../AdminComponents.jsx";
import { api, useAdminData } from "../adminApi.js";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const OPEN_MINUTES = 8 * 60;
const CLOSE_MINUTES = 22 * 60;

function minutes(value) {
  const [hour, minute] = String(value || "0:0").split(":").map(Number);
  return hour * 60 + minute;
}
function displayTime(total) {
  const hour = Math.floor(total / 60);
  return `${hour % 12 || 12}:${String(total % 60).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}
function dayAvailability(bookings, day) {
  const occupied = bookings.filter((booking) => booking.meetingDays.includes(day))
    .map((booking) => ({ ...booking, start: minutes(booking.startTime), end: minutes(booking.endTime) }))
    .sort((a, b) => a.start - b.start);
  const available = [];
  let cursor = OPEN_MINUTES;
  for (const booking of occupied) {
    if (booking.start > cursor) available.push([cursor, booking.start]);
    cursor = Math.max(cursor, booking.end);
  }
  if (cursor < CLOSE_MINUTES) available.push([cursor, CLOSE_MINUTES]);
  return { occupied, available };
}
function floorKey(roomNumber) {
  return String(roomNumber).match(/\d/)?.[0] || "other";
}
function floorLabel(key) {
  if (key === "other") return "Other rooms";
  const suffix = key === "1" ? "st" : key === "2" ? "nd" : key === "3" ? "rd" : "th";
  return `${key}${suffix} Floor`;
}

export default function BuildingDetails() {
  const { buildingId } = useParams();
  const navigate = useNavigate();
  const buildingData = useAdminData(`/api/admin/buildings/${buildingId}`);
  const refs = useAdminData("/api/admin/reference-data");
  const building = buildingData.data?.building;
  const [addingRoom, setAddingRoom] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [notice, setNotice] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleSemesterId, setScheduleSemesterId] = useState("");
  const [scheduleRooms, setScheduleRooms] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const roomFields = [{ name: "roomNumber", label: "Room number", required: true }];
  const bulkRoomFields = [
    { name: "floor", label: "Floor number", type: "number", min: 1, required: true },
    { name: "roomCount", label: "Number of rooms", type: "number", min: 1, required: true },
  ];
  const floors = Object.entries((building?.classrooms || []).reduce((groups, room) => {
    const key = floorKey(room.roomNumber);
    (groups[key] ||= []).push(room);
    return groups;
  }, {})).sort(([a], [b]) => a === "other" ? 1 : b === "other" ? -1 : Number(a) - Number(b));

  async function saveRoom(values, room) {
    await api(room ? `/api/admin/classrooms/${room.classroomId}` : "/api/admin/classrooms", {
      method: room ? "PATCH" : "POST",
      body: JSON.stringify({ buildingId: Number(buildingId), roomNumber: values.roomNumber.trim() }),
    });
    setAddingRoom(false);
    setEditingRoom(null);
    setNotice("Classroom saved.");
    buildingData.reload();
  }
  async function createFloorRooms(values) {
    const result = await api(`/api/admin/buildings/${buildingId}/classrooms/bulk`, {
      method: "POST",
      body: JSON.stringify({ floor: Number(values.floor), roomCount: Number(values.roomCount) }),
    });
    setAddingRoom(false);
    setNotice(`${result.createdCount} classroom${result.createdCount === 1 ? "" : "s"} created${result.skippedCount ? `; ${result.skippedCount} already existed` : ""}.`);
    buildingData.reload();
  }
  async function loadSchedule(semesterId) {
    setScheduleLoading(true);
    setScheduleError("");
    try {
      const result = await api(`/api/admin/buildings/${buildingId}/classroom-schedule?semesterId=${semesterId}`);
      setScheduleRooms(result.classrooms || []);
    } catch (err) {
      setScheduleRooms([]);
      setScheduleError(err.message);
    } finally { setScheduleLoading(false); }
  }
  function openSchedule() {
    const semesters = refs.data?.semesters || [];
    const selected = semesters.find((semester) => semester.isActive) || semesters[0];
    const semesterId = String(selected?.semesterId || "");
    setScheduleSemesterId(semesterId);
    setScheduleOpen(true);
    if (semesterId) loadSchedule(semesterId);
  }

  return <>
    <PageState loading={buildingData.loading} error={buildingData.error}>
      {building && <>
        <button className="admin-back-link" type="button" onClick={() => navigate("/admin/locations")}>← All buildings</button>
        <Header eyebrow="Campus building" title={building.name} description={`${building.classrooms.length} classrooms · Map ID: ${building.mapElementId}`} action={<div className="building-detail-actions"><button className="admin-button secondary" onClick={openSchedule}>Weekly schedule</button><button className="admin-button" onClick={() => setAddingRoom(true)}>+ Add floor rooms</button></div>} />
        {notice && <div className="admin-alert success">{notice}</div>}
        <div className="building-floor-list">
          {floors.map(([floor, rooms]) => <section className="admin-card floor-card" key={floor}>
            <header><div><span className="admin-eyebrow">Floor</span><h2>{floorLabel(floor)}</h2></div><strong>{rooms.length} room{rooms.length === 1 ? "" : "s"}</strong></header>
            <div className="floor-room-grid">{rooms.sort((a, b) => String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric: true })).map((room) => <article className="floor-room" key={room.classroomId}>
              <strong>Room {room.roomNumber}</strong>
              <div><button className="admin-link" onClick={() => setEditingRoom(room)}>Edit</button><ConfirmButton label="Delete" onConfirm={async () => {
                try { await api(`/api/admin/classrooms/${room.classroomId}`, { method: "DELETE" }); setNotice("Classroom deleted."); buildingData.reload(); }
                catch (err) { setNotice(err.message); }
              }} /></div>
            </article>)}</div>
          </section>)}
          {!floors.length && <div className="admin-empty">No classrooms yet. Add the first room to this building.</div>}
        </div>
      </>}
    </PageState>
    <Dialog title={`Add floor classrooms${building ? ` to ${building.name}` : ""}`} open={addingRoom} onClose={() => setAddingRoom(false)}>
      <p className="admin-form-help bulk-room-help">Enter a floor and room count. For example, floor 1 with 13 rooms creates Room 101 through Room 113.</p>
      <AdminForm fields={bulkRoomFields} initial={{ floor: 1, roomCount: 1 }} submitLabel="Create rooms" onCancel={() => setAddingRoom(false)} onSubmit={createFloorRooms} />
    </Dialog>
    <Dialog title="Edit classroom" open={Boolean(editingRoom)} onClose={() => setEditingRoom(null)}>
      {editingRoom && <AdminForm fields={roomFields} initial={{ roomNumber: editingRoom.roomNumber }} onCancel={() => setEditingRoom(null)} onSubmit={(values) => saveRoom(values, editingRoom)} />}
    </Dialog>
    <Dialog title={`Classroom schedule${building ? ` — ${building.name}` : ""}`} open={scheduleOpen} onClose={() => setScheduleOpen(false)} size="wide">
      <div className="classroom-schedule">
        <label className="admin-field classroom-schedule-semester"><span>Semester</span><select value={scheduleSemesterId} onChange={(event) => { setScheduleSemesterId(event.target.value); loadSchedule(event.target.value); }}>
          {(refs.data?.semesters || []).map((semester) => <option key={semester.semesterId} value={semester.semesterId}>{semester.type} {semester.year}{semester.isActive ? " — Current" : ""}</option>)}
        </select></label>
        {scheduleLoading && <div className="admin-state">Loading classroom availability…</div>}
        {scheduleError && <div className="admin-alert error">{scheduleError}</div>}
        {!scheduleLoading && !scheduleError && <div className="classroom-schedule-table-wrap"><table className="classroom-schedule-table">
          <thead><tr><th>Classroom</th>{WEEKDAYS.map((day) => <th key={day}>{day.slice(0, 3)}</th>)}</tr></thead>
          <tbody>{scheduleRooms.map((room) => <tr key={room.classroomId}><th>Room {room.roomNumber}</th>{WEEKDAYS.map((day) => { const schedule = dayAvailability(room.bookings, day); return <td key={day}><strong>Available</strong>{schedule.available.length ? schedule.available.map(([start, end]) => <span className="available-time" key={`${start}-${end}`}>{displayTime(start)}–{displayTime(end)}</span>) : <span className="no-time">No availability</span>}{schedule.occupied.map((booking) => <span className="occupied-time" key={booking.classSectionId}>{booking.courseCode} · {displayTime(booking.start)}–{displayTime(booking.end)}</span>)}</td>; })}</tr>)}</tbody>
        </table>{!scheduleRooms.length && <div className="admin-empty">This building has no classrooms.</div>}</div>}
        <p className="admin-form-help">Availability is calculated from 8:00 AM to 10:00 PM. Cancelled sections are ignored.</p>
      </div>
    </Dialog>
  </>;
}
