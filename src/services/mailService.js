const nodemailer = require('nodemailer');
const { supabase } = require('../config/supabase');
const { decrypt } = require('../utils/encryption');
const { pool } = require('../db');
const { logInfo, logError } = require('../utils/logger');

const sendApplicationEmail = async (userId, applicationId, recipientEmail, subject, body, resumeFilePath) => {
  const reqId = `send_${applicationId}_${Date.now()}`;

  try {
    logInfo("email_send_start", { reqId, applicationId, userId, recipientEmail, stage: "smtp" });

    // Fetch encrypted credentials
    const { rows } = await pool.query(
      'SELECT email, encrypted_app_password FROM user_email_credentials WHERE user_id = $1',
      [userId]
    );

    if (rows.length === 0) {
      throw { message: 'No email credentials found for user', code: 'NO_CREDENTIALS', stage: 'smtp' };
    }

    const credentials = rows[0];
    const decryptedPassword = decrypt(credentials.encrypted_app_password);

    // Create transporter
    const transporter = nodemailer.createTransporter({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: credentials.email,
        pass: decryptedPassword
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });

    // Download resume from Supabase Storage
    const { data, error } = await supabase.storage
      .from('resumes')
      .download(resumeFilePath);

    if (error || !data) {
      throw { message: 'Storage download failed', code: 'STORAGE_ERROR', stage: 'storage' };
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    if (!buffer.length) {
      throw { message: 'Empty file buffer', code: 'EMPTY_BUFFER', stage: 'storage' };
    }

    // Send email
    const mailOptions = {
      from: credentials.email,
      to: recipientEmail,
      subject: subject,
      html: body,
      attachments: [
        {
          filename: 'resume.pdf',
          content: buffer,
          contentType: 'application/pdf'
        }
      ]
    };

    const result = await transporter.sendMail(mailOptions);

    logInfo("email_send_success", { reqId, applicationId, userId, recipientEmail, messageId: result.messageId, stage: "smtp" });

    return {
      success: true,
      messageId: result.messageId
    };

  } catch (error) {
    // Ensure error has proper stage
    if (!error.stage) {
      error.stage = 'smtp';
    }

    logError("email_send_failed", error, { reqId, applicationId, userId, recipientEmail, stage: error.stage });
    
    throw error;
  }
};

module.exports = {
  sendApplicationEmail
};
