const db = require("../config/db");

const logActivity = (organizationId, workspaceId, userId, action) =>
  new Promise((resolve, reject) => {
    db.query(
      `INSERT INTO activity_logs (organization_id, workspace_id, user_id, action)
       VALUES (?, ?, ?, ?)`,
      [organizationId || null, workspaceId || null, userId, action],
      (err, result) => (err ? reject(err) : resolve(result))
    );
  });

module.exports = logActivity;