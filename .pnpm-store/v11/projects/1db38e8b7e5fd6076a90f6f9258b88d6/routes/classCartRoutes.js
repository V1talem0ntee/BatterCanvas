const express = require("express");
const {
  listClassCart,
  addClassCartSection,
  removeClassCartSection,
} = require("../controllers/classCart");
const { requireAuth } = require("../middleware/token");

const router = express.Router();

router.get("/class-cart", requireAuth, listClassCart);
router.post("/class-cart", requireAuth, addClassCartSection);
router.delete("/class-cart/:classSectionId", requireAuth, removeClassCartSection);
router.get("/cart/sections", requireAuth, listClassCart);
router.post("/cart/sections", requireAuth, addClassCartSection);
router.delete("/cart/sections/:classSectionId", requireAuth, removeClassCartSection);

module.exports = router;
