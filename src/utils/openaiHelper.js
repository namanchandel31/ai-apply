function safeParseJSON(str) { 
  try { return JSON.parse(str); } catch { return null; } 
}

function extractOpenAIResponse(response) {
  const content = response.output_text?.trim() ||
    response.output
      ?.flatMap((o) => o.content || [])
      ?.find((c) => c.type === "output_text")
      ?.text
      ?.trim();
  
  if (!content || !content.trim()) throw new Error("Empty response");
  let parsed = safeParseJSON(content);
  if (!parsed) {
    const stripped = content.replace(/```json\s*|```\s*/g, '').trim();
    parsed = safeParseJSON(stripped);
  }
  if (!parsed) throw new Error("Invalid JSON response");
  return parsed;
}

module.exports = { safeParseJSON, extractOpenAIResponse };
