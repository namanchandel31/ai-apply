const express = require("express");
const router = express.Router();
const controller = require("../controllers/authController");

/**
 * @openapi
 * /auth/signup:
 *   post:
 *     operationId: signupUser
 *     tags: [Auth]
 *     summary: Register a new user account
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignupRequest'
 *           example:
 *             email: "newuser@example.com"
 *             password: "SecurePass123"
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Account created"
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error:
 *                 code: "DUPLICATE_EMAIL"
 *                 message: "An account with this email already exists"
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post("/signup", controller.signup);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     operationId: loginUser
 *     tags: [Auth]
 *     summary: Login and receive a JWT
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           example:
 *             email: "user@example.com"
 *             password: "SecurePass123"
 *     responses:
 *       200:
 *         description: JWT returned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *             example:
 *               success: true
 *               token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJpYXQiOjE3MDAwMDAwMDB9.signature"
 *               user:
 *                 id: "550e8400-e29b-41d4-a716-446655440000"
 *                 email: "user@example.com"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post("/login", controller.login);

module.exports = router;
