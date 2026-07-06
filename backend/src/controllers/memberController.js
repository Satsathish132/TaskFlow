const crypto = require("crypto");
const db = require("../config/db");
const logActivity = require("../utils/logActivity");
const createNotification = require("../utils/createNotification");

exports.inviteMember = (req, res) => {
    const { workspaceId, email, projectId } = req.body;
    const currentUserId = req.user.id;
    const organizationId = req.user.organization_id;

    // only SUPER_ADMIN and ADMIN can invite
    if (!["SUPER_ADMIN", "ADMIN", "SUB_ADMIN"].includes(req.user.role)) {
        return res.status(403).json({ message: "Permission denied" });
    }

    db.query(`SELECT id, email FROM users WHERE email = ?`, [email], (err, user) => {
        if (err) return res.status(500).json(err);
        if (user.length === 0) return res.status(404).json({ message: "User not found" });

        const invitedUserId = user[0].id;

        // check already a workspace member
        db.query(
            `SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?`,
            [workspaceId, invitedUserId],
            (err, existing) => {
                if (err) return res.status(500).json(err);
                if (existing.length > 0) return res.status(400).json({ message: "User is already a member of this workspace" });

                // check pending invite
                db.query(
                    `SELECT 1 FROM workspace_invites WHERE workspace_id = ? AND email = ? AND status = 'PENDING'`,
                    [workspaceId, email],
                    (err, pendingInvite) => {
                        if (err) return res.status(500).json(err);
                        if (pendingInvite.length > 0) return res.status(400).json({ message: "User already has a pending invite" });

                        const token = crypto.randomBytes(20).toString("hex");

                        db.query(
                            `SELECT first_name, last_name FROM users WHERE id = ?`,
                            [currentUserId],
                            (err, sender) => {
                                if (err) return res.status(500).json(err);
                                const senderName = sender.length ? `${sender[0].first_name} ${sender[0].last_name}` : "Someone";

                               db.query(
    `INSERT INTO workspace_invites (workspace_id, email, token, invited_by, project_id, expires_at) VALUES (?,?,?,?,?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
    [workspaceId, email, token, currentUserId, projectId || null],
                                    (err) => {
                                        if (err) return res.status(500).json(err);

                                        createNotification(invitedUserId, workspaceId, "INVITE", `${senderName} invited you to a workspace`, req);

                                        logActivity(organizationId, workspaceId, currentUserId, `Invited ${email} to workspace`).catch(() => {});

                                        res.json({
                                            message: "Invite sent successfully",
                                            inviteLink: `http://localhost:5000/api/members/invites/accept/${token}`
                                        });
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    });
};

// ===============================
// ADD EXISTING ORG MEMBER TO WORKSPACE (direct — no email invite/token)
// The person must already have an account in this organization
// (created via userController.inviteUser). This is the only way
// members get added to a workspace now — there is no separate
// "invite to workspace" email flow in the UI anymore.
// ===============================
exports.addExistingMember = (req, res) => {
    const { workspaceId, userId } = req.body;
    const currentUserId = req.user.id;
    const organizationId = req.user.organization_id;

    if (!["SUPER_ADMIN", "ADMIN", "SUB_ADMIN"].includes(req.user.role)) {
        return res.status(403).json({ message: "Permission denied" });
    }
    if (!workspaceId || !userId) {
        return res.status(400).json({ message: "workspaceId and userId required" });
    }

    // target user must belong to the same organization as the assigner
    db.query(
        `SELECT id, first_name, last_name, organization_id FROM users WHERE id = ?`,
        [userId],
        (err, rows) => {
            if (err) return res.status(500).json(err);
            if (!rows.length) return res.status(404).json({ message: "User not found" });
            if (rows[0].organization_id !== organizationId) {
                return res.status(403).json({ message: "User is not part of your organization" });
            }

            db.query(
                `SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?`,
                [workspaceId, userId],
                (err, existing) => {
                    if (err) return res.status(500).json(err);
                    if (existing.length > 0) {
                        return res.status(400).json({ message: "User is already a member of this workspace" });
                    }

                    db.query(
                        `INSERT INTO workspace_members (workspace_id, user_id) VALUES (?, ?)`,
                        [workspaceId, userId],
                        (err) => {
                            if (err) return res.status(500).json(err);

                            createNotification(
                                userId,
                                workspaceId,
                                "WORKSPACE_ADDED",
                                "You were added to a workspace",
                                req
                            );

                            logActivity(
                                organizationId,
                                workspaceId,
                                currentUserId,
                                `Added ${rows[0].first_name} ${rows[0].last_name} to workspace`
                            ).catch(() => {});

                            res.json({ message: "Member added to workspace" });
                        }
                    );
                }
            );
        }
    );
};

exports.getMembers = (req, res) => {
    const workspaceId = req.params.workspaceId;

    db.query(
        `
        SELECT
            u.id,
            u.first_name,
            u.last_name,
            u.email,
            u.role
        FROM workspace_members wm
        JOIN users u ON wm.user_id = u.id
        WHERE wm.workspace_id = ?
        `,
        [workspaceId],
        (err, result) => {
            if (err) return res.status(500).json(err);
            res.json(result);
        }
    );
};

exports.changeRole = (req, res) => {
    const { workspaceId, userId, role } = req.body;
    const currentUserId = req.user.id;
    const organizationId = req.user.organization_id;

    // only SUPER_ADMIN can change roles
    if (req.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ message: "Only SUPER_ADMIN can change roles" });
    }

    // valid roles
    const validRoles = ["ADMIN", "SUB_ADMIN", "MEMBER"];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
    }

    db.query(
        `UPDATE users SET role = ? WHERE id = ?`,
        [role, userId],
        (err, result) => {
            if (err) return res.status(500).json(err);
            if (result.affectedRows === 0) return res.status(404).json({ message: "User not found" });
            logActivity(organizationId, workspaceId, currentUserId, `Changed role of user ${userId} to ${role}`).catch(() => {});
            res.json({ message: "Role updated successfully" });
        }
    );
};

exports.removeMember = (req, res) => {
    const { workspaceId, userId } = req.body;
    const currentUserId = req.user.id;
    const organizationId = req.user.organization_id;

    if (parseInt(userId) === parseInt(currentUserId)) {
        return res.status(400).json({ message: "You cannot remove yourself" });
    }

    // only SUPER_ADMIN and ADMIN can remove
    if (!["SUPER_ADMIN", "ADMIN"].includes(req.user.role)) {
        return res.status(403).json({ message: "Permission denied" });
    }

    // get target user role
    db.query(`SELECT role FROM users WHERE id = ?`, [userId], (err, rows) => {
        if (err) return res.status(500).json(err);
        if (rows.length === 0) return res.status(404).json({ message: "User not found" });

        const targetRole = rows[0].role;

        // ADMIN cannot remove SUPER_ADMIN or other ADMIN
        if (req.user.role === "ADMIN" && ["SUPER_ADMIN", "ADMIN"].includes(targetRole)) {
            return res.status(403).json({ message: "ADMINs can only remove MEMBERs and SUB_ADMINs" });
        }

        if (targetRole === "SUPER_ADMIN") {
            return res.status(403).json({ message: "Cannot remove SUPER_ADMIN" });
        }

        db.query(
            `DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?`,
            [workspaceId, userId],
            (err) => {
                if (err) return res.status(500).json(err);
                logActivity(organizationId, workspaceId, currentUserId, `Removed member from workspace`).catch(() => {});
                res.json({ message: "Member removed" });
            }
        );
    });
};

exports.acceptInvite = (req, res) => {
    const { token } = req.params;

    db.query(
        `SELECT * FROM workspace_invites WHERE token = ?`,
        [token],
        (err, invites) => {
            if (err) return res.status(500).json(err);
            if (invites.length === 0) return res.status(404).json({ message: "Invite not found" });

            const invite = invites[0];

            if (invite.status !== "PENDING") {
                return res.status(400).json({ message: `Invite already ${invite.status.toLowerCase()}` });
            }
            if (new Date(invite.expires_at) < new Date()) {
                db.query(`UPDATE workspace_invites SET status = 'EXPIRED' WHERE id = ?`, [invite.id]);
                return res.status(400).json({ message: "Invite has expired" });
            }

            db.query(
                `SELECT id FROM users WHERE email = ?`,
                [invite.email],
                (err, users) => {
                    if (err) return res.status(500).json(err);
                    if (users.length === 0) {
                        return res.status(404).json({ message: "No account found for this email. Please register first." });
                    }

                    const userId = users[0].id;

                    db.query(
                        `INSERT IGNORE INTO workspace_members (workspace_id, user_id) VALUES (?, ?)`,
                        [invite.workspace_id, userId],
                        (err) => {
                            if (err) return res.status(500).json(err);

                            // If the invite targeted a specific project, also add them there.
                            const finish = () => {
                                db.query(
                                    `UPDATE workspace_invites SET status = 'ACCEPTED' WHERE id = ?`,
                                    [invite.id],
                                    (err) => {
                                        if (err) return res.status(500).json(err);
                                        res.json({ message: "Invite accepted. Welcome to the workspace!" });
                                    }
                                );
                            };

                            if (invite.project_id) {
                                db.query(
                                    `INSERT IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)`,
                                    [invite.project_id, userId],
                                    (err) => {
                                        if (err) return res.status(500).json(err);
                                        finish();
                                    }
                                );
                            } else {
                                finish();
                            }
                        }
                    );
                }
            );
        }
    );
};