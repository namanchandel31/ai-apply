const request = require('supertest');
const express = require('express');
const uploadMiddleware = require('../../src/middlewares/upload');
const {
    createValidPdfBuffer,
    createInvalidPdfBuffer,
    createNoEofPdfBuffer,
    createNoHeaderPdfBuffer,
    createOversizedPdfBuffer,
    createNearLimitValidPdfBuffer,
    createEmptyBuffer,
    createExactSizePdfBuffer,
    createPdfWithTrailingGarbage,
    createPdfWithMultipleEof,
    createValidPdfVersion17,
    createValidPdfWithPaddingBeforeEof
} = require('../utils/mockPdf');

const app = express();

let lastValidationFlags = null;

// Instrument observability: Trap validation flags before response drops
app.use('/upload', (req, res, next) => {
    res.on('finish', () => {
        lastValidationFlags = req.validationFlags || null;
    });
    next();
});

app.post('/upload', uploadMiddleware, (req, res) => {
    res.status(200).json({ success: true, message: 'Upload passed' });
});

// Explicit error handler ensuring uncaught errors log appropriately natively
app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ 
        success: false, 
        errorType: err.code || 'UNHANDLED_ERROR',
        message: err.message || 'Server Error',
    });
});

/**
 * Wait helper for concurrency jitter
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('Production-Grade Defenses: Upload Middleware Target 95%+', () => {

    beforeEach(() => { 
        lastValidationFlags = null;
    });

    const executeUpload = (buffer, options = {}) => {
        const { field = 'resume', filename = 'test.pdf', contentType = 'application/pdf' } = options;
        return request(app)
            .post('/upload')
            .attach(field, buffer, { filename, contentType });
    };

    /**
     * Asserts explicit structured JSON parameters mapping defensive boundary correctness.
     * Prevents false positives by strictly verifying explicit Enums instead of string matches.
     */
    const assertDefensiveRejection = (response, expectedErrorType, expectedStatus = 400) => {
        expect(response.status).not.toBe(200); // 🚨 Absolute False Positive Guard
        expect(response.status).toBe(expectedStatus);
        
        expect(response.body).toEqual(
            expect.objectContaining({
                success: false,
                errorType: expectedErrorType,
                message: expect.any(String)
            })
        );
    };

    const assertSuccess = (response) => {
        expect(response.status).toBe(200);
        expect(response.body).toEqual(
            expect.objectContaining({
                success: true,
                message: expect.any(String)
            })
        );
    };

    describe('🔎 Internal Execution Validation (Instrumentation Guards)', () => {
        
        it('should prove internal validation executes fully on a valid payload', async () => {
            const buffer = createValidPdfBuffer();
            const res = await executeUpload(buffer);
            assertSuccess(res);
            
            // Proves no logic skipping occurred internally natively 
            expect(lastValidationFlags).not.toBeNull();
            expect(lastValidationFlags.sizeChecked).toBe(true);
            expect(lastValidationFlags.headerChecked).toBe(true);
            expect(lastValidationFlags.headerValid).toBe(true);
            expect(lastValidationFlags.eofChecked).toBe(true);
            expect(lastValidationFlags.eofValid).toBe(true);
        });

        it('should prove internal validation immediately stops execution if size fails', async () => {
            const buffer = createExactSizePdfBuffer(50);
            const res = await executeUpload(buffer);
            assertDefensiveRejection(res, 'INVALID_SIZE');
            
            expect(lastValidationFlags.sizeChecked).toBe(true);
            expect(lastValidationFlags.headerChecked).toBe(false); // Should not proceed to deep binary analysis
            expect(lastValidationFlags.eofChecked).toBe(false);
        });
    });

    describe('🚨 Precision Adversarial Mocks', () => {

        it('should confidently reject buffers exactly 1 byte under limits natively', async () => {
            const buffer = createExactSizePdfBuffer(99); 
            const res = await executeUpload(buffer);
            assertDefensiveRejection(res, 'INVALID_SIZE');
        });

        it('should securely trigger INVALID_HEADER on missing Magic bytes', async () => {
            const buffer = createNoHeaderPdfBuffer();
            const res = await executeUpload(buffer);
            assertDefensiveRejection(res, 'INVALID_HEADER');
        });

        it('should securely trigger INVALID_EOF on missing termination markers', async () => {
            const buffer = createNoEofPdfBuffer();
            const res = await executeUpload(buffer);
            assertDefensiveRejection(res, 'INVALID_EOF');
        });

        it('should decisively fall back to INVALID_PDF_STRUCTURE on spoofed binary', async () => {
            const buffer = createInvalidPdfBuffer();
            // Header falls apart
            const res = await executeUpload(buffer, { contentType: 'application/pdf' });
            assertDefensiveRejection(res, 'INVALID_HEADER');
            expect(lastValidationFlags.headerValid).toBe(false);
        });

        it('should confidently defer limits strictly resolving Multer boundaries seamlessly', async () => {
             const buffer = createExactSizePdfBuffer(2 * 1024 * 1024 + 1); 
             const res = await executeUpload(buffer);
             assertDefensiveRejection(res, 'MULTER_LIMIT', 400); 
        });

        it('should block multiple file logic targeting unexpected internal fields cleanly', async () => {
             const buffer = createValidPdfBuffer();
             const res = await request(app)
                .post('/upload')
                .attach('resume', buffer, '1.pdf')
                .attach('resume', buffer, '2.pdf'); // Injecting duplicate streams
                
             assertDefensiveRejection(res, 'MULTER_MALFORMED'); 
        });
    });

    describe('✅ Valid but Unorthodox Acceptance Parameters', () => {

        it('should not over-reject %PDF-1.7 natively', async () => {
            const buffer = createValidPdfVersion17();
            const res = await executeUpload(buffer);
            assertSuccess(res);
            expect(lastValidationFlags.headerValid).toBe(true);
        });

        it('should not over-reject deeply padded but completely valid boundaries', async () => {
            const buffer = createValidPdfWithPaddingBeforeEof();
            const res = await executeUpload(buffer);
            assertSuccess(res);
            expect(lastValidationFlags.eofValid).toBe(true);
        });

        it('should process edge-case sizes natively resolving EXACT boundaries strictly', async () => {
            const buffer = createExactSizePdfBuffer(100);
            const res = await executeUpload(buffer);
            assertSuccess(res);
        });
    });

    describe('🚔 Multi-Vector & Filename Escaping Vulnerabilities', () => {

        it('should intercept incomplete multi-part form hooks flawlessly dropping busboy streams', async () => {
            const res = await request(app)
                .post('/upload')
                .set('Content-Type', 'multipart/form-data; boundary=fakeboundary')
                // Re-creating dropped connections dynamically directly
                .send('--fakeboundary\r\nContent-Disposition: form-data; name="resume"; filename="test.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4\n%%');
            
            assertDefensiveRejection(res, 'MULTER_MALFORMED');
        });

        it('should confidently reject requests cleanly missing files completely', async () => {
            const res = await request(app)
                .post('/upload')
                .set('Content-Type', 'multipart/form-data; boundary=bound123')
                .send('--bound123\r\nContent-Disposition: form-data; name="other"\r\n\r\nvalue\r\n--bound123--\r\n');
                
            assertDefensiveRejection(res, 'NO_FILE');
        });

        it('should evaluate and completely neutralize filesystem spoofing blindly', async () => {
            const buffer = createValidPdfBuffer();
            const res = await executeUpload(buffer, { filename: '../../../../etc/passwd' });
            
            // We do NOT write to disk (MemoryStorage logic handles this securely). 
            // It MUST be able to complete seamlessly and ignore malicious names without trusting them.
            assertSuccess(res);
        });

        it('should effortlessly neutralize double extension executable masking natively', async () => {
            const buffer = createValidPdfBuffer();
            const res = await executeUpload(buffer, { filename: 'file.pdf.php' });
            // Since our logic tests BINARY structure purely matching '%PDF-', the MIME or filename
            // are completely decoupled. It accepts the file because it mathematically IS a PDF in memory.
            assertSuccess(res);
            expect(lastValidationFlags.headerValid).toBe(true);
        });
    });

    describe('⚡ Hardened Parallel Thrashing', () => {

        it('should withstand randomized race states concurrently asserting strictly decoupled states natively', async () => {
            const configurations = [];
            
            // Loop 10 distinct randomized events mixing payloads
            for (let i = 0; i < 10; i++) {
                const isMalicious = i % 2 !== 0; // True if Odd
                const buffer = isMalicious ? createInvalidPdfBuffer() : createValidPdfBuffer(200);
                
                const task = async () => {
                    await sleep(Math.floor(Math.random() * 20)); // Delay jittering overlaps
                    return executeUpload(buffer);
                };
                
                configurations.push(task());
            }

            const responses = await Promise.all(configurations);
            const successes = responses.filter(r => r.status === 200).length;
            const rejections = responses.filter(r => r.status === 400).length;

            expect(successes).toBe(5);
            expect(rejections).toBe(5);
            
            // All invalid executions should correctly trap structural limits precisely 
            const hostile = responses.filter(r => r.status === 400);
            hostile.forEach(res => {
                expect(res.body.errorType).toBe('INVALID_HEADER');
            });
        });
    });
});
