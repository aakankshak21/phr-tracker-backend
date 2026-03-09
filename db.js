const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:            process.env.DB_HOST,
  port:            parseInt(process.env.DB_PORT),
  database:        process.env.DB_NAME,
  user:            process.env.DB_USER,
  password:        process.env.DB_PASSWORD,
  ssl:             { rejectUnauthorized: false },
  max:             1,
  idleTimeoutMillis: 0,
  connectionTimeoutMillis: 10000,
});

module.exports = { pool };
