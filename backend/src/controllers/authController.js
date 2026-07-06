const db     = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const { generateAccessToken, generateRefreshToken } = require("../utils/tokens");
const sendEmail = require("../utils/sendEmail");
const crypto = require("crypto");
const logger = require('../logger');

const slugifyDomain = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 63);

exports.register = async (req, res) => {
  const { first_name, last_name, email, password, organization_name, organization_domain } = req.body;

  if (!first_name || !last_name || !email || !password || !organization_name) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const slug   = slugifyDomain(organization_name);
  const domain = (organization_domain?.trim() || (slug ? `${slug}.com` : "")).toLowerCase() || null;

  db.query("SELECT id FROM users WHERE email = ?", [email], async (err, rows) => {
    if (err) return res.status(500).json({ message: "Server error" });
    if (rows.length > 0) return res.status(400).json({ message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);

    db.query(
      "INSERT INTO organizations (name, domain) VALUES (?, ?)",
      [organization_name, domain],
      (err, orgResult) => {
        if (err) return res.status(500).json({ message: "Server error" });
        const organizationId = orgResult.insertId;

        db.query(
          `INSERT INTO users
           (first_name, last_name, email, password, role, organization_id, must_change_password)
           VALUES (?, ?, ?, ?, 'SUPER_ADMIN', ?, FALSE)`,
          [first_name, last_name, email, hashed, organizationId],
          (err, userResult) => {
            if (err) return res.status(500).json({ message: "Server error" });
            const userId = userResult.insertId;

            db.query(
              "UPDATE organizations SET owner_id = ? WHERE id = ?",
              [userId, organizationId],
              (err) => {
                if (err) return res.status(500).json({ message: "Server error" });

                logger.success(`Organization registered: ${organization_name}`, { organizationId, userId, email });

                return res.status(201).json({
                  message: "Organization and Super Admin created successfully",
                  organizationId,
                  userId,
                  domain,
                });
              }
            );
          }
        );
      }
    );
  });
};

exports.login = (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, rows) => {
    if (err) return res.status(500).json({ message: "Server error" });
    if (!rows.length) return res.status(404).json({ message: "User not found" });

    const user = rows[0];

    // ✅ No password set — first time login
    if (!user.password) {
      const { loginType } = req.body;
  if (loginType === "organization" && user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ message: "This account isn't a Super Admin. Please use the User login instead." });
  }
  if (loginType === "user" && user.role === "SUPER_ADMIN") {
    return res.status(403).json({ message: "Super Admin accounts should log in from the Organization tab." });
  }
      // log failed/first-time attempt
      const ip     = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
      const device = req.headers["user-agent"] || "Unknown";
      db.query(
        "INSERT INTO login_history (user_id, ip_address, device, status) VALUES (?,?,?,'SUCCESS')",
        [user.id, ip, device],
        (err) => {
          if (err) logger.error("LOGIN_HISTORY INSERT ERROR:", err);
        }
      );

      return res.status(200).json({
        must_set_password: true,
        userId:  user.id,
        email:   user.email,
        message: "Please set your password to continue",
      });
    }

    if (!password) {
      return res.status(400).json({ message: "Password required" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      // ✅ Log failed login
      const ip     = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
      const device = req.headers["user-agent"] || "Unknown";
      db.query(
        "INSERT INTO login_history (user_id, ip_address, device, status) VALUES (?,?,?,'FAILED')",
        [user.id, ip, device],
        (err) => {
          if (err) logger.error("LOGIN_HISTORY INSERT ERROR:", err);
        }
      );
      return res.status(400).json({ message: "Wrong password" });
    }

    const { loginType } = req.body;
if (loginType === "organization" && user.role !== "SUPER_ADMIN") {
  return res.status(403).json({ message: "This account isn't a Super Admin. Please use the User login instead." });
}
if (loginType === "user" && user.role === "SUPER_ADMIN") {
  return res.status(403).json({ message: "Super Admin accounts should log in from the Organization tab." });
}

    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    db.query("UPDATE users SET refresh_token = ? WHERE id = ?", [refreshToken, user.id]);

    // ✅ Log successful login
    const ip     = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const device = req.headers["user-agent"] || "Unknown";

    db.query(
      "INSERT INTO login_history (user_id, ip_address, device, status) VALUES (?,?,?,'SUCCESS')",
      [user.id, ip, device],
      (err) => {
        if (err) logger.error("LOGIN_HISTORY INSERT ERROR:", err);
      }
    );

    // ✅ Upsert session (one active session row per user_id)
    db.query(
      `INSERT INTO sessions (user_id, token, ip_address, device)
       VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE token = VALUES(token), ip_address = VALUES(ip_address), device = VALUES(device)`,
      [user.id, accessToken, ip, device],
      (err) => {
        if (err) logger.error("SESSIONS INSERT ERROR:", err);
      }
    );

    logger.success(`User logged in: ${user.email}`, { userId: user.id });

    return res.json({
      accessToken,
      refreshToken,
      must_set_password:    false,
      must_change_password: user.must_change_password,
      user: {
        id:              user.id,
        first_name:      user.first_name,
        last_name:       user.last_name,
        email:           user.email,
        role:            user.role,
        organization_id: user.organization_id,
      },
    });
  });
};

exports.refreshToken = (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ message: "No token" });

  jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid refresh token" });

    db.query("SELECT * FROM users WHERE id = ?", [decoded.id], (err, rows) => {
      if (err) return res.status(500).json({ message: "Server error" });
      if (!rows.length) return res.status(404).json({ message: "User not found" });

      const user = rows[0];
      if (user.refresh_token !== token) {
        return res.status(403).json({ message: "Token mismatch" });
      }

      const newAccessToken = generateAccessToken(user);

      logger.success(`Access token refreshed: ${user.email}`, { userId: user.id });

      res.json({ accessToken: newAccessToken });
    });
  });
};

exports.changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  const userId = req.user.id;

  if (!current_password) {
    return res.status(400).json({ message: "Current password is required" });
  }
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ message: "New password must be at least 6 characters" });
  }

  db.query("SELECT password FROM users WHERE id = ?", [userId], async (err, rows) => {
    if (err) return res.status(500).json({ message: "Server error" });
    if (!rows.length) return res.status(404).json({ message: "User not found" });

    const currentHash = rows[0].password;

    // Accounts created without a password yet (e.g. pending first-login /
    // org-created accounts) can't "change" a password that doesn't exist —
    // they should go through /auth/set-password instead.
    if (!currentHash) {
      return res.status(400).json({ message: "No password set on this account yet. Use the set-password flow instead." });
    }

    const isMatch = await bcrypt.compare(current_password, currentHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    if (current_password === new_password) {
      return res.status(400).json({ message: "New password must be different from the current password" });
    }

    const hashed = await bcrypt.hash(new_password, 10);

    db.query(
      "UPDATE users SET password = ?, must_change_password = FALSE WHERE id = ?",
      [hashed, userId],
      (err) => {
        if (err) return res.status(500).json({ message: "Server error" });

        logger.success(`Password changed: user ${userId}`, { userId });

        res.json({ message: "Password changed successfully" });
      }
    );
  });
};


// ✅ Set password — first time login only
exports.setPassword = async (req, res) => {
  const { userId, password } = req.body;

  if (!userId || !password) {
    return res.status(400).json({ message: "userId and password required" });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  db.query("SELECT * FROM users WHERE id = ?", [userId], async (err, rows) => {
    if (err) return res.status(500).json({ message: "Server error" });
    if (!rows.length) return res.status(404).json({ message: "User not found" });

    const user = rows[0];

    if (user.password) {
      return res.status(400).json({ message: "Password already set. Use change password instead." });
    }

    const hashed = await bcrypt.hash(password, 10);

    db.query(
      "UPDATE users SET password = ?, must_change_password = FALSE WHERE id = ?",
      [hashed, user.id],
      (err) => {
        if (err) return res.status(500).json({ message: "Server error" });

        const accessToken  = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        db.query("UPDATE users SET refresh_token = ? WHERE id = ?", [refreshToken, user.id]);

        // ✅ Log session after password set
        const ip     = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
        const device = req.headers["user-agent"] || "Unknown";

        db.query(
          "INSERT INTO login_history (user_id, ip_address, device, status) VALUES (?,?,?,'SUCCESS')",
          [user.id, ip, device],
          (err) => {
            if (err) logger.error("LOGIN_HISTORY INSERT ERROR:", err);
          }
        );

        db.query(
          `INSERT INTO sessions (user_id, token, ip_address, device)
           VALUES (?,?,?,?)
           ON DUPLICATE KEY UPDATE token = VALUES(token), ip_address = VALUES(ip_address), device = VALUES(device)`,
          [user.id, accessToken, ip, device],
          (err) => {
            if (err) logger.error("SESSIONS INSERT ERROR:", err);
          }
        );

        logger.success(`Password set (first login): ${user.email}`, { userId: user.id });

        return res.json({
          message: "Password set successfully",
          accessToken,
          refreshToken,
          user: {
            id:              user.id,
            first_name:      user.first_name,
            last_name:       user.last_name,
            email:           user.email,
            role:            user.role,
            organization_id: user.organization_id,
          },
        });
      }
    );
  });
};

// ✅ Admin creates a user — org email auto-generated from org's domain
exports.createUser = async (req, res) => {
  const { first_name, last_name, personal_email, role } = req.body;
  const adminOrgId = req.user.organization_id;

  if (!first_name || !last_name || !role) {
    return res.status(400).json({ message: "first_name, last_name, and role are required" });
  }

  const allowedRoles = ["ADMIN", "SUB_ADMIN", "MEMBER"];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  db.query("SELECT domain, name FROM organizations WHERE id = ?", [adminOrgId], (err, orgRows) => {
    if (err) return res.status(500).json({ message: "Server error" });
    if (!orgRows.length || !orgRows[0].domain) {
      return res.status(400).json({ message: "Organization domain not configured" });
    }

    const domain    = orgRows[0].domain;
    const orgName   = orgRows[0].name;
    const localPart = `${first_name}.${last_name}`.toLowerCase().replace(/[^a-z0-9.]/g, "");
    const orgEmail  = `${localPart}@${domain}`;

    db.query("SELECT id FROM users WHERE email = ?", [orgEmail], (err, existing) => {
      if (err) return res.status(500).json({ message: "Server error" });
      if (existing.length > 0) {
        return res.status(400).json({ message: `Generated email ${orgEmail} is already taken` });
      }

      db.query(
        `INSERT INTO users
         (first_name, last_name, email, personal_email, password, role, organization_id, must_change_password)
         VALUES (?, ?, ?, ?, NULL, ?, ?, FALSE)`,
        [first_name, last_name, orgEmail, personal_email || null, role, adminOrgId],
        async (err, result) => {
          if (err) return res.status(500).json({ message: "Server error" });

          let emailSent = false;

          if (personal_email) {
            try {
              await sendEmail({
                to: personal_email,
                subject: `Your ${orgName} login for Taskflow`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 32px; border-radius: 12px;">
                    <div style="text-align: center; margin-bottom: 24px;">
                      <h2 style="color: #4F6EF7; margin: 0;">Welcome to Taskflow</h2>
                      <p style="color: #666; margin-top: 8px;">Your company account is ready</p>
                    </div>
                    <div style="background: #fff; border-radius: 8px; padding: 24px; border: 1px solid #e5e7eb;">
                      <p>Hi <strong>${first_name}</strong>,</p>
                      <p>You've been added to <strong>${orgName}</strong> on Taskflow as <strong>${role}</strong>.</p>
                      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #4F6EF7;">
                        <p style="margin: 0 0 6px; font-weight: bold; color: #333;">Your Company Email</p>
                        <p style="margin: 0; font-size: 18px; color: #4F6EF7; font-weight: bold;">${orgEmail}</p>
                      </div>
                      <div style="background: #fef3c7; border-radius: 8px; padding: 14px; margin: 16px 0; border-left: 4px solid #f59e0b;">
                        <p style="margin: 0; color: #92400e; font-size: 13px;">
                          ℹ️ When you first log in with your company email, you will be prompted to set your own password.
                        </p>
                      </div>
                      <div style="text-align: center; margin: 24px 0;">
                        <a href="${process.env.FRONTEND_URL}" style="display:inline-block;background:#4F6EF7;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Login to Taskflow</a>
                      </div>
                    </div>
                    <p style="color: #999; font-size: 11px; text-align: center; margin-top: 16px;">
                      If you did not expect this email, please contact your administrator.
                    </p>
                  </div>
                `,
              });
              emailSent = true;
            } catch (mailErr) {
              logger.error("CREATE-USER EMAIL ERROR:", mailErr);
            }
          }

          logger.success(`User created: ${orgEmail}`, { userId: result.insertId, role, organizationId: adminOrgId, emailSent });

          return res.status(201).json({
            message:   emailSent
              ? `Account created and details sent to ${personal_email}`
              : "User created successfully",
            userId:    result.insertId,
            email:     orgEmail,
            emailSent,
          });
        }
      );
    });
  });
};

exports.forgotPassword = (req, res) => {
  const { email, personal_email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  db.query(
    "SELECT id, first_name, email, personal_email FROM users WHERE email = ?",
    [email],
    async (err, rows) => {
      if (err) return res.status(500).json({ message: "Server error" });

      const genericResponse = { message: "If that email exists, a reset link has been sent." };
      if (!rows.length) return res.json(genericResponse);

      const user = rows[0];
      let targetEmail;

      if (personal_email) {
        const matches =
          user.personal_email &&
          user.personal_email.toLowerCase() === personal_email.trim().toLowerCase();
        if (!matches) return res.json(genericResponse);
        targetEmail = user.personal_email;
      } else {
        targetEmail = user.email;
      }

      const token   = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 30 * 60 * 1000);

      db.query(
        "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?",
        [token, expires, user.id],
        async (err) => {
          if (err) return res.status(500).json({ message: "Server error" });

          const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;

          try {
            await sendEmail({
              to: targetEmail,
              subject: "Reset your Taskflow password",
              html: `
                <p>Hi ${user.first_name},</p>
                <p>Click the link below to reset your password. This link expires in 30 minutes.</p>
                <p><a href="${resetLink}">${resetLink}</a></p>
                <p>If you didn't request this, you can safely ignore this email.</p>
              `,
            });
            logger.success(`Password reset email sent: ${targetEmail}`, { userId: user.id });
          } catch (mailErr) {
            logger.error("FORGOT-PASSWORD EMAIL ERROR:", mailErr);
          }

          return res.json(genericResponse);
        }
      );
    }
  );
};

exports.resetPassword = async (req, res) => {
  const { token, new_password } = req.body;

  if (!token || !new_password) {
    return res.status(400).json({ message: "Token and new password are required" });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  db.query(
    "SELECT id, reset_token_expires FROM users WHERE reset_token = ?",
    [token],
    async (err, rows) => {
      if (err) return res.status(500).json({ message: "Server error" });
      if (!rows.length) return res.status(400).json({ message: "Invalid or expired reset link" });

      const user = rows[0];
      if (new Date(user.reset_token_expires) < new Date()) {
        return res.status(400).json({ message: "Reset link has expired" });
      }

      const hashed = await bcrypt.hash(new_password, 10);

      db.query(
        "UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?",
        [hashed, user.id],
        (err) => {
          if (err) return res.status(500).json({ message: "Server error" });

          logger.success(`Password reset completed: user ${user.id}`, { userId: user.id });

          return res.json({ message: "Password reset successfully. You can now log in." });
        }
      );
    }
  );
};
