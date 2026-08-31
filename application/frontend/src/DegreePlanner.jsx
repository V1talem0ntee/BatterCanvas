import "./App.css";
import "./DegreePlanner.css";
import { useEffect, useState } from "react";
import { authFetch } from "./AuthContext.jsx";

function createTermsForYear(yearNumber) {
    return [
        {
            id: `fall-${yearNumber}`,
            name: "Fall",
            optional: false,
            courses: [],
        },
        {
            id: `spring-${yearNumber}`,
            name: "Spring",
            optional: false,
            courses: [],
        },
    ];
}

function createInitialYears() {
    return [1, 2, 3, 4].map((yearNumber) => {
        return {
            id: yearNumber,
            name: `Year ${yearNumber}`,
            terms: createTermsForYear(yearNumber),
        };
    });
}

function getTermOrder(termName) {
    const termOrder = {
        Fall: 1,
        Winter: 2,
        Spring: 3,
        Summer: 4,
    };

    return termOrder[termName] || 99;
}
function formatUnits(units) {
    if (Number(units) === 1) {
        return "1 unit";
    }

    return `${Number(units)} units`;
}

function buildYearsFromSavedTerms(savedTerms, courseCatalog) {
    if (!savedTerms || savedTerms.length === 0) {
        return createInitialYears();
    }

    const highestYear = Math.max(
        4,
        ...savedTerms.map((term) => {
            return Number(term.yearNumber);
        })
    );

    const years = [];

    for (let yearNumber = 1; yearNumber <= highestYear; yearNumber++) {
        const termsForYear = savedTerms
            .filter((term) => {
                return Number(term.yearNumber) === yearNumber;
            })
            .sort((firstTerm, secondTerm) => {
                return getTermOrder(firstTerm.termName) -
                    getTermOrder(secondTerm.termName);
            })
            .map((term) => {
                return {
                    id: `${term.termName.toLowerCase()}-${yearNumber}`,
                    planTermId: term.planTermId,
                    name: term.termName,
                    optional:
                        term.termName === "Winter" ||
                        term.termName === "Summer",
                    courses: (term.courses || []).map((savedCourse) => {
                        const catalogCourse = courseCatalog.find((course) => {
                            return course.courseId === savedCourse.courseId;
                        });

                        if (catalogCourse) {
                            return {
                                ...catalogCourse,
                                planCourseId: savedCourse.planCourseId,
                            };
                        }

                        return {
                            id: String(savedCourse.courseId),
                            courseId: Number(savedCourse.courseId),
                            code:
                                `${savedCourse.subjectCode} ` +
                                `${savedCourse.courseNumber}`,
                            name: savedCourse.title,
                            description: savedCourse.description,
                            category: "Major",
                            requirement: "Saved Degree Plan Course",
                            requirementType: "",
                            units: Number(savedCourse.units),
                            suggested: false,
                            planCourseId: savedCourse.planCourseId,
                        };
                    }),
                };
            });

        years.push({
            id: yearNumber,
            name: `Year ${yearNumber}`,
            terms: termsForYear,
        });
    }

    return years;
}

function DraggableCourseCard({
    course,
    handleDragStart,
    handleDragEnd,
    showSuggestedLabel,
}) {
    return (
        <article
            className={
                showSuggestedLabel
                    ? "catalog-course-card suggested-course"
                    : "catalog-course-card"
            }
            draggable
            onDragStart={(event) => {
                handleDragStart(event, course.id);
            }}
            onDragEnd={handleDragEnd}
        >
            <div className="catalog-course-top">
                <span
                    className={
                        "course-category-badge " +
                        course.category.toLowerCase()
                    }
                >
                    {course.category}
                </span>

                {showSuggestedLabel && (
                    <span className="suggested-course-label">
                        Suggested Next
                    </span>
                )}
            </div>

            <strong>{course.code}</strong>

            <span className="catalog-course-name">
                {course.name}
            </span>

            <small>{course.requirement}</small>
            <small>{formatUnits(course.units)}</small>
        </article>
    );
}

function CourseGroup({
    title,
    countText,
    courses,
    emptyText,
    open,
    handleDragStart,
    handleDragEnd,
    showSuggestedLabel,
    children,
}) {
    return (
        <details className="catalog-section" open={open}>
            <summary className="catalog-section-summary">
                <span className="catalog-section-title">
                    {title}
                </span>

                <span className="catalog-section-count">
                    {countText}
                </span>
            </summary>

            <div className="catalog-section-content">
                {children}

                {courses.length > 0 ? (
                    courses.map((course) => (
                        <DraggableCourseCard
                            key={course.id}
                            course={course}
                            handleDragStart={handleDragStart}
                            handleDragEnd={handleDragEnd}
                            showSuggestedLabel={showSuggestedLabel}
                        />
                    ))
                ) : (
                    <p className="empty-catalog-message">
                        {emptyText}
                    </p>
                )}
            </div>
        </details>
    );
}

function DegreePlanner() {
    const [degreeProgram, setDegreeProgram] = useState(null);
    const [requirements, setRequirements] = useState([]);
    const [courseCatalog, setCourseCatalog] = useState([]);
    const [plannerLoading, setPlannerLoading] = useState(true);
    const [plannerError, setPlannerError] = useState("");
    const [years, setYears] = useState(createInitialYears);
    const [selectedTerm, setSelectedTerm] = useState("Summer");
    const [targetYear, setTargetYear] = useState(1);
    const [draggedCourseId, setDraggedCourseId] = useState(null);
    const [activeDropZone, setActiveDropZone] = useState("");

    useEffect(function () {
        async function loadDegreePlanner() {
            setPlannerLoading(true);
            setPlannerError("");

            try {
                const response = await authFetch(
                    "/api/degree-planner"
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                        "Unable to load the degree planner."
                    );
                }

                const databaseCourses = (data.courses || []).map(
                    (course) => {
                        return {
                            id: String(course.courseId),
                            courseId: Number(course.courseId),
                            code:
                                `${course.subjectCode} ` +
                                `${course.courseNumber}`,
                            name: course.title,
                            description: course.description,
                            category: course.category,
                            requirement: course.requirement,
                            requirementType:
                                course.requirementType,
                            units: Number(course.units),
                            suggested: Boolean(course.suggested),
                        };
                    }
                );

                setDegreeProgram(data.degreeProgram || null);
                setRequirements(data.requirements || []);
                setCourseCatalog(databaseCourses);
                setYears(
                    buildYearsFromSavedTerms(
                        data.savedTerms || [],
                        databaseCourses
                    )
                );
            } catch (error) {
                setDegreeProgram(null);
                setRequirements([]);
                setCourseCatalog([]);
                setPlannerError(
                    error.message ||
                    "Unable to load the degree planner."
                );
            } finally {
                setPlannerLoading(false);
            }
        }

        loadDegreePlanner();
    }, []);

    const roadmapName = degreeProgram
        ? `${degreeProgram.majorName} ` +
        `${degreeProgram.degreeType} — ` +
        `${degreeProgram.catalogYear}`
        : "";

    const selectedYear = years.find((year) => {
        return year.id === Number(targetYear);
    });

    const selectedTermId =
        `${selectedTerm.toLowerCase()}-${targetYear}`;

    const semesterAlreadyExists = selectedYear?.terms.some((term) => {
        return term.id === selectedTermId;
    });

    const allPlannedCourses = years.flatMap((year) => {
        return year.terms.flatMap((term) => {
            return term.courses;
        });
    });

    const plannedCourseIds = new Set(
        allPlannedCourses.map((course) => {
            return course.id;
        })
    );

    const availableCourses = courseCatalog.filter((course) => {
        return !plannedCourseIds.has(course.id);
    });

    const suggestedCourses = availableCourses
        .filter((course) => {
            return course.suggested;
        })
        .slice(0, 3);

    const suggestedCourseIds = new Set(
        suggestedCourses.map((course) => {
            return course.id;
        })
    );

    const majorCourses = availableCourses.filter((course) => {
        return (
            course.category === "Major" &&
            !suggestedCourseIds.has(course.id)
        );
    });

    const geCourses = availableCourses.filter((course) => {
        return (
            course.category === "GE" &&
            !suggestedCourseIds.has(course.id)
        );
    });

    const electiveCourses = availableCourses.filter((course) => {
        return (
            course.category === "Elective" &&
            !suggestedCourseIds.has(course.id)
        );
    });

    const electiveRequirement = requirements.find((requirement) => {
        return requirement.type === "major-elective";
    });

    const electiveUnitsRequired =
        Number(electiveRequirement?.requiredUnits) || 0;

    const plannedElectiveCourses = allPlannedCourses.filter(
        (course) => {
            return course.category === "Elective";
        }
    );

    const plannedElectiveUnits = plannedElectiveCourses.reduce(
        (total, course) => {
            return total + Number(course.units);
        },
        0
    );

    const remainingElectiveUnits = Math.max(
        electiveUnitsRequired - plannedElectiveUnits,
        0
    );

    const electiveRequirementMet =
        electiveUnitsRequired > 0 &&
        plannedElectiveUnits >= electiveUnitsRequired;

    async function addSemester() {
        const yearNumber = Number(targetYear);

        try {
            const response = await authFetch(
                "/api/degree-planner/terms",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        yearNumber,
                        termName: selectedTerm,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Unable to add semester."
                );
            }

            const newSemester = {
                id: `${selectedTerm.toLowerCase()}-${yearNumber}`,
                planTermId: data.term.planTermId,
                name: selectedTerm,
                optional:
                    selectedTerm === "Winter" ||
                    selectedTerm === "Summer",
                courses: [],
            };

            setYears((currentYears) => {
                return currentYears.map((year) => {
                    if (year.id !== yearNumber) {
                        return year;
                    }

                    const alreadyExists = year.terms.some((term) => {
                        return term.id === newSemester.id;
                    });

                    if (alreadyExists) {
                        return year;
                    }

                    return {
                        ...year,
                        terms: [...year.terms, newSemester],
                    };
                });
            });
        } catch (error) {
            setPlannerError(error.message || "Unable to add semester.");
        }
    }

    async function removeSemester(yearId, termId) {
        const currentYear = years.find((year) => {
            return year.id === yearId;
        });

        const currentTerm = currentYear?.terms.find((term) => {
            return term.id === termId;
        });

        try {
            if (currentTerm?.planTermId) {
                const response = await authFetch(
                    `/api/degree-planner/terms/${currentTerm.planTermId}`,
                    {
                        method: "DELETE",
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message || "Unable to remove semester."
                    );
                }
            }

            setYears((currentYears) => {
                return currentYears.map((year) => {
                    if (year.id !== yearId) {
                        return year;
                    }

                    return {
                        ...year,
                        terms: year.terms.filter((term) => {
                            return term.id !== termId;
                        }),
                    };
                });
            });
        } catch (error) {
            setPlannerError(error.message || "Unable to remove semester.");
        }
    }

    /*Right now, addYear() creates Fall and Spring with two separate POST requests. 
    Since “Add Another Year” is one user action, there is a partial-save risk if one request succeeds and the other fails. 
    The frontend would not update unless both succeed, but the database could already contain one created term. 
    A better design would be one backend endpoint that creates both default terms in a single transaction. */
    async function addYear() {
        const lastYearNumber =
            years.length > 0
                ? Math.max(
                    ...years.map((year) => {
                        return year.id;
                    })
                )
                : 0;

        const newYearNumber = lastYearNumber + 1;

        try {
            const response = await authFetch(

                "/api/degree-planner/years",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ year: newYearNumber,}),
                }
            );

            const data = await response.json();

            if (!response.ok) {

                throw new Error(

                    data.message || "Unable to add year."

                );
            }

            const fallterm = data.year.terms.find((term) => {

                return term.termName === "Fall";

            });
            const springterm = data.year.terms.find((term) => {

                return term.termName === "Spring";

            });

            setYears((currentYears) => {
                return [
                    ...currentYears,
                    {
                        id: newYearNumber,
                        name: `Year ${newYearNumber}`,
                        terms: [
                            {
                                id: `fall-${newYearNumber}`,

                                planTermId: fallterm.newtermid,

                                name: "Fall",

                                optional: false,

                                courses: [],
                            },
                            {
                                id: `spring-${newYearNumber}`,

                                planTermId: springterm.newtermid,

                                name: "Spring",

                                optional: false,

                                courses: [],
                            },
                        ],
                    },
                ];
            });

            setTargetYear(newYearNumber);
        } catch (error) {
            setPlannerError(error.message || "Unable to add year.");
        }
    }

    /* removeLastYear() has the same issue as addYear() because it deletes multiple terms one request at a time. 
    Removing a year should also be handled as one transaction so the year is fully removed or not changed at all. */
    async function removeLastYear() {
        if (years.length <= 4) {
            return;
        }

        const lastYearId = Math.max(
            ...years.map((year) => {
                return year.id;
            })
        );

        const lastYear = years.find((year) => {
            return year.id === lastYearId;
        });

        try {
            for (const term of lastYear?.terms || []) {
                if (term.planTermId) {
                    const response = await authFetch(
                        `/api/degree-planner/terms/${term.planTermId}`,
                        {
                            method: "DELETE",
                        }
                    );

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(
                            data.message || "Unable to remove year."
                        );
                    }
                }
            }

            setYears((currentYears) => {
                return currentYears.filter((year) => {
                    return year.id !== lastYearId;
                });
            });

            if (Number(targetYear) === lastYearId) {
                setTargetYear(lastYearId - 1);
            }
        } catch (error) {
            setPlannerError(error.message || "Unable to remove year.");
        }
    }

    function handleDragStart(event, courseId) {
        setDraggedCourseId(courseId);

        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", courseId);
    }

    function handleDragEnd() {
        setDraggedCourseId(null);
        setActiveDropZone("");
    }

    function handleDragOver(event, yearId, termId) {
        event.preventDefault();

        event.dataTransfer.dropEffect = "move";
        setActiveDropZone(`${yearId}-${termId}`);
    }

    async function handleCourseDrop(event, yearId, termId) {
        event.preventDefault();

        const droppedCourseId =
            event.dataTransfer.getData("text/plain") ||
            draggedCourseId;

        const droppedCourse = courseCatalog.find((course) => {
            return course.id === droppedCourseId;
        });

        if (!droppedCourse) {
            return;
        }

        const destinationYear = years.find((year) => {
            return year.id === yearId;
        });

        const destinationTerm = destinationYear?.terms.find((term) => {
            return term.id === termId;
        });

        if (!destinationTerm) {
            return;
        }

        try {
            const response = await authFetch(
                "/api/degree-planner/courses",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        courseId: droppedCourse.courseId,
                        yearNumber: yearId,
                        termName: destinationTerm.name,
                        courseOrder: destinationTerm.courses.length,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Unable to save planned course."
                );
            }

            const savedCourse = {
                ...droppedCourse,
                planCourseId: data.plannedCourse.planCourseId,
            };

            setYears((currentYears) => {
                return currentYears.map((year) => {
                    return {
                        ...year,
                        terms: year.terms.map((term) => {
                            const isDestination =
                                year.id === yearId &&
                                term.id === termId;

                            const coursesWithoutMovedCourse =
                                term.courses.filter((course) => {
                                    return course.id !== droppedCourse.id;
                                });

                            if (!isDestination) {
                                return {
                                    ...term,
                                    courses: coursesWithoutMovedCourse,
                                };
                            }

                            return {
                                ...term,
                                courses: [
                                    ...coursesWithoutMovedCourse,
                                    savedCourse,
                                ],
                            };
                        }),
                    };
                });
            });

            setDraggedCourseId(null);
            setActiveDropZone("");
        } catch (error) {
            setPlannerError(error.message || "Unable to save planned course.");
            setDraggedCourseId(null);
            setActiveDropZone("");
        }
    }

    async function removeCourseFromSemester(
        yearId,
        termId,
        courseId
    ) {
        try {
            const response = await authFetch(
                `/api/degree-planner/courses/${courseId}`,
                {
                    method: "DELETE",
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Unable to remove planned course."
                );
            }

            setYears((currentYears) => {
                return currentYears.map((year) => {
                    if (year.id !== yearId) {
                        return year;
                    }

                    return {
                        ...year,
                        terms: year.terms.map((term) => {
                            if (term.id !== termId) {
                                return term;
                            }

                            return {
                                ...term,
                                courses: term.courses.filter(
                                    (course) => {
                                        return course.id !== courseId;
                                    }
                                ),
                            };
                        }),
                    };
                });
            });
        } catch (error) {
            setPlannerError(error.message || "Unable to remove planned course.");
        }
    }

    return (
        <main className="degree-planner-page">
            <div className="degree-planner-container">
                <h1>Degree Planner</h1>

                <section className="planner-toolbar">
                    <div className="planner-field roadmap-selector">
                        <label htmlFor="roadmap">
                            Degree Roadmap
                        </label>

                        <select
                            id="roadmap"
                            value={roadmapName}
                            disabled={!roadmapName}
                            onChange={() => { }}
                        >
                            {!roadmapName && (
                                <option value="">
                                    Loading Degree Roadmap
                                </option>
                            )}

                            {roadmapName && (
                                <option value={roadmapName}>
                                    {roadmapName}
                                </option>
                            )}
                        </select>
                    </div>

                    <div className="semester-controls">
                        <div className="planner-field">
                            <label htmlFor="selectedTerm">
                                Semester
                            </label>

                            <select
                                id="selectedTerm"
                                value={selectedTerm}
                                onChange={(event) => {
                                    setSelectedTerm(
                                        event.target.value
                                    );
                                }}
                            >
                                <option value="Fall">Fall</option>
                                <option value="Winter">
                                    Winter
                                </option>
                                <option value="Spring">
                                    Spring
                                </option>
                                <option value="Summer">
                                    Summer
                                </option>
                            </select>
                        </div>

                        <div className="planner-field">
                            <label htmlFor="targetYear">
                                Add to Year
                            </label>

                            <select
                                id="targetYear"
                                value={targetYear}
                                onChange={(event) => {
                                    setTargetYear(
                                        Number(event.target.value)
                                    );
                                }}
                            >
                                {years.map((year) => (
                                    <option
                                        key={year.id}
                                        value={year.id}
                                    >
                                        {year.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="button"
                            className="add-term-button"
                            onClick={addSemester}
                            disabled={semesterAlreadyExists}
                        >
                            {semesterAlreadyExists
                                ? "Already Added"
                                : "Add Semester"}
                        </button>
                    </div>
                </section>

                {plannerError && (
                    <div
                        className="course-search-notice"
                        role="alert"
                    >
                        <p>{plannerError}</p>
                    </div>
                )}

                <div className="degree-planner-layout">
                    <aside className="course-catalog-panel">
                        <div className="catalog-heading">
                            <h2>Remaining Courses</h2>

                            <p>
                                Drag a course into a semester to add
                                it to your plan.
                            </p>
                        </div>

                        {plannerLoading ? (
                            <p className="empty-catalog-message">
                                Loading degree requirements...
                            </p>
                        ) : (
                            <>
                                <CourseGroup
                                    title="Suggested Next"
                                    countText={
                                        suggestedCourses.length
                                    }
                                    courses={suggestedCourses}
                                    emptyText="No suggested courses are currently available."
                                    open
                                    handleDragStart={
                                        handleDragStart
                                    }
                                    handleDragEnd={handleDragEnd}
                                    showSuggestedLabel
                                />

                                <CourseGroup
                                    title="Required Major Courses"
                                    countText={
                                        `${majorCourses.length} ` +
                                        "remaining"
                                    }
                                    courses={majorCourses}
                                    emptyText="All required major courses are planned."
                                    open
                                    handleDragStart={
                                        handleDragStart
                                    }
                                    handleDragEnd={handleDragEnd}
                                />

                                <CourseGroup
                                    title="General Education"
                                    countText={
                                        `${geCourses.length} ` +
                                        "remaining"
                                    }
                                    courses={geCourses}
                                    emptyText="All listed GE courses are planned."
                                    handleDragStart={
                                        handleDragStart
                                    }
                                    handleDragEnd={handleDragEnd}
                                />

                                <CourseGroup
                                    title="Major Elective Options"
                                    countText={
                                        `${remainingElectiveUnits} ` +
                                        "units remaining"
                                    }
                                    courses={electiveCourses}
                                    emptyText="All listed electives are planned."
                                    handleDragStart={
                                        handleDragStart
                                    }
                                    handleDragEnd={handleDragEnd}
                                >
                                    <p className="elective-description">
                                        Complete{" "}
                                        {electiveUnitsRequired} total
                                        elective units for this
                                        requirement.
                                    </p>

                                    <div
                                        className={
                                            electiveRequirementMet
                                                ? "elective-progress complete"
                                                : "elective-progress"
                                        }
                                    >
                                        <span>
                                            Planned elective units:{" "}
                                            <strong>
                                                {
                                                    plannedElectiveUnits
                                                }
                                                /
                                                {
                                                    electiveUnitsRequired
                                                }
                                            </strong>
                                        </span>

                                        <strong className="elective-status">
                                            {electiveRequirementMet
                                                ? "Elective requirement satisfied"
                                                : "Elective requirement in progress"}
                                        </strong>
                                    </div>
                                </CourseGroup>
                            </>
                        )}
                    </aside>

                    <section className="planner-years">
                        {years.map((year) => {
                            const orderedTerms = [
                                ...year.terms,
                            ].sort(
                                (
                                    firstTerm,
                                    secondTerm
                                ) => {
                                    return (
                                        getTermOrder(
                                            firstTerm.name
                                        ) -
                                        getTermOrder(
                                            secondTerm.name
                                        )
                                    );
                                }
                            );

                            return (
                                <section
                                    className="planner-year-card"
                                    key={year.id}
                                >
                                    <h2 className="planner-year-heading">
                                        {year.name}
                                    </h2>

                                    {orderedTerms.length === 0 ? (
                                        <div className="empty-year-message">
                                            <p>
                                                No semesters have
                                                been added to this
                                                year.
                                            </p>

                                            <span>
                                                Use the toolbar above
                                                to add one.
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="planner-term-grid">
                                            {orderedTerms.map(
                                                (term) => {
                                                    const dropZoneId =
                                                        `${year.id}-` +
                                                        `${term.id}`;

                                                    return (
                                                        <div
                                                            className="planner-term-card"
                                                            key={
                                                                term.id
                                                            }
                                                        >
                                                            <div className="planner-term-header">
                                                                <div>
                                                                    <h3>
                                                                        {
                                                                            term.name
                                                                        }
                                                                    </h3>

                                                                    {term.optional && (
                                                                        <span className="optional-term-label">
                                                                            Optional
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    className="remove-term-button"
                                                                    onClick={() => {
                                                                        removeSemester(
                                                                            year.id,
                                                                            term.id
                                                                        );
                                                                    }}
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>

                                                            <div
                                                                className={
                                                                    activeDropZone ===
                                                                        dropZoneId
                                                                        ? "term-drop-zone active"
                                                                        : "term-drop-zone"
                                                                }
                                                                onDragOver={(
                                                                    event
                                                                ) => {
                                                                    handleDragOver(
                                                                        event,
                                                                        year.id,
                                                                        term.id
                                                                    );
                                                                }}
                                                                onDrop={(
                                                                    event
                                                                ) => {
                                                                    handleCourseDrop(
                                                                        event,
                                                                        year.id,
                                                                        term.id
                                                                    );
                                                                }}
                                                            >
                                                                {term
                                                                    .courses
                                                                    .length ===
                                                                    0 ? (
                                                                    <div className="empty-term-area">
                                                                        <p>
                                                                            Drop
                                                                            courses
                                                                            here
                                                                        </p>

                                                                        <span>
                                                                            Drag
                                                                            a
                                                                            course
                                                                            from
                                                                            the
                                                                            left
                                                                            panel.
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="planned-course-list">
                                                                        {term.courses.map(
                                                                            (
                                                                                course
                                                                            ) => (
                                                                                <div
                                                                                    className="planned-course-card"
                                                                                    key={
                                                                                        course.id
                                                                                    }
                                                                                    draggable
                                                                                    onDragStart={(event) => {
                                                                                        handleDragStart(
                                                                                            event,
                                                                                            course.id
                                                                                        );
                                                                                    }}
                                                                                    onDragEnd={
                                                                                        handleDragEnd
                                                                                    }
                                                                                >
                                                                                    <div className="planned-course-information">
                                                                                        <span
                                                                                            className={
                                                                                                "course-category-badge " +
                                                                                                course.category.toLowerCase()
                                                                                            }
                                                                                        >
                                                                                            {
                                                                                                course.category
                                                                                            }
                                                                                        </span>

                                                                                        <strong>
                                                                                            {
                                                                                                course.code
                                                                                            }
                                                                                        </strong>

                                                                                        <span>
                                                                                            {
                                                                                                course.name
                                                                                            }
                                                                                        </span>

                                                                                        <small>
                                                                                            {formatUnits(
                                                                                                course.units
                                                                                            )}
                                                                                        </small>
                                                                                    </div>

                                                                                    <button
                                                                                        type="button"
                                                                                        className="remove-course-button"
                                                                                        aria-label={
                                                                                            `Remove ` +
                                                                                            course.code
                                                                                        }
                                                                                        onClick={() => {
                                                                                            removeCourseFromSemester(
                                                                                                year.id,
                                                                                                term.id,
                                                                                                course.id
                                                                                            );
                                                                                        }}
                                                                                    >
                                                                                        ×
                                                                                    </button>
                                                                                </div>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                            )}
                                        </div>
                                    )}
                                </section>
                            );
                        })}

                        <div className="year-control-buttons">
                            {years.length > 4 && (
                                <button
                                    type="button"
                                    className="remove-year-button"
                                    onClick={removeLastYear}
                                >
                                    Remove Year{" "}
                                    {
                                        years[
                                            years.length - 1
                                        ].id
                                    }
                                </button>
                            )}

                            <button
                                type="button"
                                className="add-year-button"
                                onClick={addYear}
                                disabled={years.length >= 8}
                            >
                                <span>+</span>
                                {years.length >= 8
                                    ? "Maximum 8 Years"
                                    : "Add Another Year"}
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}

export default DegreePlanner;
