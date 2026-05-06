require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runAudit() {
  console.log('🔍 Starting Migration Audit (READ-ONLY)\n');
  
  try {
    // Step 1: Check for migration tracking tables
    console.log('=== STEP 1: Migration Tracking Tables ===');
    const trackingResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name ILIKE '%migration%';
    `);
    
    if (trackingResult.rows.length === 0) {
      console.log('❌ No migration tracking tables found - using schema inspection\n');
    } else {
      console.log('✅ Migration tracking tables found:', trackingResult.rows.map(r => r.table_name));
    }
    
    // Step 2: Full table inventory
    console.log('\n=== STEP 2: Full Table Inventory ===');
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('Tables found:', tablesResult.rows.map(r => r.table_name));
    
    // Step 3: Column type + nullability validation
    console.log('\n=== STEP 3: Column Types + Nullability ===');
    const columnsResult = await pool.query(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name IN (
        'resumes', 'parsed_resumes', 'job_descriptions', 'parsed_job_descriptions',
        'failed_parses', 'applications', 'users', 'user_email_credentials'
      )
      ORDER BY table_name, ordinal_position;
    `);
    
    columnsResult.rows.forEach(col => {
      console.log(`${col.table_name}.${col.column_name}: ${col.data_type} (${col.is_nullable})${col.column_default ? ` DEFAULT ${col.column_default}` : ''}`);
    });
    
    // Step 4: Default values validation
    console.log('\n=== STEP 4: Default Values Validation ===');
    const defaultsResult = await pool.query(`
      SELECT column_name, column_default
      FROM information_schema.columns
      WHERE table_name = 'applications'
      AND column_name = 'status';
    `);
    
    if (defaultsResult.rows.length > 0) {
      console.log('applications.status default:', defaultsResult.rows[0].column_default);
    } else {
      console.log('❌ applications.status column not found');
    }
    
    // Step 5: Foreign key validation
    console.log('\n=== STEP 5: Foreign Key Validation ===');
    const fkResult = await pool.query(`
      SELECT
        conname,
        conrelid::regclass AS table,
        pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE contype = 'f';
    `);
    
    if (fkResult.rows.length === 0) {
      console.log('❌ No foreign keys found');
    } else {
      fkResult.rows.forEach(fk => {
        console.log(`${fk.conname}: ${fk.table} ${fk.definition}`);
      });
    }
    
    // Step 6: JSONB index validation
    console.log('\n=== STEP 6: JSONB Index Validation ===');
    const jsonbIndexResult = await pool.query(`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename IN ('parsed_resumes', 'parsed_job_descriptions')
      AND indexdef LIKE '%gin%';
    `);
    
    if (jsonbIndexResult.rows.length === 0) {
      console.log('❌ No GIN indexes found for JSONB columns');
    } else {
      jsonbIndexResult.rows.forEach(idx => {
        console.log(`${idx.indexname}: ${idx.indexdef}`);
      });
    }
    
    // Step 7: UNIQUE constraint validation
    console.log('\n=== STEP 7: UNIQUE Constraint Validation ===');
    const uniqueResult = await pool.query(`
      SELECT
        conname,
        conrelid::regclass AS table,
        pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE contype = 'u';
    `);
    
    if (uniqueResult.rows.length === 0) {
      console.log('❌ No unique constraints found');
    } else {
      uniqueResult.rows.forEach(uc => {
        console.log(`${uc.conname}: ${uc.table} ${uc.definition}`);
      });
    }
    
    // Step 8: Comprehensive index coverage
    console.log('\n=== STEP 8: Index Coverage Validation ===');
    const indexResult = await pool.query(`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename IN ('applications', 'resumes', 'job_descriptions', 'user_email_credentials')
      ORDER BY tablename, indexname;
    `);
    
    indexResult.rows.forEach(idx => {
      console.log(`${idx.indexname}: ${idx.indexdef}`);
    });
    
    // Step 9: ENUM-style status validation
    console.log('\n=== STEP 9: Status Constraint Validation ===');
    const statusResult = await pool.query(`
      SELECT 
        conname,
        pg_get_constraintdef(oid) as definition,
        CASE 
          WHEN pg_get_constraintdef(oid) = 'CHECK (status IN (draft, sent, failed))' THEN 'EXACT_MATCH'
          WHEN pg_get_constraintdef(oid) LIKE '%draft%' AND pg_get_constraintdef(oid) LIKE '%sent%' AND pg_get_constraintdef(oid) LIKE '%failed%' THEN 'PARTIAL_MATCH'
          ELSE 'MISMATCH'
        END as validation_status
      FROM pg_constraint
      WHERE conrelid = 'applications'::regclass
      AND contype = 'c'
      AND conname LIKE '%status%';
    `);
    
    if (statusResult.rows.length === 0) {
      console.log('❌ No status constraint found on applications table');
    } else {
      statusResult.rows.forEach(sc => {
        console.log(`${sc.conname}: ${sc.definition} [${sc.validation_status}]`);
      });
    }
    
    // Step 10: Duplicate index detection
    console.log('\n=== STEP 10: Duplicate Index Detection ===');
    const duplicateResult = await pool.query(`
      SELECT indexdef, COUNT(*) as duplicate_count, array_agg(indexname) as index_names
      FROM pg_indexes
      WHERE tablename IN ('applications', 'resumes', 'job_descriptions', 'parsed_resumes', 'parsed_job_descriptions', 'user_email_credentials')
      GROUP BY indexdef
      HAVING COUNT(*) > 1;
    `);
    
    if (duplicateResult.rows.length === 0) {
      console.log('✅ No duplicate indexes found');
    } else {
      duplicateResult.rows.forEach(dupe => {
        console.log(`❌ DUPLICATE INDEXES: ${dupe.indexdef}`);
        console.log(`   Names: ${dupe.index_names.join(', ')}`);
      });
    }
    
    // Step 11: All constraints check
    console.log('\n=== STEP 11: All CHECK Constraints ===');
    const checkResult = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid IN ('applications'::regclass, 'failed_parses'::regclass, 'user_email_credentials'::regclass)
      AND contype = 'c';
    `);
    
    checkResult.rows.forEach(cc => {
      console.log(`${cc.conname}: ${cc.definition}`);
    });
    
  } catch (error) {
    console.error('❌ Audit failed:', error.message);
  } finally {
    await pool.end();
  }
}

runAudit();
