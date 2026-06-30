const { pool } = require("../db");
const {
  captureBusiness,
  captureProduct,
  captureOperational,
  identifyUser,
} = require("./posthog");

const LIFECYCLE = {
  ANONYMOUS: "anonymous",
  NEW: "new",
  ONBOARDING: "onboarding",
  ACTIVATED: "activated",
  SUBSCRIBER: "subscriber",
  INACTIVE: "inactive",
};

function setLifecycle(userId, stage, extra = {}) {
  identifyUser(userId, { current_lifecycle_stage: stage, ...extra });
}

async function countSentApplications(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM applications WHERE user_id = $1 AND application_status = 'sent'`,
    [userId]
  );
  return rows[0]?.c ?? 0;
}

function trackUserSignedUp(userId, properties = {}) {
  const now = new Date().toISOString();
  const signupSource = properties.referral_code ? "referral" : properties.utm_source ? "utm" : "organic";
  captureBusiness(userId, "user_signed_up", { signup_source: signupSource, ...properties }, 1);
  setLifecycle(userId, LIFECYCLE.NEW, {
    signup_date: now,
    signup_source: signupSource,
    utm_source: properties.utm_source,
    utm_medium: properties.utm_medium,
    utm_campaign: properties.utm_campaign,
    referral_code: properties.referral_code,
  });
}

function trackOnboardingCompleted(userId, properties = {}) {
  captureBusiness(userId, "onboarding_completed", properties, 1);
  identifyUser(userId, {
    current_lifecycle_stage: LIFECYCLE.ONBOARDING,
    onboarding_completed_at: new Date().toISOString(),
    email_skipped: properties.email_skipped,
    extension_skipped: properties.extension_skipped,
  });
}

const onboardingCompletedOnce = new Set();

function trackOnboardingCompletedOnce(userId, properties = {}) {
  if (onboardingCompletedOnce.has(userId)) return;
  onboardingCompletedOnce.add(userId);
  trackOnboardingCompleted(userId, properties);
}

function trackResumeUploaded(userId, properties = {}) {
  captureProduct(userId, "resume_uploaded", properties);
  identifyUser(userId, { resume_uploaded: true, resume_adoption_stage: "uploaded" });
}

function trackResumeParsed(userId, properties = {}) {
  captureProduct(userId, "resume_parsed", properties);
  identifyUser(userId, { resume_adoption_stage: "parsed" });
}

function trackGmailConnected(userId, properties = {}) {
  captureProduct(userId, "gmail_connected", properties);
  identifyUser(userId, { gmail_connected: true, gmail_adoption_stage: "connected" });
}

function trackExtensionConnected(userId, properties = {}) {
  captureProduct(userId, "extension_connected", properties);
  identifyUser(userId, { extension_connected: true, extension_adoption_stage: "connected" });
}

function trackAiConfigured(userId, properties = {}) {
  captureProduct(userId, "ai_configured", properties);
  identifyUser(userId, { ai_configured: true, ai_adoption_stage: "configured" });
}

function trackSetupReady(userId, properties = {}) {
  captureProduct(userId, "setup_ready", properties);
}

function trackApplicationStarted(userId, properties = {}) {
  captureProduct(userId, "application_started", properties);
}

async function trackApplicationSent(userId, properties = {}) {
  const sentCount = await countSentApplications(userId);
  const isFirstSend = sentCount <= 1;

  captureBusiness(
    userId,
    "application_sent",
    { ...properties, is_first_send: isFirstSend },
    1
  );

  identifyUser(userId, {
    applications_sent_count: sentCount,
    last_active_at: new Date().toISOString(),
  });

  if (isFirstSend) {
    const activationDate = new Date().toISOString();
    captureBusiness(
      userId,
      "user_activated",
      {
        ...properties,
        activation_date: activationDate,
        time_to_activate_ms: properties.time_to_activate_ms,
      },
      1
    );
    setLifecycle(userId, LIFECYCLE.ACTIVATED, { activation_date: activationDate });

    if (properties.source_platform === "extension") {
      identifyUser(userId, { extension_adoption_stage: "used_once" });
    }
    identifyUser(userId, { gmail_adoption_stage: "first_send_via_gmail" });
  }
}

function trackApplicationStatusTransition(userId, fromStatus, toStatus, properties = {}) {
  if (toStatus === "sent") return;

  const eventByStatus = {
    draft: "application_created",
    generated: "application_generated",
    needs_review: "application_needs_review",
    failed: "application_failed",
    cancelled: "application_cancelled",
  };
  const event = eventByStatus[toStatus];
  if (!event) return;

  const payload = { from_status: fromStatus, to_status: toStatus, ...properties };
  if (toStatus === "failed") {
    captureOperational(userId, event, payload);
  } else {
    captureProduct(userId, event, payload);
  }
}

function trackSubscriptionActivated(userId, properties = {}) {
  captureBusiness(userId, "subscription_activated", properties, 1);
  setLifecycle(userId, LIFECYCLE.SUBSCRIBER, {
    subscription_date: new Date().toISOString(),
    subscription_tier: properties.plan_id || properties.subscription_tier,
    plan_id: properties.plan_id,
  });
}

function trackCheckoutCompleted(userId, properties = {}) {
  captureBusiness(userId, "checkout_completed", properties, 1);
}

function trackTrialStarted(userId, properties = {}) {
  captureBusiness(userId, "trial_started", properties, 1);
}

function trackSubscriptionCancelled(userId, properties = {}) {
  captureBusiness(userId, "subscription_cancelled", properties, 1);
}

function trackAiRequest(userId, eventName, properties = {}) {
  captureOperational(userId, eventName, properties);
}

function trackApiError(userId, properties = {}) {
  captureOperational(userId || "anonymous", "api_error", properties);
}

module.exports = {
  LIFECYCLE,
  trackUserSignedUp,
  trackOnboardingCompleted,
  trackOnboardingCompletedOnce,
  trackResumeUploaded,
  trackResumeParsed,
  trackGmailConnected,
  trackExtensionConnected,
  trackAiConfigured,
  trackSetupReady,
  trackApplicationStarted,
  trackApplicationSent,
  trackApplicationStatusTransition,
  trackSubscriptionActivated,
  trackCheckoutCompleted,
  trackTrialStarted,
  trackSubscriptionCancelled,
  trackAiRequest,
  trackApiError,
  setLifecycle,
  identifyUser,
};
