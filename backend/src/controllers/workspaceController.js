const db = require("../config/db");
const logActivity = require("../utils/logActivity");
const logger = require("../logger");

exports.createWorkspace = (req, res) => {
    const { name, description } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    if (!name) return res.status(400).json({ message: "Workspace name required" });
    if (!organizationId) return res.status(400).json({ message: "User organization not found" });

    db.query(
        `INSERT INTO workspaces (organization_id, name, description, created_by) VALUES (?,?,?,?)`,
        [organizationId, name, description || null, userId],
        (err, result) => {
            if (err) {
                logger.error("CREATE_WORKSPACE (insert workspace) ERROR:", err);
                return res.status(500).json({ message: "Server error" });
            }
            const workspaceId = result.insertId;

            db.query(
                `INSERT INTO workspace_members (workspace_id, user_id) VALUES (?,?)`,
                [workspaceId, userId],
                (err) => {
                    if (err) {
                        logger.error("CREATE_WORKSPACE (insert member) ERROR:", err);
                        return res.status(500).json({ message: "Server error" });
                    }

                    logActivity(organizationId, workspaceId, userId, `Created workspace: ${name}`).catch((actErr) => logger.error("CREATE_WORKSPACE (activity log) ERROR:", actErr));

                    logger.success(`Workspace created: ${name}`, { workspaceId, organizationId, createdBy: userId });

                    return res.status(201).json({ message: "Workspace created", workspaceId });
                }
            );
        }
    );
};

exports.getMyWorkspaces = (req, res) => {
    const userId = req.user.id;

    db.query(
        `
        SELECT
            w.id,
            w.name,
            w.description,
            u.role,
            (SELECT COUNT(*) FROM projects WHERE workspace_id = w.id) AS projectCount
        FROM workspaces w
        JOIN workspace_members wm ON w.id = wm.workspace_id
        JOIN users u ON u.id = wm.user_id
        WHERE wm.user_id = ?
        `,
        [userId],
        (err, result) => {
            if (err) {
                logger.error("GET_MY_WORKSPACES ERROR:", err);
                return res.status(500).json({ message: "Server error" });
            }
            res.json(result);
        }
    );
};
