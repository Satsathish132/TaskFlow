const util = require("util");
const db = require("../config/db");
const logActivity = require("../utils/logActivity");
const createNotification = require("../utils/createNotification");
const logger = require("../logger");

const query = util.promisify(db.query).bind(db);

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
            if (err) {
                logger.error("CREATE_PROJECT (check member) ERROR:", err);
                return res.status(500).json({ message: "Server error" });
            }
            if (members.length === 0) return res.status(403).json({ message: "Not a workspace member" });

            db.query(
                `INSERT INTO projects (workspace_id, name, description, created_by) VALUES (?, ?, ?, ?)`,
                [workspaceId, name, description || null, userId],
                (err, result) => {
                    if (err) {
                        logger.error("CREATE_PROJECT (insert) ERROR:", err);
                        return res.status(500).json({ message: "Server error" });
                    }

                    logActivity(organizationId, workspaceId, userId, `Created project: ${name}`).catch((actErr) => logger.error("CREATE_PROJECT (activity log) ERROR:", actErr));

                    logger.success(`Project created: ${name}`, { projectId: result.insertId, workspaceId, createdBy: userId });

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
            if (err) {
                logger.error("GET_PROJECTS (check member) ERROR:", err);
                return res.status(500).json({ message: "Server error" });
            }
            if (members.length === 0) return res.status(403).json({ message: "Access denied" });

            const role = members[0].role;
            // ✅ MEMBER sees only assigned projects, all others see everything
            const isMember = role === "MEMBER";

            const projectQuery = isMember
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

            db.query(projectQuery, params, (err, result) => {
                if (err) {
                    logger.error("GET_PROJECTS (list) ERROR:", err);
                    return res.status(500).json({ message: "Server error" });
                }
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
            if (err) {
                logger.error("GET_PROJECT_MEMBERS ERROR:", err);
                return res.status(500).json({ message: "Server error" });
            }
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
            if (err) {
                logger.error("ASSIGN_MEMBER (check workspace member) ERROR:", err);
                return res.status(500).json({ message: "Server error" });
            }
            if (rows.length === 0) return res.status(404).json({ message: "User is not a workspace member" });

            db.query(
                `INSERT IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)`,
                [projectId, userId],
                (err) => {
                    if (err) {
                        logger.error("ASSIGN_MEMBER (insert) ERROR:", err);
                        return res.status(500).json({ message: "Server error" });
                    }

                    db.query(
                        `SELECT name FROM projects WHERE id = ?`,
                        [projectId],
                        (err, projects) => {
                            if (err) {
                                logger.error("ASSIGN_MEMBER (lookup project) ERROR:", err);
                                return res.status(500).json({ message: "Server error" });
                            }
                            const projectName = projects[0]?.name || "a project";

                            Promise.resolve(
                                createNotification(
                                    userId,
                                    workspaceId,
                                    "PROJECT_ASSIGNED",
                                    `You were assigned to project: ${projectName}`,
                                    req
                                )
                            ).catch((notifyErr) => logger.error("ASSIGN_MEMBER (notify) ERROR:", notifyErr));

                            logActivity(organizationId, workspaceId, currentUserId, `Assigned user to project: ${projectName}`).catch((actErr) => logger.error("ASSIGN_MEMBER (activity log) ERROR:", actErr));

                            logger.success(`User assigned to project: ${projectName}`, { projectId, userId, workspaceId, assignedBy: currentUserId });

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

    if (!projectId || !userId || !workspaceId) {
        return res.status(400).json({ message: "projectId, userId and workspaceId required" });
    }

    db.query(
        `DELETE FROM project_members WHERE project_id = ? AND user_id = ?`,
        [projectId, userId],
        (err, result) => {
            if (err) {
                logger.error("REMOVE_PROJECT_MEMBER (delete) ERROR:", err);
                return res.status(500).json({ message: "Server error" });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "User is not a member of this project" });
            }

            db.query(`SELECT name FROM projects WHERE id = ?`, [projectId], (err, projects) => {
                if (err) {
                    logger.error("REMOVE_PROJECT_MEMBER (lookup project) ERROR:", err);
                    return res.status(500).json({ message: "Server error" });
                }
                const projectName = projects[0]?.name || "a project";

                logActivity(organizationId, workspaceId, currentUserId, `Removed user from project: ${projectName}`).catch((actErr) => logger.error("REMOVE_PROJECT_MEMBER (activity log) ERROR:", actErr));

                logger.success(`User removed from project: ${projectName}`, { projectId, userId, workspaceId, removedBy: currentUserId });

                res.json({ message: "Member removed from project" });
            });
        }
    );
};

// ── NEW: edit project name/description ────────────────────────────
exports.updateProject = async (req, res) => {
    const projectId = req.params.id;
    const { name, description, workspaceId } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    if (!name) return res.status(400).json({ message: "Project name required" });
    if (!workspaceId) return res.status(400).json({ message: "workspaceId required" });

    try {
        const [project] = await query(`SELECT * FROM projects WHERE id = ?`, [projectId]);
        if (!project) return res.status(404).json({ message: "Project not found" });
        if (String(project.workspace_id) !== String(workspaceId)) {
            return res.status(400).json({ message: "Project does not belong to this workspace" });
        }

        await query(`UPDATE projects SET name = ?, description = ? WHERE id = ?`, [
            name,
            description || null,
            projectId,
        ]);

        logActivity(organizationId, workspaceId, userId, `Updated project details: ${name}`).catch((actErr) =>
            logger.error("UPDATE_PROJECT (activity log) ERROR:", actErr)
        );

        logger.success(`Project updated: ${name}`, { projectId, workspaceId, updatedBy: userId });

        return res.json({ message: "Project updated" });
    } catch (err) {
        logger.error("UPDATE_PROJECT ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

// ── NEW: snapshot a project's members, tasks, and comments before it's gone ──
const buildProjectBackup = async (projectId) => {
    const [project] = await query(`SELECT * FROM projects WHERE id = ?`, [projectId]);

    const members = await query(
        `SELECT pm.*, u.first_name, u.last_name, u.email, u.role
         FROM project_members pm JOIN users u ON u.id = pm.user_id
         WHERE pm.project_id = ?`,
        [projectId]
    );

    const tasks = await query(`SELECT * FROM tasks WHERE project_id = ?`, [projectId]);
    const taskIds = tasks.map((t) => t.id);

    const comments = taskIds.length
        ? await query(`SELECT * FROM comments WHERE task_id IN (?)`, [taskIds])
        : [];

    return { project, members, tasks, comments, backedUpAt: new Date().toISOString() };
};

// ── NEW: delete a project, optionally backing up its data first ──
exports.deleteProject = async (req, res) => {
    const projectId = req.params.id;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;
    const workspaceId = req.body?.workspaceId || req.query?.workspaceId;
    const backup = req.query.backup === "true" || req.body?.backup === true;

    if (!workspaceId) return res.status(400).json({ message: "workspaceId required" });

    try {
        const [project] = await query(`SELECT * FROM projects WHERE id = ?`, [projectId]);
        if (!project) return res.status(404).json({ message: "Project not found" });
        if (String(project.workspace_id) !== String(workspaceId)) {
            return res.status(400).json({ message: "Project does not belong to this workspace" });
        }

        if (backup) {
            const backupData = await buildProjectBackup(projectId);
            await query(
                `INSERT INTO project_backups (workspace_id, project_id, name, backup_data, deleted_by, expires_at)
                 VALUES (?,?,?,?,?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
                [workspaceId, projectId, project.name, JSON.stringify(backupData), userId]
            );

            logActivity(
                organizationId,
                workspaceId,
                userId,
                `Backup created for deleted project: ${project.name} (expires in 30 days)`
            ).catch((actErr) => logger.error("DELETE_PROJECT (activity log) ERROR:", actErr));
        }

        // Delete tasks (and their comments) that belong to this project, then
        // the project's member list, then the project itself. Tasks have
        // ON DELETE SET NULL on project_id, so without this they'd just be
        // detached rather than removed — we want a real delete here since
        // the backup above already preserves them for restore.
        const tasks = await query(`SELECT id FROM tasks WHERE project_id = ?`, [projectId]);
        const taskIds = tasks.map((t) => t.id);

        if (taskIds.length) {
            await query(`DELETE FROM comments WHERE task_id IN (?)`, [taskIds]);
            await query(`DELETE FROM tasks WHERE project_id = ?`, [projectId]);
        }

        await query(`DELETE FROM project_members WHERE project_id = ?`, [projectId]);
        await query(`DELETE FROM projects WHERE id = ?`, [projectId]);

        logger.success(`Project deleted: ${project.name}`, { projectId, workspaceId, deletedBy: userId, backup });

        return res.json({ message: backup ? "Project deleted and backed up" : "Project deleted" });
    } catch (err) {
        logger.error("DELETE_PROJECT ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

// ── NEW: list backups for a workspace ──────────────────────────────
exports.getProjectBackups = async (req, res) => {
    const workspaceId = req.params.workspaceId;

    try {
        const backups = await query(
            `SELECT id, project_id, name, deleted_by, created_at, expires_at
             FROM project_backups
             WHERE workspace_id = ? AND expires_at > NOW()
             ORDER BY created_at DESC`,
            [workspaceId]
        );
        return res.json(backups);
    } catch (err) {
        logger.error("GET_PROJECT_BACKUPS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

// ── NEW: restore a backup into a brand-new project ─────────────────
exports.restoreProjectBackup = async (req, res) => {
    const { backupId } = req.params;
    const { workspaceId } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    if (!workspaceId) return res.status(400).json({ message: "workspaceId required" });

    try {
        const [backupRow] = await query(
            `SELECT * FROM project_backups WHERE id = ? AND workspace_id = ?`,
            [backupId, workspaceId]
        );
        if (!backupRow) return res.status(404).json({ message: "Backup not found" });

        const snapshot = JSON.parse(backupRow.backup_data);
        const { project, members, tasks, comments } = snapshot;

        // Only reattach users who are still members of THIS workspace — the
        // backup may be older than someone's removal, and both FKs below
        // (project_members.user_id, tasks.created_by) are NOT NULL/required.
        const existingMemberRows = await query(
            `SELECT user_id FROM workspace_members WHERE workspace_id = ?`,
            [workspaceId]
        );
        const validUserIds = new Set(existingMemberRows.map((m) => m.user_id));
        const safeUser = (candidateId) => (validUserIds.has(candidateId) ? candidateId : userId);

        const [nameCollision] = await query(
            `SELECT id FROM projects WHERE workspace_id = ? AND name = ?`,
            [workspaceId, project.name]
        );
        const restoredName = nameCollision
            ? `${project.name} (restored ${new Date().toISOString().slice(0, 10)})`
            : `${project.name} (restored)`;

        // 1. New project
        const projectInsert = await query(
            `INSERT INTO projects (workspace_id, name, description, created_by) VALUES (?,?,?,?)`,
            [workspaceId, restoredName, project.description, safeUser(project.created_by)]
        );
        const newProjectId = projectInsert.insertId;

        // 2. Members (dedupe, only those still in the workspace)
        for (const m of members) {
            if (!validUserIds.has(m.user_id)) continue;
            await query(
                `INSERT IGNORE INTO project_members (project_id, user_id) VALUES (?,?)`,
                [newProjectId, m.user_id]
            );
        }

        // 3. Tasks — remap old task id -> new task id
        const taskIdMap = {};
        for (const t of tasks) {
            const assignedTo = t.assigned_to && validUserIds.has(t.assigned_to) ? t.assigned_to : null;
            const result = await query(
                `INSERT INTO tasks (workspace_id, project_id, title, description, status, priority, assigned_to, created_by)
                 VALUES (?,?,?,?,?,?,?,?)`,
                [workspaceId, newProjectId, t.title, t.description, t.status, t.priority, assignedTo, safeUser(t.created_by)]
            );
            taskIdMap[t.id] = result.insertId;
        }

        // 4. Comments — remap via taskIdMap
        for (const c of comments || []) {
            const newTaskId = taskIdMap[c.task_id];
            if (!newTaskId || !validUserIds.has(c.user_id)) continue;
            await query(
                `INSERT INTO comments (task_id, user_id, comment) VALUES (?,?,?)`,
                [newTaskId, c.user_id, c.comment]
            );
        }

        logActivity(
            organizationId,
            workspaceId,
            userId,
            `Restored project from backup: ${project.name}`
        ).catch((actErr) => logger.error("RESTORE_PROJECT (activity log) ERROR:", actErr));

        await query(`DELETE FROM project_backups WHERE id = ?`, [backupId]);

        logger.success(`Project restored: ${project.name}`, { backupId, newProjectId, workspaceId, restoredBy: userId });

        return res.status(201).json({ message: "Project restored", projectId: newProjectId });
    } catch (err) {
        logger.error("RESTORE_PROJECT ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

// ── NEW: manually delete a project backup permanently (no restore) ──
exports.deleteProjectBackup = async (req, res) => {
    const { backupId } = req.params;
    const { workspaceId } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    if (!workspaceId) return res.status(400).json({ message: "workspaceId required" });

    try {
        const [backupRow] = await query(
            `SELECT id, name FROM project_backups WHERE id = ? AND workspace_id = ?`,
            [backupId, workspaceId]
        );
        if (!backupRow) return res.status(404).json({ message: "Backup not found" });

        await query(`DELETE FROM project_backups WHERE id = ?`, [backupId]);

        logActivity(
            organizationId,
            workspaceId,
            userId,
            `Permanently deleted project backup: ${backupRow.name}`
        ).catch((actErr) => logger.error("DELETE_PROJECT_BACKUP (activity log) ERROR:", actErr));

        logger.success(`Project backup deleted: ${backupRow.name}`, { backupId, workspaceId, deletedBy: userId });

        return res.json({ message: "Backup deleted" });
    } catch (err) {
        logger.error("DELETE_PROJECT_BACKUP ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
