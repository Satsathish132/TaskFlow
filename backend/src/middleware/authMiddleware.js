const jwt = require("jsonwebtoken");
const db  = require("../config/db");

exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Token expired or invalid" });
    req.user = decoded;
    next();
  });
};

exports.authorizeRoles = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Insufficient permissions" });
  }
  next();
};

exports.requirePasswordChanged = (req, res, next) => {
  db.query(
    "SELECT must_change_password FROM users WHERE id = ?",
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Server error" });
      if (!rows.length) return res.status(404).json({ message: "User not found" });
      if (rows[0].must_change_password) {
        return res.status(403).json({
          message: "You must change your password before continuing",
          must_change_password: true,
        });
      }
      next();
    }
  );
};