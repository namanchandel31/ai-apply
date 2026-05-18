require('dotenv').config();
const { pool } = require('./src/db');
pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'applications'")
  .then(res => { console.log("applications:", res.rows.map(r => r.column_name)); return pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'resumes'"); })
  .then(res => { console.log("resumes:", res.rows.map(r => r.column_name)); process.exit(0); })
  .catch(console.error);
