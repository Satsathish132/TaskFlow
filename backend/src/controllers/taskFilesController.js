const db = require("../config/db");
const path = require("path");
const fs = require("fs");
const { UPLOAD_ROOT } = require("../middleware/upload");
const logger = require('../logger');

// POST /tasks/:taskId/files
// req.task and req.file are set by canAccessTaskFiles + multer middleware.
exports.uploadFile = (req, res) => {
  const { taskId } = req.params;

  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  db.query(
    `INSERT INTO task_files
     (task_id, uploaded_by, original_name, stored_name, mime_type, size_bytes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [taskId, req.user.id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size],
    (err, result) => {
      if (err) {
        logger.error("TASK FILE INSERT ERROR:", err);
        return res.status(500).json({ message: "Server error" });
      }

      return res.status(201).json({
        id: result.insertId,
        task_id: Number(taskId),
        original_name: req.file.originalname,
        mime_type: req.file.mimetype,
        size_bytes: req.file.size,
        uploaded_by: req.user.id,
      });
    }
  );
};

// GET /tasks/:taskId/files
exports.listFiles = (req, res) => {
  const { taskId } = req.params;

  db.query(
    `SELECT f.id, f.original_name, f.mime_type, f.size_bytes, f.uploaded_at,
            u.id AS uploaded_by, u.first_name, u.last_name
     FROM task_files f
     JOIN users u ON u.id = f.uploaded_by
     WHERE f.task_id = ?
     ORDER BY f.uploaded_at DESC`,
    [taskId],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Server error" });
      return res.json(rows);
    }
  );
};

// GET /tasks/:taskId/files/:fileId/download
exports.downloadFile = (req, res) => {
  const { taskId, fileId } = req.params;

  db.query(
    "SELECT original_name, stored_name FROM task_files WHERE id = ? AND task_id = ?",
    [fileId, taskId],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Server error" });
      if (!rows.length) return res.status(404).json({ message: "File not found" });

      const file = rows[0];
      const filePath = path.join(UPLOAD_ROOT, String(taskId), file.stored_name);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File no longer exists on disk" });
      }

      return res.download(filePath, file.original_name);
    }
  );
};

// DELETE /tasks/:taskId/files/:fileId
// Allowed for the uploader themselves or an org admin (req.task/req.user
// already confirmed org-admin-or-assigned by canAccessTaskFiles).
exports.deleteFile = (req, res) => {
  const { taskId, fileId } = req.params;

  db.query(
    "SELECT uploaded_by, stored_name FROM task_files WHERE id = ? AND task_id = ?",
    [fileId, taskId],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Server error" });
      if (!rows.length) return res.status(404).json({ message: "File not found" });

      const file = rows[0];
      const isOwner = file.uploaded_by === req.user.id;
      const isAdmin = ["ADMIN", "SUB_ADMIN", "SUPER_ADMIN"].includes(req.user.role);

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "You can't delete this file" });
      }

      db.query("DELETE FROM task_files WHERE id = ?", [fileId], (err) => {
        if (err) return res.status(500).json({ message: "Server error" });

        const filePath = path.join(UPLOAD_ROOT, String(taskId), file.stored_name);
        fs.unlink(filePath, () => {}); // best-effort disk cleanup

        return res.json({ message: "File deleted" });
      });
    }
  );
};
