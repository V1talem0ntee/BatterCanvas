import { memo, useEffect, useRef } from "react";
import "./CampusMap.css";
import mapImage from "./assets/sfsu-campus-map.png";
import mapSvg from "./assets/campus-map-vectors.svg?raw";

const CampusMap = memo(function CampusMap({
  highlightedBuildingIds = [],
  interactiveBuildings = [],
  onBuildingHover = function () {},
  onBuildingLeave = function () {},
}) {
  const mapRef = useRef(null);
  const overlayRef = useRef(null);
  const hoveredBuildingIdRef = useRef("");
  const onBuildingHoverRef = useRef(onBuildingHover);
  const onBuildingLeaveRef = useRef(onBuildingLeave);

  useEffect(
    function () {
      onBuildingHoverRef.current = onBuildingHover;
      onBuildingLeaveRef.current = onBuildingLeave;
    },
    [onBuildingHover, onBuildingLeave]
  );

  useEffect(function () {
    if (overlayRef.current) {
      overlayRef.current.innerHTML = mapSvg;
    }
  }, []);

  function getSafeId(id) {
    if (window.CSS && window.CSS.escape) {
      return window.CSS.escape(id);
    }

    return id;
  }

  function clearHoveredBuilding() {
    const mapElement = mapRef.current;

    if (!mapElement) {
      return;
    }

    const hoveredBuildings = mapElement.querySelectorAll(".hovered-building");

    hoveredBuildings.forEach(function (building) {
      building.classList.remove("hovered-building");
    });

    hoveredBuildingIdRef.current = "";
    onBuildingLeaveRef.current();
  }

  useEffect(
    function () {
      const mapElement = mapRef.current;

      if (!mapElement) {
        return;
      }

      const oldSelectedBuildings = mapElement.querySelectorAll(".selected-building");

      oldSelectedBuildings.forEach(function (building) {
        building.classList.remove("selected-building");
      });

      highlightedBuildingIds.forEach(function (buildingId) {
        if (!buildingId) {
          return;
        }

        const mapShape = mapElement.querySelector("#" + getSafeId(buildingId));

        if (mapShape) {
          mapShape.classList.add("selected-building");
        }
      });
    },
    [highlightedBuildingIds]
  );

  useEffect(
    function () {
      const mapElement = mapRef.current;

      if (!mapElement) {
        return;
      }

      const buildingByMapId = {};

      interactiveBuildings.forEach(function (building) {
        const mapElementId = building.mapElementId || building.map_element_id;

        if (!mapElementId) {
          return;
        }

        buildingByMapId[mapElementId] = building;

        const mapShape = mapElement.querySelector("#" + getSafeId(mapElementId));

        if (!mapShape) {
          console.warn(
            `Building "${building.buildingName || building.building_name}" (ID: ${mapElementId}) not found in SVG.`
          );
          return;
        }

        mapShape.classList.add("interactive-building");
        mapShape.dataset.mapElementId = mapElementId;
      });

      function findMapElementId(target) {
        if (!target || !target.closest) {
          return "";
        }

        const buildingElement = target.closest("[data-map-element-id]");

        if (!buildingElement || !mapElement.contains(buildingElement)) {
          return "";
        }

        return buildingElement.dataset.mapElementId || "";
      }

      function handlePointerMove(event) {
        const mapElementId = findMapElementId(event.target);

        if (!mapElementId) {
          if (hoveredBuildingIdRef.current) {
            clearHoveredBuilding();
          }

          return;
        }

        if (hoveredBuildingIdRef.current === mapElementId) {
          return;
        }

        clearHoveredBuilding();

        const mapShape = mapElement.querySelector("#" + getSafeId(mapElementId));

        if (mapShape) {
          mapShape.classList.add("hovered-building");
        }

        hoveredBuildingIdRef.current = mapElementId;
        onBuildingHoverRef.current(buildingByMapId[mapElementId]);
      }

      function handlePointerLeave() {
        clearHoveredBuilding();
      }

      mapElement.addEventListener("pointermove", handlePointerMove);
      mapElement.addEventListener("pointerleave", handlePointerLeave);

      return function () {
        mapElement.removeEventListener("pointermove", handlePointerMove);
        mapElement.removeEventListener("pointerleave", handlePointerLeave);

        interactiveBuildings.forEach(function (building) {
          const mapElementId = building.mapElementId || building.map_element_id;

          if (!mapElementId) {
            return;
          }

          const mapShape = mapElement.querySelector("#" + getSafeId(mapElementId));

          if (!mapShape) {
            return;
          }

          mapShape.classList.remove("interactive-building");
          mapShape.classList.remove("hovered-building");
          delete mapShape.dataset.mapElementId;
        });
      };
    },
    [interactiveBuildings]
  );

  return (
    <div className="campus-map-wrapper" ref={mapRef}>
      <img src={mapImage} alt="campus map" className="campus-map-background" />
      <div className="campus-map-overlay" ref={overlayRef}></div>
    </div>
  );
});

export default CampusMap;