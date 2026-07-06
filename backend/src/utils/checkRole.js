const db = require("../config/db");

const checkRole = (workspaceId, userId, callback) => {
    db.query(
        `SELECT u.role
         FROM workspace_members wm
         JOIN users u ON u.id = wm.user_id
         WHERE wm.workspace_id = ? AND wm.user_id = ?`,
        [workspaceId, userId],
        (err, result) => {
            if (err) return callback(err);
            if (result.length === 0) return callback(null, null);
            callback(null, result[0].role);
        }
    );
};

module.exports = checkRole;