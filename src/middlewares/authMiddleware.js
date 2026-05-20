const jwt = require("jsonwebtoken");

const { auth } = require("../config");
const JWT_SECRET = auth.jwtSecret;

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  // Strict header validation - must start with "Bearer "
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ 
      success: false,
      error: "Unauthorized",
      code: "UNAUTHORIZED"
    });
  }

  const token = header.split(" ")[1];
  if (!token) {
    return res.status(401).json({ 
      success: false,
      error: "Unauthorized",
      code: "UNAUTHORIZED"
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: "ai-apply",
      audience: "ai-apply-users",
      clockTolerance: 5 // 5 seconds tolerance for clock skew
    });
    req.user = { id: decoded.userId };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ 
        success: false,
        error: "Token expired",
        code: "TOKEN_EXPIRED"
      });
    }
    return res.status(401).json({ 
      success: false,
      error: "Unauthorized",
      code: "UNAUTHORIZED"
    });
  }
}

module.exports = authMiddleware;
