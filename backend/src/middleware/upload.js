const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const UPLOAD_ROOT = path.join(__dirname, "..", "uploads", "tasks");
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB — adjust as needed

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const taskDir = path.join(UPLOAD_ROOT, String(req.params.taskId));
    fs.mkdirSync(taskDir, { recursive: true });
    cb(null, taskDir);
  },
  filename: (req, file, cb) => {
    // Random name on disk -- original name is preserved separately in the
    // DB and shown to users, so this avoids path traversal / collisions /
    // leaking the original filename in the URL.
    const uniqueName = crypto.randomBytes(16).toString("hex") + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  // No type restriction -- any file type is accepted, per requirements.
});

module.exports = { upload, UPLOAD_ROOT, MAX_FILE_SIZE };
