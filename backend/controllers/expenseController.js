const { db, admin } = require("../firebase");

const VALID_EXPENSE_TYPES = new Set(["fuel", "service", "repair", "insurance"]);

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getMonthKey(dateValue) {
  return new Date(dateValue).toISOString().slice(0, 7);
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

function buildExpensePayload(body, parsedDate) {
  const amount = Number(body.amount);
  const type = cleanText(body.type).toLowerCase();
  const note = cleanText(body.note);
  const odometer = optionalPositiveNumber(body.odometer, "odometer");
  const fuelQuantity = optionalPositiveNumber(body.fuelQuantity, "fuelQuantity");

  if (!Number.isFinite(amount) || amount <= 0 || !VALID_EXPENSE_TYPES.has(type)) {
    const error = new Error("Positive amount and valid type are required.");
    error.status = 400;
    throw error;
  }

  if (type !== "fuel" && fuelQuantity !== null) {
    const error = new Error("fuelQuantity can only be saved for fuel expenses.");
    error.status = 400;
    throw error;
  }

  return {
    amount,
    type,
    note,
    date: parsedDate.toISOString().slice(0, 10),
    month: getMonthKey(parsedDate),
    odometer,
    fuelQuantity: type === "fuel" ? fuelQuantity : null
  };
}

async function assertVehicleOwnership(vehicleId, uid) {
  const vehicleDoc = await db.collection("vehicles").doc(vehicleId).get();
  return vehicleDoc.exists && vehicleDoc.data().userId === uid;
}

async function getVehicleDoc(vehicleId, uid) {
  const vehicleDoc = await db.collection("vehicles").doc(vehicleId).get();
  if (!vehicleDoc.exists || vehicleDoc.data().userId !== uid) return null;
  return vehicleDoc;
}

async function updateVehicleCurrentOdometer(uid, vehicleId) {
  const snapshot = await db.collection("expenses").where("userId", "==", uid).where("vehicleId", "==", vehicleId).get();
  const odometers = snapshot.docs
    .map((doc) => Number(doc.data().odometer))
    .filter((value) => Number.isFinite(value));

  const vehicleRef = db.collection("vehicles").doc(vehicleId);
  const vehicleDoc = await vehicleRef.get();
  const initialOdometer = Number(vehicleDoc.data().initialOdometer);
  const currentOdometer = odometers.length
    ? Math.max(...odometers)
    : Number.isFinite(initialOdometer)
      ? initialOdometer
      : null;

  await vehicleRef.update({
    currentOdometer,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function addExpense(req, res) {
  const uid = req.user.uid;
  const vehicleId = cleanText(req.body.vehicleId);
  const date = cleanText(req.body.date);

  if (!vehicleId || !date) {
    return res.status(400).json({
      message: "vehicleId and date are required."
    });
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return res.status(400).json({ message: "Expense date is invalid." });
  }

  const vehicleDoc = await getVehicleDoc(vehicleId, uid);
  if (!vehicleDoc) {
    return res.status(403).json({ message: "Vehicle does not belong to the authenticated user." });
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  let expensePayload;

  try {
    const odometer = optionalPositiveNumber(req.body.odometer, "odometer");
    expensePayload = buildExpensePayload({ ...req.body, odometer }, parsedDate);
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message });
  }

  const docRef = await db.collection("expenses").add({
    userId: uid,
    vehicleId,
    ...expensePayload,
    createdAt: now,
    updatedAt: now
  });

  const snapshot = await docRef.get();
  await updateVehicleCurrentOdometer(uid, vehicleId);
  return res.status(201).json({
    message: "Expense added.",
    expense: { id: docRef.id, ...snapshot.data() }
  });
}

async function getExpenses(req, res) {
  const uid = req.user.uid;

  if (req.params.userId !== uid) {
    return res.status(403).json({ message: "You can only access your own expenses." });
  }

  const vehicleId = cleanText(req.query.vehicleId);
  const category = cleanText(req.query.type).toLowerCase();
  const snapshot = await db.collection("expenses").where("userId", "==", uid).get();
  const expenses = snapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data()
    }))
    .filter((expense) => {
      const matchesVehicle = !vehicleId || expense.vehicleId === vehicleId;
      const matchesCategory = !category || expense.type === category;
      return matchesVehicle && matchesCategory;
    });

  expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const monthlySummary = expenses.reduce((summary, expense) => {
    const month = expense.month || getMonthKey(expense.date);
    summary[month] = (summary[month] || 0) + Number(expense.amount || 0);
    return summary;
  }, {});

  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  return res.json({ expenses, total, monthlySummary });
}

async function updateExpense(req, res) {
  const uid = req.user.uid;
  const expenseId = cleanText(req.params.expenseId);
  const vehicleId = cleanText(req.body.vehicleId);
  const date = cleanText(req.body.date);

  if (!vehicleId || !date) {
    return res.status(400).json({
      message: "vehicleId and date are required."
    });
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return res.status(400).json({ message: "Expense date is invalid." });
  }

  const expenseRef = db.collection("expenses").doc(expenseId);
  const expenseDoc = await expenseRef.get();

  if (!expenseDoc.exists) {
    return res.status(404).json({ message: "Expense not found." });
  }

  if (expenseDoc.data().userId !== uid) {
    return res.status(403).json({ message: "You can only update your own expenses." });
  }

  const vehicleDoc = await getVehicleDoc(vehicleId, uid);
  if (!vehicleDoc) {
    return res.status(403).json({ message: "Vehicle does not belong to the authenticated user." });
  }

  let expensePayload;

  try {
    const odometer = optionalPositiveNumber(req.body.odometer, "odometer");
    expensePayload = buildExpensePayload({ ...req.body, odometer }, parsedDate);
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message });
  }

  await expenseRef.update({
    vehicleId,
    ...expensePayload,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const updatedDoc = await expenseRef.get();
  await updateVehicleCurrentOdometer(uid, vehicleId);
  return res.json({
    message: "Expense updated.",
    expense: { id: updatedDoc.id, ...updatedDoc.data() }
  });
}

async function deleteExpense(req, res) {
  const uid = req.user.uid;
  const expenseId = cleanText(req.params.expenseId);
  const expenseRef = db.collection("expenses").doc(expenseId);
  const expenseDoc = await expenseRef.get();

  if (!expenseDoc.exists) {
    return res.status(404).json({ message: "Expense not found." });
  }

  if (expenseDoc.data().userId !== uid) {
    return res.status(403).json({ message: "You can only delete your own expenses." });
  }

  await expenseRef.delete();
  await updateVehicleCurrentOdometer(uid, expenseDoc.data().vehicleId);
  return res.json({ message: "Expense deleted.", expenseId });
}

module.exports = { addExpense, deleteExpense, getExpenses, updateExpense };
