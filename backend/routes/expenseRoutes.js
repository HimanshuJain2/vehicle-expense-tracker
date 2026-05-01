const express = require("express");
const { addExpense, getExpenses } = require("../controllers/expenseController");
const { verifyFirebaseToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/add", verifyFirebaseToken, addExpense);
router.get("/:userId", verifyFirebaseToken, getExpenses);

module.exports = router;
