const express = require("express");
const router = express.Router();
const { processApplication } = require("../controllers/applyController");

router.post("/", processApplication);

module.exports = router;
