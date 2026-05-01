const { db, admin } = require("../firebase");

const VALID_TYPES = new Set(["car", "bike", "truck", "scooter", "other"]);

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function addVehicle(req, res) {
  const uid = req.user.uid;
  const vehicleName = cleanText(req.body.vehicleName);
  const number = cleanText(req.body.number).toUpperCase();
  const type = cleanText(req.body.type).toLowerCase();

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

module.exports = { addVehicle, getVehicles };
