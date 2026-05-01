const { db, admin } = require("../firebase");

const VALID_TYPES = new Set(["car", "bike", "truck", "scooter", "other"]);

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalPositiveNumber(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    const error = new Error(`${fieldName} must be a positive number.`);
    error.status = 400;
    throw error;
  }

  return number;
}

async function addVehicle(req, res) {
  const uid = req.user.uid;
  const vehicleName = cleanText(req.body.vehicleName);
  const number = cleanText(req.body.number).toUpperCase();
  const type = cleanText(req.body.type).toLowerCase();
  let initialOdometer;

  try {
    initialOdometer = optionalPositiveNumber(req.body.initialOdometer, "initialOdometer");
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message });
  }

  if (!vehicleName || !number || !VALID_TYPES.has(type)) {
    return res.status(400).json({
      message: "vehicleName, number, and a valid type are required."
    });
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const docRef = await db.collection("vehicles").add({
    userId: uid,
    vehicleName,
    number,
    type,
    initialOdometer,
    currentOdometer: initialOdometer,
    createdAt: now,
    updatedAt: now
  });

  const snapshot = await docRef.get();
  return res.status(201).json({
    message: "Vehicle added.",
    vehicle: { id: docRef.id, ...snapshot.data() }
  });
}

async function getVehicles(req, res) {
  const uid = req.user.uid;

  if (req.params.userId !== uid) {
    return res.status(403).json({ message: "You can only access your own vehicles." });
  }

  const snapshot = await db.collection("vehicles").where("userId", "==", uid).get();

  const vehicles = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));

  vehicles.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || 0;
    const bTime = b.createdAt?.toMillis?.() || 0;
    return bTime - aTime;
  });

  return res.json({ vehicles });
}

async function updateVehicle(req, res) {
  const uid = req.user.uid;
  const vehicleId = cleanText(req.params.vehicleId);
  const vehicleName = cleanText(req.body.vehicleName);
  const number = cleanText(req.body.number).toUpperCase();
  const type = cleanText(req.body.type).toLowerCase();
  let initialOdometer;

  try {
    initialOdometer = optionalPositiveNumber(req.body.initialOdometer, "initialOdometer");
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message });
  }

  if (!vehicleName || !number || !VALID_TYPES.has(type)) {
    return res.status(400).json({
      message: "vehicleName, number, and a valid type are required."
    });
  }

  const vehicleRef = db.collection("vehicles").doc(vehicleId);
  const vehicleDoc = await vehicleRef.get();

  if (!vehicleDoc.exists) {
    return res.status(404).json({ message: "Vehicle not found." });
  }

  if (vehicleDoc.data().userId !== uid) {
    return res.status(403).json({ message: "You can only update your own vehicles." });
  }

  await vehicleRef.update({
    vehicleName,
    number,
    type,
    initialOdometer,
    currentOdometer: vehicleDoc.data().currentOdometer ?? initialOdometer,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const updatedDoc = await vehicleRef.get();
  return res.json({
    message: "Vehicle updated.",
    vehicle: { id: updatedDoc.id, ...updatedDoc.data() }
  });
}

async function deleteVehicle(req, res) {
  const uid = req.user.uid;
  const vehicleId = cleanText(req.params.vehicleId);
  const vehicleRef = db.collection("vehicles").doc(vehicleId);
  const vehicleDoc = await vehicleRef.get();

  if (!vehicleDoc.exists) {
    return res.status(404).json({ message: "Vehicle not found." });
  }

  if (vehicleDoc.data().userId !== uid) {
    return res.status(403).json({ message: "You can only delete your own vehicles." });
  }

  const expenseSnapshot = await db
    .collection("expenses")
    .where("vehicleId", "==", vehicleId)
    .limit(1)
    .get();

  if (!expenseSnapshot.empty) {
    return res.status(409).json({
      message: "This vehicle has expenses. Delete those expenses before deleting the vehicle."
    });
  }

  await vehicleRef.delete();
  return res.json({ message: "Vehicle deleted.", vehicleId });
}

module.exports = { addVehicle, deleteVehicle, getVehicles, updateVehicle };
