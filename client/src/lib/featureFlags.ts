/** When false, skip pricing page and subscription paywall (sign up → onboarding → dashboard). */
export const isPricingEnabled = import.meta.env.VITE_PRICING_ENABLED !== "false";

/**
 * Gmail read tier (gmail.readonly). UI-only gate for showing the future
 * "Read recruiter replies" option. The server independently refuses the read
 * scope unless its own GMAIL_READ_TIER_ENABLED flag is on, so this never grants
 * access by itself. Default off (must opt in via VITE_GMAIL_READ_TIER_ENABLED=true).
 */
export const isGmailReadTierEnabled = import.meta.env.VITE_GMAIL_READ_TIER_ENABLED === "true";
