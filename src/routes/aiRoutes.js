const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
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

const router = express.Router();

router.get("/ai/providers", authMiddleware, listProvidersController);
router.get("/ai/credentials", authMiddleware, listCredentialsController);
router.post("/ai/credentials", authMiddleware, saveCredentialController);
router.put("/ai/credentials/chain", authMiddleware, reorderChainController);
router.post("/ai/credentials/test", authMiddleware, testCredentialController);
router.patch("/ai/credentials/:id", authMiddleware, patchCredentialController);
router.post("/ai/credentials/:id/health-check", authMiddleware, healthCheckCredentialController);
router.post("/ai/credentials/:id/activate", authMiddleware, activateCredentialController);
router.delete("/ai/credentials/:id", authMiddleware, deleteCredentialController);

module.exports = router;
