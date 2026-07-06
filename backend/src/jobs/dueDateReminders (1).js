const db = require("../config/db");
const logger = require('../logger');
// How far ahead of a task's due_date to start reminding (also catches
// already-overdue tasks, since the SQL condition is "<=").
const REMINDER_WINDOW_HOURS = 24;

// How often to poll. Reminders don't need to be real-time, so a modest
// interval keeps this cheap.
const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const FIRST_RUN_DELAY_MS = 10 * 1000; // let the server finish booting first

async function checkDueTasks(io) {
  let rows;
  try {
    [rows] = await db.promise().query(
      `SELECT t.id, t.title, t.due_date, t.assigned_to, t.workspace_id, w.organization_id
       FROM tasks t
       JOIN workspaces w ON w.id = t.workspace_id
       WHERE t.due_date IS NOT NULL
         AND t.reminder_sent_at IS NULL
         AND t.assigned_to IS NOT NULL
         AND t.status != 'DONE'
         AND t.due_date <= DATE_ADD(NOW(), INTERVAL ? HOUR)`,
      [REMINDER_WINDOW_HOURS]
    );
  } catch (err) {
    logger.error("Due-date reminder job — query failed:", err);
    return;
  }

  for (const task of rows) {
    const isOverdue = new Date(task.due_date).getTime() < Date.now();
    const message = isOverdue
      ? `"${task.title}" is overdue`
      : `"${task.title}" is due soon`;

    try {
      const [result] = await db.promise().query(
        `INSERT INTO notifications (user_id, organization_id, workspace_id, type, message)
         VALUES (?, ?, ?, 'TASK_DUE_SOON', ?)`,
        [task.assigned_to, task.organization_id, task.workspace_id, message]
      );

      await db.promise().query(
        `UPDATE tasks SET reminder_sent_at = NOW() WHERE id = ?`,
        [task.id]
      );

      if (io) {
        io.to(`user_${task.assigned_to}`).emit("notification", {
          id: result.insertId,
          userId: task.assigned_to,
          organizationId: task.organization_id,
          workspaceId: task.workspace_id,
          type: "TASK_DUE_SOON",
          message,
        });
      }
    } catch (err) {
      logger.error(`Due-date reminder job — failed for task ${task.id}:`, err);
      // Don't let one bad row stop the rest from being processed.
    }
  }
}

// Call once from app.js after `io` is created: startDueDateReminderJob(io)
function startDueDateReminderJob(io) {
  setTimeout(() => checkDueTasks(io), FIRST_RUN_DELAY_MS);
  setInterval(() => checkDueTasks(io), POLL_INTERVAL_MS);
  logger.log("⏰ Due-date reminder job scheduled (every 15 min)");
}

module.exports = startDueDateReminderJob;
