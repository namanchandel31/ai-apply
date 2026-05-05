const fs = require('fs');
const { Pool } = require('pg');

async function runMigration() {
  try {
    const migrationSQL = fs.readFileSync('./src/migrations/004_email_sending.sql', 'utf8');
    
    // Create a new pool with SSL disabled for local migration
    const migrationPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    console.log('Running Phase 3 migration...');
    await migrationPool.query(migrationSQL);
    console.log('Migration completed successfully!');
    
    await migrationPool.end();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
