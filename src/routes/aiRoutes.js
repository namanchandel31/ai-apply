const express = require("express");
const supabaseAuthMiddleware = require("../middlewares/supabaseAuthMiddleware");
const { requireEntitlement } = require("../middlewares/entitlementMiddleware");
const { FEATURE_KEYS } = require("../constants/featureKeys");
const {
  listProvidersController,
  listCredentialsController,
  saveCredentialController,
  testCredentialController,
  reorderChainController,
  patchCredentialController,
  healthCheckCredentialController,
  activateCredentialController,
  deleteCredentialController,
} = require("../controllers/aiCredentialController");
const { listCuratedModelsPublicController } = require("../controllers/modelCertificationController");

const router = express.Router();

router.get("/ai/curated-models", supabaseAuthMiddleware, listCuratedModelsPublicController);
router.get("/ai/providers", supabaseAuthMiddleware, listProvidersController);
router.get("/ai/credentials", supabaseAuthMiddleware, listCredentialsController);
const requireByok = requireEntitlement(FEATURE_KEYS.CAN_USE_BYOK);

router.post("/ai/credentials", supabaseAuthMiddleware, requireByok, saveCredentialController);
router.put("/ai/credentials/chain", supabaseAuthMiddleware, requireByok, reorderChainController);
router.post("/ai/credentials/test", supabaseAuthMiddleware, requireByok, testCredentialController);
router.patch("/ai/credentials/:id", supabaseAuthMiddleware, requireByok, patchCredentialController);
router.post("/ai/credentials/:id/health-check", supabaseAuthMiddleware, requireByok, healthCheckCredentialController);
router.post("/ai/credentials/:id/activate", supabaseAuthMiddleware, requireByok, activateCredentialController);
router.delete("/ai/credentials/:id", supabaseAuthMiddleware, requireByok, deleteCredentialController);

module.exports = router;
