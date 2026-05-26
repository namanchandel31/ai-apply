const { nullifyEmpty } = require("../utils/normalise");

/**
 * Structured validation diagnostics for JD parse outcomes.
 * @param {{ llmData?: object, enrichedData?: object }} input
 */
function buildContentValidationDiagnostics({ llmData = {}, enrichedData = {} }) {
  const missingFields = [];
  const emptyFields = [];
  const invalidFields = [];

  const check = (field, llmVal, enrichedVal) => {
    const e = enrichedVal !== undefined ? enrichedVal : llmVal;
    if (e === undefined || e === null) {
      missingFields.push(field);
    } else if (typeof e === "string" && nullifyEmpty(e) === null) {
      emptyFields.push(field);
    } else if (field === "skills" && Array.isArray(e) && e.length === 0) {
      emptyFields.push(field);
    } else if (field === "roles" && Array.isArray(e) && e.length === 0) {
      emptyFields.push(field);
    }
  };

  check("job_title", llmData.job_title, enrichedData.job_title);
  check("skills", llmData.skills, enrichedData.skills);
  check("roles", llmData.roles, enrichedData.roles);
  check("company_name", llmData.company_name, enrichedData.company_name);

  if (enrichedData.contact_email === null && llmData.contact_email) {
    invalidFields.push("contact_email");
  }
  if (enrichedData.contact_number === null && llmData.contact_number) {
    invalidFields.push("contact_number");
  }

  const hasUsableContent = Boolean(
    enrichedData.job_title ||
      (Array.isArray(enrichedData.skills) && enrichedData.skills.length > 0) ||
      (Array.isArray(enrichedData.roles) && enrichedData.roles.length > 0)
  );

  return {
    missingFields,
    emptyFields,
    invalidFields,
    hasUsableContent,
    primaryFailure: !hasUsableContent
      ? "no_usable_content"
      : !enrichedData.job_title
        ? "job_title"
        : null,
  };
}

module.exports = {
  buildContentValidationDiagnostics,
};
