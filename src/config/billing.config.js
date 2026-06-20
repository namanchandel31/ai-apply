const { int, str } = require("./env");

const currency = (str("RAZORPAY_CURRENCY", "INR") || "INR").toUpperCase();

const plans = Object.freeze({
  byok: Object.freeze({
    id: "byok",
    tier: "byok",
    name: "Bring your own AI",
    amountPaise: int("BILLING_PLAN_BYOK_PAISE", 9900),
    currency,
  }),
  onetap_llm: Object.freeze({
    id: "onetap_llm",
    tier: "onetap_llm",
    name: "OneTap LLM",
    amountPaise: int("BILLING_PLAN_ONETAP_LLM_PAISE", 14900),
    currency,
  }),
});

const razorpayKeyId = str("RAZORPAY_KEY_ID", "");
const razorpayKeySecret = str("RAZORPAY_KEY_SECRET", "");

module.exports = Object.freeze({
  razorpayKeyId,
  razorpayKeySecret,
  currency,
  plans,
  isEnabled: Boolean(razorpayKeyId && razorpayKeySecret),
});
