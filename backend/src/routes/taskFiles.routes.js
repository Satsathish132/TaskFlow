const express = require("express");
const router = express.Router();

const { canAccessTaskFiles } = require("../middleware/taskAccess");
const { upload } = require("../middleware/upload");
const { verifyToken } = require("../middleware/authMiddleware"); // ← fixed
const taskFilesController = require("../controllers/taskFilesController");

router.post(
  "/tasks/:taskId/files",
  verifyToken,
  canAccessTaskFiles,
  upload.single("file"),
  taskFilesController.uploadFile
);

router.get(
  "/tasks/:taskId/files",
  verifyToken,
  canAccessTaskFiles,
  taskFilesController.listFiles
);

router.get(
  "/tasks/:taskId/files/:fileId/download",
  verifyToken,
  canAccessTaskFiles,
  taskFilesController.downloadFile
);

router.delete(
  "/tasks/:taskId/files/:fileId",
  verifyToken,
  canAccessTaskFiles,
  taskFilesController.deleteFile
);

module.exports = router;