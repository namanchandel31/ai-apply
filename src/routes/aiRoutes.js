const express = require("express");
const supabaseAuthMiddleware = require("../middlewares/supabaseAuthMiddleware");
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
router.post("/ai/credentials", supabaseAuthMiddleware, saveCredentialController);
router.put("/ai/credentials/chain", supabaseAuthMiddleware, reorderChainController);
router.post("/ai/credentials/test", supabaseAuthMiddleware, testCredentialController);
router.patch("/ai/credentials/:id", supabaseAuthMiddleware, patchCredentialController);
router.post("/ai/credentials/:id/health-check", supabaseAuthMiddleware, healthCheckCredentialController);
router.post("/ai/credentials/:id/activate", supabaseAuthMiddleware, activateCredentialController);
router.delete("/ai/credentials/:id", supabaseAuthMiddleware, deleteCredentialController);

module.exports = router;
