import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./Cart.css";
import { authFetch } from "./AuthContext.jsx";

function courseName(item) {
  return `${item.subjectCode} ${item.courseNumber}`;
}

function formatTime(value) {
  if (!value) return "TBA";
  const [hours, minutes] = String(value).split(":").map(Number);
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

function formatMeeting(item) {
  const days = (item.meetingDays || []).map((day) => day.slice(0, 3)).join(" ");
  if (!days && !item.meetingStartTime) return "Schedule TBA";
  return `${days || "TBA"} · ${formatTime(item.meetingStartTime)}–${formatTime(item.meetingEndTime)}`;
}

function semesterLabel(semester) {
  return semester ? `${semester.type} ${semester.year}` : "";
}

function Cart() {
  const token = localStorage.getItem("authToken") || "";

  const [cartItems, setCartItems] = useState([]);
  const [semesterCatalog, setSemesterCatalog] = useState([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [termPickerOpen, setTermPickerOpen] = useState(false);
  const [requirements, setRequirements] = useState([]);
  const [degreeSummary, setDegreeSummary] = useState(null);
  const [timeConflicts, setTimeConflicts] = useState([]);
  const [walkingWarnings, setWalkingWarnings] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState(null);
  const [enrollMessage, setEnrollMessage] = useState("");

  const loadCart = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [cartResponse, semesterResponse, calendarResponse, walkingResponse, progressResponse] =
        await Promise.all([
          authFetch("/api/cart/sections", { headers }),
          fetch("/api/semesters"),
          authFetch("/api/calendar", { headers }),
          authFetch("/api/walking-warnings", { headers }),
          authFetch("/api/degree-progress", { headers }),
        ]);

      const cartData = await cartResponse.json();
      if (!cartResponse.ok) throw new Error(cartData.message || "Unable to load your cart.");
      setCartItems(cartData.classCart || []);

      setSemesterCatalog(semesterResponse.ok ? (await semesterResponse.json()).semesters || [] : []);
      setTimeConflicts(calendarResponse.ok ? (await calendarResponse.json()).conflicts || [] : []);
      setWalkingWarnings(walkingResponse.ok ? (await walkingResponse.json()).warnings || [] : []);
      if (progressResponse.ok) {
        const progressData = await progressResponse.json();
        setRequirements(progressData.requirements || []);
        setDegreeSummary(progressData.summary || null);
      } else {
        setRequirements([]);
        setDegreeSummary(null);
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to connect to the cart service.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timeoutId = window.setTimeout(loadCart, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadCart]);

  // Terms represented in the cart, newest first (matches /api/semesters ordering).
  const cartSemesters = useMemo(() => {
    const ids = new Set(cartItems.map((item) => String(item.semesterId)));
    return semesterCatalog.filter((semester) => ids.has(String(semester.semesterId)));
  }, [cartItems, semesterCatalog]);

  useEffect(() => {
    if (!selectedSemesterId && cartSemesters.length) {
      const timeoutId = window.setTimeout(
        () => setSelectedSemesterId(String(cartSemesters[0].semesterId)),
        0
      );
      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
  }, [selectedSemesterId, cartSemesters]);

  const visibleItems = useMemo(
    () =>
      selectedSemesterId
        ? cartItems.filter((item) => String(item.semesterId) === selectedSemesterId)
        : cartItems,
    [cartItems, selectedSemesterId]
  );

  const visibleSectionIds = useMemo(
    () => new Set(visibleItems.map((item) => item.classSectionId)),
    [visibleItems]
  );

  const visibleConflicts = useMemo(
    () =>
      timeConflicts.filter((conflict) =>
        (conflict.sections || []).some((section) => visibleSectionIds.has(section.classSectionId))
      ),
    [timeConflicts, visibleSectionIds]
  );

  const visibleWalkingWarnings = useMemo(
    () =>
      walkingWarnings.filter(
        (warning) =>
          visibleSectionIds.has(warning.fromClass?.classSectionId) ||
          visibleSectionIds.has(warning.toClass?.classSectionId)
      ),
    [walkingWarnings, visibleSectionIds]
  );

  // Match cart courses against required courses on each degree requirement.
  const requirementMatches = useMemo(() => {
    const matches = [];
    for (const item of visibleItems) {
      const satisfied = requirements.filter((requirement) =>
        (requirement.requiredCourses || []).some((course) => course.courseId === item.courseId)
      );
      matches.push({ item, satisfied });
    }
    return matches;
  }, [visibleItems, requirements]);

  const totalUnits = visibleItems.reduce((sum, item) => sum + Number(item.units || 0), 0);
  const hasBlockingConflicts = visibleConflicts.length > 0;
  const selectedSemester = semesterCatalog.find(
    (semester) => String(semester.semesterId) === selectedSemesterId
  );
  const shouldOfferGraduateCourse =
    Boolean(degreeSummary?.projectedComplete) &&
    Boolean(selectedSemester?.isActive) &&
    visibleItems.length > 0 &&
    visibleItems.length < 4 &&
    totalUnits < 15;

  async function removeFromCart(classSectionId) {
    setRemovingId(classSectionId);
    setError("");
    setEnrollMessage("");
    try {
      const response = await authFetch(`/api/cart/sections/${classSectionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Unable to remove this class from the cart.");
      }
      await loadCart();
    } catch (requestError) {
      setError(requestError.message || "Unable to update your cart.");
    } finally {
      setRemovingId(null);
    }
  }

  function handleProceedToEnroll() {
    if (!visibleItems.length) return;
    if (hasBlockingConflicts) {
      setEnrollMessage("Resolve the schedule conflicts below before enrolling.");
      return;
    }
    setEnrollMessage(
      "Registration will open once your enrollment window begins. This prototype does not process live enrollment yet."
    );
  }

  return (
    <main className="cart-page">
<header className="cart-title">
        <h1>Cart</h1>
      </header>

      {error && (
        <div className="cart-error">
          <span>{error}</span>
          <button onClick={loadCart}>Try again</button>
        </div>
      )}

      {loading ? (
        <div className="cart-loading">Loading your cart…</div>
      ) : (
        <div className="cart-dashboard">
          {shouldOfferGraduateCourse && (
            <section className="graduate-course-prompt" aria-labelledby="graduate-course-title">
              <div>
                <span className="graduate-course-eyebrow">Graduation opportunity</span>
                <h2 id="graduate-course-title">You may have room for a Master-level course</h2>
                <p>
                  Your current plan appears to cover your remaining undergraduate degree
                  requirements. You have {visibleItems.length} of 4 courses and {totalUnits} of
                  15 units in this term.
                </p>
              </div>
              <Link
                className="graduate-course-link"
                to={`/courses?level=graduate&semesterId=${selectedSemesterId}`}
              >
                Explore graduate courses
              </Link>
            </section>
          )}

          <section className="cart-panel semester-info-panel">
            <header>
              <h2>Semester Info</h2>
              <button className="change-term-button" onClick={() => setTermPickerOpen((open) => !open)}>
                Change Term
              </button>
            </header>
            <div className="semester-info-body">
              {cartSemesters.length === 0 ? (
                <p className="panel-empty">Your cart is empty, so no term is selected.</p>
              ) : termPickerOpen ? (
                <select
                  value={selectedSemesterId}
                  onChange={(event) => {
                    setSelectedSemesterId(event.target.value);
                    setTermPickerOpen(false);
                  }}
                >
                  {cartSemesters.map((semester) => (
                    <option value={String(semester.semesterId)} key={semester.semesterId}>
                      {semesterLabel(semester)}
                    </option>
                  ))}
                </select>
              ) : (
                <p>
                  Viewing{" "}
                  <strong>
                    {semesterLabel(cartSemesters.find((s) => String(s.semesterId) === selectedSemesterId)) ||
                      "your cart"}
                  </strong>{" "}
                  · {visibleItems.length} class{visibleItems.length === 1 ? "" : "es"} · {totalUnits} units
                </p>
              )}
            </div>
          </section>

          <section className="cart-panel class-list-panel">
            <div className="class-list">
              {visibleItems.length ? (
                visibleItems.map((item, index) => (
                  <article className="class-row" key={item.classSectionId}>
                    <div className="class-row-main">
                      <span className="class-row-index">Class {index + 1}</span>
                      <strong>
                        {courseName(item)} — {item.title}
                      </strong>
                      <span className="class-row-meta">
                        Sec. {item.sectionNumber} · {formatMeeting(item)}
                      </span>
                      <span className="class-row-meta">
                        {item.instructor?.firstName
                          ? `${item.instructor.firstName} ${item.instructor.lastName}`
                          : "Instructor TBA"}{" "}
                        ·{" "}
                        {item.location
                          ? `${item.location.buildingName} ${item.location.roomNumber || ""}`.trim()
                          : item.modality}
                        {" · "}
                        {item.units} unit{item.units === 1 ? "" : "s"}
                      </span>
                    </div>
                    <button
                      className="remove-button"
                      disabled={removingId === item.classSectionId}
                      onClick={() => removeFromCart(item.classSectionId)}
                    >
                      {removingId === item.classSectionId ? "Removing…" : "Remove"}
                    </button>
                  </article>
                ))
              ) : (
                <p className="panel-empty">
                  No classes in your cart yet. Visit <Link to="/courses">Course Search</Link> to add classes.
                </p>
              )}
            </div>
          </section>

          <section className="cart-panel requirements-panel">
            <header>
              <h2>Requirements Check</h2>
            </header>
            <div className="requirements-list">
              {!visibleItems.length ? (
                <p className="panel-empty">Add classes to your cart to check degree requirements.</p>
              ) : (
                requirementMatches.map(({ item, satisfied }) => (
                  <div className="requirement-row" key={item.classSectionId}>
                    <span className="requirement-course">{courseName(item)}</span>
                    {satisfied.length ? (
                      <span className="requirement-tags">
                        {satisfied.map((requirement) => (
                          <span className="requirement-tag" key={requirement.requirementId}>
                            {requirement.name}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="requirement-tag none">No matching requirement found</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="cart-panel cart-summary-panel">
            <header>
              <h2>Cart Summary</h2>
            </header>
            <div className="cart-summary-body">
              <dl>
                <div>
                  <dt>Classes</dt>
                  <dd>{visibleItems.length}</dd>
                </div>
                <div>
                  <dt>Total Units</dt>
                  <dd>{totalUnits}</dd>
                </div>
                <div>
                  <dt>Conflicts</dt>
                  <dd className={hasBlockingConflicts ? "warn" : ""}>
                    {visibleConflicts.length + visibleWalkingWarnings.length}
                  </dd>
                </div>
              </dl>

              <ul className="cart-summary-list">
                {visibleItems.map((item) => (
                  <li key={item.classSectionId}>
                    <span>{courseName(item)}</span>
                    <span>{item.units}u</span>
                  </li>
                ))}
              </ul>

              {enrollMessage && <p className="enroll-message">{enrollMessage}</p>}

              <button
                className="proceed-button"
                onClick={handleProceedToEnroll}
                disabled={!visibleItems.length}
              >
                Proceed to Enroll
              </button>
            </div>
          </section>

          <section className="cart-panel conflicts-panel">
            <header>
              <h2>Conflicts</h2>
              <span>{visibleConflicts.length + visibleWalkingWarnings.length}</span>
            </header>
            <div className="side-list conflict-list">
              {visibleConflicts.map((item, index) => (
                <div className="conflict-item" key={`time-${index}`}>
                  <strong>Time overlap</strong>
                  <span>{item.dayOfWeek}</span>
                  <small>{item.sections.map(courseName).join(" & ")}</small>
                </div>
              ))}
              {visibleWalkingWarnings.map((item, index) => (
                <div className="conflict-item walking" key={`walk-${index}`}>
                  <strong>Walking time</strong>
                  <span>{item.dayOfWeek}</span>
                  <small>
                    {courseName(item.fromClass)} → {courseName(item.toClass)}
                  </small>
                </div>
              ))}
              {!visibleConflicts.length && !visibleWalkingWarnings.length && (
                <p className="panel-empty success">No conflicts found.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default Cart;
