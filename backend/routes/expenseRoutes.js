const express = require("express");
const { addExpense, deleteExpense, getExpenses, updateExpense } = require("../controllers/expenseController");
const { verifyFirebaseToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/add", verifyFirebaseToken, addExpense);
router.get("/:userId", verifyFirebaseToken, getExpenses);
router.put("/:expenseId", verifyFirebaseToken, updateExpense);
router.delete("/:expenseId", verifyFirebaseToken, deleteExpense);

module.exports = router;
