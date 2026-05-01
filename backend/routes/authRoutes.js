const express = require("express");
const { verifyToken } = require("../controllers/authController");
const { verifyFirebaseToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/verifyToken", verifyFirebaseToken, verifyToken);

module.exports = router;
