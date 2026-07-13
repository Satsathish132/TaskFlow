const util = require("util");
const db = require("../config/db");
const logActivity = require("../utils/logActivity");
const logger = require("../logger");

const query = util.promisify(db.query).bind(db);

const CAN_MANAGE_WORKSPACE = ["SUPER_ADMIN", "ADMIN"];

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

// ── NEW: edit workspace name/description ─────────────────────────
exports.updateWorkspace = async (req, res) => {
    const workspaceId = req.params.id;
    const { name, description } = req.body;
    const organizationId = req.user.organization_id;

    if (!CAN_MANAGE_WORKSPACE.includes(req.user.role)) {
        return res.status(403).json({ message: "You don't have permission to edit this workspace" });
    }
    if (!name) return res.status(400).json({ message: "Workspace name required" });

    try {
        const [workspace] = await query(`SELECT * FROM workspaces WHERE id = ?`, [workspaceId]);
        if (!workspace) return res.status(404).json({ message: "Workspace not found" });
        if (workspace.organization_id !== organizationId) {
            return res.status(403).json({ message: "Workspace does not belong to your organization" });
        }

        await query(`UPDATE workspaces SET name = ?, description = ? WHERE id = ?`, [
            name,
            description || null,
            workspaceId,
        ]);

        logActivity(organizationId, workspaceId, req.user.id, `Updated workspace details`).catch((actErr) =>
            logger.error("UPDATE_WORKSPACE (activity log) ERROR:", actErr)
        );

        logger.success(`Workspace updated: ${name}`, { workspaceId, organizationId, updatedBy: req.user.id });

        return res.json({ message: "Workspace updated" });
    } catch (err) {
        logger.error("UPDATE_WORKSPACE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

// ── NEW: snapshot everything under a workspace before it's gone ──
const buildWorkspaceBackup = async (workspaceId) => {
    const [workspace] = await query(`SELECT * FROM workspaces WHERE id = ?`, [workspaceId]);

    const members = await query(
        `SELECT wm.*, u.first_name, u.last_name, u.email, u.role
         FROM workspace_members wm JOIN users u ON u.id = wm.user_id
         WHERE wm.workspace_id = ?`,
        [workspaceId]
    );

    const projects = await query(`SELECT * FROM projects WHERE workspace_id = ?`, [workspaceId]);
    const projectIds = projects.map((p) => p.id);

    const projectMembers = projectIds.length
        ? await query(`SELECT * FROM project_members WHERE project_id IN (?)`, [projectIds])
        : [];

    const tasks = await query(`SELECT * FROM tasks WHERE workspace_id = ?`, [workspaceId]);
    const taskIds = tasks.map((t) => t.id);

    const comments = taskIds.length
        ? await query(`SELECT * FROM comments WHERE task_id IN (?)`, [taskIds])
        : [];

    const activity = await query(`SELECT * FROM activity_logs WHERE workspace_id = ?`, [workspaceId]);

    return { workspace, members, projects, projectMembers, tasks, comments, activity, backedUpAt: new Date().toISOString() };
};

// ── NEW: delete workspace, optionally backing up its data first ──
exports.deleteWorkspace = async (req, res) => {
    const workspaceId = req.params.id;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;
    const backup = req.query.backup === "true" || req.body?.backup === true;

    if (!CAN_MANAGE_WORKSPACE.includes(req.user.role)) {
        return res.status(403).json({ message: "You don't have permission to delete this workspace" });
    }

    try {
        const [workspace] = await query(`SELECT * FROM workspaces WHERE id = ?`, [workspaceId]);
        if (!workspace) return res.status(404).json({ message: "Workspace not found" });
        if (workspace.organization_id !== organizationId) {
            return res.status(403).json({ message: "Workspace does not belong to your organization" });
        }

        if (backup) {
            const backupData = await buildWorkspaceBackup(workspaceId);
            await query(
                `INSERT INTO workspace_backups (organization_id, workspace_id, name, backup_data, deleted_by, expires_at)
                 VALUES (?,?,?,?,?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
                [organizationId, workspaceId, workspace.name, JSON.stringify(backupData), userId]
            );

            logActivity(
                organizationId,
                null,
                userId,
                `Backup created for deleted workspace: ${workspace.name} (expires in 30 days)`
            ).catch((actErr) => logger.error("DELETE_WORKSPACE (activity log) ERROR:", actErr));
        }

        // ── actually remove the workspace and everything under it ──
        const projects = await query(`SELECT id FROM projects WHERE workspace_id = ?`, [workspaceId]);
        const projectIds = projects.map((p) => p.id);

        const tasks = await query(`SELECT id FROM tasks WHERE workspace_id = ?`, [workspaceId]);
        const taskIds = tasks.map((t) => t.id);

        if (taskIds.length) {
            await query(`DELETE FROM comments WHERE task_id IN (?)`, [taskIds]);
        }
        await query(`DELETE FROM tasks WHERE workspace_id = ?`, [workspaceId]);

        if (projectIds.length) {
            await query(`DELETE FROM project_members WHERE project_id IN (?)`, [projectIds]);
        }
        await query(`DELETE FROM projects WHERE workspace_id = ?`, [workspaceId]);

        await query(`DELETE FROM activity_logs WHERE workspace_id = ?`, [workspaceId]);
        await query(`DELETE FROM workspace_members WHERE workspace_id = ?`, [workspaceId]);
        await query(`DELETE FROM workspaces WHERE id = ?`, [workspaceId]);

        logger.success(`Workspace deleted: ${workspace.name}`, { workspaceId, organizationId, deletedBy: userId, backup });

        return res.json({ message: backup ? "Workspace deleted and backed up" : "Workspace deleted" });
    } catch (err) {
        logger.error("DELETE_WORKSPACE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

// ── NEW: list backups for the org (so Super Admin/Admin can find & restore data manually later) ──
exports.getWorkspaceBackups = async (req, res) => {
    const organizationId = req.user.organization_id;

    if (!CAN_MANAGE_WORKSPACE.includes(req.user.role)) {
        return res.status(403).json({ message: "You don't have permission to view backups" });
    }

    try {
        const backups = await query(
            `SELECT id, workspace_id, name, deleted_by, created_at, expires_at
             FROM workspace_backups
             WHERE organization_id = ? AND expires_at > NOW()
             ORDER BY created_at DESC`,
            [organizationId]
        );
        return res.json(backups);
    } catch (err) {
        logger.error("GET_WORKSPACE_BACKUPS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

// ── NEW: restore a backup into a brand-new workspace ──────────────
exports.restoreWorkspaceBackup = async (req, res) => {
    const { backupId } = req.params;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    if (!CAN_MANAGE_WORKSPACE.includes(req.user.role)) {
        return res.status(403).json({ message: "You don't have permission to restore workspaces" });
    }

    try {
        const [backupRow] = await query(
            `SELECT * FROM workspace_backups WHERE id = ? AND organization_id = ?`,
            [backupId, organizationId]
        );
        if (!backupRow) return res.status(404).json({ message: "Backup not found" });

        const snapshot = JSON.parse(backupRow.backup_data);
        const { workspace, members, projects, projectMembers, tasks, comments } = snapshot;

        // Only reattach users who still exist in this org — the backup may be
        // older than a since-departed teammate, and every FK below is NOT NULL.
        const existingUserRows = await query(`SELECT id FROM users WHERE organization_id = ?`, [organizationId]);
        const validUserIds = new Set(existingUserRows.map((u) => u.id));
        const safeUser = (candidateId) => (validUserIds.has(candidateId) ? candidateId : userId);

        const [nameCollision] = await query(
    `SELECT id FROM workspaces WHERE organization_id = ? AND name = ?`,
    [organizationId, workspace.name]
);
const restoredName = nameCollision
    ? `${workspace.name} (${new Date().toISOString().slice(0, 10)})`
    : workspace.name;

        // 1. New workspace
        const workspaceInsert = await query(
            `INSERT INTO workspaces (organization_id, name, description, created_by) VALUES (?,?,?,?)`,
            [organizationId, `${workspace.name} (restored)`, workspace.description, safeUser(workspace.created_by)]
        );
        const newWorkspaceId = workspaceInsert.insertId;

        // 2. Members (dedupe, always include the restoring user)
        const memberIds = new Set([userId]);
        members.forEach((m) => {
            if (validUserIds.has(m.user_id)) memberIds.add(m.user_id);
        });
        for (const uid of memberIds) {
            await query(
                `INSERT IGNORE INTO workspace_members (workspace_id, user_id) VALUES (?,?)`,
                [newWorkspaceId, uid]
            );
        }

        // 3. Projects — remap old project id -> new project id
        const projectIdMap = {};
        for (const p of projects) {
            const result = await query(
                `INSERT INTO projects (workspace_id, name, description, created_by) VALUES (?,?,?,?)`,
                [newWorkspaceId, p.name, p.description, safeUser(p.created_by)]
            );
            projectIdMap[p.id] = result.insertId;
        }

        // 4. Project members
        for (const pm of projectMembers || []) {
            const newProjectId = projectIdMap[pm.project_id];
            if (!newProjectId || !validUserIds.has(pm.user_id)) continue;
            await query(
                `INSERT IGNORE INTO project_members (project_id, user_id) VALUES (?,?)`,
                [newProjectId, pm.user_id]
            );
        }

        // 5. Tasks — remap old task id -> new task id, and project_id via the map
        const taskIdMap = {};
        for (const t of tasks) {
            const newProjectId = t.project_id ? projectIdMap[t.project_id] || null : null;
            const assignedTo = t.assigned_to && validUserIds.has(t.assigned_to) ? t.assigned_to : null;
            const result = await query(
                `INSERT INTO tasks (workspace_id, project_id, title, description, status, priority, assigned_to, created_by)
                 VALUES (?,?,?,?,?,?,?,?)`,
                [newWorkspaceId, newProjectId, t.title, t.description, t.status, t.priority, assignedTo, safeUser(t.created_by)]
            );
            taskIdMap[t.id] = result.insertId;
        }

        // 6. Comments — remap via taskIdMap
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
    newWorkspaceId,
    userId,
    `Restored workspace from backup: ${workspace.name}`
).catch((actErr) => logger.error("RESTORE_WORKSPACE (activity log) ERROR:", actErr));

await query(`DELETE FROM workspace_backups WHERE id = ?`, [backupId]);

logger.success(`Workspace restored: ${workspace.name}`, { backupId, newWorkspaceId, organizationId, restoredBy: userId });

        return res.status(201).json({ message: "Workspace restored", workspaceId: newWorkspaceId });
    } catch (err) {
        logger.error("RESTORE_WORKSPACE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

// ── NEW: manually delete a backup permanently (no restore) ────────
exports.deleteWorkspaceBackup = async (req, res) => {
    const { backupId } = req.params;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    if (!CAN_MANAGE_WORKSPACE.includes(req.user.role)) {
        return res.status(403).json({ message: "You don't have permission to delete backups" });
    }

    try {
        const [backupRow] = await query(
            `SELECT id, name FROM workspace_backups WHERE id = ? AND organization_id = ?`,
            [backupId, organizationId]
        );
        if (!backupRow) return res.status(404).json({ message: "Backup not found" });

        await query(`DELETE FROM workspace_backups WHERE id = ?`, [backupId]);

        logActivity(
            organizationId,
            null,
            userId,
            `Permanently deleted workspace backup: ${backupRow.name}`
        ).catch((actErr) => logger.error("DELETE_WORKSPACE_BACKUP (activity log) ERROR:", actErr));

        logger.success(`Workspace backup deleted: ${backupRow.name}`, { backupId, organizationId, deletedBy: userId });

        return res.json({ message: "Backup deleted" });
    } catch (err) {
        logger.error("DELETE_WORKSPACE_BACKUP ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};