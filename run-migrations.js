require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const { discoverMigrations } = require("./scripts/lib/discoverMigrations");
const {
  MIGRATION_RUN_LOCK_KEY,
  ensureSchemaMigrationsTable,
  isMigrationApplied,
  applyMigrationInTransaction,
  migrationChecksum,
} = require("./scripts/lib/migrationLedger");

const defaultMigrationsDir = path.join(__dirname, "src", "migrations");

let poolSingleton = null;

function getPool() {
  if (!poolSingleton) {
    poolSingleton = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    });
  }
  return poolSingleton;
}

async function closePoolIfAny() {
  if (poolSingleton) {
    await poolSingleton.end();
    poolSingleton = null;
  }
}

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

  console.log("🔄 Checking / applying migrations (ledger: schema_migrations)...");

  const pool = getPool();
  const client = await pool.connect();
  let applied = 0;
  let skipped = 0;

  try {
    await ensureSchemaMigrationsTable(client);
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_RUN_LOCK_KEY]);

    for (const migration of discovery.migrations) {
      const migrationPath = path.join(discovery.migrationsDir, migration);
      const migrationSQL = fs.readFileSync(migrationPath, "utf8");
      const checksum = migrationChecksum(migrationSQL);

      if (await isMigrationApplied(client, migration)) {
        console.log(`⏭️  Skipping ${migration} (already applied)`);
        skipped += 1;
        continue;
      }

      console.log(`\n📄 Applying ${migration}...`);
      await applyMigrationInTransaction(client, migration, migrationSQL, checksum);
      console.log(`✅ ${migration} applied`);
      applied += 1;
    }

    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_RUN_LOCK_KEY]);
  } catch (err) {
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_RUN_LOCK_KEY]);
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }

  console.log(`\n🎉 Done. Applied: ${applied}, skipped (already applied): ${skipped}`);
  return {
    success: true,
    exitCode: 0,
    count: discovery.migrations.length,
    applied,
    skipped,
  };
}

async function main() {
  const migrationsDir = process.env.MIGRATIONS_DIR || defaultMigrationsDir;

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
    await closePoolIfAny();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  runMigrations,
  discoverMigrations,
  defaultMigrationsDir,
  getPool,
  closePoolIfAny,
};
