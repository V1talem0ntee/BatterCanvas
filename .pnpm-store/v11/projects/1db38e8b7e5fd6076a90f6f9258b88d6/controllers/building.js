const { pool } = require("../db");

function buildingRow(row) {
  return {
    buildingId: row.building_id,
    schoolId: row.school_id,
    buildingName: row.building_name,
    mapElementId: row.map_element_id,
    buildingTypes: row.building_types || [],
  };
}

async function listBuildings(req, res) {
  try {
    const result = await pool.query(
      `SELECT
        b.building_id,
        b.school_id,
        b.building_name,
        b.map_element_id,

        ARRAY(
          SELECT bt.building_type
          FROM public.building_type bt
          WHERE bt.building_id = b.building_id
          ORDER BY bt.building_type
        ) AS building_types

      FROM public.building b
      ORDER BY b.building_name`
    );

    return res.json({
      buildings: result.rows.map(buildingRow),
    });
  } catch (error) {
    console.error("Unable to load buildings:", error.message);

    return res.status(500).json({
      message: "Unable to load buildings.",
    });
  }
}

module.exports = {
  listBuildings,
};