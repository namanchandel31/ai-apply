require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function analyzeResults() {
  console.log('📊 MIGRATION AUDIT ANALYSIS\n');
  
  try {
    // Check if user_email_credentials table exists
    console.log('=== CRITICAL TABLE CHECK ===');
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'user_email_credentials';
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('❌ user_email_credentials table NOT FOUND');
    } else {
      console.log('✅ user_email_credentials table exists');
    }
    
    // Check users table existence
    const usersCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'users';
    `);
    
    console.log(usersCheck.rows.length > 0 ? '✅ users table exists' : '❌ users table NOT FOUND');
    
    // Check for user_id columns in main tables
    console.log('\n=== USER_ID COLUMNS CHECK ===');
    const userIdColumns = await pool.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE column_name = 'user_id'
      AND table_name IN ('resumes', 'job_descriptions', 'applications')
      ORDER BY table_name;
    `);
    
    userIdColumns.rows.forEach(col => {
      console.log(`${col.table_name}.user_id: ${col.data_type} (${col.is_nullable})`);
    });
    
    // Check for sent_at and error columns in applications
    console.log('\n=== APPLICATIONS EMAIL COLUMNS ===');
    const emailColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'applications'
      AND column_name IN ('sent_at', 'error')
      ORDER BY column_name;
    `);
    
    if (emailColumns.rows.length === 0) {
      console.log('❌ sent_at and error columns NOT FOUND');
    } else {
      emailColumns.rows.forEach(col => {
        console.log(`applications.${col.column_name}: ${col.data_type} (${col.is_nullable})`);
      });
    }
    
    // Check failed_parses table
    console.log('\n=== FAILED_PARSES TABLE ===');
    const failedParsesCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'failed_parses'
      ORDER BY ordinal_position;
    `);
    
    if (failedParsesCheck.rows.length === 0) {
      console.log('❌ failed_parses table NOT FOUND');
    } else {
      console.log('✅ failed_parses columns:');
      failedParsesCheck.rows.forEach(col => {
        console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
      });
    }
    
    // Check status constraint details
    console.log('\n=== STATUS CONSTRAINT DETAILS ===');
    const statusConstraint = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'applications'::regclass
      AND contype = 'c'
      AND conname LIKE '%status%';
    `);
    
    if (statusConstraint.rows.length > 0) {
      const constraint = statusConstraint.rows[0];
      console.log(`${constraint.conname}: ${constraint.definition}`);
      
      // Check if it matches expected exactly
      const expected = 'CHECK ((status = ANY (ARRAY[\'draft\'::text, \'sent\'::text, \'failed\'::text])))';
      const isExact = constraint.definition === expected;
      console.log(`Exact match: ${isExact ? '✅' : '❌'}`);
    }
    
    // Check for security constraints
    console.log('\n=== SECURITY CONSTRAINTS CHECK ===');
    const securityConstraints = await pool.query(`
      SELECT conname, conrelid::regclass as table_name, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid::regclass::text IN ('resumes', 'job_descriptions', 'applications')
      AND contype = 'f'
      AND conname LIKE '%user%';
    `);
    
    if (securityConstraints.rows.length === 0) {
      console.log('❌ No user_id foreign key constraints found');
    } else {
      securityConstraints.rows.forEach(fk => {
        console.log(`${fk.conname}: ${fk.table_name} ${fk.definition}`);
      });
    }
    
    // Check for composite indexes
    console.log('\n=== COMPOSITE INDEXES CHECK ===');
    const compositeIndexes = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename IN ('applications', 'resumes', 'job_descriptions')
      AND indexdef LIKE '%,%'
      ORDER BY tablename, indexname;
    `);
    
    if (compositeIndexes.rows.length === 0) {
      console.log('❌ No composite indexes found');
    } else {
      compositeIndexes.rows.forEach(idx => {
        console.log(`${idx.indexname}: ${idx.indexdef}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  } finally {
    await pool.end();
  }
}

analyzeResults();
