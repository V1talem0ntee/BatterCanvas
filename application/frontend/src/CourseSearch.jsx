import "./App.css";
import "./CourseSearch.css";
import { authFetch } from "./AuthContext.jsx";

import CampusMap from "./CampusMap.jsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useRequestCooldown from "./useRequestCooldown.js";

function CourseSearch() {
  const navigate = useNavigate();
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);

  const canAddToCart =
    Boolean(localStorage.getItem("authToken")) &&
    localStorage.getItem("userRole") === "student";

  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [courses, setCourses] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [geAreas, setGeAreas] = useState([]);
  const [departmentId, setDepartmentId] = useState("");
  const [semesterId, setSemesterId] = useState(() => initialParams.get("semesterId") || "");
  const [modality, setModality] = useState("");
  const [units, setUnits] = useState("");
  const [level, setLevel] = useState(() =>
    initialParams.get("level") === "graduate" ? "graduate" : ""
  );
  const [courseCategory, setCourseCategory] = useState("");
  const [geAreaId, setGeAreaId] = useState("");
  const [mapHoveredBuilding, setMapHoveredBuilding] = useState(null);
  const [buildingMessage, setBuildingMessage] = useState("");
  const [message, setMessage] = useState("");
  const [mapExpanded, setMapExpanded] = useState(false);
  const [expandedCourseIds, setExpandedCourseIds] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [hoveredBuildingId, setHoveredBuildingId] = useState("");
  const [cartMessage, setCartMessage] = useState("");
  const [cartAdding, setCartAdding] = useState(false);
  const [plannerCourseIds, setPlannerCourseIds] = useState(new Set());

  const {
    isCoolingDown: searchCoolingDown,
    startCooldown: startSearchCooldown,
  } = useRequestCooldown();

  const activeFilterCount = [
    departmentId,
    modality,
    units,
    level,
    courseCategory,
    geAreaId,
  ].filter(Boolean).length;

  useEffect(function () {
    async function loadSearchOptions() {
      try {
        const [buildingResponse, departmentResponse, semesterResponse, geAreaResponse] =
          await Promise.all([
            fetch("/api/buildings"),
            fetch("/api/departments"),
            fetch("/api/semesters"),
            fetch("/api/ge-areas"),
          ]);

        const [buildingData, departmentData, semesterData, geAreaData] = await Promise.all([
          buildingResponse.json(),
          departmentResponse.json(),
          semesterResponse.json(),
          geAreaResponse.json(),
        ]);

        if (
          !buildingResponse.ok ||
          !departmentResponse.ok ||
          !semesterResponse.ok ||
          !geAreaResponse.ok
        ) {
          throw new Error("Unable to load course search options.");
        }

        setBuildings(buildingData.buildings || []);
        setDepartments(departmentData.departments || []);
        const semesterOptions = semesterData.semesters || [];
        setSemesters(semesterOptions);
        setGeAreas(geAreaData.geAreas || []);
        const currentSemester = semesterOptions.find((semester) => semester.isActive);
        setSemesterId((current) => current || String(currentSemester?.semesterId || semesterOptions[0]?.semesterId || ""));
        setBuildingMessage("");
      } catch (error) {
        console.log(error);
        setBuildings([]);
        setDepartments([]);
        setSemesters([]);
        setGeAreas([]);
        setBuildingMessage("Some search and building options are unavailable.");
      }
    }

    loadSearchOptions();
  }, []);

  useEffect(function () {
    async function loadPlannerCourseIds() {
      const token = localStorage.getItem("authToken");

      if (!token || localStorage.getItem("userRole") !== "student") {
        setPlannerCourseIds(new Set());
        return;
      }

      try {
        const response = await authFetch("/api/degree-planner", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to load planner courses.");
        }

        setPlannerCourseIds(
          new Set(
            (data.savedTerms || []).flatMap(function (term) {
              return (term.courses || []).map(function (course) {
                return String(course.courseId);
              });
            })
          )
        );
      } catch (error) {
        console.log(error);
        setPlannerCourseIds(new Set());
      }
    }

    loadPlannerCourseIds();
  }, []);

  const highlightedBuildingIds = useMemo(
    function () {
      const ids = [];

      if (selectedBuildingId) {
        ids.push(selectedBuildingId);
      }

      if (hoveredBuildingId && !ids.includes(hoveredBuildingId)) {
        ids.push(hoveredBuildingId);
      }

      return ids;
    },
    [selectedBuildingId, hoveredBuildingId],
  );

  const handleBuildingHover = useCallback(function (building) {
    setMapHoveredBuilding(building);
  }, []);

  const handleBuildingLeave = useCallback(function () {
    setMapHoveredBuilding(null);
  }, []);

  function groupCourses(courseRows) {
    const courseMap = {};

    for (let i = 0; i < courseRows.length; i++) {
      const course = courseRows[i];
      const courseId = String(course.courseId);

      if (!courseMap[courseId]) {
        courseMap[courseId] = {
          courseId: course.courseId,
          subjectCode: course.subjectCode,
          courseNumber: course.courseNumber,
          title: course.title,
          description: course.description,
          units: course.units,
          level: course.level,
          department: course.department,
          sectionType: course.sectionType,
          category: course.category,
          geAreas: course.geAreas || [],
          sections: [],
        };
      }

      if (course.section !== null) {
        courseMap[courseId].sections.push(course.section);
      }
    }

    return Object.values(courseMap);
  }

  async function handleSearch(event) {
    event.preventDefault();

    if (!semesterId) {
      setMessage("Select a semester before searching for courses.");
      return;
    }

    if (!startSearchCooldown()) {
      return;
    }

    setMessage("Loading...");
    setCartMessage("");

    try {
      const params = new URLSearchParams();

      if (search.trim()) params.set("search", search.trim());
      if (departmentId) params.set("departmentId", departmentId);
      if (semesterId) params.set("semesterId", semesterId);
      if (modality) params.set("modality", modality);
      if (units) params.set("units", units);
      if (level) params.set("level", level);
      if (courseCategory) params.set("courseCategory", courseCategory);
      if (geAreaId) params.set("geAreaId", geAreaId);

      const response = await fetch(`/api/courses?${params.toString()}`);

      if (response.ok === false) {
        throw new Error("Request failed");
      }

      const data = await response.json();

      if (data.courses && data.courses.length > 0) {
        setCourses(groupCourses(data.courses));
        setMessage("");
      } else {
        setCourses([]);
        setMessage("No courses found.");
      }
    } catch (error) {
      console.log(error);
      setCourses([]);
      setMessage("Unable to connect to the backend.");
    }
  }

  function clearFilters() {
    setSearch("");
    setDepartmentId("");
    setModality("");
    setUnits("");
    setLevel("");
    setCourseCategory("");
    setGeAreaId("");
    setCourses([]);
    setExpandedCourseIds([]);
    setSelectedSectionId("");
    setSelectedBuildingId("");
    setMessage("");
    setCartMessage("");
  }

  function toggleCourse(courseId) {
    const id = String(courseId);

    if (expandedCourseIds.includes(id)) {
      setExpandedCourseIds(
        expandedCourseIds.filter(function (savedId) {
          return savedId !== id;
        }),
      );
    } else {
      setExpandedCourseIds(expandedCourseIds.concat(id));
    }
  }

  function selectSection(section) {
    const sectionId = String(section.classSectionId);
    setCartMessage("");

    if (selectedSectionId === sectionId) {
      setSelectedSectionId("");
      setSelectedBuildingId("");
      return;
    }

    setSelectedSectionId(sectionId);

    if (section.location && section.location.mapElementId) {
      setSelectedBuildingId(section.location.mapElementId);
    } else {
      setSelectedBuildingId("");
    }
  }

  function hoverSection(section) {
    if (section.location && section.location.mapElementId) {
      setHoveredBuildingId(section.location.mapElementId);
    }
  }

  function leaveSection() {
    setHoveredBuildingId("");
  }

  function getBuildingName(building) {
    if (!building) {
      return "Not listed";
    }

    return (
      building.buildingName ||
      building.building_name ||
      building.name ||
      "Not listed"
    );
  }

  function getBuildingTypesFromBuilding(building) {
    if (!building) {
      return [];
    }

    return (
      building.buildingTypes || building.building_types || building.types || []
    );
  }

  function formatBuildingType(buildingType) {
    if (!buildingType) {
      return "Not listed";
    }

    if (Array.isArray(buildingType)) {
      if (buildingType.length === 0) {
        return "Not listed";
      }

      return buildingType
        .map(function (type) {
          return formatBuildingType(type);
        })
        .join(", ");
    }

    return String(buildingType)
      .replaceAll("_", " ")
      .split(" ")
      .map(function (word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  }

  function getMeetingDays(section) {
    if (section.meetingDays && section.meetingDays.length > 0) {
      return section.meetingDays.join(", ");
    }

    return "Not listed";
  }

  function getSelectedData() {
    for (let i = 0; i < courses.length; i++) {
      const course = courses[i];

      for (let j = 0; j < course.sections.length; j++) {
        const section = course.sections[j];

        if (selectedSectionId === String(section.classSectionId)) {
          return {
            selectedCourse: course,
            selectedSection: section,
          };
        }
      }
    }

    return {
      selectedCourse: null,
      selectedSection: null,
    };
  }

  async function addSelectedSectionToCart() {
    const selectedData = getSelectedData();

    if (!selectedData.selectedCourse || !selectedData.selectedSection) {
      setCartMessage("Select a section first.");
      return;
    }

    const token = localStorage.getItem("authToken") || "";

    if (!token) {
      setCartMessage("Log in as a student before adding a class to the cart.");
      return;
    }

    setCartAdding(true);
    setCartMessage("");

    try {
      const response = await authFetch("/api/cart/sections", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          classSectionId: selectedData.selectedSection.classSectionId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const firstError = data.validation?.errors?.[0]?.message;

        throw new Error(
          firstError || data.message || "Unable to add this class to the cart.",
        );
      }

      setCartMessage(
        `${selectedData.selectedCourse.subjectCode} ${selectedData.selectedCourse.courseNumber} Section ${selectedData.selectedSection.sectionNumber} added to cart. Open Schedule to view it.`,
      );
    } catch (error) {
      setCartMessage(error.message || "Unable to add this class to the cart.");
    } finally {
      setCartAdding(false);
    }
  }

  function displayMapBuildingInfo() {
    return (
      <>
        <h3>Building Information</h3>

        {mapHoveredBuilding ? (
          <>
            <p>
              <strong>Name</strong>
              <br />
              {getBuildingName(mapHoveredBuilding)}
            </p>

            <p>
              <strong>Building Type</strong>
              <br />
              {formatBuildingType(
                getBuildingTypesFromBuilding(mapHoveredBuilding),
              )}
            </p>
          </>
        ) : (
          <p className="muted-text">
            Hover over a mapped building to view its name and type.
          </p>
        )}
      </>
    );
  }

  function displaySections(course) {
    if (course.sections.length === 0) {
      return <p>No sections currently available.</p>;
    }

    return course.sections.map(function (section) {
      let sectionClass = "section-detail";

      if (selectedSectionId === String(section.classSectionId)) {
        sectionClass = "section-detail selected-section";
      }

      return (
        <div
          className={sectionClass}
          key={section.classSectionId}
          onClick={function () {
            selectSection(section);
          }}
          onMouseEnter={function () {
            hoverSection(section);
          }}
          onMouseLeave={function () {
            leaveSection();
          }}
        >
          <div className="section-top-row">
            <h3>Section {section.sectionNumber}</h3>
            <span className="status-pill">{section.status}</span>
          </div>

          <div className="section-info-grid">
            <p>
              <strong>Seats</strong>
              {section.availableSeats} open / {section.capacity} total
            </p>

            <p>
              <strong>Enrolled</strong>
              {section.enrolledCount}
            </p>

            <p>
              <strong>Days</strong>
              {getMeetingDays(section)}
            </p>

            <p>
              <strong>Time</strong>
              {section.meetingStartTime || "TBA"} -{" "}
              {section.meetingEndTime || "TBA"}
            </p>

            <p>
              <strong>Location</strong>
              {section.location
                ? `${section.location.buildingName} ${
                    section.location.roomNumber || ""
                  }`
                : "Not listed"}
            </p>

            <p>
              <strong>Modality</strong>
              {section.modality || "Not listed"}
            </p>
          </div>
        </div>
      );
    });
  }

  const selectedData = getSelectedData();
  const selectedSemester = semesters.find((semester) => String(semester.semesterId) === semesterId);
  const semesterIsActive = Boolean(selectedSemester?.isActive);

  return (
    <main className="course-search-page">
      <div className="course-search-layout">
        <section className="course-left-panel">
          <div className="panel-heading">
            <h2>Course Search</h2>
          </div>

          <form onSubmit={handleSearch} className="course-search-form">
            <label className="course-semester-picker">
              <span>Semester</span>
              <select value={semesterId} required onChange={(event) => {
                setSemesterId(event.target.value);
                setCourses([]);
                setSelectedSectionId("");
                setCartMessage("");
              }}>
                <option value="">Select a semester</option>
                {semesters.map((semester) => <option value={semester.semesterId} key={semester.semesterId}>
                  {semester.type} {semester.year}
                </option>)}
              </select>
              {selectedSemester && !semesterIsActive && <small>This semester is view-only. Only the current semester can be changed.</small>}
            </label>
            <div className="course-search-row">
              <input
                type="text"
                value={search}
                onChange={function (event) {
                  setSearch(event.target.value);
                }}
                placeholder="Search subject, course number, title, or department..."
              />
            </div>

            <div className="course-search-actions">
              <button
                type="button"
                className={
                  filtersOpen
                    ? "filter-toggle-button filter-toggle-button-open"
                    : "filter-toggle-button"
                }
                onClick={function () {
                  setFiltersOpen(!filtersOpen);
                }}
                aria-expanded={filtersOpen}
                aria-controls="course-filter-panel"
              >
                Filters
                {activeFilterCount > 0 && ` (${activeFilterCount})`}
                <span>{filtersOpen ? "▲" : "▼"}</span>
              </button>

              <button
                type="submit"
                className="course-search-button"
                disabled={searchCoolingDown}
              >
                {searchCoolingDown ? "Please wait..." : "Search"}
              </button>
            </div>

            {filtersOpen && (
              <div id="course-filter-panel" className="course-filter-panel">
                <div className="course-filter-grid">
                  <label>
                    <span>Department</span>

                    <select
                      value={departmentId}
                      onChange={function (event) {
                        setDepartmentId(event.target.value);
                      }}
                    >
                      <option value="">All departments</option>

                      {departments.map((department) => (
                        <option
                          value={department.departmentId}
                          key={department.departmentId}
                        >
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Modality</span>

                    <select
                      value={modality}
                      onChange={function (event) {
                        setModality(event.target.value);
                      }}
                    >
                      <option value="">Any modality</option>
                      <option value="in-person">In person</option>
                      <option value="online">Online</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </label>

                  <label>
                    <span>Units</span>

                    <select
                      value={units}
                      onChange={function (event) {
                        setUnits(event.target.value);
                      }}
                    >
                      <option value="">Any units</option>

                      {[1, 2, 3, 4, 5, 6].map((value) => (
                        <option value={value} key={value}>
                          {value} units
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Course level</span>

                    <select
                      value={level}
                      onChange={function (event) {
                        setLevel(event.target.value);
                      }}
                    >
                      <option value="">Any level</option>
                      <option value="lower_division">Lower division</option>
                      <option value="upper_division">Upper division</option>
                      <option value="graduate">Graduate</option>
                    </select>
                  </label>

                  <label>
                    <span>Course category</span>
                    <select value={courseCategory} onChange={(event) => {
                      setCourseCategory(event.target.value);
                      if (event.target.value !== "ge") setGeAreaId("");
                    }}>
                      <option value="">Any category</option>
                      <option value="major-core">Major Core</option>
                      <option value="major-elective">Major Elective</option>
                      <option value="ge">General Education</option>
                    </select>
                  </label>

                  <label>
                    <span>GE Area</span>
                    <select value={geAreaId} disabled={courseCategory !== "ge"} onChange={(event) => setGeAreaId(event.target.value)}>
                      <option value="">Any GE area</option>
                      {geAreas.map((area) => <option key={area.geAreaId} value={area.geAreaId}>Area {area.code} — {area.name}</option>)}
                    </select>
                  </label>

                  <button
                    type="button"
                    className="clear-filter-button"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            )}
          </form>

          <div className="course-secondary-buttons">
            <button
              type="button"
              onClick={function () {
                navigate("/degree-progress");
              }}
            >
              Degree Progress
            </button>

            <button
              type="button"
              onClick={function () {
                navigate("/degree-planner");
              }}
            >
              Degree Planner
            </button>
          </div>

          <div className="course-results-scroll">
            {message === "Loading..." && <p className="muted-text">{message}</p>}
            {message && message !== "Loading..." && (
              <div className="course-search-notice" role="alert">
                <p>{message}</p>
                <button type="button" onClick={() => setMessage("")}>OK</button>
              </div>
            )}

            {courses.length > 0 && (
              <p className="course-result-count">
                Showing {courses.length} course result
                {courses.length === 1 ? "" : "s"}
              </p>
            )}

            {courses.map(function (course) {
              const courseId = String(course.courseId);
              const isExpanded = expandedCourseIds.includes(courseId);
              const isPlannerCourse = plannerCourseIds.has(String(course.courseId));
              let arrow = "▼";

              if (isExpanded) {
                arrow = "▲";
              }

              return (
                <section
                  className={
                    (isExpanded ? "course-card course-card-open" : "course-card") +
                    (isPlannerCourse ? " planner-course-highlight" : "")
                  }
                  key={course.courseId}
                >
                  <div className="course-card-header">
                    <div className="course-card-main">
                      <h2>
                        {course.subjectCode} {course.courseNumber}:{" "}
                        {course.title}
                      </h2>

                      <div className="course-tags">
                        <span className="course-tag">
                          Units: {course.units}
                        </span>

                        <span className="course-tag">
                          {course.category === "ge" ? `GE ${course.geAreas.join(", ")}`
                            : course.category === "major-elective" ? "Major Elective" : "Major Core"}
                        </span>

                        {isPlannerCourse && (
                          <span className="course-tag planner-course-tag">
                            In Degree Planner
                          </span>
                        )}

                        {course.department?.name && (
                          <span className="course-tag">
                            {course.department.name}
                          </span>
                        )}

                        {course.level && (
                          <span className="course-tag">
                            {course.level.replaceAll("-", " ")}
                          </span>
                        )}

                        <span className="course-tag">
                          {course.sections.length} section
                          {course.sections.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="arrow-button"
                      onClick={function () {
                        toggleCourse(course.courseId);
                      }}
                    >
                      {arrow}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="course-expanded">
                      <p className="course-description">
                        {course.description}
                      </p>
                      {displaySections(course)}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </section>

        <aside className="campus-map-panel">
          <div className="panel-heading">
            <h2>Campus Map</h2>

            <button
              type="button"
              className="expand-map-button"
              onClick={function () {
                setMapExpanded(true);
              }}
            >
              Expand Map
            </button>
          </div>

          <CampusMap
            highlightedBuildingIds={highlightedBuildingIds}
            interactiveBuildings={buildings}
            onBuildingHover={handleBuildingHover}
            onBuildingLeave={handleBuildingLeave}
          />

          <div className="map-details-row">
            <div className="map-building-info-card">
              {displayMapBuildingInfo()}
              {buildingMessage && (
                <p className="muted-text">{buildingMessage}</p>
              )}
            </div>

            <div className="selected-location-card">
              <h3>Selected Location</h3>

              {selectedData.selectedCourse && selectedData.selectedSection ? (
                <>
                  <p>
                    <strong>
                      {selectedData.selectedCourse.subjectCode}{" "}
                      {selectedData.selectedCourse.courseNumber}
                    </strong>
                  </p>

                  <p>Section {selectedData.selectedSection.sectionNumber}</p>

                  <p>
                    {selectedData.selectedSection.location
                      ? `${selectedData.selectedSection.location.buildingName} ${
                          selectedData.selectedSection.location.roomNumber || ""
                        }`
                      : "No location listed for this section."}
                  </p>
                </>
              ) : (
                <p className="muted-text">
                  Click a section to view its selected location.
                </p>
              )}
            </div>
          </div>

          {canAddToCart && (
            <>
              <button
                type="button"
                className="add-cart-button"
                onClick={addSelectedSectionToCart}
                disabled={cartAdding || !semesterIsActive}
              >
                {cartAdding ? "Adding..." : semesterIsActive ? "Add to Cart" : "View only"}
              </button>

              {cartMessage && <p className="cart-message">{cartMessage}</p>}
            </>
          )}
        </aside>
      </div>

      {mapExpanded && (
        <div
          className="map-modal-backdrop"
          onClick={function () {
            setMapExpanded(false);
          }}
        >
          <div
            className="map-modal-content"
            onClick={function (event) {
              event.stopPropagation();
            }}
          >
            <div className="map-modal-header">
              <h2>Campus Map</h2>

              <button
                type="button"
                className="map-modal-close"
                onClick={function () {
                  setMapExpanded(false);
                }}
              >
                ×
              </button>
            </div>

            <CampusMap
              highlightedBuildingIds={highlightedBuildingIds}
              interactiveBuildings={buildings}
              onBuildingHover={handleBuildingHover}
              onBuildingLeave={handleBuildingLeave}
            />

            <div className="map-building-info-card">
              {displayMapBuildingInfo()}
              {buildingMessage && (
                <p className="muted-text">{buildingMessage}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default CourseSearch;
