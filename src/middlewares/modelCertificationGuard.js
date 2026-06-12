const modelCertificationConfig = require("../config/modelCertification.config");

function modelCertificationGuard(req, res, next) {
  if (!modelCertificationConfig.isEnabled()) {
    return res.status(404).json({ success: false, error: "Not found" });
  }

  const email = (req.user?.email || "").trim().toLowerCase();
  const admins = modelCertificationConfig.getAdminEmails();

  if (!email || !admins.length || !admins.includes(email)) {
    return res.status(404).json({ success: false, error: "Not found" });
  }

  return next();
}

module.exports = modelCertificationGuard;
