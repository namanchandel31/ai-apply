/**
 * One-time migration runner.
 * Usage: node scripts/migrate.js
 *
 * Reads 001_create_tables.sql and executes it against DATABASE_URL.
 * Safe to re-run — all statements use IF NOT EXISTS.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const SQL_PATH = path.join(__dirname, "..", "src", "migrations", "001_create_tables.sql");

const run = async () => {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set. Aborting migration.");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  let client;

  try {
    const sql = fs.readFileSync(SQL_PATH, "utf-8");

    client = await pool.connect();
    console.log("⏳ Running migration...");

    await client.query(sql);

    console.log("✅ Migration completed successfully.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
};

run();
