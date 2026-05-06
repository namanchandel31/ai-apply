require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function validateSchema() {
  console.log('🔍 Validating schema...\n');
  
  try {
    // 1. Check all tables exist
    console.log('=== TABLE INVENTORY ===');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    const expectedTables = ['users', 'resumes', 'job_descriptions', 'parsed_resumes', 'parsed_job_descriptions', 'applications', 'failed_parses', 'user_email_credentials'];
    const actualTables = tablesResult.rows.map(r => r.table_name);
    
    console.log('Expected tables:', expectedTables);
    console.log('Actual tables:  ', actualTables);
    
    const missingTables = expectedTables.filter(t => !actualTables.includes(t));
    if (missingTables.length === 0) {
      console.log('✅ All expected tables present');
    } else {
      console.log('❌ Missing tables:', missingTables);
    }
    
    // 2. Check user_id columns are UUID
    console.log('\n=== USER_ID COLUMN VALIDATION ===');
    const userIdResult = await pool.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE column_name = 'user_id'
      AND table_name IN ('resumes', 'job_descriptions', 'applications', 'user_email_credentials')
      ORDER BY table_name
    `);
    
    console.log('user_id columns:');
    userIdResult.rows.forEach(col => {
      const status = col.data_type === 'uuid' ? '✅' : '❌';
      console.log(`  ${status} ${col.table_name}.user_id: ${col.data_type} (${col.is_nullable})`);
    });
    
    // 3. Check foreign keys
    console.log('\n=== FOREIGN KEY VALIDATION ===');
    const fkResult = await pool.query(`
      SELECT conname, conrelid::regclass as table, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE contype = 'f'
      AND conrelid::regclass::text IN ('resumes', 'job_descriptions', 'applications', 'user_email_credentials', 'parsed_resumes', 'parsed_job_descriptions')
      ORDER BY conrelid::regclass::text, conname
    `);
    
    console.log('Foreign keys:');
    fkResult.rows.forEach(fk => {
      console.log(`  ✅ ${fk.conname}: ${fk.table} ${fk.definition}`);
    });
    
    // 4. Check constraints
    console.log('\n=== CONSTRAINT VALIDATION ===');
    const constraintResult = await pool.query(`
      SELECT conname, conrelid::regclass as table, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE contype = 'c'
      AND conrelid::regclass::text IN ('users', 'applications', 'failed_parses')
      ORDER BY conrelid::regclass::text, conname
    `);
    
    console.log('CHECK constraints:');
    constraintResult.rows.forEach(constraint => {
      console.log(`  ✅ ${constraint.conname}: ${constraint.table} ${constraint.definition}`);
    });
    
    // 5. Check unique constraints
    console.log('\n=== UNIQUE CONSTRAINT VALIDATION ===');
    const uniqueResult = await pool.query(`
      SELECT conname, conrelid::regclass as table, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE contype = 'u'
      AND conrelid::regclass::text IN ('resumes', 'applications', 'failed_parses', 'users')
      ORDER BY conrelid::regclass::text, conname
    `);
    
    console.log('UNIQUE constraints:');
    uniqueResult.rows.forEach(uc => {
      console.log(`  ✅ ${uc.conname}: ${uc.table} ${uc.definition}`);
    });
    
    // 6. Check indexes
    console.log('\n=== INDEX VALIDATION ===');
    const indexResult = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename IN ('resumes', 'job_descriptions', 'applications', 'parsed_resumes', 'parsed_job_descriptions', 'users')
      AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename, indexname
    `);
    
    console.log('Indexes:');
    indexResult.rows.forEach(idx => {
      console.log(`  ✅ ${idx.indexname}: ${idx.indexdef}`);
    });
    
    // 7. Check triggers
    console.log('\n=== TRIGGER VALIDATION ===');
    const triggerResult = await pool.query(`
      SELECT trigger_name, event_object_table, action_timing, event_manipulation
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table, trigger_name
    `);
    
    console.log('Triggers:');
    triggerResult.rows.forEach(trigger => {
      console.log(`  ✅ ${trigger.trigger_name}: ${trigger.event_object_table} (${trigger.action_timing} ${trigger.event_manipulation})`);
    });
    
    console.log('\n🎉 Schema validation completed!');
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    console.error('Details:', error);
  } finally {
    await pool.end();
  }
}

validateSchema();
