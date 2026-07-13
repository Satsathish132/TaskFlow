const cron = require("node-cron");
const util = require("util");
const db = require("../config/db");
const logger = require("../logger");
const { getIO } = require("../utils/io"); // NEW — added at the top with other requires

const query = util.promisify(db.query).bind(db);

async function purgeExpiredBackups() {
    try {
        // 1. Warn once, 7 days before expiry
        const expiringSoon = await query(
            `SELECT id, organization_id, name, deleted_by, expires_at
             FROM workspace_backups
             WHERE expires_at <= DATE_ADD(NOW(), INTERVAL 7 DAY)
               AND expires_at > NOW()
               AND notified_expiring = FALSE`
        );

        for (const b of expiringSoon) {
            await query(
                `INSERT INTO notifications (user_id, organization_id, type, message)
                 VALUES (?, ?, 'backup_expiring', ?)`,
                [b.deleted_by, b.organization_id, `Backup "${b.name}" will be permanently deleted soon.`]
            );

            // ── NEW: emit right after the insert above, inside this same loop ──
            const io = getIO();
            if (io) {
                io.to(`user_${b.deleted_by}`).emit("notification", {
                    type: "backup_expiring",
                    message: `Backup "${b.name}" will be permanently deleted soon.`,
                });
            }
            // ────────────────────────────────────────────────────────────────

            await query(`UPDATE workspace_backups SET notified_expiring = TRUE WHERE id = ?`, [b.id]);
        }

        // 2. Permanently purge anything past expiry, notify the deleter
        const expired = await query(
            `SELECT id, organization_id, name, deleted_by FROM workspace_backups WHERE expires_at <= NOW()`
        );

        for (const b of expired) {
            await query(
                `INSERT INTO notifications (user_id, organization_id, type, message)
                 VALUES (?, ?, 'backup_deleted', ?)`,
                [b.deleted_by, b.organization_id, `Backup "${b.name}" was permanently deleted after 30 days.`]
            );

            // ── NEW: emit right after this insert too, inside this loop ──
            const io = getIO();
            if (io) {
                io.to(`user_${b.deleted_by}`).emit("notification", {
                    type: "backup_deleted",
                    message: `Backup "${b.name}" was permanently deleted after 30 days.`,
                });
            }
            // ──────────────────────────────────────────────────────────────
        }

        if (expired.length) {
            const ids = expired.map((b) => b.id);
            await query(`DELETE FROM workspace_backups WHERE id IN (?)`, [ids]);
        }

        logger.success(`Backup purge run: ${expiringSoon.length} warned, ${expired.length} deleted.`);
    } catch (err) {
        logger.error("PURGE_WORKSPACE_BACKUPS ERROR:", err);
    }
}

// Daily at 2 AM
cron.schedule("0 2 * * *", purgeExpiredBackups);

module.exports = { purgeExpiredBackups };
