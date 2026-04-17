const PDF_MAGIC = '%PDF-1.4';
const EOF = '%%EOF';

function createValidPdfBuffer(size = 150) { 
    return createExactSizePdfBuffer(size);
}

function createInvalidPdfBuffer() {
    return Buffer.from('Just some random text file containing junk data, totally not a PDF at all. Please reject this.');
}

function createNoEofPdfBuffer(size = 150) {
    const fillerSize = Math.max(0, size - PDF_MAGIC.length);
    return Buffer.concat([Buffer.from(PDF_MAGIC), Buffer.alloc(fillerSize, 'b')]);
}

function createNoHeaderPdfBuffer(size = 150) {
    const fillerSize = Math.max(0, size - EOF.length);
    return Buffer.concat([Buffer.alloc(fillerSize, 'c'), Buffer.from(EOF)]);
}

function createOversizedPdfBuffer() {
    const size = 2 * 1024 * 1024 + 5120; // 2MB + 5KB
    return createExactSizePdfBuffer(size);
}

function createNearLimitValidPdfBuffer() {
    const size = 2 * 1024 * 1024 - 5120; // 2MB - 5KB to prevent multipart boundary overhead triggering LIMIT
    return createExactSizePdfBuffer(size);
}

function createEmptyBuffer() {
    return Buffer.alloc(0);
}

function createExactSizePdfBuffer(size) {
    if (size < PDF_MAGIC.length + EOF.length) {
        return Buffer.alloc(size, 'a');
    }
    const fillerSize = size - PDF_MAGIC.length - EOF.length;
    const filler = Buffer.alloc(fillerSize, 'a');
    return Buffer.concat([Buffer.from(PDF_MAGIC), filler, Buffer.from(EOF)]);
}

function createPdfWithTrailingGarbage() {
    const validPart = createValidPdfBuffer(150);
    const garbage = Buffer.alloc(2048, 'g'); 
    return Buffer.concat([validPart, garbage]);
}

function createPdfWithMultipleEof() {
    const chunk1 = Buffer.from(`${PDF_MAGIC}chunk1${EOF}`);
    const chunk2 = Buffer.from(`malicious_chunk${EOF}`);
    return Buffer.concat([chunk1, Buffer.alloc(50, 'x'), chunk2]);
}

// --- NEW ADVANCED MOCKS ---

function createValidPdfVersion17() {
    // Uses %PDF-1.7 specifically instead of naive %PDF-
    const prefix = Buffer.from('%PDF-1.7\n', 'ascii');
    const filler = Buffer.alloc(100, 'v');
    const eof = Buffer.from('\n%%EOF\n', 'ascii');
    return Buffer.concat([prefix, filler, eof]);
}

function createValidPdfWithPaddingBeforeEof() {
    // Valid PDF where %%EOF is preceded by heavy padding but still within 1024 bytes
    const fillerSize = 500;
    const filler = Buffer.alloc(fillerSize, '\r\n');
    return Buffer.concat([Buffer.from(PDF_MAGIC), filler, Buffer.from(EOF)]);
}

module.exports = {
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
};
