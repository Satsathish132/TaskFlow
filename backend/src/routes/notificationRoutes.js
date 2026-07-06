const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/authMiddleware");
const notificationController = require("../controllers/notificationController");

router.get(
    "/",
    verifyToken,
    notificationController.getNotifications
);

router.put(
    "/:id/read",
    verifyToken,
    notificationController.markAsRead
);

router.put("/mark-all", verifyToken, notificationController.markAllRead);

module.exports = router;