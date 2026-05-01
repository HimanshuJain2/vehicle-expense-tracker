const { admin } = require("../firebase");

async function verifyFirebaseToken(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Missing Firebase ID token." });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || null
    };
    return next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired Firebase ID token.",
      error: error.message
    });
  }
}

module.exports = { verifyFirebaseToken };
