const { db, admin } = require("../firebase");

async function verifyToken(req, res) {
  const { uid, email } = req.user;

  const userRef = db.collection("users").doc(uid);
  const now = admin.firestore.FieldValue.serverTimestamp();

  await userRef.set(
    {
      uid,
      email,
      lastLoginAt: now,
      updatedAt: now,
      createdAt: now
    },
    { merge: true }
  );

  return res.json({
    message: "Token verified.",
    user: { uid, email }
  });
}

module.exports = { verifyToken };
