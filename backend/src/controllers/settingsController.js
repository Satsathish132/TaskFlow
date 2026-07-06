const db     = require("../config/db");
const bcrypt = require("bcryptjs");
const { generateTwoFactorSecret, verifyTwoFactorToken } = require("../utils/twoFactor");
const logger = require('../logger');

// ── ANALYTICS (Admin/Super Admin only) ───────────────────────────
exports.getAnalytics = async (req, res) => {
  const { organization_id, role } = req.user;

  if (!["SUPER_ADMIN", "ADMIN"].includes(role)) {
    return res.status(403).json({ message: "Access denied" });
  }

  const workspaceId = req.query.workspaceId || null;

  try {
    // Total tasks created
    const [totalTasks] = await db.promise().query(
      workspaceId
        ? `SELECT COUNT(*) AS count FROM tasks WHERE workspace_id = ?`
        : `SELECT COUNT(*) AS count FROM tasks t
           JOIN workspaces w ON t.workspace_id = w.id
           WHERE w.organization_id = ?`,
      [workspaceId || organization_id]
    );

    // Total tasks completed
    const [completedTasks] = await db.promise().query(
      workspaceId
        ? `SELECT COUNT(*) AS count FROM tasks WHERE workspace_id = ? AND status = 'DONE'`
        : `SELECT COUNT(*) AS count FROM tasks t
           JOIN workspaces w ON t.workspace_id = w.id
           WHERE w.organization_id = ? AND t.status = 'DONE'`,
      [workspaceId || organization_id]
    );

    // Overdue tasks (created more than 30 days ago and not done)
    const [overdueTasks] = await db.promise().query(
      workspaceId
        ? `SELECT COUNT(*) AS count FROM tasks
           WHERE workspace_id = ? AND status != 'DONE'
           AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
        : `SELECT COUNT(*) AS count FROM tasks t
           JOIN workspaces w ON t.workspace_id = w.id
           WHERE w.organization_id = ? AND t.status != 'DONE'
           AND t.created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [workspaceId || organization_id]
    );

    // Tasks per member
    const [tasksPerMember] = await db.promise().query(
      workspaceId
        ? `SELECT CONCAT(u.first_name, ' ', u.last_name) AS name,
                  COUNT(t.id) AS task_count
           FROM users u
           LEFT JOIN tasks t ON t.assigned_to = u.id AND t.workspace_id = ?
           JOIN workspace_members wm ON wm.user_id = u.id AND wm.workspace_id = ?
           GROUP BY u.id ORDER BY task_count DESC`
        : `SELECT CONCAT(u.first_name, ' ', u.last_name) AS name,
                  COUNT(t.id) AS task_count
           FROM users u
           LEFT JOIN tasks t ON t.assigned_to = u.id
           WHERE u.organization_id = ?
           GROUP BY u.id ORDER BY task_count DESC`,
      workspaceId ? [workspaceId, workspaceId] : [organization_id]
    );

    // Project activity (last 30 days)
    const [projectActivity] = await db.promise().query(
      workspaceId
        ? `SELECT p.name, COUNT(t.id) AS task_count
           FROM projects p
           LEFT JOIN tasks t ON t.project_id = p.id
             AND t.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
           WHERE p.workspace_id = ?
           GROUP BY p.id ORDER BY task_count DESC`
        : `SELECT p.name, COUNT(t.id) AS task_count
           FROM projects p
           LEFT JOIN tasks t ON t.project_id = p.id
             AND t.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
           JOIN workspaces w ON p.workspace_id = w.id
           WHERE w.organization_id = ?
           GROUP BY p.id ORDER BY task_count DESC`,
      [workspaceId || organization_id]
    );

    // Workspace activity summary (last 30 days)
    const [workspaceActivity] = await db.promise().query(
      `SELECT w.name, COUNT(a.id) AS activity_count
       FROM workspaces w
       LEFT JOIN activity_logs a ON a.workspace_id = w.id
         AND a.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       WHERE w.organization_id = ?
       GROUP BY w.id ORDER BY activity_count DESC`,
      [organization_id]
    );

    return res.json({
      totalTasks:        totalTasks[0].count,
      completedTasks:    completedTasks[0].count,
      overdueTasks:      overdueTasks[0].count,
      tasksPerMember,
      projectActivity,
      workspaceActivity,
    });

  } catch (err) {
    logger.error("getAnalytics error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── NOTIFICATION PREFERENCES ─────────────────────────────────────
exports.getNotificationPrefs = async (req, res) => {
  const userId = req.user.id;

  try {
    const [rows] = await db.promise().query(
      "SELECT * FROM notification_preferences WHERE user_id = ?",
      [userId]
    );

    if (!rows.length) {
      // return defaults
      return res.json({
        email_notifications: true,
        inapp_notifications: true,
        task_assignment:     true,
        task_comment:        true,
        due_date_reminder:   true,
        workspace_invite:    true,
        chat_mention:        true,
      });
    }

    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateNotificationPrefs = async (req, res) => {
  const userId = req.user.id;
  const {
    email_notifications,
    inapp_notifications,
    task_assignment,
    task_comment,
    due_date_reminder,
    workspace_invite,
    chat_mention,
  } = req.body;

  try {
    await db.promise().query(
      `INSERT INTO notification_preferences
       (user_id, email_notifications, inapp_notifications, task_assignment,
        task_comment, due_date_reminder, workspace_invite, chat_mention)
       VALUES (?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         email_notifications = VALUES(email_notifications),
         inapp_notifications = VALUES(inapp_notifications),
         task_assignment     = VALUES(task_assignment),
         task_comment        = VALUES(task_comment),
         due_date_reminder   = VALUES(due_date_reminder),
         workspace_invite    = VALUES(workspace_invite),
         chat_mention        = VALUES(chat_mention)`,
      [userId, email_notifications, inapp_notifications, task_assignment,
       task_comment, due_date_reminder, workspace_invite, chat_mention]
    );
    return res.json({ message: "Notification preferences updated" });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  const userId = req.user.id;
  try {
    await db.promise().query(
      "UPDATE notifications SET is_read = 1 WHERE user_id = ?",
      [userId]
    );
    return res.json({ message: "All notifications marked as read" });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

// ── SECURITY ─────────────────────────────────────────────────────
exports.getLoginHistory = async (req, res) => {
  const userId = req.user.id;
  try {
    const [rows] = await db.promise().query(
      `SELECT id, ip_address, device, status, created_at
       FROM login_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getActiveSessions = async (req, res) => {
  const userId = req.user.id;
  try {
    const [rows] = await db.promise().query(
      `SELECT id, ip_address, device, last_active, created_at
       FROM sessions
       WHERE user_id = ?
       ORDER BY last_active DESC`,
      [userId]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

exports.logoutCurrentSession = async (req, res) => {
  const userId  = req.user.id;
  const token   = req.headers.authorization?.split(" ")[1];

  try {
    await db.promise().query(
      "DELETE FROM sessions WHERE user_id = ? AND token = ?",
      [userId, token]
    );
    return res.json({ message: "Session logged out" });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

exports.logoutAllSessions = async (req, res) => {
  const userId = req.user.id;
  try {
    await db.promise().query(
      "DELETE FROM sessions WHERE user_id = ?",
      [userId]
    );
    await db.promise().query(
      "UPDATE users SET refresh_token = NULL WHERE id = ?",
      [userId]
    );
    return res.json({ message: "All sessions logged out" });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getConnectedAccounts = async (req, res) => {
  const userId = req.user.id;
  try {
    const [rows] = await db.promise().query(
      "SELECT email, google_id, personal_email, two_factor_enabled FROM users WHERE id = ?",
      [userId]
    );
    if (!rows.length) return res.status(404).json({ message: "User not found" });

    const user = rows[0];
    return res.json({
      email:           { connected: true,                 value: user.email },
      google:          { connected: !!user.google_id,      value: user.google_id ? "Connected" : null },
      personal_email:  { connected: !!user.personal_email, value: user.personal_email },
      two_factor_enabled: !!user.two_factor_enabled,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

// ── TWO-FACTOR AUTH ───────────────────────────────────────────────
exports.setupTwoFactor = async (req, res) => {
  const userId = req.user.id;
  const email  = req.user.email;

  try {
    const { base32Secret, qrDataUrl } = await generateTwoFactorSecret(email);

    await db.promise().query(
      "UPDATE users SET two_factor_secret = ?, two_factor_enabled = FALSE WHERE id = ?",
      [base32Secret, userId]
    );

    return res.json({ qrDataUrl });
  } catch (err) {
    logger.error("setupTwoFactor error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.confirmTwoFactor = async (req, res) => {
  const userId = req.user.id;
  const { token } = req.body;

  try {
    const [rows] = await db.promise().query(
      "SELECT two_factor_secret FROM users WHERE id = ?",
      [userId]
    );

    if (!rows.length || !rows[0].two_factor_secret) {
      return res.status(400).json({ message: "Start 2FA setup first" });
    }

    const isValid = verifyTwoFactorToken(rows[0].two_factor_secret, token);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid code. Try again." });
    }

    await db.promise().query(
      "UPDATE users SET two_factor_enabled = TRUE WHERE id = ?",
      [userId]
    );

    return res.json({ message: "Two-factor authentication enabled" });
  } catch (err) {
    logger.error("confirmTwoFactor error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.disableTwoFactor = async (req, res) => {
  const userId = req.user.id;
  const { password } = req.body;

  try {
    const [rows] = await db.promise().query(
      "SELECT password FROM users WHERE id = ?",
      [userId]
    );
    if (!rows.length) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(password || "", rows[0].password || "");
    if (!match) return res.status(400).json({ message: "Incorrect password" });

    await db.promise().query(
      "UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL WHERE id = ?",
      [userId]
    );

    return res.json({ message: "Two-factor authentication disabled" });
  } catch (err) {
    logger.error("disableTwoFactor error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── GOOGLE UNLINK ─────────────────────────────────────────────────
exports.unlinkGoogle = async (req, res) => {
  const userId = req.user.id;

  try {
    const [rows] = await db.promise().query(
      "SELECT password, google_id FROM users WHERE id = ?",
      [userId]
    );
    if (!rows.length) return res.status(404).json({ message: "User not found" });

    const user = rows[0];
    if (!user.google_id) {
      return res.status(400).json({ message: "Google account isn't connected" });
    }
    if (!user.password) {
      return res.status(400).json({
        message: "Set a password first — otherwise you'd be locked out of your account.",
      });
    }

    await db.promise().query("UPDATE users SET google_id = NULL WHERE id = ?", [userId]);
    return res.json({ message: "Google account unlinked" });
  } catch (err) {
    logger.error("unlinkGoogle error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};