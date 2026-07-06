const jwt = require("jsonwebtoken");

const generateAccessToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, organization_id: user.organization_id },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRE || "15m" }
  );

const generateRefreshToken = (user) =>
  jwt.sign(
    { id: user.id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRE || "7d" }
  );

module.exports = { generateAccessToken, generateRefreshToken };