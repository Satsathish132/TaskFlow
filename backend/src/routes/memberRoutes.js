const express = require("express");
const router = express.Router();
const memberController = require("../controllers/memberController");
const { verifyToken } = require("../middleware/authMiddleware");

router.delete("/remove", verifyToken, memberController.removeMember);

// Direct assignment of an already-invited org member into a workspace.
// Replaces the old email/token "invite to workspace" flow.
router.post("/add-existing", verifyToken, memberController.addExistingMember);

// Legacy email-invite flow — kept for backward compatibility, no longer
// used by the frontend (super admins now invite people at the org level
// via /api/users/invite, then assign them into workspaces directly).
router.post("/invite", verifyToken, memberController.inviteMember);

router.get("/:workspaceId", verifyToken, memberController.getMembers);

router.put("/role", verifyToken, memberController.changeRole);

router.get("/invites/accept/:token", memberController.acceptInvite);

module.exports = router;