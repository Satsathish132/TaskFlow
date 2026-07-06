const express  = require("express");
const router   = express.Router();
const ctrl     = require("../controllers/settingsController");
const { verifyToken } = require("../middleware/authMiddleware");

router.use(verifyToken);

// Analytics
router.get("/analytics",               ctrl.getAnalytics);

// Notifications
router.get("/notifications/prefs",     ctrl.getNotificationPrefs);
router.put("/notifications/prefs",     ctrl.updateNotificationPrefs);
router.put("/notifications/mark-all",  ctrl.markAllNotificationsRead);

// Security
router.get("/security/login-history",  ctrl.getLoginHistory);
router.get("/security/sessions",       ctrl.getActiveSessions);
router.delete("/security/session",     ctrl.logoutCurrentSession);
router.delete("/security/sessions",    ctrl.logoutAllSessions);
router.get("/security/accounts",       ctrl.getConnectedAccounts);
router.post("/security/2fa/setup",           ctrl.setupTwoFactor);
router.post("/security/2fa/confirm",         ctrl.confirmTwoFactor);
router.post("/security/2fa/disable",         ctrl.disableTwoFactor);
router.delete("/security/accounts/google",   ctrl.unlinkGoogle);

module.exports = router;