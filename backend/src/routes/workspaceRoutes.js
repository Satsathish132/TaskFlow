const express = require("express");
const router = express.Router();
const workspaceController = require("../controllers/workspaceController");
const { verifyToken } = require("../middleware/authMiddleware");

router.post("/create", verifyToken, workspaceController.createWorkspace);
router.get("/my", verifyToken, workspaceController.getMyWorkspaces);

// NEW
router.put("/:id", verifyToken, workspaceController.updateWorkspace);
router.delete("/:id", verifyToken, workspaceController.deleteWorkspace);
router.get("/backups", verifyToken, workspaceController.getWorkspaceBackups);
router.post("/backups/:backupId/restore", verifyToken, workspaceController.restoreWorkspaceBackup);
router.delete("/backups/:backupId", verifyToken, workspaceController.deleteWorkspaceBackup);

module.exports = router;