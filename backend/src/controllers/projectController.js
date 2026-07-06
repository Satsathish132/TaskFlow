const db = require("../config/db");
const logActivity = require("../utils/logActivity");
const createNotification = require("../utils/createNotification");

exports.createProject = (req, res) => {
    const { workspaceId, name, description } = req.body || {};
    if (!workspaceId || !name) return res.status(400).json({ message: "workspaceId and name are required" });
    const userId = req.user?.id;
    const organizationId = req.user?.organization_id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    db.query(
        `SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?`,
        [workspaceId, userId],
        (err, members) => {
            if (err) return res.status(500).json({ error: err.message });
            if (members.length === 0) return res.status(403).json({ message: "Not a workspace member" });

            db.query(
                `INSERT INTO projects (workspace_id, name, description, created_by) VALUES (?, ?, ?, ?)`,
                [workspaceId, name, description || null, userId],
                (err, result) => {
                    if (err) return res.status(500).json({ error: err.message });
                    logActivity(organizationId, workspaceId, userId, `Created project: ${name}`).catch(() => {});
                    return res.status(201).json({ message: "Project created successfully", projectId: result.insertId });
                }
            );
        }
    );
};

exports.getProjects = (req, res) => {
    const workspaceId = req.params.workspaceId;
    const userId = req.user?.id;

    if (!workspaceId) return res.status(400).json({ message: "workspaceId is required" });
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // ✅ get role from users table via workspace_members join
    db.query(
        `SELECT u.role FROM workspace_members wm
         JOIN users u ON u.id = wm.user_id
         WHERE wm.workspace_id = ? AND wm.user_id = ?`,
        [workspaceId, userId],
        (err, members) => {
            if (err) return res.status(500).json({ error: err.message });
            if (members.length === 0) return res.status(403).json({ message: "Access denied" });

            const role = members[0].role;
            // ✅ MEMBER sees only assigned projects, all others see everything
            const isMember = role === "MEMBER";

            const query = isMember
                ? `
                    SELECT
                        p.id, p.name, p.description, p.created_at,
                        CONCAT(u.first_name, ' ', u.last_name) AS createdBy,
                        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS taskCount,
                        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'IN_PROGRESS') AS activeCount,
                        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'TODO') AS todoCount
                    FROM projects p
                    JOIN users u ON p.created_by = u.id
                    JOIN project_members pm ON pm.project_id = p.id
                    WHERE p.workspace_id = ? AND pm.user_id = ?
                    ORDER BY p.created_at DESC
                  `
                : `
                    SELECT
                        p.id, p.name, p.description, p.created_at,
                        CONCAT(u.first_name, ' ', u.last_name) AS createdBy,
                        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS taskCount,
                        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'IN_PROGRESS') AS activeCount,
                        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'TODO') AS todoCount
                    FROM projects p
                    JOIN users u ON p.created_by = u.id
                    WHERE p.workspace_id = ?
                    ORDER BY p.created_at DESC
                  `;

            const params = isMember ? [workspaceId, userId] : [workspaceId];

            db.query(query, params, (err, result) => {
                if (err) return res.status(500).json({ error: err.message });
                return res.json(result);
            });
        }
    );
};

// GET PROJECT MEMBERS
exports.getProjectMembers = (req, res) => {
    const { projectId } = req.params;

    db.query(
        `SELECT u.id, u.first_name, u.last_name, u.email, u.role
         FROM project_members pm
         JOIN users u ON pm.user_id = u.id
         WHERE pm.project_id = ?`,
        [projectId],
        (err, result) => {
            if (err) return res.status(500).json(err);
            res.json(result);
        }
    );
};

// ASSIGN MEMBER TO PROJECT
exports.assignMember = (req, res) => {
    const { projectId, userId, workspaceId } = req.body;
    const currentUserId = req.user.id;
    const organizationId = req.user.organization_id;

    if (!projectId || !userId || !workspaceId) {
        return res.status(400).json({ message: "projectId, userId and workspaceId required" });
    }

    db.query(
        `SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?`,
        [workspaceId, userId],
        (err, rows) => {
            if (err) return res.status(500).json(err);
            if (rows.length === 0) return res.status(404).json({ message: "User is not a workspace member" });

            db.query(
                `INSERT IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)`,
                [projectId, userId],
                (err) => {
                    if (err) return res.status(500).json(err);

                    db.query(
                        `SELECT name FROM projects WHERE id = ?`,
                        [projectId],
                        (err, projects) => {
                            if (err) return res.status(500).json(err);
                            const projectName = projects[0]?.name || "a project";

                            createNotification(
                                userId,
                                workspaceId,
                                "PROJECT_ASSIGNED",
                                `You were assigned to project: ${projectName}`,
                                req
                            );

                            logActivity(organizationId, workspaceId, currentUserId, `Assigned user to project: ${projectName}`).catch(() => {});
                            res.json({ message: "Member assigned to project" });
                        }
                    );
                }
            );
        }
    );
};

// REMOVE MEMBER FROM PROJECT
exports.removeMember = (req, res) => {
    const { projectId, userId, workspaceId } = req.body;
    const currentUserId = req.user.id;
    const organizationId = req.user.organization_id;

    db.query(
        `DELETE FROM project_members WHERE project_id = ? AND user_id = ?`,
        [projectId, userId],
        (err) => {
            if (err) return res.status(500).json(err);
            db.query(`SELECT name FROM projects WHERE id = ?`, [projectId], (err, projects) => {
                if (err) return res.status(500).json(err);
                const projectName = projects[0]?.name || "a project";
                logActivity(organizationId, workspaceId, currentUserId, `Removed user from project: ${projectName}`).catch(() => {});
                res.json({ message: "Member removed from project" });
            });
        }
    );
};
