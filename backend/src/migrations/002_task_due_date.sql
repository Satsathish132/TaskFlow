-- ============================================================
-- MIGRATION: due dates + reminder tracking on tasks
-- ============================================================

ALTER TABLE tasks
    ADD COLUMN due_date DATETIME NULL AFTER priority,
    ADD COLUMN reminder_sent_at DATETIME NULL AFTER due_date;

-- reminder_sent_at tracks whether the "due soon / overdue" notification
-- has already fired for a task's *current* due_date. taskController.js
-- resets it to NULL on every update, so changing the due date re-arms
-- the reminder.
