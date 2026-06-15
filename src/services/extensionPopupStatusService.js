const { buildSetupStatus } = require("./setupStatusService");
const { getUserById } = require("../models/userModel");

/**
 * Combined popup payload for extension — setup gating fields + apply mode.
 */
async function buildExtensionPopupStatus(userId) {
  const [setup, user] = await Promise.all([
    buildSetupStatus(userId),
    getUserById(userId),
  ]);

  return {
    setup: {
      hasValidResume: setup.hasValidResume,
      hasEmailSetup: setup.hasEmailSetup,
      hasVerifiedAiCredential: setup.hasVerifiedAiCredential,
    },
    applyMode: user?.apply_mode ?? "review_apply",
  };
}

module.exports = {
  buildExtensionPopupStatus,
};
