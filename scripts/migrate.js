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
    client = await pool.connect();
    
    const migrationsDir = path.join(__dirname, "..", "src", "migrations");
    const files = fs.readdirSync(migrationsDir)
                    .filter(f => f.endsWith('.sql'))
                    .sort(); // ensures 001 runs before 002

    console.log("⏳ Running migrations...");

    for (const file of files) {
      console.log(`Executing ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      await client.query(sql);
    }

    console.log("✅ Migrations completed successfully.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
};

run();
