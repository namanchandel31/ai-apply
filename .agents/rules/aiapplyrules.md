---
trigger: always_on
---

You are a senior backend engineer building a production-grade Node.js service.

Your task is to implement a robust "Job Description Parser Service" using OpenAI.

This is NOT a demo script. It must be reliable, fault-tolerant, and production-ready.

---

## Requirements

### 1. OpenAI API Usage

* Use the **Responses API** (NOT chat.completions).
* Model: "gpt-4.1-mini"
* Use: `response_format: { type: "json_object" }` to enforce valid JSON output.
* Temperature must be 0.

---

### 2. Function Contract

Implement:

```js
async function parseJobDescription(rawText)
```

Validation:

* Throw error if rawText is missing, not a string, or empty.

---

### 3. Output Structure (STRICT)

The model MUST return:

{
"job_title": "string or null",
"company_name": "string or null",
"contact_person": "string or null",
"location": "string or null",
"contact_email": "string or null",
"contact_number": "string or null",
"job_type": "Remote | Hybrid | Onsite | Unknown | null",
"skills": ["array", "of", "strings"]
}

---

### 4. System Prompt (IMPORTANT)

Use a strict extraction prompt with rules:

* Return ONLY valid JSON
* No markdown or explanations
* Do NOT hallucinate missing data
* Only extract what is explicitly present or highly certain
* If unknown → null
* job_type must be one of: Remote, Hybrid, Onsite, Unknown, or null

---

### 5. Retry Logic (MANDATORY)

* Implement retry mechanism (2–3 retries)
* Retry ONLY if:

  * JSON parsing fails
  * OpenAI response is empty or malformed

---

### 6. JSON Parsing Safety

* Safely extract response text
* Attempt JSON.parse
* If fails → retry
* Final failure → throw meaningful error

---

### 7. Schema Validation (CRITICAL)

Use **Zod** to validate output:

* Enforce all fields exist
* Enforce job_type enum
* Ensure skills is array of strings
* Allow nullable fields where required

Reject invalid AI output.

---

### 8. Skills Normalization

After validation:

* Convert all skills to lowercase
* Trim whitespace
* Remove duplicates

---

### 9. Code Quality

* Use clean modular structure
* No hardcoded values except model name
* Proper error messages
* Export function cleanly
* Use async/await properly

---

### 10. Dependencies

Use:

* openai
* zod
* dotenv (optional for env handling)

---

### 11. Output

Return ONLY the final JavaScript code.
Do NOT explain anything.
Do NOT include markdown formatting.
-----------------------------------

Your goal:
Write code that does not break in real-world usage, not a toy example.
