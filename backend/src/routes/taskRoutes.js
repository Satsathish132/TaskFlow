const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const taskController = require("../controllers/taskController");
const permit = require("../middleware/rbac");

// Create task — OWNER, ADMIN, MEMBER (not SUB_ADMIN)
router.post(
  "/create",
  verifyToken,
  permit("SUPER_ADMIN", "ADMIN", "MEMBER"),
  taskController.createTask
);

// NOTE: /status must come BEFORE /:id
router.put(
  "/status",
  verifyToken,
  permit("SUPER_ADMIN", "ADMIN", "SUB_ADMIN", "MEMBER"),
  taskController.updateTaskStatus
);

// Get all tasks in a workspace
router.get(
  "/:workspaceId",
  verifyToken,
  permit("SUPER_ADMIN", "ADMIN", "SUB_ADMIN", "MEMBER"),
  taskController.getTasks
);

// Edit task
router.put(
  "/:id",
  verifyToken,
  permit("SUPER_ADMIN", "ADMIN", "SUB_ADMIN", "MEMBER"),
  taskController.updateTask
);

// Delete task
router.delete(
  "/:id",
  verifyToken,
  permit("SUPER_ADMIN", "ADMIN", "SUB_ADMIN", "MEMBER"),
  taskController.deleteTask
);

module.exports = router;