require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigrations() {
  console.log('🔄 Running migrations in order...');
  
  try {
    const migrations = [
      '001_create_core_tables.sql',
      '002_create_applications.sql', 
      '003_create_failed_parses.sql',
      '004_email_credentials.sql',
      '005_indexes_and_constraints.sql'
    ];
    
    for (const migration of migrations) {
      console.log(`\n📄 Running ${migration}...`);
      
      const migrationPath = path.join(__dirname, 'src', 'migrations', migration);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      await pool.query(migrationSQL);
      console.log(`✅ ${migration} completed`);
    }
    
    console.log('\n🎉 All migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Details:', error);
  } finally {
    await pool.end();
  }
}

runMigrations();
