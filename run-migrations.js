require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const { discoverMigrations } = require("./scripts/lib/discoverMigrations");

const defaultMigrationsDir = path.join(__dirname, "src", "migrations");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

async function runMigrations(migrationsDir = defaultMigrationsDir) {
  const discovery = discoverMigrations(migrationsDir);

  if (!discovery.ok) {
    if (discovery.code === "MISSING_DIR") {
      console.error(`❌ Migrations directory not found: ${discovery.migrationsDir}`);
      return { success: false, exitCode: 1 };
    }
    console.warn(`⚠️  No migration files found in ${discovery.migrationsDir}`);
    return { success: true, exitCode: 0, skipped: true };
  }

  console.log("🔄 Running migrations in order...");

  for (const migration of discovery.migrations) {
    console.log(`\n📄 Running ${migration}...`);
    const migrationPath = path.join(discovery.migrationsDir, migration);
    const migrationSQL = fs.readFileSync(migrationPath, "utf8");
    await pool.query(migrationSQL);
    console.log(`✅ ${migration} completed`);
  }

  console.log("\n🎉 All migrations completed successfully!");
  return { success: true, exitCode: 0, count: discovery.migrations.length };
}

async function main() {
  const migrationsDir =
    process.env.MIGRATIONS_DIR || defaultMigrationsDir;

  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set. Aborting migration.");
    process.exit(1);
  }

  try {
    const result = await runMigrations(migrationsDir);
    process.exit(result.exitCode);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    console.error("Details:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { runMigrations, discoverMigrations, defaultMigrationsDir };
