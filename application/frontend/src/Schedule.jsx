import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CampusMap from "./CampusMap.jsx";
import "./Schedule.css";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const START_HOUR = 8;
const END_HOUR = 22;
const HOUR_HEIGHT = 58;

function timeToMinutes(value) {
  const [hours, minutes] = String(value || "0:0").split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTime(value) {
  const total = timeToMinutes(value);
  const hours = Math.floor(total / 60);
  return `${hours % 12 || 12}:${String(total % 60).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

function courseName(event) {
  return `${event.subjectCode} ${event.courseNumber}`;
}

function semesterName(event) {
  return event.termType && event.termYear
    ? `${event.termType} ${event.termYear}`
    : `Semester ${event.semesterId}`;
}

function formatDate(value, includeTime = false) {
  if (!value) return "Not configured";
  return new Intl.DateTimeFormat("en-US", includeTime
    ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" }
  ).format(new Date(value));
}

function formatDateRange(start, end, includeTime = false) {
  if (!start || !end) return "Not configured";
  return `${formatDate(start, includeTime)} – ${formatDate(end, includeTime)}`;
}

function eventStyle(event) {
  const top = Math.max(0, timeToMinutes(event.startTime) - START_HOUR * 60);
  const duration = Math.max(45, timeToMinutes(event.endTime) - timeToMinutes(event.startTime));
  return {
    top: `${(top / 60) * HOUR_HEIGHT}px`,
    height: `${Math.max(46, (duration / 60) * HOUR_HEIGHT - 4)}px`,
  };
}

function Schedule() {
  const token = localStorage.getItem("authToken") || "";
  const [calendar, setCalendar] = useState([]);
  const [semesterCatalog, setSemesterCatalog] = useState([]);
  const [timeConflicts, setTimeConflicts] = useState([]);
  const [walkingWarnings, setWalkingWarnings] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState(null);

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [calendarResponse, walkingResponse, semesterResponse] = await Promise.all([
        fetch("/api/calendar", { headers }),
        fetch("/api/walking-warnings", { headers }),
        fetch("/api/student/semesters", { headers }),
      ]);
      const data = await calendarResponse.json();
      if (!calendarResponse.ok) throw new Error(data.message || "Unable to load your schedule.");
      setCalendar(data.calendar || []);
      setTimeConflicts(data.conflicts || []);
      if (semesterResponse.ok) {
        const semesterData = await semesterResponse.json();
        setSemesterCatalog(semesterData.semesters || []);
      } else {
        setSemesterCatalog([]);
      }
      if (walkingResponse.ok) {
        const walkingData = await walkingResponse.json();
        setWalkingWarnings(walkingData.warnings || []);
      } else {
        setWalkingWarnings([]);
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to connect to the schedule service.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timeoutId = window.setTimeout(loadSchedule, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadSchedule]);

  const allEvents = useMemo(() => {
    const unique = new Map();
    for (const day of calendar) {
      for (const event of day.events || []) unique.set(`${event.status}-${event.classSectionId}`, event);
    }
    return Array.from(unique.values());
  }, [calendar]);

  const semesters = useMemo(() => {
    if (semesterCatalog.length) {
      return semesterCatalog.map((semester) => ({
        id: String(semester.semesterId),
        label: `${semester.type} ${semester.year}`,
      }));
    }
    const unique = new Map();
    for (const event of allEvents) unique.set(String(event.semesterId), semesterName(event));
    return Array.from(unique, ([id, label]) => ({ id, label }));
  }, [allEvents, semesterCatalog]);

  // Start with a real semester so the page always makes the current calendar
  // context clear. Students can still choose "All semesters" afterward.
  useEffect(() => {
    if (!selectedSemester && semesters.length) {
      const activeSemester = semesterCatalog.find((semester) => semester.isActive);
      const timeoutId = window.setTimeout(
        () => setSelectedSemester(activeSemester ? String(activeSemester.semesterId) : semesters[0].id),
        0
      );
      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
  }, [selectedSemester, semesters, semesterCatalog]);

  useEffect(() => {
    if (!selectedSectionId && allEvents.length) {
      const timeoutId = window.setTimeout(
        () => setSelectedSectionId(allEvents[0].classSectionId),
        0
      );
      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
  }, [allEvents, selectedSectionId]);

  const semesterEvents = useMemo(
    () => selectedSemester === "all" || !selectedSemester ? allEvents : allEvents.filter((event) => String(event.semesterId) === selectedSemester),
    [allEvents, selectedSemester]
  );

  const selectedEvent = useMemo(
    () => allEvents.find((event) => event.classSectionId === selectedSectionId) || semesterEvents[0] || null,
    [allEvents, semesterEvents, selectedSectionId]
  );

  const selectedSemesterDetails = useMemo(
    () => semesterCatalog.find((semester) => String(semester.semesterId) === selectedSemester) || null,
    [semesterCatalog, selectedSemester]
  );

  const conflictIds = useMemo(() => {
    const ids = new Set();
    for (const conflict of timeConflicts) for (const section of conflict.sections || []) ids.add(section.classSectionId);
    for (const warning of walkingWarnings) {
      if (warning.fromClass) ids.add(warning.fromClass.classSectionId);
      if (warning.toClass) ids.add(warning.toClass.classSectionId);
    }
    return ids;
  }, [timeConflicts, walkingWarnings]);

  const days = useMemo(() => {
    const allowed = new Set(semesterEvents.map((event) => `${event.status}-${event.classSectionId}`));
    const byDay = new Map(calendar.map((day) => [day.dayOfWeek, day.events || []]));
    return WEEKDAYS.map((dayOfWeek) => ({
      dayOfWeek,
      events: (byDay.get(dayOfWeek) || []).filter((event) => allowed.has(`${event.status}-${event.classSectionId}`)),
    }));
  }, [calendar, semesterEvents]);

  const cartEvents = semesterEvents.filter((event) => event.status === "cart");
  const enrolledCount = semesterEvents.filter((event) => event.status === "enrolled").length;
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => START_HOUR + index);

  async function removeFromCart(classSectionId) {
    setRemovingId(classSectionId);
    setError("");
    try {
      const response = await fetch(`/api/cart/sections/${classSectionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Unable to remove this class from the cart.");
      }
      if (selectedSectionId === classSectionId) setSelectedSectionId(null);
      await loadSchedule();
    } catch (requestError) {
      setError(requestError.message || "Unable to update your cart.");
    } finally {
      setRemovingId(null);
    }
  }

  const selectConflict = (item) => {
    const section = item.sections?.[0] || item.fromClass || item.toClass;
    if (section) setSelectedSectionId(section.classSectionId);
  };

  function conflictSemesterLabel(item) {
    const semesterId =
      item.semesterId ||
      item.sections?.[0]?.semesterId ||
      item.fromClass?.semesterId ||
      item.toClass?.semesterId;

    if (!semesterId) {
      return "";
    }

    const semester = semesters.find((entry) => {
      return entry.id === String(semesterId);
    });

    return semester ? semester.label : `Semester ${semesterId}`;
  }

  return (
    <main className="schedule-page">
      <header className="schedule-title"><h1>Schedule</h1></header>

      {error && <div className="schedule-error"><span>{error}</span><button onClick={loadSchedule}>Try again</button></div>}

      {loading ? <div className="schedule-loading">Loading your schedule…</div> : (
        <div className="schedule-dashboard">
          <aside className="schedule-left-column">
            <label className="semester-picker">
              <span>Select Semester</span>
              <select value={selectedSemester} onChange={(event) => setSelectedSemester(event.target.value)}>
                {!selectedSemester && <option value="">Select a semester</option>}
                <option value="all">All semesters</option>
                {semesters.map((semester) => <option value={semester.id} key={semester.id}>{semester.label}</option>)}
              </select>
              <strong>
                Viewing {selectedSemester === "all"
                  ? "all semesters"
                  : semesters.find((semester) => semester.id === selectedSemester)?.label || "schedule"}
              </strong>
            </label>

            {selectedSemesterDetails && (
              <section className="schedule-panel semester-details-panel">
                <header>
                  <h2>Semester Details</h2>
                  <span>{selectedSemesterDetails.isActive ? "Active" : "View only"}</span>
                </header>
                <dl>
                  <div><dt>Term dates</dt><dd>{formatDateRange(selectedSemesterDetails.startDate, selectedSemesterDetails.endDate)}</dd></div>
                  <div><dt>Enrollment</dt><dd>{formatDateRange(selectedSemesterDetails.enrollmentStart, selectedSemesterDetails.enrollmentEnd, true)}</dd></div>
                  <div><dt>Add/drop deadline</dt><dd>{formatDate(selectedSemesterDetails.addDropDeadline)}</dd></div>
                  <div><dt>Withdrawal deadline</dt><dd>{formatDate(selectedSemesterDetails.withdrawalDeadline)}</dd></div>
                </dl>
              </section>
            )}

            <section className="schedule-panel cart-panel">
              <header><h2>Class Cart</h2><span>{cartEvents.length}</span></header>
              <div className="side-list">
                {cartEvents.length ? cartEvents.map((event) => (
                  <button className={selectedEvent?.classSectionId === event.classSectionId ? "selected" : ""} onClick={() => setSelectedSectionId(event.classSectionId)} key={event.classSectionId}>
                    <strong>{courseName(event)}</strong><span>Sec. {event.sectionNumber}</span><small>{formatTime(event.startTime)}</small>
                  </button>
                )) : <p className="panel-empty">No classes in your cart.</p>}
              </div>
            </section>

            <section className="schedule-panel conflict-panel">
              <header><h2>Conflicts</h2><span>{timeConflicts.length + walkingWarnings.length}</span></header>
              <p className="panel-caption">Walking time and class overlap</p>
              <div className="side-list conflict-list">
                {timeConflicts.map((item, index) => (
                  <button onClick={() => selectConflict(item)} key={`time-${index}`}>
                    <strong>Time overlap</strong>
                    <span>
                      {conflictSemesterLabel(item)}
                      {conflictSemesterLabel(item) ? " · " : ""}
                      {item.dayOfWeek}
                    </span>
                    <small>{item.sections.map(courseName).join(" & ")}</small>
                  </button>
                ))}

                {walkingWarnings.map((item, index) => (
                  <button onClick={() => selectConflict(item)} key={`walk-${index}`}>
                    <strong>Walking time</strong>
                    <span>
                      {conflictSemesterLabel(item)}
                      {conflictSemesterLabel(item) ? " · " : ""}
                      {item.dayOfWeek}
                    </span>
                    <small>{courseName(item.fromClass)} → {courseName(item.toClass)}</small>
                  </button>
                ))}
                {!timeConflicts.length && !walkingWarnings.length && <p className="panel-empty success">No conflicts found.</p>}
              </div>
            </section>
          </aside>

          <section className="schedule-center-column">
            <header className="calendar-heading">
              <div><h2>Calendar View</h2><p>{enrolledCount} enrolled · {cartEvents.length} in cart</p></div>
              <div className="calendar-legend"><span><i className="enrolled" />Enrolled</span><span><i className="cart" />Cart</span></div>
            </header>
            <div className="calendar-scroll">
              <div className="calendar-grid">
                <div className="calendar-time-heading">Time</div>
                {WEEKDAYS.map((day) => <div className="calendar-day-heading" key={day}>{day.slice(0, 3)}</div>)}
                <div className="time-column">{hours.map((hour) => <span style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px` }} key={hour}>{formatTime(`${hour}:00`)}</span>)}</div>
                {days.map((day) => <div className="calendar-day-column" key={day.dayOfWeek}>
                  {hours.slice(0, -1).map((hour) => <div className="calendar-hour-line" key={hour} />)}
                  {day.events.map((event) => <button
                    className={`calendar-event ${event.status} ${conflictIds.has(event.classSectionId) ? "conflict" : ""} ${selectedEvent?.classSectionId === event.classSectionId ? "selected" : ""}`}
                    style={eventStyle(event)} onClick={() => setSelectedSectionId(event.classSectionId)}
                    key={`${event.status}-${event.classSectionId}-${day.dayOfWeek}`}>
                    <strong>{courseName(event)}</strong><span>Sec. {event.sectionNumber}</span><small>{formatTime(event.startTime)}</small>
                  </button>)}
                </div>)}
              </div>
            </div>
          </section>

          <aside className="schedule-right-column">
            <Link to="/courses" className="manage-course-button">Add/Remove Courses<span>Go to Course Search</span></Link>

            <section className="schedule-panel details-panel">
              <header><h2>Class Details</h2></header>
              {selectedEvent ? <div className="class-details">
                <span className={`status-badge ${selectedEvent.status}`}>{selectedEvent.status === "cart" ? "In Cart" : "Enrolled"}</span>
                <h3>{courseName(selectedEvent)}</h3><p>{selectedEvent.title}</p>
                <dl>
                  <div><dt>Section</dt><dd>{selectedEvent.sectionNumber}</dd></div>
                  <div><dt>Time</dt><dd>{formatTime(selectedEvent.startTime)}–{formatTime(selectedEvent.endTime)}</dd></div>
                  <div><dt>Instructor</dt><dd>{`${selectedEvent.instructor?.firstName || ""} ${selectedEvent.instructor?.lastName || ""}`.trim() || "Not listed"}</dd></div>
                  <div><dt>Location</dt><dd>{selectedEvent.location ? `${selectedEvent.location.buildingName} ${selectedEvent.location.roomNumber || ""}`.trim() : selectedEvent.modality}</dd></div>
                </dl>
                {selectedEvent.status === "cart" && <button className="remove-cart-button" disabled={removingId === selectedEvent.classSectionId} onClick={() => removeFromCart(selectedEvent.classSectionId)}>{removingId === selectedEvent.classSectionId ? "Removing…" : "Remove from Cart"}</button>}
              </div> : <p className="panel-empty">Select a class to view its details.</p>}
            </section>

            <section className="schedule-panel map-preview-panel">
              <header><h2>Map Preview</h2><span>Click to expand</span></header>
              <button className="map-preview-button" onClick={() => setMapExpanded(true)} disabled={!selectedEvent?.location?.mapElementId}>
                <CampusMap highlightedBuildingIds={selectedEvent?.location?.mapElementId ? [selectedEvent.location.mapElementId] : []} />
              </button>
            </section>
          </aside>
        </div>
      )}

      {mapExpanded && <div className="schedule-map-modal" role="dialog" aria-modal="true" aria-label="Campus map">
        <div><button className="map-close" onClick={() => setMapExpanded(false)}>×</button><h2>{selectedEvent?.location?.buildingName || "Campus Map"}</h2><CampusMap highlightedBuildingIds={selectedEvent?.location?.mapElementId ? [selectedEvent.location.mapElementId] : []} /></div>
      </div>}
    </main>
  );
}

export default Schedule;
