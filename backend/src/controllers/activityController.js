const db = require("../config/db");

exports.getActivity = (req, res) => {
    const workspaceId = req.params.workspaceId;
    const userId = req.user.id;

    if (!workspaceId) return res.status(400).json({ message: "workspaceId required" });

    db.query(
        `
        SELECT
            a.id,
            a.action,
            a.created_at,
            CONCAT(u.first_name, ' ', u.last_name) AS user_name
        FROM activity_logs a
        JOIN users u ON a.user_id = u.id
        WHERE a.workspace_id = ? AND a.user_id = ?
        ORDER BY a.created_at DESC
        LIMIT 50
        `,
        [workspaceId, userId],
        (err, result) => {
            if (err) return res.status(500).json({ message: "Server error", error: err });
            return res.json(result);
        }
    );
};