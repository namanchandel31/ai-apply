const pdfParse = require('pdf-parse');

const PDF_PARSE_TIMEOUT_MS = 5000;
const MAX_TEXT_LENGTH = 100_000;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB — duplicated as defense-in-depth

/**
 * Wraps pdf-parse with a timeout using Promise.race.
 * Prevents hanging on malformed or extremely large PDFs.
 * @param {Buffer} buffer
 * @param {number} timeoutMs
 * @returns {Promise<object>}
 */
// TODO: Move PDF parsing to worker thread or queue for scalability
const parsePdfWithTimeout = (buffer, timeoutMs) =>
  Promise.race([
    pdfParse(buffer),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('PDF_PARSE_TIMEOUT')), timeoutMs)
    ),
  ]);

const uploadResumeController = async (req, res) => {
  const reqId = req.requestId || 'UNKNOWN';

  try {
    // Defense-in-depth: guard against future middleware misconfiguration
    if (req.file.size > MAX_FILE_SIZE) {
      return res.status(400).json({
        success: false,
        message: 'File too large',
      });
    }

    const data = await parsePdfWithTimeout(req.file.buffer, PDF_PARSE_TIMEOUT_MS);

    if (!data || !data.text || data.text.trim().length === 0) {
      return res.status(200).json({
        success: false,
        message: 'No extractable text found',
      });
    }

    // Normalize whitespace and line breaks, then enforce size limit
    let normalizedText = data.text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+$/gm, '')
      .trim();

    if (normalizedText.length > MAX_TEXT_LENGTH) {
      normalizedText = normalizedText.substring(0, MAX_TEXT_LENGTH);
    }

    return res.status(200).json({
      success: true,
      text: normalizedText,
    });
  } catch (error) {
    if (error.message === 'PDF_PARSE_TIMEOUT') {
      console.error(`[${reqId}] [PDF_PARSE_TIMEOUT] PDF parsing exceeded time limit`);
      return res.status(500).json({
        success: false,
        message: 'PDF parsing timed out',
      });
    }

    console.error(`[${reqId}] [PDF_PARSE_ERROR]`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to extract text from PDF',
    });
  }
};

module.exports = {
  uploadResumeController,
};
