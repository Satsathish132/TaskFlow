const db = require("../config/db");

const ADMIN_ROLES = ["ADMIN", "SUB_ADMIN", "SUPER_ADMIN"];

// Attaches req.task = { id, assigned_to, organization_id } on success.
// Allows through: the user assigned to the task, or an admin-tier user
// in the same organization as the task's workspace.
function canAccessTaskFiles(req, res, next) {
  const taskId = req.params.taskId;

  db.query(
    `SELECT t.id, t.assigned_to, w.organization_id
     FROM tasks t
     JOIN workspaces w ON w.id = t.workspace_id
     WHERE t.id = ?`,
    [taskId],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Server error" });
      if (!rows.length) return res.status(404).json({ message: "Task not found" });

      const task = rows[0];
      const user = req.user;

      const isAssignedMember = task.assigned_to === user.id;
      const isOrgAdmin =
        ADMIN_ROLES.includes(user.role) && user.organization_id === task.organization_id;

      if (!isAssignedMember && !isOrgAdmin) {
        return res.status(403).json({ message: "You don't have access to this task's files" });
      }

      req.task = task;
      next();
    }
  );
}

module.exports = { canAccessTaskFiles };
