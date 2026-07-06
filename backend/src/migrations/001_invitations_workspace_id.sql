-- ============================================================
-- MIGRATION: link organization invites to a workspace
-- Run this once against your existing org_db database.
-- ============================================================

ALTER TABLE invitations
    ADD COLUMN workspace_id INT NULL AFTER role;

ALTER TABLE invitations
    ADD CONSTRAINT fk_invitations_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL;

-- ============================================================
-- For fresh installs, the CREATE TABLE invitations statement in
-- schema.sql should instead read (workspace_id added, nullable):
--
-- CREATE TABLE invitations (
--     id              INT AUTO_INCREMENT PRIMARY KEY,
--     organization_id INT           NOT NULL,
--     email           VARCHAR(255)  NOT NULL,
--     role            ENUM('ADMIN','SUB_ADMIN','MEMBER') NOT NULL DEFAULT 'MEMBER',
--     workspace_id    INT           NULL,
--     temp_password   VARCHAR(255)  NOT NULL,
--     token           VARCHAR(255)  NOT NULL UNIQUE,
--     invited_by      INT           NOT NULL,
--     status          ENUM('PENDING','ACCEPTED','EXPIRED') DEFAULT 'PENDING',
--     expires_at      TIMESTAMP     NOT NULL,
--     created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
--
--     FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
--     FOREIGN KEY (invited_by)      REFERENCES users(id)         ON DELETE CASCADE,
--     FOREIGN KEY (workspace_id)    REFERENCES workspaces(id)    ON DELETE SET NULL
-- );
-- ============================================================
