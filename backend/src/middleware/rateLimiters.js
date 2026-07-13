const rateLimit = require("express-rate-limit");

// Keyed by IP by default. Combined with the generic "if that email exists"
// response in forgotPassword, this stops both inbox-spam and email-enumeration
// attempts via brute force.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                   // 5 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

// Reset tokens are 32-byte random hex, so brute force is already infeasible —
// this is just a cheap extra layer against automated abuse of the endpoint.
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

// Bonus: login is the other classic brute-force target and currently has
// no limiter at all. Not something you asked for, but worth having —
// remove this export/usage if you'd rather handle it separately.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again later." },
});

module.exports = { forgotPasswordLimiter, resetPasswordLimiter, loginLimiter };
