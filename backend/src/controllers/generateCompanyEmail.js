const db = require("../config/db");

const generateCompanyEmail = async (first_name, last_name, domain) => {
  const clean = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
  const base  = `${clean(first_name)}.${clean(last_name)}`;
  let email   = `${base}@${domain}`;

  // check if base email exists
  const [existing] = await db.promise().query(
    "SELECT email FROM users WHERE email LIKE ?",
    [`${base}%@${domain}`]
  );

  if (existing.length > 0) {
    const chars  = "abcdefghijklmnopqrstuvwxyz0123456789";
    const suffix = "_" + Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
    email = `${base}${suffix}@${domain}`;

    // double check new one doesn't exist
    const [dupCheck] = await db.promise().query(
      "SELECT id FROM users WHERE email = ?", [email]
    );
    if (dupCheck.length > 0) {
      // timestamp fallback — guaranteed unique
      email = `${base}_${Date.now()}@${domain}`;
    }
  }

  return email;
};

module.exports = generateCompanyEmail;