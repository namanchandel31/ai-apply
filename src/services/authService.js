const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");

const JWT_SECRET = process.env.JWT_SECRET;

async function signup(email, password) {
  const hash = await bcrypt.hash(password, 10);

  const result = await pool.query(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING id, email`,
    [email, hash]
  );

  return result.rows[0];
}

async function login(email, password) {
  const result = await pool.query(
    `SELECT * FROM users WHERE email = $1`,
    [email]
  );

  if (result.rows.length === 0) {
    throw new Error("Invalid credentials");
  }

  const user = result.rows[0];

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) throw new Error("Invalid credentials");

  // NOTE: JWT tokens are stateless.
  // No revocation mechanism yet.
  // Replay is possible until expiry.
  // Future: implement token blacklist or session store.
  // TODO: Rotate JWT_SECRET periodically
  
  const token = jwt.sign(
    { userId: user.id }, // Keep payload minimal (userId only)
    JWT_SECRET,
    { 
      expiresIn: "7d",
      issuer: "ai-apply",
      audience: "ai-apply-users"
    }
  );

  return {
    token,
    user: { id: user.id, email: user.email }
  };
}

module.exports = { signup, login };
