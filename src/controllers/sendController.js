const { pool } = require('../db');
const { sendApplicationEmail } = require('../services/mailService');
const { getUserId } = require('../utils/auth');
const { logInfo, logError } = require('../utils/logger');
const { error, ok, ERROR_CODES } = require('../utils/response');

const sendApplicationController = async (req, res) => {
  const reqId = req.requestId || 'UNKNOWN';
  const { applicationId } = req.params;
  const userId = getUserId(req);

  try {
    logInfo("send_application_start", { reqId, applicationId, userId });

    // 1. Fetch application + ownership check
    const { rows: apps } = await pool.query(
      `SELECT a.*, jd.contact_email as jd_contact_email, r.file_path
       FROM applications a
       JOIN job_descriptions jd ON jd.id = a.jd_id
       LEFT JOIN resumes r ON r.id = a.resume_id
       WHERE a.id = $1 AND a.user_id = $2`,
      [applicationId, userId]
    );

    if (apps.length === 0) {
      return error(res, 404, 'Application not found', ERROR_CODES.NOT_FOUND);
    }

    const application = apps[0];

    // Check ownership (assuming user_id is stored in applications or related table)
    // This is a placeholder - adjust based on your actual ownership logic
    // if (application.user_id !== userId) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Access denied'
    //   });
    // }

    // 2. Check if already sent
    if (application.status === 'sent') {
      logInfo("send_application_already_sent", { reqId, applicationId, userId, stage: "validation" });
      return res.status(200).json({
        success: true,
        message: 'Application already sent',
        data: {
          status: application.status,
          sentAt: application.sent_at
        }
      });
    }

    // 3. Resolve recipient with strict validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let recipientEmail = null;

    if (req.body.recipientEmail) {
      const normalizedRecipient = req.body.recipientEmail.trim().toLowerCase();
      if (emailRegex.test(normalizedRecipient)) {
        recipientEmail = normalizedRecipient;
      }
    }

    if (!recipientEmail && application.jd_contact_email) {
      const normalizedJdEmail = application.jd_contact_email.trim().toLowerCase();
      if (emailRegex.test(normalizedJdEmail)) {
        recipientEmail = normalizedJdEmail;
      }
    }

    if (!recipientEmail) {
      return res.status(400).json({
        success: false,
        message: 'Valid recipient email is required'
      });
    }

    // 4. Check file_path
    if (!application.file_path) {
      return res.status(400).json({
        success: false,
        message: 'Resume file not found'
      });
    }

    // 5. Send email
    const emailSubject = `Job Application - ${application.job_title || 'Position'}`;
    const emailBody = `
      <h2>Job Application</h2>
      <p>Dear Hiring Manager,</p>
      <p>I am writing to express my interest in the ${application.job_title || 'position'}.</p>
      <p>Please find my resume attached for your consideration.</p>
      <p>Best regards,<br>${application.custom_answers?.name || 'Applicant'}</p>
    `;

    try {
      const emailResult = await sendApplicationEmail(
        userId,
        applicationId,
        recipientEmail,
        emailSubject,
        emailBody,
        application.file_path
      );

      // 6. Update application status to sent (atomic update with user_id safety)
      const { rows: updateRows } = await pool.query(
        `UPDATE applications 
         SET status = 'sent', sent_at = NOW(), error = NULL
         WHERE id = $1 AND user_id = $2 AND status != 'sent'
         RETURNING id, status, sent_at`,
        [applicationId, userId]
      );

      if (updateRows.length === 0) {
        // Application was already sent by another request
        logInfo("send_application_duplicate_send", { reqId, applicationId, userId, stage: "validation" });
        return ok(res, {
          status: 'sent',
          sentAt: application.sent_at,
          message: 'Application already sent'
        });
      }

      // Mask email for security logging
      const maskedEmail = recipientEmail ? 
        recipientEmail.charAt(0) + '***' + recipientEmail.substring(recipientEmail.lastIndexOf('@')) : 
        'unknown';
      
      logInfo("send_application_success", { reqId, applicationId, userId, recipientEmail: maskedEmail, stage: "smtp" });

      return ok(res, {
        messageId: emailResult.messageId,
        status: 'sent',
        sentAt: updateRows[0].sent_at,
        message: 'Application sent successfully'
      });

    } catch (emailError) {
      // Update application status to failed
      const errorData = {
        message: emailError.message,
        code: emailError.code || 'SEND_ERROR',
        stage: emailError.stage || 'smtp'
      };

      await pool.query(
        `UPDATE applications 
         SET status = 'failed', error = $1
         WHERE id = $2 AND user_id = $3`,
        [JSON.stringify(errorData), applicationId, userId]
      );

      // Mask email for security logging
      const maskedEmail = recipientEmail ? 
        recipientEmail.charAt(0) + '***' + recipientEmail.substring(recipientEmail.lastIndexOf('@')) : 
        'unknown';
      
      logError("send_application_failed", emailError, { reqId, applicationId, userId, recipientEmail: maskedEmail, stage: emailError.stage });

      return error(res, 500, `Failed to send application: ${emailError.message}`, ERROR_CODES.INTERNAL_ERROR);
    }

  } catch (error) {
    logError("send_application_error", error, { reqId, applicationId, userId });
    
    return error(res, 500, 'Failed to send application', ERROR_CODES.INTERNAL_ERROR);
  }
};

module.exports = {
  sendApplicationController
};
