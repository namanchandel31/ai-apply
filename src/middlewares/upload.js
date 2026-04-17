const multer = require('multer');
const crypto = require('crypto');

// --- Constants ---
const PDF_MAGIC_PREFIX = '%PDF-';
const EOF_MARKER = '%%EOF';
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
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
 * @returns {boolean}
 */
const isPdfValid = (buffer) => {
  if (!buffer || buffer.length < 5) return false;

  // Check 1: Magic Prefix (%PDF-)
  const header = buffer.subarray(0, 5).toString('ascii');
  if (header !== PDF_MAGIC_PREFIX) {
    return false;
  }

  // Check 2: End-of-File marker (%%EOF)
  const searchAreaStart = Math.max(0, buffer.length - 1024);
  const searchArea = buffer.subarray(searchAreaStart);
  
  // Check for the literal sequence of bytes representing '%%EOF'
  const eofBytes = Buffer.from(EOF_MARKER, 'ascii'); 
  
  // We must use buffer.indexOf(Buffer) for reliable binary search
  return searchArea.indexOf(eofBytes) !== -1;
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

  // 1. Content-Type gate (Pre-Multer validation)
  if (!isMultipartRequest(req)) {
    return res.status(400).json({
      success: false,
      message: 'Content-Type must be multipart/form-data',
    });
  }

  const uploader = upload.single('resume');

  uploader(req, res, (err) => {
    // --- 2. Error Handling Block ---
    if (err) {
      let status = 500;
      let message = 'Internal server error';

      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          status = 400;
          message = 'File size exceeds limit (2MB)';
        } else {
          // Handle other multer-specific errors (e.g., NO_FILE)
          console.error(`[${req.requestId}] [MULTER_ERROR]`, err);
          status = 400;
          message = 'Invalid file upload structure';
        }
      } else {
        // Log general errors (e.g., connection issues)
        console.error(`[${req.requestId}] [UPLOAD_ERROR]`, err);
      }
      
      return res.status(status).json({ success: false, message: message });
    }

    // --- 3. Post-Upload Validation Block ---
    
    // Check 3.1: Defensive existence check
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'No file uploaded or invalid upload structure' });
    }

    // Check 3.2: MIME type sanity check (New requirement)
    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ success: false, message: 'Invalid MIME type, expected PDF' });
    }
    
    // Check 3.3: Size limits
    if (req.file.size < MIN_FILE_SIZE) {
      return res.status(400).json({ success: false, message: 'Invalid or corrupted PDF file (too small)' });
    }

    // Check 3.4: Deep PDF Validation (Magic bytes + EOF)
    if (!isPdfValid(req.file.buffer)) {
      return res.status(400).json({ success: false, message: 'Invalid PDF file format (Header or EOF missing)' });
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
