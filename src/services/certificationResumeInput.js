const pdfParse = require("pdf-parse");
const supabase = require("../config/supabase");
const { MAX_LLM_INPUT_CHARS } = require("../config/parsingConfig");
const { getLatestParsedResumeForUser } = require("../models/resumeModel");
const { sanitizeTextForLlm } = require("../utils/textSanitize");
const { NonRetryableError } = require("../utils/errors");
const { logCertificationDebug } = require("./certificationDebug");

const MIN_RESUME_CHARS = 50;

function prepareResumeText(raw) {
  if (raw == null) return "";
  return sanitizeTextForLlm(String(raw), MAX_LLM_INPUT_CHARS);
}

function assertUsableResumeText(cleanedText, { source }) {
  if (cleanedText == null || cleanedText === "") {
    throw new NonRetryableError("Resume content is empty");
  }
  if (cleanedText.length < MIN_RESUME_CHARS) {
    throw new NonRetryableError(
      `Resume text extraction failed: only ${cleanedText.length} characters after sanitization (minimum ${MIN_RESUME_CHARS})`
    );
  }
  logCertificationDebug("resume_validation_passed", {
    source,
    resolvedResumeLength: cleanedText.length,
    validationPassed: true,
  });
  return cleanedText;
}

function buildTextFromParsedResume(parsed) {
  if (!parsed || typeof parsed !== "object") return "";

  const lines = [];
  if (parsed.name) lines.push(String(parsed.name));
  if (parsed.email) lines.push(String(parsed.email));
  if (parsed.phone) lines.push(String(parsed.phone));
  if (parsed.location) lines.push(String(parsed.location));
  if (parsed.summary) lines.push(String(parsed.summary));

  if (Array.isArray(parsed.skills) && parsed.skills.length) {
    lines.push(`Skills: ${parsed.skills.filter(Boolean).join(", ")}`);
  }

  for (const exp of parsed.experience || []) {
    if (!exp) continue;
    const role = exp.role || "";
    const company = exp.company || "";
    const dates = [exp.start_date, exp.end_date].filter(Boolean).join(" – ");
    lines.push([role, company, dates].filter(Boolean).join(" | "));
    if (exp.description) lines.push(String(exp.description));
  }

  for (const edu of parsed.education || []) {
    if (!edu) continue;
    lines.push(
      [edu.degree, edu.institution, edu.graduation_year].filter(Boolean).join(" | ")
    );
  }

  for (const project of parsed.projects || []) {
    if (!project) continue;
    lines.push([project.name, project.description].filter(Boolean).join(" — "));
  }

  return lines.join("\n");
}

async function extractTextFromPdfBuffer(buffer) {
  if (!buffer?.length) {
    throw new NonRetryableError("Resume PDF buffer is empty");
  }

  const data = await pdfParse(buffer);
  const raw = data?.text || "";
  logCertificationDebug("resume_pdf_extracted", {
    source: "upload",
    extractedTextLength: String(raw).length,
  });

  const cleanedText = prepareResumeText(raw);
  return assertUsableResumeText(cleanedText, { source: "upload" });
}

async function resolveActiveResumeText(userId) {
  const latest = await getLatestParsedResumeForUser(userId);
  if (!latest) {
    throw new NonRetryableError(
      "No uploaded resume found. Upload a resume first or use upload mode."
    );
  }

  logCertificationDebug("resume_source_resolved", {
    resumeSource: "active",
    hasRawText: Boolean(latest.rawText),
    hasFilePath: Boolean(latest.filePath),
    hasParsedJson: Boolean(latest.parsedJson),
  });

  if (latest.rawText && String(latest.rawText).trim().length >= MIN_RESUME_CHARS) {
    const cleanedText = prepareResumeText(latest.rawText);
    if (cleanedText.length >= MIN_RESUME_CHARS) {
      return assertUsableResumeText(cleanedText, { source: "active_raw_text" });
    }
  }

  if (latest.filePath) {
    const { data, error } = await supabase.storage.from("resumes").download(latest.filePath);
    if (error) {
      throw new NonRetryableError(`Failed to download resume: ${error.message}`);
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    return extractTextFromPdfBuffer(buffer);
  }

  const fromParsed = buildTextFromParsedResume(latest.parsedJson);
  if (fromParsed.trim().length >= MIN_RESUME_CHARS) {
    const cleanedText = prepareResumeText(fromParsed);
    return assertUsableResumeText(cleanedText, { source: "active_parsed_json" });
  }

  throw new NonRetryableError("Resume text unavailable for certification");
}

async function resolveCertificationResumeText({ userId, resumeSource, uploadBuffer }) {
  logCertificationDebug("resume_source_selection", {
    resumeSource,
    hasUploadBuffer: Boolean(uploadBuffer?.length),
  });

  if (resumeSource === "upload") {
    if (!uploadBuffer?.length) {
      throw new NonRetryableError("PDF upload required for upload resume source");
    }
    return extractTextFromPdfBuffer(uploadBuffer);
  }

  return resolveActiveResumeText(userId);
}

module.exports = {
  resolveCertificationResumeText,
  extractTextFromPdfBuffer,
  prepareResumeText,
  assertUsableResumeText,
  buildTextFromParsedResume,
  MIN_RESUME_CHARS,
};
