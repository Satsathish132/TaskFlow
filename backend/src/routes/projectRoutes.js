const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const projectController = require("../controllers/projectController");
const permit = require("../middleware/rbac");

router.get("/members/:projectId", verifyToken, projectController.getProjectMembers);
router.post("/assign", verifyToken, permit("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), projectController.assignMember);
router.delete("/remove", verifyToken, permit("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), projectController.removeMember);

router.post("/create", verifyToken, permit("SUPER_ADMIN", "ADMIN"), projectController.createProject);

// backups routes BEFORE "/:workspaceId" so "backups" is never swallowed as a workspaceId
router.get("/backups/:workspaceId", verifyToken, permit("SUPER_ADMIN", "ADMIN"), projectController.getProjectBackups);
router.post("/backups/:backupId/restore", verifyToken, permit("SUPER_ADMIN", "ADMIN"), projectController.restoreProjectBackup);
router.delete("/backups/:backupId", verifyToken, permit("SUPER_ADMIN", "ADMIN"), projectController.deleteProjectBackup);

// edit / delete a project
router.put("/:id", verifyToken, permit("SUPER_ADMIN", "ADMIN"), projectController.updateProject);
router.delete("/:id", verifyToken, permit("SUPER_ADMIN", "ADMIN"), projectController.deleteProject);

router.get("/:workspaceId", verifyToken, permit("SUPER_ADMIN", "ADMIN", "SUB_ADMIN", "MEMBER"), projectController.getProjects);

module.exports = router;