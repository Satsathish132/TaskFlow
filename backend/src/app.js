const express = require("express");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const jwt = require("jsonwebtoken");
const logger = require('./logger');

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));

const db = require("./config/db");

logger.info(`CLIENT ID: ${process.env.GOOGLE_CLIENT_ID}`);
logger.info(`CLIENT SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? "loaded " : "MISSING ❌"}`);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// ===================== GOOGLE OAUTH STRATEGY =====================
passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.API_URL}/api/auth/google/callback`,
      proxy: true,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email      = profile.emails[0].value;
        const first_name = profile.name.givenName  || "";
        const last_name  = profile.name.familyName || "";
        const google_id  = profile.id;

        logger.info('Google profile received', { email, first_name, last_name });

        const [existing] = await db.promise().query(
          "SELECT * FROM users WHERE email = ?",
          [email]
        );

        if (existing.length > 0) {
          logger.info(`Existing user found: ${existing[0].email}`);
          if (!existing[0].google_id) {
            await db.promise().query(
              "UPDATE users SET google_id = ? WHERE email = ?",
              [google_id, email]
            );
          }
          return done(null, existing[0]);
        }

        // ✅ New Google user → create organization + SUPER_ADMIN
        logger.info(`Creating new Google user: ${email}`);

        const [orgResult] = await db.promise().query(
          "INSERT INTO organizations (name) VALUES (?)",
          [`${first_name}'s Organization`]
        );
        const organizationId = orgResult.insertId;

        const [userResult] = await db.promise().query(
          `INSERT INTO users
           (first_name, last_name, email, google_id, role, organization_id, must_change_password)
           VALUES (?, ?, ?, ?, 'SUPER_ADMIN', ?, FALSE)`,
          [first_name, last_name, email, google_id, organizationId]
        );

        // ✅ Set owner_id on the organization
        await db.promise().query(
          "UPDATE organizations SET owner_id = ? WHERE id = ?",
          [userResult.insertId, organizationId]
        );

        const [newUser] = await db.promise().query(
          "SELECT * FROM users WHERE id = ?",
          [userResult.insertId]
        );

        return done(null, newUser[0]);
      } catch (err) {
        logger.error('Google Strategy Error', { error: err.message, stack: err.stack });
        return done(err, null);
      }
    }
  )
);

// ===================== GOOGLE AUTH ROUTES =====================
app.get("/api/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
    prompt: "select_account",
  })
);

app.get("/api/auth/google/callback",
  (req, res, next) => {
    passport.authenticate("google", { session: false },
      (err, user, info) => {
        if (err) {
          logger.error('PASSPORT ERROR', { error: err.message, stack: err.stack });
          return res.redirect(`${process.env.CLIENT_URL}?error=google_failed`);
        }
        if (!user) {
          logger.error('NO USER RETURNED', { info });
          return res.redirect(`${process.env.CLIENT_URL}?error=google_failed`);
        }

        try {
          // ✅ Include role and organization_id in token
          const accessToken = jwt.sign(
            {
              id:              user.id,
              email:           user.email,
              role:            user.role,
              organization_id: user.organization_id,
            },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: "1d" }
          );

          const refreshToken = jwt.sign(
            { id: user.id },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: "7d" }
          );

          const userPayload = encodeURIComponent(JSON.stringify({
            id:              user.id,
            first_name:      user.first_name,
            last_name:       user.last_name,
            email:           user.email,
            role:            user.role,             // ✅ added
            organization_id: user.organization_id,  // ✅ added
          }));

          // ✅ Record this session and login event, matching the real
          // schema used by authController.js's login function
          db.query(
            "INSERT INTO sessions (user_id, token, ip_address, device) VALUES (?, ?, ?, ?)",
            [user.id, accessToken, req.ip, req.headers["user-agent"] || null]
          );
          db.query(
            "INSERT INTO login_history (user_id, ip_address, device, status) VALUES (?, ?, ?, 'SUCCESS')",
            [user.id, req.ip, req.headers["user-agent"] || null]
          );

          logger.info(`Google login success: ${user.email}`);

          return res.redirect(`${process.env.CLIENT_URL}?accessToken=${accessToken}&refreshToken=${refreshToken}&user=${userPayload}`);
          
        } catch (tokenErr) {
          logger.error('Token generation error', { error: tokenErr.message, stack: tokenErr.stack });
          return res.redirect(`${process.env.CLIENT_URL}?error=google_failed`);
        }
      }
    )(req, res, next);
  }
);

// ===================== ROUTES =====================
const authRoutes         = require("./routes/authRoutes");
const workspaceRoutes    = require("./routes/workspaceRoutes");
const memberRoutes       = require("./routes/memberRoutes");
const projectRoutes      = require("./routes/projectRoutes");
const taskRoutes         = require("./routes/taskRoutes");
const commentRoutes      = require("./routes/commentRoutes");
const activityRoutes     = require("./routes/activityRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const userRoutes         = require("./routes/userRoutes");
const taskFilesRoutes    = require("./routes/taskFiles.routes");
const settingsRoutes = require("./routes/settingsRoutes");
require("./jobs/purgeWorkspaceBackups");

app.use("/api/auth",          authRoutes);
app.use("/api/workspaces",    workspaceRoutes);
app.use("/api/members",       memberRoutes);
app.use("/api/projects",      projectRoutes);
app.use("/api/tasks",         taskRoutes);
app.use("/api/comments",      commentRoutes);
app.use("/api/activity",      activityRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/users",         userRoutes);
app.use("/api",               taskFilesRoutes);
app.use("/api/settings", settingsRoutes);

// ===================== SOCKET.IO =====================
const io = new Server(server, {
  cors: { origin: "*" }
});

app.set("io", io);
require("./utils/io").setIO(io); // NEW

io.on("connection", (socket) => {
  logger.info(` User connected: ${socket.id}`);
  socket.on("join", (userId) => {
    socket.join(`user_${userId}`);
    logger.info(`User joined room: user_${userId}`);
  });
  socket.on("disconnect", () => {
    logger.info(' User disconnected');
  });
});

// ===================== HEALTH CHECK =====================
app.get("/", (req, res) => {
  res.json({ success: true, message: "API running" });
});

// ===================== 404 =====================
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
});

// ===================== START SERVER =====================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  logger.info(` Server running on port ${PORT}`);
});
