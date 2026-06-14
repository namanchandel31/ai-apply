function capitalizeWord(word) {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Infer a display name from the email local part (e.g. john.doe → John / Doe).
 */
function deriveNameFromEmail(email) {
  if (!email || typeof email !== "string") {
    return { firstName: null, lastName: null };
  }

  const local = email.split("@")[0]?.trim() || "";
  if (!local) {
    return { firstName: null, lastName: null };
  }

  const parts = local.split(/[._+-]+/).filter(Boolean).map(capitalizeWord);
  if (parts.length >= 2) {
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(" "),
    };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }
  return { firstName: null, lastName: null };
}

function splitFullName(fullName) {
  const trimmed = typeof fullName === "string" ? fullName.trim() : "";
  if (!trimmed) {
    return { firstName: null, lastName: null };
  }
  const spaceIdx = trimmed.indexOf(" ");
  if (spaceIdx === -1) {
    return { firstName: trimmed, lastName: null };
  }
  return {
    firstName: trimmed.slice(0, spaceIdx),
    lastName: trimmed.slice(spaceIdx + 1).trim() || null,
  };
}

function buildFullName(firstName, lastName) {
  const parts = [firstName, lastName]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

module.exports = {
  deriveNameFromEmail,
  splitFullName,
  buildFullName,
  capitalizeWord,
};
