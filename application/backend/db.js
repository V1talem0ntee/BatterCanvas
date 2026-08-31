const { Pool } = require("pg");


const sslEnabled = process.env.DATABASE_SSL === "true";


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: sslEnabled ? { rejectUnauthorized: false } : false,
});


async function checkDatabaseConnection() {
  const result = await pool.query("SELECT 1 AS connected");
  return result.rows[0]?.connected === 1; 
}

module.exports = {
  pool,
  checkDatabaseConnection,
};