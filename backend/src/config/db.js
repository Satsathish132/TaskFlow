const mysql = require("mysql2");
require("dotenv").config();
const logger = require('../logger'); // adjust path if this file isn't in src/config

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    logger.error('DB Error', { error: err.message, stack: err.stack });
  } else {
    logger.info('MySQL Connected');
  }
});

module.exports = db;
