const db = require("../config/db");
const logger = require('../logger');
// GET notifications
exports.getNotifications = (req, res) => {

    logger.log("LOGGED USER:", req.user);

    const userId = req.user.id;

    db.query(
        `SELECT *
         FROM notifications
         WHERE user_id=?`,
        [userId],
        (err, result) => {

            if (err) {
                return res.status(500).json(err);
            }

            logger.log("RESULT:", result);

            res.json({
                loggedUser: userId,
                notifications: result
            });
        }
    );
};

exports.markAsRead = (req, res) => {

    const notificationId = req.params.id;
    const userId = req.user.id;

    db.query(
        `UPDATE notifications
         SET is_read = 1
         WHERE id = ? AND user_id = ?`,
        [notificationId, userId],
        (err, result) => {

            if (err) {
                return res.status(500).json(err);
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "Notification not found"
                });
            }

            res.json({
                message: "Notification marked as read"
            });
        }
    );
};

exports.markAllRead = (req, res) => {
  const userId = req.user.id;
  db.query(
    "UPDATE notifications SET is_read = 1 WHERE user_id = ?",
    [userId],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "All notifications marked as read" });
    }
  );
};