const express   = require("express");
const router    = express.Router();
const authCtrl  = require("../controllers/authController");
const { verifyToken, authorizeRoles } = require("../middleware/authMiddleware");
const {
  forgotPasswordLimiter,
  resetPasswordLimiter,
  loginLimiter,
} = require("../middleware/rateLimiters");

router.post("/register",        authCtrl.register);
router.post("/login",           loginLimiter, authCtrl.login);
router.post("/refresh",         authCtrl.refreshToken);
router.post("/set-password",    authCtrl.setPassword);
router.put("/change-password",  verifyToken, authCtrl.changePassword);
router.post("/forgot-password", forgotPasswordLimiter, authCtrl.forgotPassword);
router.post("/reset-password",  resetPasswordLimiter, authCtrl.resetPassword);

router.post(
  "/create-user",
  verifyToken,
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  authCtrl.createUser
);

module.exports = router;
