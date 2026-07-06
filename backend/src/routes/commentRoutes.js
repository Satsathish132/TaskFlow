const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const commentController = require("../controllers/commentController");
const permit = require("../middleware/rbac");

router.get(
    "/:workspaceId/:taskId",
    verifyToken,
    permit("SUPER_ADMIN", "ADMIN", "SUB_ADMIN", "MEMBER"),
    commentController.getComments
);

router.post(
    "/add",
    verifyToken,
    commentController.addComment
);

module.exports = router;