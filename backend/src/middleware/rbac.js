const db = require("../config/db");

const permit = (...allowedRoles) => {
    return (req, res, next) => {
        const userId = req.user.id;

        const workspaceId =
            req.body?.workspaceId ||
            req.params?.workspaceId ||
            req.query?.workspaceId;

        if (!workspaceId) {
            return res.status(400).json({ message: "Workspace ID required" });
        }

        // check user is a workspace member
        db.query(
            `SELECT u.role FROM workspace_members wm
             JOIN users u ON u.id = wm.user_id
             WHERE wm.workspace_id = ? AND wm.user_id = ?`,
            [workspaceId, userId],
            (err, rows) => {
                if (err) return res.status(500).json(err);
                if (rows.length === 0) return res.status(403).json({ message: "Not a workspace member" });

                const role = rows[0].role;

                if (!allowedRoles.includes(role)) {
                    return res.status(403).json({ message: "Access denied for role: " + role });
                }

                req.role = role;
                next();
            }
        );
    };
};

module.exports = permit;