const db = require("../config/db");
const logActivity = require("../utils/logActivity");
const createNotification = require("../utils/createNotification");
const logger = require("../logger");

const VALID_TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"];

// CREATE TASK
exports.createTask = (req, res) => {
  const { workspaceId, projectId, title, description, assignedTo, priority, dueDate } = req.body;
  const userId = req.user.id;
  const organizationId = req.user.organization_id;

  if (!workspaceId || !title) {
    return res.status(400).json({ message: "workspaceId and title required" });
  }

  const insertTask = () => {
    db.query(
      `INSERT INTO tasks
       (workspace_id, project_id, title, description, assigned_to, created_by, priority, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [workspaceId, projectId || null, title, description || null, assignedTo || null, userId, priority || "MEDIUM", dueDate || null],
      (err, result) => {
        if (err) {
          logger.error("CREATE_TASK (insert) ERROR:", err);
          return res.status(500).json({ message: "Server error" });
        }

        const taskId = result.insertId;

        if (assignedTo) {
          Promise.resolve(
            createNotification(
              assignedTo, workspaceId, "TASK_ASSIGNED",
              `You got a new task: ${title}`, req
            )
          ).catch((notifyErr) => logger.error("CREATE_TASK (notify) ERROR:", notifyErr));
        }

        logActivity(organizationId, workspaceId, userId, `Created task: ${title}`).catch((actErr) => logger.error("CREATE_TASK (activity log) ERROR:", actErr));

        logger.success(`Task created: ${title}`, { taskId, workspaceId, projectId: projectId || null, createdBy: userId });

        return res.json({ message: "Task created successfully", taskId });
      }
    );
  };

  // If a project + assignee are both given, the assignee must be a
  // member of that project.
  if (assignedTo && projectId) {
    db.query(
      `SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?`,
      [projectId, assignedTo],
      (err, rows) => {
        if (err) {
          logger.error("CREATE_TASK (check project member) ERROR:", err);
          return res.status(500).json({ message: "Server error" });
        }
        if (rows.length === 0) {
          return res.status(400).json({ message: "Assignee must be a member of this project" });
        }
        insertTask();
      }
    );
  } else {
    insertTask();
  }
};

// GET TASKS
exports.getTasks = (req, res) => {
  const workspaceId = req.params.workspaceId;

  db.query(
    `SELECT 
        t.id,
        t.workspace_id,
        t.project_id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.due_date,
        t.created_by,
        t.created_at,
        t.assigned_to,
        CONCAT(u.first_name, ' ', u.last_name) AS assignedToName,
        (SELECT COUNT(*) FROM comments WHERE task_id = t.id) AS commentCount
     FROM tasks t
     LEFT JOIN users u ON t.assigned_to = u.id
     WHERE t.workspace_id = ?`,
    [workspaceId],
    (err, result) => {
      if (err) {
        logger.error("GET_TASKS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
      }
      res.json(result);
    }
  );
};

// UPDATE TASK STATUS
exports.updateTaskStatus = (req, res) => {
  const { taskId, status, workspaceId } = req.body;
  const userId = req.user.id;
  const organizationId = req.user.organization_id;

  if (!taskId || !status) {
    return res.status(400).json({ message: "taskId and status required" });
  }
  if (!VALID_TASK_STATUSES.includes(status)) {
    return res.status(400).json({ message: `Invalid status. Must be one of: ${VALID_TASK_STATUSES.join(", ")}` });
  }

  db.query(
    `UPDATE tasks SET status = ? WHERE id = ?`,
    [status, taskId],
    (err, result) => {
      if (err) {
        logger.error("UPDATE_TASK_STATUS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Task not found" });
      }

      logActivity(organizationId, workspaceId || null, userId, `Changed task ${taskId} status to ${status}`).catch((actErr) => logger.error("UPDATE_TASK_STATUS (activity log) ERROR:", actErr));

      logger.success(`Task status updated: ${taskId} -> ${status}`, { taskId, status, workspaceId: workspaceId || null, updatedBy: userId });

      res.json({ message: "Task status updated successfully" });
    }
  );
};

// UPDATE TASK
exports.updateTask = (req, res) => {
  const { id } = req.params;
  const { title, description, priority, assignedTo, workspaceId, dueDate } = req.body;
  const userId = req.user.id;
  const organizationId = req.user.organization_id;

  if (!title) {
    return res.status(400).json({ message: "Title is required" });
  }

  const applyUpdate = () => {
    db.query(
      // reminder_sent_at resets on every edit: if the due date changed,
      // this re-arms the reminder job; if it didn't, the task's next
      // reminder check just re-evaluates it, which is harmless.
      `UPDATE tasks
       SET title = ?, description = ?, priority = ?, assigned_to = ?, due_date = ?, reminder_sent_at = NULL
       WHERE id = ?`,
      [title, description || null, priority || "MEDIUM", assignedTo || null, dueDate || null, id],
      (err, result) => {
        if (err) {
          logger.error("UPDATE_TASK (update) ERROR:", err);
          return res.status(500).json({ message: "Server error" });
        }
        if (result.affectedRows === 0) {
          return res.status(404).json({ message: "Task not found" });
        }

        logActivity(organizationId, workspaceId || null, userId, `Updated task: ${title}`).catch((actErr) => logger.error("UPDATE_TASK (activity log) ERROR:", actErr));

        logger.success(`Task updated: ${title}`, { taskId: id, workspaceId: workspaceId || null, updatedBy: userId });

        res.json({ message: "Task updated successfully" });
      }
    );
  };

  if (assignedTo) {
    // Task's project isn't in the request body, so look it up first,
    // then confirm the new assignee actually belongs to that project.
    db.query(`SELECT project_id FROM tasks WHERE id = ?`, [id], (err, rows) => {
      if (err) {
        logger.error("UPDATE_TASK (lookup project) ERROR:", err);
        return res.status(500).json({ message: "Server error" });
      }
      if (rows.length === 0) return res.status(404).json({ message: "Task not found" });

      const projectId = rows[0].project_id;

      if (!projectId) {
        // Task has no project (workspace-only task) — nothing to validate against.
        return applyUpdate();
      }

      db.query(
        `SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?`,
        [projectId, assignedTo],
        (err2, memberRows) => {
          if (err2) {
            logger.error("UPDATE_TASK (check project member) ERROR:", err2);
            return res.status(500).json({ message: "Server error" });
          }
          if (memberRows.length === 0) {
            return res.status(400).json({ message: "Assignee must be a member of this project" });
          }
          applyUpdate();
        }
      );
    });
  } else {
    applyUpdate();
  }
};

// DELETE TASK
exports.deleteTask = (req, res) => {
  const { id } = req.params;
  const { workspaceId } = req.body;
  const userId = req.user.id;
  const organizationId = req.user.organization_id;

  db.query("SELECT title FROM tasks WHERE id = ?", [id], (err, rows) => {
    if (err) {
      logger.error("DELETE_TASK (lookup) ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }
    if (!rows.length) return res.status(404).json({ message: "Task not found" });

    const title = rows[0].title;

    db.query("DELETE FROM tasks WHERE id = ?", [id], (err2) => {
      if (err2) {
        logger.error("DELETE_TASK (delete) ERROR:", err2);
        return res.status(500).json({ message: "Server error" });
      }

      logActivity(organizationId, workspaceId || null, userId, `Deleted task: ${title}`).catch((actErr) => logger.error("DELETE_TASK (activity log) ERROR:", actErr));

      logger.success(`Task deleted: ${title}`, { taskId: id, workspaceId: workspaceId || null, deletedBy: userId });

      res.json({ message: "Task deleted successfully" });
    });
  });
};
