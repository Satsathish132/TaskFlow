const db = require("../config/db");
const logActivity = require("../utils/logActivity");
const logger = require("../logger");

// ===============================
// ADD COMMENT
// ===============================
exports.addComment = (req, res) => {
    logger.info("🔥 Add Comment API HIT");

    const { taskId, comment, workspaceId } = req.body || {};
    const userId = req.user?.id;
    const organizationId = req.user?.organization_id;

    if (!taskId || !comment || !workspaceId) {
        return res.status(400).json({
            message: "taskId, workspaceId, and comment required"
        });
    }

    db.query(
        `INSERT INTO comments (task_id, user_id, comment) VALUES (?,?,?)`,
        [taskId, userId, comment],
        (err, result) => {
            if (err) {
                logger.error("ERROR (addComment):", err);
                return res.status(500).json({ message: "Server error", error: err });
            }

            logActivity(
                organizationId,  // ✅ added
                workspaceId,
                userId,
                `Commented on task ${taskId}`
            ).catch(() => {});

            logger.success(`Comment added on task ${taskId}`, { userId, taskId, workspaceId, commentId: result.insertId });

            res.json({ message: "Comment added", commentId: result.insertId });
        }
    );
};

// ===============================
// GET COMMENTS BY TASK
// ===============================
exports.getComments = (req, res) => {
    const taskId = req.params.taskId;

    db.query(
        `
        SELECT 
            c.id,
            c.comment,
            c.created_at,
            u.first_name,
            u.last_name
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.task_id = ?
        ORDER BY c.created_at DESC
        `,
        [taskId],
        (err, result) => {
            if (err) {
                logger.error("ERROR:", err);
                return res.status(500).json({ message: "Server error", error: err });
            }
            return res.json(result);
        }
    );
};