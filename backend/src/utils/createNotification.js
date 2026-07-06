const db = require("../config/db");
const logger = require('../logger');
const createNotification = (
    userId,
    workspaceId,
    type,
    message,
    req
) => {
    // get organization_id from the workspace
    db.query(
        `SELECT organization_id FROM workspaces WHERE id = ?`,
        [workspaceId],
        (err, rows) => {
            if (err) {
                logger.log("Notification workspace lookup error:", err);
                return;
            }

            const organizationId = rows[0]?.organization_id || null;

            db.query(
                `INSERT INTO notifications
                (user_id, organization_id, workspace_id, type, message)
                VALUES (?,?,?,?,?)`,
                [userId, organizationId, workspaceId, type, message],
                (err, result) => {
                    if (err) {
                        logger.log("Notification error:", err);
                        return;
                    }

                    logger.log("Notification inserted:", result.insertId);

                    const io = req?.app?.get("io");

                    if (!io) {
                        logger.log("Socket not ready");
                        return;
                    }

                    const payload = {
                        id: result.insertId,
                        userId,
                        organizationId,
                        workspaceId,
                        type,
                        message
                    };

                    io.to(`user_${userId}`).emit("notification", payload);
                    logger.log("📡 Notification sent to:", `user_${userId}`);
                }
            );
        }
    );
};

module.exports = createNotification;