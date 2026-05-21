/**
 * Final plain-text sanitation before persist.
 */
function sanitizeEmailOutput({ subject, body }) {
  const clean = (text) => {
    if (!text) return "";
    let t = String(text);
    t = t.replace(/[\u2014\u2013]/g, ", ");
    t = t.replace(/[\u2018\u2019]/g, "'");
    t = t.replace(/[\u201C\u201D]/g, '"');
    t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
    t = t.replace(/\*([^*]+)\*/g, "$1");
    t = t.replace(/`([^`]+)`/g, "$1");
    t = t.replace(/^#+\s+/gm, "");
    t = t.replace(/^>\s+/gm, "");
    t = t.replace(/[ \t]+/g, " ");
    t = t.replace(/\n{3,}/g, "\n\n");
    t = t.replace(/,(\s*,)+/g, ",");
    t = t.replace(/\.\.+/g, ".");
    return t.trim();
  };

  return {
    subject: clean(subject).slice(0, 120),
    body: clean(body),
  };
}

module.exports = { sanitizeEmailOutput };
