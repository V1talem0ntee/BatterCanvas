const express = require("express");
const { login, logout, getSession } = require("../controllers/auth");
const { activateAccount } = require("../controllers/accountAuth");
const { requireAuth } = require("../middleware/token");

const router = express.Router();


router.post("/auth/login", login);
router.post("/auth/logout", requireAuth, logout);
router.get("/auth/session", requireAuth, getSession);
router.post("/auth/activate", activateAccount);
router.post("/auth/signup", activateAccount);

module.exports = router;
