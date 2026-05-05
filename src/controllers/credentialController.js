const nodemailer = require('nodemailer');
const { pool } = require('../db');
const { encrypt } = require('../utils/encryption');
const { getUserId } = require('../utils/auth');
const { logInfo, logError } = require('../utils/logger');

const saveEmailCredentialsController = async (req, res) => {
  const reqId = req.requestId || 'UNKNOWN';

  try {
    const { email, appPassword } = req.body;

    if (!email || !appPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email and app password are required'
      });
    }

    // Validate and normalize email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = email.trim().toLowerCase();
    
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Normalize appPassword
    const normalizedPassword = appPassword.replace(/\s+/g, '');
    
    if (normalizedPassword.length !== 16) {
      return res.status(400).json({
        success: false,
        message: 'App password must be 16 characters long'
      });
    }

    const userId = getUserId(req);

    logInfo("credential_save_start", { reqId, userId, email: normalizedEmail });

    // Verify SMTP credentials before saving
    const transporter = nodemailer.createTransporter({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: normalizedEmail,
        pass: normalizedPassword
      }
    });

    try {
      await transporter.verify();
      logInfo("smtp_verification_success", { reqId, userId, email: normalizedEmail });
    } catch (verifyError) {
      logError("smtp_verification_failed", verifyError, { reqId, userId, email: normalizedEmail });
      return res.status(400).json({
        success: false,
        message: 'Email credentials verification failed. Please check your email and app password.'
      });
    }

    // Encrypt password
    const encryptedPassword = encrypt(normalizedPassword);

    // UPSERT credentials
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const { rows } = await client.query(
        `INSERT INTO user_email_credentials (user_id, email, encrypted_app_password, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           email = EXCLUDED.email,
           encrypted_app_password = EXCLUDED.encrypted_app_password,
           updated_at = NOW()
         RETURNING user_id, email, updated_at`,
        [userId, normalizedEmail, encryptedPassword]
      );

      await client.query('COMMIT');

      logInfo("credential_save_success", { reqId, userId, email: normalizedEmail });

      return res.status(200).json({
        success: true,
        message: 'Email credentials saved successfully',
        data: {
          userId: rows[0].user_id,
          email: rows[0].email,
          updatedAt: rows[0].updated_at
        }
      });

    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }

  } catch (error) {
    logError("credential_save_error", error, { reqId });
    
    return res.status(500).json({
      success: false,
      message: 'Failed to save email credentials'
    });
  }
};

module.exports = {
  saveEmailCredentialsController
};
