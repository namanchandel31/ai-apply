/** Copy aligned with client/src/lib/applyMode.ts */

export function isAutoApplyMode(applyMode) {
  return applyMode === "auto_apply";
}

export function autoApplyToggleDescription(enabled) {
  return enabled
    ? "OneTap sends applications automatically from your Gmail."
    : "Review each email in Applications before sending from your Gmail.";
}

export function linkedInButtonTitle(autoApply) {
  return autoApply
    ? "Add to OneTap — sends automatically"
    : "Add to OneTap — review before sending";
}

export function linkedInSuccessLabel(autoApply) {
  return autoApply ? "Sending" : "Review";
}

export function linkedInSuccessTitle(autoApply) {
  return autoApply
    ? "Queued — email will send automatically"
    : "Queued — review in OneTap Applications";
}

export function setupIssuesFromStatus(setup) {
  if (!setup) return [{ label: "Complete setup", path: "/setup" }];
  const issues = [];
  if (!setup.hasValidResume) {
    issues.push({ label: "Upload resume", path: "/setup" });
  }
  if (!setup.hasEmailSetup) {
    issues.push({ label: "Connect Gmail", path: "/setup" });
  }
  if (!setup.hasVerifiedAiCredential) {
    issues.push({ label: "Configure AI", path: "/setup" });
  }
  return issues;
}

export function isSetupCompleteFromStatus(setup) {
  return Boolean(
    setup?.hasValidResume && setup?.hasEmailSetup && setup?.hasVerifiedAiCredential
  );
}

export function friendlyApplyError(message) {
  const text = String(message || "Something went wrong");
  if (/rate limit/i.test(text)) {
    return "Too many requests — wait a minute and try again.";
  }
  if (/quota|credit|limit exceeded/i.test(text)) {
    return "Application limit reached — upgrade or wait for your quota to reset.";
  }
  if (/not connected|401|unauthorized/i.test(text)) {
    return "Session expired — reconnect in OneTap Settings.";
  }
  if (/setup|resume|email|credential/i.test(text)) {
    return "Finish setup on the OneTap dashboard first.";
  }
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}
