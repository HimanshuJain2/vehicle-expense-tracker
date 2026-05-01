const express = require("express");
const { addVehicle, getVehicles } = require("../controllers/vehicleController");
const { verifyFirebaseToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/add", verifyFirebaseToken, addVehicle);
router.get("/:userId", verifyFirebaseToken, getVehicles);

module.exports = router;
