const express = require("express");
const multer = require("multer");
const supabaseAuthMiddleware = require("../middlewares/supabaseAuthMiddleware");
const modelCertificationGuard = require("../middlewares/modelCertificationGuard");
const {
  runCertificationController,
  listRunsController,
  listCuratedAdminController,
  promoteCuratedController,
  patchCuratedController,
  deleteCuratedController,
} = require("../controllers/modelCertificationController");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = express.Router();

router.use(supabaseAuthMiddleware, modelCertificationGuard);

router.post(
  "/dev/model-certification/run",
  upload.single("resume"),
  runCertificationController
);
router.get("/dev/model-certification/runs", listRunsController);
router.get("/dev/model-certification/curated", listCuratedAdminController);
router.post("/dev/model-certification/curated/promote", promoteCuratedController);
router.patch("/dev/model-certification/curated/:id", patchCuratedController);
router.delete("/dev/model-certification/curated/:id", deleteCuratedController);

module.exports = router;
