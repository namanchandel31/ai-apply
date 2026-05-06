require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function resetDatabase() {
  console.log('🔄 Resetting database...');
  
  try {
    await pool.query(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);
    
    console.log('✅ Database reset complete');
    
    // Verify all tables are dropped
    const result = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    if (result.rows.length === 0) {
      console.log('✅ All tables dropped successfully');
    } else {
      console.log('⚠️  Tables remaining:', result.rows.map(r => r.table_name));
    }
    
  } catch (error) {
    console.error('❌ Reset failed:', error.message);
  } finally {
    await pool.end();
  }
}

resetDatabase();
