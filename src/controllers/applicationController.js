const { pool } = require('../db');
const { ok, error, ERROR_CODES } = require('../utils/response');
const { logError } = require('../utils/logger');

const getApplicationsController = async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows } = await pool.query(
      `SELECT 
         a.id, 
         a.status, 
         a.created_at as "createdAt",
         a.sent_at as "sentAt",
         jd.title as "role",
         jd.company_name as "company"
       FROM applications a
       JOIN job_descriptions jd ON a.job_description_id = jd.id
       WHERE a.user_id = $1
       ORDER BY a.created_at DESC`,
      [userId]
    );

    return ok(res, rows);
  } catch (err) {
    logError("GET_APPLICATIONS_ERROR", err, { userId });
    return error(res, 500, "Failed to fetch applications", ERROR_CODES.INTERNAL_ERROR);
  }
};

module.exports = {
  getApplicationsController
};
