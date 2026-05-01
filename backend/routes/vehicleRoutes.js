const express = require("express");
const { addVehicle, deleteVehicle, getVehicles, updateVehicle } = require("../controllers/vehicleController");
const { verifyFirebaseToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/add", verifyFirebaseToken, addVehicle);
router.get("/:userId", verifyFirebaseToken, getVehicles);
router.put("/:vehicleId", verifyFirebaseToken, updateVehicle);
router.delete("/:vehicleId", verifyFirebaseToken, deleteVehicle);

module.exports = router;
