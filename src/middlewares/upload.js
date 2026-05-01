const multer = require('multer');
const crypto = require('crypto');

// --- Constants ---
const PDF_MAGIC_PREFIX = '%PDF-';
const EOF_MARKER = '%%EOF';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MIN_FILE_SIZE = 100; // bytes

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  // No fileFilter — relying on post-upload validation (magic bytes, EOF, MIME)
});

/**
 * Validates a PDF buffer using two methods:
 * 1. Starts with the '%PDF-' magic prefix.
 * 2. Contains the '%%EOF' end-of-file marker within the last 1024 bytes.
 * @param {Buffer} buffer
 * @param {import('express').Request} req - For tracking validation checkpoints
 * @returns {boolean}
 */
const isPdfValid = (buffer, req) => {
  // Fail fast on minimum structural length.
  if (!buffer || buffer.length < 16) return false;

  // Check 1: Strict Versioned Magic Prefix (%PDF-x.y)
  req.validationFlags.headerChecked = true;
  // Safely limit parsing scope to the first 16 bytes for extreme speed (O(1))
  const header = buffer.subarray(0, 16).toString('ascii');
  
  if (!/^%PDF-\d\.\d/.test(header)) {
    req.validationFlags.headerValid = false;
    return false; // Fast exit prevents scanning entirely
  }
  req.validationFlags.headerValid = true;

  // Check 2: End-of-File marker (%%EOF) bounded perfectly natively
  req.validationFlags.eofChecked = true;
  const eofBytes = Buffer.from(EOF_MARKER, 'ascii'); 
  
  // Fast performance: Only slice into the absolute last 1024 target bytes seamlessly
  const searchAreaStart = Math.max(0, buffer.length - 1024);
  const searchArea = buffer.subarray(searchAreaStart);
  
  let eofCount = 0;
  let idx = searchArea.indexOf(eofBytes);
  let lastRelativeIndex = -1;
  
  // Sweeping exact array positions scoped natively only onto trailing limits
  while (idx !== -1) {
    eofCount++;
    lastRelativeIndex = idx;
    idx = searchArea.indexOf(eofBytes, idx + 1);
  }

  // Enforce mathematically exactly one EOF safely natively contained internally
  if (eofCount !== 1) {
    req.validationFlags.eofValid = false;
    return false;
  }

  const absoluteEofStart = searchAreaStart + lastRelativeIndex;
  
  // Ensure EOF securely natively operates as absolute tail terminal
  let trailingDataStart = absoluteEofStart + eofBytes.length;
  let validTrailing = true;
  
  for (let i = trailingDataStart; i < buffer.length; i++) {
    const charCode = buffer[i];
    // Allow Space (32), Line Feed (10), Carriage Return (13) strictly exclusively
    if (charCode !== 13 && charCode !== 10 && charCode !== 32) {
      validTrailing = false;
      break;
    }
  }

  if (!validTrailing) {
    req.validationFlags.eofValid = false;
    return false;
  }

  req.validationFlags.eofValid = true;
  return true;
};

/**
 * Generates a short random request ID for log correlation.
 * @returns {string}
 */
const generateRequestId = () => crypto.randomBytes(6).toString('hex');

/**
 * Validates that the incoming request has multipart/form-data content type.
 * @param {import('express').Request} req
 * @returns {boolean}
 */
const isMultipartRequest = (req) => {
  const contentType = req.headers['content-type'] || '';
  return contentType.startsWith('multipart/form-data');
};

const uploadMiddleware = (req, res, next) => {
  // Attach a request ID for log correlation
  req.requestId = generateRequestId();
  
  // 0. Initialize validation tracking checkpoints
  req.validationFlags = {
    headerChecked: false,
    headerValid: false,
    eofChecked: false,
    eofValid: false,
    sizeChecked: false
  };

  // 1. Content-Type gate (Pre-Multer validation)
  if (!isMultipartRequest(req)) {
    return res.status(400).json({
      success: false,
      errorType: 'MISSING_MULTIPART',
      message: 'Content-Type must be multipart/form-data',
    });
  }

  const uploader = upload.single('resume');

  uploader(req, res, (err) => {
    // --- 2. Error Handling Block ---
    if (err) {
      let status = 500;
      let message = 'Internal server error';
      let errorType = 'INTERNAL_ERROR';

      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          status = 400;
          message = 'File size exceeds limit (5MB)';
          errorType = 'MULTER_LIMIT';
        } else {
          // Handle other multer-specific errors (e.g., NO_FILE, Unexpected Field)
          console.error(`[${req.requestId}] [MULTER_ERROR]`, err);
          status = 400;
          message = 'Invalid file upload structure';
          errorType = 'MULTER_MALFORMED';
        }
      } else {
        // Log general errors (e.g., connection issues)
        console.error(`[${req.requestId}] [UPLOAD_ERROR]`, err);
      }
      
      return res.status(status).json({ success: false, errorType, message });
    }

    // --- 3. Post-Upload Validation Block ---
    
    // Check 3.1: Defensive existence check
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, errorType: 'NO_FILE', message: 'No file uploaded or invalid upload structure' });
    }

    // Check 3.2: MIME type sanity check 
    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ success: false, errorType: 'INVALID_MIME', message: 'Invalid MIME type, expected PDF' });
    }
    
    // Check 3.3: Size limits
    req.validationFlags.sizeChecked = true;
    if (req.file.size < MIN_FILE_SIZE) {
      return res.status(400).json({ success: false, errorType: 'INVALID_SIZE', message: 'Invalid or corrupted PDF file (too small)' });
    }

    // Check 3.4: Deep PDF Validation (Magic bytes + EOF)
    if (!isPdfValid(req.file.buffer, req)) {
      if (!req.validationFlags.headerValid) {
        return res.status(400).json({ success: false, errorType: 'INVALID_HEADER', message: 'Invalid PDF file format (Header missing)' });
      }
      if (!req.validationFlags.eofValid) {
        return res.status(400).json({ success: false, errorType: 'INVALID_EOF', message: 'Invalid PDF file format (EOF missing)' });
      }
      return res.status(400).json({ success: false, errorType: 'INVALID_PDF_STRUCTURE', message: 'Invalid PDF file format structure' });
    }

    // 4. Success Log
    console.log(
      `[${req.requestId}] Upload successfully validated: ${req.file.originalname} (${req.file.size} bytes)`
    );

    // 5. Pass to next middleware
    next();
  });
};

module.exports = uploadMiddleware;
