-- ============================================================
--  SCHEMA: Multi-Tenant Organization System
--  Roles: SUPER_ADMIN > ADMIN > SUB_ADMIN > MEMBER
-- ============================================================

CREATE DATABASE IF NOT EXISTS org_db;
USE org_db;

-- ─────────────────────────────────────────
-- 1. ORGANIZATIONS
--    Every Super Admin owns one organization.
-- ─────────────────────────────────────────
CREATE TABLE organizations (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(255)  NOT NULL,
    owner_id     INT           NULL,          -- set after Super Admin user is created
    created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────
-- 2. USERS
--    Super Admin registers → org created → they become owner.
--    All other users are invited by Super Admin / Admin / Sub Admin.
-- ─────────────────────────────────────────
CREATE TABLE users (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    first_name          VARCHAR(100)  NOT NULL,
    last_name           VARCHAR(100)  NOT NULL,
    email               VARCHAR(100)  NOT NULL UNIQUE,
    password            VARCHAR(255)  NULL,                          -- NULL for Google-only accounts
    google_id           VARCHAR(255)  NULL,
    role                ENUM('SUPER_ADMIN','ADMIN','SUB_ADMIN','MEMBER') NOT NULL DEFAULT 'MEMBER',
    organization_id     INT           NULL,
    created_by          INT           NULL,                          -- who invited this user
    must_change_password BOOLEAN      DEFAULT FALSE,                 -- TRUE for temp-password users
    refresh_token       TEXT          NULL,
    created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by)      REFERENCES users(id)         ON DELETE SET NULL
);

-- Back-fill owner_id now that users table exists
ALTER TABLE organizations
    ADD CONSTRAINT fk_org_owner
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────
-- 3. INVITATIONS
--    Super Admin / Admin / Sub Admin create invitations.
--    Token is emailed; user clicks link and is forced to set password.
-- ─────────────────────────────────────────
CREATE TABLE invitations (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT           NOT NULL,
    email           VARCHAR(255)  NOT NULL,
    role            ENUM('ADMIN','SUB_ADMIN','MEMBER') NOT NULL DEFAULT 'MEMBER',
    temp_password   VARCHAR(255)  NOT NULL,                   -- hashed temp password
    token           VARCHAR(255)  NOT NULL UNIQUE,
    invited_by      INT           NOT NULL,
    status          ENUM('PENDING','ACCEPTED','EXPIRED') DEFAULT 'PENDING',
    expires_at      TIMESTAMP     NOT NULL,
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by)      REFERENCES users(id)         ON DELETE CASCADE
);

-- ─────────────────────────────────────────
-- 4. WORKSPACES
--    Scoped to an organization.
-- ─────────────────────────────────────────
CREATE TABLE workspaces (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT           NOT NULL,
    name            VARCHAR(255)  NOT NULL,
    description     TEXT          NULL,
    created_by      INT           NOT NULL,
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by)      REFERENCES users(id)         ON DELETE CASCADE
);

-- ─────────────────────────────────────────
-- 5. WORKSPACE MEMBERS
--    Tracks which users belong to which workspace.
-- ─────────────────────────────────────────
CREATE TABLE workspace_members (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    workspace_id INT NOT NULL,
    user_id      INT NOT NULL,
    joined_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_ws_member (workspace_id, user_id),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)      REFERENCES users(id)      ON DELETE CASCADE
);

-- ─────────────────────────────────────────
-- 6. PROJECTS
-- ─────────────────────────────────────────
CREATE TABLE projects (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    workspace_id INT           NOT NULL,
    name         VARCHAR(255)  NOT NULL,
    description  TEXT          NULL,
    created_by   INT           NOT NULL,
    created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by)   REFERENCES users(id)      ON DELETE CASCADE
);

-- ─────────────────────────────────────────
-- 7. PROJECT MEMBERS
-- ─────────────────────────────────────────
CREATE TABLE project_members (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    user_id    INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_proj_member (project_id, user_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
);

-- ─────────────────────────────────────────
-- 8. TASKS
-- ─────────────────────────────────────────
CREATE TABLE tasks (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    workspace_id INT           NOT NULL,
    project_id   INT           NULL,
    title        VARCHAR(255)  NOT NULL,
    description  TEXT          NULL,
    status       ENUM('TODO','IN_PROGRESS','DONE') DEFAULT 'TODO',
    priority     ENUM('LOW','MEDIUM','HIGH')        DEFAULT 'MEDIUM',
    assigned_to  INT           NULL,
    created_by   INT           NOT NULL,
    created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id)   REFERENCES projects(id)   ON DELETE SET NULL,
    FOREIGN KEY (assigned_to)  REFERENCES users(id)      ON DELETE SET NULL,
    FOREIGN KEY (created_by)   REFERENCES users(id)      ON DELETE CASCADE
);

-- ─────────────────────────────────────────
-- 9. COMMENTS
-- ─────────────────────────────────────────
CREATE TABLE comments (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    task_id    INT  NOT NULL,
    user_id    INT  NOT NULL,
    comment    TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────
-- 10. ACTIVITY LOGS
-- ─────────────────────────────────────────
CREATE TABLE activity_logs (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT           NULL,
    workspace_id    INT           NULL,
    user_id         INT           NOT NULL,
    action          VARCHAR(255)  NOT NULL,
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id)    REFERENCES workspaces(id)    ON DELETE CASCADE,
    FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE
);

-- ─────────────────────────────────────────
-- 11. NOTIFICATIONS
-- ─────────────────────────────────────────
CREATE TABLE notifications (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT           NOT NULL,
    organization_id INT           NULL,
    workspace_id    INT           NULL,
    type            VARCHAR(100)  NOT NULL,
    message         TEXT          NOT NULL,
    is_read         BOOLEAN       DEFAULT FALSE,
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id)    REFERENCES workspaces(id)    ON DELETE CASCADE
);

-- 1. Create an organization for your existing user
INSERT INTO organizations (name, owner_id) VALUES ('My Organization', 1);

-- 2. Link user to that organization and set role
UPDATE users 
SET organization_id = 1, role = 'SUPER_ADMIN' 
WHERE id = 1;

-- 3. Verify
SELECT id, email, role, organization_id FROM users WHERE id = 1;

---workspace_invites

CREATE TABLE workspace_invites (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    workspace_id INT           NOT NULL,
    email        VARCHAR(255)  NOT NULL,
    token        VARCHAR(255)  NOT NULL UNIQUE,
    invited_by   INT           NOT NULL,
    status       ENUM('PENDING','ACCEPTED','EXPIRED') DEFAULT 'PENDING',
    expires_at   TIMESTAMP     NULL,
    created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by)   REFERENCES users(id)      ON DELETE CASCADE
);

ALTER TABLE invitations
    ADD COLUMN workspace_id INT NULL AFTER role;

ALTER TABLE invitations
    ADD CONSTRAINT fk_invitations_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL;

DESCRIBE organizations;
DESCRIBE users;

ALTER TABLE organizations ADD COLUMN domain VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN personal_email VARCHAR(100) NULL;

UPDATE organizations SET domain = 'yourorg.com' WHERE id = 1;
SELECT * FROM organizations;
UPDATE organizations SET domain = 'yourorg.com' WHERE id = 1;

SELECT id, name, domain FROM organizations WHERE id = 4;

ALTER TABLE workspace_invites
    ADD COLUMN project_id INT NULL AFTER workspace_id,
    ADD CONSTRAINT fk_invite_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

ALTER TABLE users
    ADD COLUMN reset_token VARCHAR(255) NULL,
    ADD COLUMN reset_token_expires TIMESTAMP NULL;

-- Login history
CREATE TABLE login_history (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT          NOT NULL,
    ip_address VARCHAR(45)  NULL,
    device     VARCHAR(255) NULL,
    status     ENUM('SUCCESS','FAILED') DEFAULT 'SUCCESS',
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Active sessions
CREATE TABLE sessions (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT          NOT NULL,
    token         VARCHAR(500) NOT NULL,
    ip_address    VARCHAR(45)  NULL,
    device        VARCHAR(255) NULL,
    last_active   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notification preferences
CREATE TABLE notification_preferences (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    user_id                 INT     NOT NULL UNIQUE,
    email_notifications     BOOLEAN DEFAULT TRUE,
    inapp_notifications     BOOLEAN DEFAULT TRUE,
    task_assignment         BOOLEAN DEFAULT TRUE,
    task_comment            BOOLEAN DEFAULT TRUE,
    due_date_reminder       BOOLEAN DEFAULT TRUE,
    workspace_invite        BOOLEAN DEFAULT TRUE,
    chat_mention            BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

USE org_db;

CREATE TABLE IF NOT EXISTS user_sessions (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT           NOT NULL,
    refresh_token VARCHAR(500)  NOT NULL,
    user_agent    VARCHAR(255)  NULL,
    ip_address    VARCHAR(45)   NULL,
    created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    last_active   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user ON user_sessions (user_id);

CREATE TABLE IF NOT EXISTS login_history (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT           NOT NULL,
    ip_address VARCHAR(45)   NULL,
    user_agent VARCHAR(255)  NULL,
    status     ENUM('SUCCESS','FAILED') NOT NULL,
    created_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_login_history_user ON login_history (user_id);

ALTER TABLE users
    ADD COLUMN two_factor_enabled BOOLEAN      DEFAULT FALSE,
    ADD COLUMN two_factor_secret  VARCHAR(255) NULL;