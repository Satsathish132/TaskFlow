-- ============================================================
--  MIGRATION: Task file attachments
--  Members assigned to a task, and any admin (ADMIN/SUB_ADMIN/
--  SUPER_ADMIN) in the same organization, can upload and view files.
-- ============================================================

USE org_db;

CREATE TABLE IF NOT EXISTS task_files (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    task_id       INT           NOT NULL,
    uploaded_by   INT           NOT NULL,
    original_name VARCHAR(255)  NOT NULL,   -- name shown to users
    stored_name   VARCHAR(255)  NOT NULL,   -- actual filename on disk (uuid-based)
    mime_type     VARCHAR(150)  NULL,
    size_bytes    INT           NOT NULL,
    uploaded_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (task_id)     REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_task_files_task ON task_files (task_id);
