const db     = require("../config/db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const logActivity = require("../utils/logActivity");

const ROLE_RANK = { SUPER_ADMIN: 4, ADMIN: 3, SUB_ADMIN: 2, MEMBER: 1 };

exports.getOrgUsers = (req, res) => {
  const { organization_id } = req.user;

  db.query(
    `SELECT id, first_name, last_name, email, role, created_at, must_change_password
     FROM users
     WHERE organization_id = ?
     ORDER BY FIELD(role,'SUPER_ADMIN','ADMIN','SUB_ADMIN','MEMBER'), first_name`,
    [organization_id],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Server error" });
      res.json(rows);
    }
  );
};

exports.deleteUser = (req, res) => {
  const { userId } = req.params;
  const deleter    = req.user;

  if (parseInt(userId) === deleter.id) {
    return res.status(400).json({ message: "You cannot delete yourself" });
  }

  db.query(
    "SELECT role, organization_id FROM users WHERE id = ?",
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Server error" });
      if (!rows.length) return res.status(404).json({ message: "User not found" });

      const target = rows[0];

      if (target.organization_id !== deleter.organization_id) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (ROLE_RANK[target.role] >= ROLE_RANK[deleter.role]) {
        return res.status(403).json({ message: "You cannot delete a user with equal or higher role" });
      }

      db.query("DELETE FROM users WHERE id = ?", [userId], (err) => {
        if (err) return res.status(500).json({ message: "Server error" });
        logActivity(deleter.organization_id, null, deleter.id, `Deleted user ${userId}`).catch(() => {});
        res.json({ message: "User deleted successfully" });
      });
    }
  );
};

exports.changeUserRole = (req, res) => {
  const { userId, role } = req.body;
  const changer = req.user;

  if (!userId || !role) return res.status(400).json({ message: "userId and role required" });
  if (role === "SUPER_ADMIN") return res.status(403).json({ message: "Cannot assign SUPER_ADMIN role" });

  db.query(
    "SELECT role, organization_id FROM users WHERE id = ?",
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Server error" });
      if (!rows.length) return res.status(404).json({ message: "User not found" });

      const target = rows[0];

      if (target.organization_id !== changer.organization_id) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (ROLE_RANK[target.role] >= ROLE_RANK[changer.role]) {
        return res.status(403).json({ message: "Cannot change role of a user with equal or higher role" });
      }

      if (ROLE_RANK[role] >= ROLE_RANK[changer.role]) {
        return res.status(403).json({ message: "Cannot assign a role equal to or higher than yours" });
      }

      db.query(
        "UPDATE users SET role = ? WHERE id = ?",
        [role, userId],
        (err) => {
          if (err) return res.status(500).json({ message: "Server error" });
          logActivity(changer.organization_id, null, changer.id, `Changed role of user ${userId} to ${role}`).catch(() => {});
          res.json({ message: "Role updated successfully" });
        }
      );
    }
  );
};