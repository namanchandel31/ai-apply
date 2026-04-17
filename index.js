require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { testConnection } = require("./src/db");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const resumeRoutes = require("./src/routes/resumeRoutes");

app.use('/api', resumeRoutes);

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
