const express = require("express");
const multer = require("multer");
const supabaseAuthMiddleware = require("../middlewares/supabaseAuthMiddleware");
const adminGuard = require("../middlewares/adminGuard");
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

// Scope auth/guard to dev certification paths only — a router-level use() would
// intercept every unmatched /api request and return a misleading 404 "Not found".
const devRouter = express.Router();
devRouter.use(supabaseAuthMiddleware, adminGuard);
devRouter.post("/run", upload.single("resume"), runCertificationController);
devRouter.get("/runs", listRunsController);
devRouter.get("/curated", listCuratedAdminController);
devRouter.post("/curated/promote", promoteCuratedController);
devRouter.patch("/curated/:id", patchCuratedController);
devRouter.delete("/curated/:id", deleteCuratedController);

router.use("/dev/model-certification", devRouter);

module.exports = router;
