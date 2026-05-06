require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { testConnection } = require("./src/db");

// Fail-fast check for JWT_SECRET
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET missing from environment variables");
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require("./src/routes/authRoutes");
const resumeRoutes = require("./src/routes/resumeRoutes");
const jdRoutes = require("./src/routes/jdRoutes");
const applyRoutes = require("./src/routes/applyRoutes");
const credentialRoutes = require("./src/routes/credentialRoutes");
const sendRoutes = require("./src/routes/sendRoutes");

const rateLimit = require("express-rate-limit");
const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later',
    });
  },
});

app.use('/api', globalApiLimiter);
app.use('/auth', authRoutes);
app.use('/api', resumeRoutes);
app.use('/api', jdRoutes);
app.use('/api/apply', applyRoutes);
app.use('/api', credentialRoutes);
app.use('/api', sendRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Global error handler — catch-all for unhandled errors
app.use((err, req, res, next) => {
  const reqId = req.requestId || 'NO_REQ_ID';
  console.error(`[${reqId}] [UNHANDLED_ERROR]`, err.message || err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
});

if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await testConnection();
  });
}

module.exports = app;
