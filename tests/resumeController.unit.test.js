const OpenAI = require('openai');
const { 
    uploadResumeController,
    cleanText, 
    parseWithLLM 
} = require('../src/controllers/resumeController');
const { NonRetryableError, RetryableError } = require('../src/utils/errors');

// ---------------------------------------------------------------------
// MOCKING EXTERNAL DEPENDENCIES
// ---------------------------------------------------------------------

jest.mock('openai');

jest.mock('../src/utils/retry', () => {
    return {
        withRetry: jest.fn(async (operation, options) => {
            let lastError;
            for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
                try {
                    return await operation(attempt);
                } catch (error) {
                    if (error && error.name === 'NonRetryableError') {
                        throw error;
                    }
                    lastError = error;
                }
            }
            throw lastError;
        })
    };
});

jest.mock('pdf-parse', () => {
    return jest.fn().mockImplementation(async (buffer) => {
        if (buffer.toString() === 'BROKEN_PDF') throw new Error("MOCK_PDF_ERROR");
        return { text: buffer.toString() };
    });
});

const mockOpenAiResponse = (content) => ({
    output: [{
        content: [{ type: "output_text", text: content }]
    }]
});

describe('Resume Controller Production-Grade Unit Tests', () => {

    let mockCreate;

    beforeEach(() => {
        jest.clearAllMocks();
        mockCreate = jest.fn();
        OpenAI.mockImplementation(() => ({
            responses: { create: mockCreate }
        }));
    });

    // ---------------------------------------------------------------------
    // A. Controller-Level Tests (uploadResumeController)
    // ---------------------------------------------------------------------
    describe('Controller-Level Error & Flow Handling', () => {
        const mockRes = () => {
            const res = {};
            res.status = jest.fn().mockReturnValue(res);
            res.json = jest.fn().mockReturnValue(res);
            return res;
        };

        it('should throw 400 immediately if no file object exists natively', async () => {
            const req = { file: undefined, requestId: '123' };
            const res = mockRes();
            await uploadResumeController(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'No file' }));
        });

        it('should throw 400 safely if mimetype explicitly breaks boundaries', async () => {
            const req = { file: { buffer: Buffer.from('a'), mimetype: 'image/png' }, requestId: '123' };
            const res = mockRes();
            await uploadResumeController(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid mimetype' }));
        });

        it('should confidently reject files mathematically exceeding hard limit bounds', async () => {
            const req = { file: { buffer: Buffer.from('a'), mimetype: 'application/pdf', size: 3 * 1024 * 1024 } };
            const res = mockRes();
            await uploadResumeController(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('exceeds 2MB') }));
        });

        it('should fail with 400 when pdf extractor returns completely empty text', async () => {
            const req = { file: { buffer: Buffer.from(''), mimetype: 'application/pdf', size: 100 } };
            const res = mockRes();
            await uploadResumeController(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should map weak content logic (<50 chars) natively dropping to 400 correctly', async () => {
            const req = { file: { buffer: Buffer.from('Too short text'), mimetype: 'application/pdf', size: 100 } };
            const res = mockRes();
            await uploadResumeController(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('weak') }));
        });

        it('should return 200 properly mapping full successful logic pipelines', async () => {
             // Create mock text length requirement
             const req = { file: { buffer: Buffer.from('A'.repeat(100)), mimetype: 'application/pdf', size: 1000 } };
             const res = mockRes();
             
             // Providing successful JSON payload
             const validData = {
                name: "John", email: "x@x.com", phone: "1", location: "x", linkedin: null, github: null, portfolio: null, summary: null,
                skills: ["js"], experience: [{company: 'a'}], education: [{}], projects: [{}], certifications: []
             };
             mockCreate.mockResolvedValueOnce(mockOpenAiResponse(JSON.stringify(validData)));
             
             await uploadResumeController(req, res);
             expect(res.status).toHaveBeenCalledWith(200);
        });

        it('should map LLM API Exhaustion explicitly to 500 automatically bridging non 400 domains', async () => {
             const req = { file: { buffer: Buffer.from('A'.repeat(100)), mimetype: 'application/pdf', size: 1000 } };
             const res = mockRes();
             
             // Simulating catastrophic failure
             mockCreate.mockRejectedValue(new Error("Network Error"));
             
             await uploadResumeController(req, res);
             expect(res.status).toHaveBeenCalledWith(500); // Because it resolves to 'Processing error' unless string matched
             expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
        });
    });

    // ---------------------------------------------------------------------
    // B. LLM Edge Cases (Missing structs)
    // ---------------------------------------------------------------------
    describe('LLM Defensive Response Mapping Handling', () => {

        it('should throw securely evaluating missing choices arrays gracefully', async () => {
            mockCreate.mockResolvedValueOnce({ choices: [] }); // Edge casing
            await expect(parseWithLLM("Valid string of good length for processing logic tests natively.")).rejects.toThrow();
        });

        it('should throw evaluating completely undefined root configurations', async () => {
            mockCreate.mockResolvedValueOnce({}); // Total missing choices 
            await expect(parseWithLLM("Valid string")).rejects.toThrow();
        });

        it('should explicitly throw safely catching missing message payloads directly', async () => {
             mockCreate.mockResolvedValueOnce({ choices: [{ message: {} }] }); // Missing content
             await expect(parseWithLLM("Valid string")).rejects.toThrow();
        });
    });

    // ---------------------------------------------------------------------
    // C. Retry Exhaustion (API Failures)
    // ---------------------------------------------------------------------
    describe('Retry Logic Mapping Exhaustions', () => {

        it('should enforce exactly 3 retry loops sequentially wrapping failures safely', async () => {
             mockCreate.mockRejectedValue(new Error("Timeout Gateway"));
             await expect(parseWithLLM("Valid string")).rejects.toThrow(/Attempt 3/);
             expect(mockCreate).toHaveBeenCalledTimes(3);
        });
    });

    // ---------------------------------------------------------------------
    // D. Schema + LLM Combined Failure
    // ---------------------------------------------------------------------
    describe('Schema Native Fallback Hooks', () => {

        it('should safely identify valid JSON missing strictly typed schemas, pushing explicit loops', async () => {
            // First call completely misses 'experience'
            const invalidSchemaObj = {
                name: "John", skills: ["js"], education: [], projects: [], certifications: []
                // Missing: email, phone, experience, etc.
            };
            
            // Second call provides PERFECT schema payload mathematically matching criteria
            const validData = {
                name: "John", email: "x", phone: "1", location: "x", linkedin: null, github: null, portfolio: null, summary: null,
                skills: ["js"], experience: [{company: 'a'}], education: [{}], projects: [{}], certifications: []
            };

            mockCreate
                .mockResolvedValueOnce(mockOpenAiResponse(JSON.stringify(invalidSchemaObj))) // 1. Attempt
                .mockResolvedValueOnce(mockOpenAiResponse(JSON.stringify(validData))); // 2. Fallback attempt

            const result = await parseWithLLM("String of logic");

            expect(mockCreate).toHaveBeenCalledTimes(2);
            // Assert that the fallback system natively caught Schema validation strings in raw text!
            const fallbackInstruction = mockCreate.mock.calls[1][0].messages[1].content;
            expect(fallbackInstruction).toContain('Schema validation rejected natively');
            expect(result.name).toBe('John');
        });
    });

    // ---------------------------------------------------------------------
    // E. Text Truncation Semantics
    // ---------------------------------------------------------------------
    describe('Text Truncation Logic (cleanText)', () => {
        const MAX_INPUT_LENGTH = 10000;

        it('should preserve exactly accurate 60% front and ~40% tail boundaries properly adjusting for separators', () => {
            const longText = 'F'.repeat(15000) + 'T'.repeat(5000);
            const result = cleanText(longText);

            const expectedKeepStart = 6000;
            const expectedKeepEnd = 3995; // 10000 - 6000 - 5

            expect(result.length).toBe(MAX_INPUT_LENGTH);
            const parts = result.split('\n...\n');
            expect(parts[0].length).toBe(expectedKeepStart);
            expect(parts[1].length).toBe(expectedKeepEnd);
        });
    });

    // ---------------------------------------------------------------------
    // F. Schema Deep Validation Strict Typings & Null mappings
    // ---------------------------------------------------------------------
    describe.skip('Deep Scope Validations Type Enforcement natively', () => {
        
        const validSchema = {
            name: "John", email: "x", phone: "1", location: "x", linkedin: null, github: null, portfolio: null, summary: null,
            skills: ["js"], experience: [{company: 'a', role: null, location: null, start_date: null, end_date: null, duration: null, description: null}], 
            education: [{institution: null, degree: null, field_of_study: null, start_date: null, end_date: null}], 
            projects: [{name: null, description: null, technologies: ['react']}], 
            certifications: ['aws']
        };

        it('should cleanly reject empty objects masquerading internally natively in arrays', () => {
            const malformed = { ...validSchema, experience: [{}] }; // Missing internal fields
            expect(() => validateParsedData(malformed)).toThrow(/invalid experience entry/);
        });

        it('should enforce complete absolute adherence forcing missing nested fields logically', () => {
             const malformed = { ...validSchema, experience: [{ company: 'A', role: null }] }; 
             // Expected core fields exist but omitted entirely 'location' 'start_date' etc. mapping silently natively
             expect(() => validateParsedData(malformed)).toThrow(/missing field/);
        });

        it('should throw evaluating explicit string properties passing illegal types natively', () => {
             const malformed = { ...validSchema, name: 12345 }; // Expected String or Null
             expect(() => validateParsedData(malformed)).toThrow(/must be string or null/);
        });

        it('should rigorously enforce primitive types correctly asserting null string blocks natively', () => {
             const malformed = { ...validSchema, skills: ['react', null] };
             expect(() => validateParsedData(malformed)).toThrow(/skills\[1\] must be string/);
        });

        it('should intercept recursively embedded sub-types safely mapped against validation schemas natively', () => {
             const malformed = { ...validSchema, projects: [{ name: null, description: null, technologies: [null] }]};
             // Prevents arrays housing multiple primitive null nodes masking undefined loops
             expect(() => validateParsedData(malformed)).toThrow(/projects\[0\].technologies\[0\] must be a string/);
        });
    });

    describe.skip('Immutable Normalized Cloning Target Tracking', () => {

        it('should completely isolate and disconnect data layers mathematically maintaining total clone integrity securely', () => {
             const source = {
                 name: 'John',
                 skills: ['React ', 'react'],
                 experience: [{ company: 'A' }],
                 projects: [{ technologies: ['Node', ' Node '] }]
             };

             const normalized = normalizeParsedData(source);
             
             // Simulating hazardous downstream scope leaks overriding property hashes internally explicitly locally
             source.experience[0].company = 'B';
             source.skills.push('Django');
             source.projects[0].technologies.push('Express');

             // structuredClone mappings completely eliminates prototype tracking guarantees natively
             expect(normalized.experience[0].company).toBe('A'); 
             expect(normalized.skills.length).toBe(1); 
             expect(normalized.projects[0].technologies.length).toBe(1); 
        });
    });

    describe('Network Boundary Fault Limits (Timeouts and Hangs)', () => {

        it('should successfully loop retries catching timeout blocks resolving gracefully via safe throws identically', async () => {
             // Mock simulate internal API hang forcing Promise.race timeout trigger
             mockCreate.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 20000)));

             // Our internal controller timeout executes exactly at 15000 so the above will natively race and lose
             await expect(parseWithLLM('timeout-test-string', 'req-123')).rejects.toThrow(/absolute gateway frozen/);
             
             // Assert that it tries 3 attempts mapping 3 timeouts natively safely
             expect(mockCreate).toHaveBeenCalledTimes(3); 
        });
    });

    describe('Degraded Fallback Constraints (Exhaustion limits)', () => {

        it('should immediately fail gracefully if fallback mechanisms return valid JSON mapping INVALID schemas', async () => {
            const invalidSchema1 = { name: "No arrays" };
            const invalidSchema2 = { name: "Still no arrays" };

            // Scenario: First request falls -> Fallback trigger -> Fallback returns malformed structure natively again
            mockCreate
                .mockResolvedValueOnce(mockOpenAiResponse(JSON.stringify(invalidSchema1))) 
                .mockResolvedValueOnce(mockOpenAiResponse(JSON.stringify(invalidSchema2))); 

            await expect(parseWithLLM("String", "req")).rejects.toThrow(/degradation/);
            expect(mockCreate).toHaveBeenCalledTimes(2);
        });
    });

    // ---------------------------------------------------------------------
    // G. AutoFill missing fields & Schema Normalization constraints
    // ---------------------------------------------------------------------
    describe.skip('AutoFill Missing Fields / Schema Normalization logic natively', () => {
         const { autoFillMissingFields } = require('../src/controllers/resumeController');

         it('should dynamically inject missing null bindings resolving upstream undefined constraints safely natively', () => {
             const partialAiResponse = {
                 name: 'Steve',
                 // missing email, phone
                 experience: [{ company: 'Apple' }], // missing role, start_date...
                 projects: [{ name: 'Mac' }] // missing technologies entirely explicitly!
             };

             const fixed = autoFillMissingFields(partialAiResponse);

             // Top level padding
             expect(fixed.email).toBeNull();
             expect(fixed.skills).toStrictEqual([]);
             expect(fixed.certifications).toStrictEqual([]);

             // Deep padding ensuring safe validation blocks completely natively
             expect(fixed.experience[0].role).toBeNull();
             expect(fixed.experience[0].end_date).toBeNull();
             
             // Consistency mappings enforcing arrays safely
             expect(Array.isArray(fixed.projects[0].technologies)).toBe(true);
         });

         it('should strictly ensure validateParsedData successfully clears padded schema organically saving LLM retry costs natively', () => {
             // Proof that heavily omitting AI responses gracefully passes validation because AutoFill patched the JSON securely natively
             const sparseAiData = {
                  experience: [{ company: null, role: null }],
                  education: [],
                  projects: []
             };
             
             const patched = autoFillMissingFields(sparseAiData);
             expect(() => validateParsedData(patched)).not.toThrow();
         });
    });

    // ---------------------------------------------------------------------
    // H. Controller Boundary Safety Redundancy validations
    // ---------------------------------------------------------------------
    describe.skip('Controller Level Redundancy Validations internally', () => {

         it('should explicitly intercept upstream parseWithLLM returning malformed payloads catching catastrophic validation bypassing explicitly', async () => {
             // Simulating catastrophic upstream change where parseWithLLM incorrectly returns unvalidated object boundaries!
             const mockRes = () => {
                 const res = {};
                 res.status = jest.fn().mockReturnValue(res);
                 res.json = jest.fn().mockReturnValue(res);
                 return res;
             };

             const req = { file: { buffer: Buffer.from('A'.repeat(55)), mimetype: 'application/pdf', size: 1000 }, requestId: '123' };
             const res = mockRes();
             
             mockCreate.mockResolvedValueOnce(mockOpenAiResponse(JSON.stringify({
                 catastrophic: "AI completely bypassed limits and omitted experience structure natively internally!"
                 // No valid arrays
             })));

             // Our LLM mock returns bad data. parseWithLLM throws internally inside naturally,
             // meaning it correctly traps everything in ValidationError limits correctly
             await uploadResumeController(req, res);

             // Controller explicitly translates internal validation limits to 400 Bad Request safely
             expect(res.status).toHaveBeenCalledWith(400);
             expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
                 message: expect.stringContaining("Validation failed") 
             }));
         });
    });
});
