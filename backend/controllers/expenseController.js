const { db, admin } = require("../firebase");

const VALID_EXPENSE_TYPES = new Set(["fuel", "service", "repair", "insurance"]);

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getMonthKey(dateValue) {
  return new Date(dateValue).toISOString().slice(0, 7);
}

async function assertVehicleOwnership(vehicleId, uid) {
  const vehicleDoc = await db.collection("vehicles").doc(vehicleId).get();
  return vehicleDoc.exists && vehicleDoc.data().userId === uid;
}

async function addExpense(req, res) {
  const uid = req.user.uid;
  const vehicleId = cleanText(req.body.vehicleId);
  const amount = Number(req.body.amount);
  const type = cleanText(req.body.type).toLowerCase();
  const note = cleanText(req.body.note);
  const date = cleanText(req.body.date);

  if (!vehicleId || !Number.isFinite(amount) || amount <= 0 || !VALID_EXPENSE_TYPES.has(type) || !date) {
    return res.status(400).json({
      message: "vehicleId, positive amount, valid type, and date are required."
    });
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return res.status(400).json({ message: "Expense date is invalid." });
  }

  const ownsVehicle = await assertVehicleOwnership(vehicleId, uid);
  if (!ownsVehicle) {
    return res.status(403).json({ message: "Vehicle does not belong to the authenticated user." });
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const docRef = await db.collection("expenses").add({
    userId: uid,
    vehicleId,
    amount,
    type,
    note,
    date: parsedDate.toISOString().slice(0, 10),
    month: getMonthKey(parsedDate),
    createdAt: now,
    updatedAt: now
  });

  const snapshot = await docRef.get();
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
  let query = db.collection("expenses").where("userId", "==", uid);

  if (vehicleId) {
    query = query.where("vehicleId", "==", vehicleId);
  }

  if (category && VALID_EXPENSE_TYPES.has(category)) {
    query = query.where("type", "==", category);
  }

  const snapshot = await query.get();
  const expenses = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));

  expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const monthlySummary = expenses.reduce((summary, expense) => {
    const month = expense.month || getMonthKey(expense.date);
    summary[month] = (summary[month] || 0) + Number(expense.amount || 0);
    return summary;
  }, {});

  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  return res.json({ expenses, total, monthlySummary });
}

module.exports = { addExpense, getExpenses };
