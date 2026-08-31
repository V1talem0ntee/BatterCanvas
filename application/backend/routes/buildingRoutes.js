const express = require("express");
const { listBuildings } = require("../controllers/building");

const router = express.Router();

router.get("/buildings", listBuildings);

module.exports = router;