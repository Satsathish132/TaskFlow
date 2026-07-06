const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const projectController = require("../controllers/projectController");
const permit = require("../middleware/rbac");
 
router.get("/members/:projectId", verifyToken, projectController.getProjectMembers);
router.post("/assign", verifyToken, permit("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), projectController.assignMember);
router.delete("/remove", verifyToken, permit("SUPER_ADMIN", "ADMIN", "SUB_ADMIN"), projectController.removeMember);
 
router.post("/create", verifyToken, permit("SUPER_ADMIN", "ADMIN"), projectController.createProject);
router.get("/:workspaceId", verifyToken, permit("SUPER_ADMIN", "ADMIN", "SUB_ADMIN", "MEMBER"), projectController.getProjects);
 
module.exports = router;