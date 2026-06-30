const pdfParse = require("pdf-parse");
const { sanitizeTextForStorage } = require("./textSanitize");

const ACTUAL_TEXT_MIN_SANITIZED_CHARS = 50;

/** Unescape a PDF literal string body (inside parentheses, escapes already stripped of parens). */
function unescapePdfLiteralString(value) {
  let out = "";
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }

    const next = value[++i];
    if (next == null) break;

    if (next >= "0" && next <= "7") {
      let octal = next;
      for (let j = 0; j < 2; j += 1) {
        const digit = value[i + 1];
        if (digit >= "0" && digit <= "7") {
          octal += digit;
          i += 1;
        } else {
          break;
        }
      }
      out += String.fromCharCode(parseInt(octal, 8));
      continue;
    }

    switch (next) {
      case "n":
        out += "\n";
        break;
      case "r":
        out += "\r";
        break;
      case "t":
        out += "\t";
        break;
      case "b":
        out += "\b";
        break;
      case "f":
        out += "\f";
        break;
      case "(":
      case ")":
      case "\\":
        out += next;
        break;
      case "\r":
        if (value[i + 1] === "\n") i += 1;
        break;
      case "\n":
        break;
      default:
        out += next;
        break;
    }
  }
  return out;
}

/** Extract accessibility ActualText entries (PDF/UA tagged PDFs, e.g. Canva exports). */
function extractActualTextFromPdfBuffer(buffer) {
  const source = buffer.toString("latin1");
  const pattern = /\/ActualText\s*\(((?:\\.|[^\\)])*)\)/g;
  const parts = [];
  let match;

  while ((match = pattern.exec(source)) !== null) {
    const decoded = unescapePdfLiteralString(match[1]).trim();
    if (decoded) parts.push(decoded);
  }

  return parts.join("\n");
}

/**
 * Extract readable text from a PDF buffer.
 * Uses pdf-parse first; falls back to structure-tree ActualText when needed.
 */
async function extractTextFromPdf(buffer) {
  const startTime = Date.now();

  let text = "";
  let method = "pdf-parse";

  try {
    const data = await pdfParse(buffer);
    text = data.text || "";
  } catch {
    text = "";
  }

  let sanitized = sanitizeTextForStorage(text);
  if (sanitized.length < ACTUAL_TEXT_MIN_SANITIZED_CHARS) {
    const actualText = extractActualTextFromPdfBuffer(buffer);
    const actualSanitized = sanitizeTextForStorage(actualText);
    if (actualSanitized.length > sanitized.length) {
      text = actualText;
      sanitized = actualSanitized;
      method = "actual-text";
    }
  }

  const extractDurationMs = Date.now() - startTime;
  const sanitizeStart = Date.now();
  if (!sanitized && text) {
    sanitized = sanitizeTextForStorage(text);
  }
  const sanitizationDurationMs = Date.now() - sanitizeStart;

  return {
    raw: text,
    sanitized,
    extractDurationMs,
    sanitizationDurationMs,
    method,
  };
}

module.exports = {
  unescapePdfLiteralString,
  extractActualTextFromPdfBuffer,
  extractTextFromPdf,
  ACTUAL_TEXT_MIN_SANITIZED_CHARS,
};
