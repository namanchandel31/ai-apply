"use strict";

const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi    = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",

    info: {
      title:       "AI Apply API",
      version:     "1.0.0",
      description: "Automated job application backend — resume upload, JD parsing, and email dispatch.",
    },

    // ── Multi-server config ─────────────────────────────────────────────────
    servers: [
      { url: "http://localhost:5000",      description: "Local Development" },
      { url: "https://api.yourdomain.com", description: "Production"        },
    ],

    // ── Global tag definitions — controls Swagger UI grouping order ─────────
    tags: [
      { name: "Auth",         description: "Supabase Google OAuth (Bearer access token)" },
      { name: "Upload",       description: "Resume and job description ingestion"       },
      { name: "Applications", description: "Apply and send application emails"          },
      { name: "AutoApply",    description: "One-click automated job applications"       },
      { name: "User",         description: "User profile and defaults"                  },
      { name: "Credentials",  description: "Manage SMTP email credentials"              },
      { name: "System",       description: "Health and infrastructure endpoints"        },
    ],

    // ── Global security — bearerAuth applied to ALL endpoints by default ────
    // Public endpoints (/health) override with: security: []
    security: [
      { bearerAuth: [] },
    ],

    components: {

      // ── Security schemes ──────────────────────────────────────────────────
      securitySchemes: {
        bearerAuth: {
          type:         "http",
          scheme:       "bearer",
          bearerFormat: "JWT",
          description:  "Supabase session access_token (Google OAuth)",
        },
      },

      // ── Reusable request/response schemas ─────────────────────────────────
      schemas: {

        // ── Auth ──────────────────────────────────────────────────────────
        SignupRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email:    { type: "string", format: "email", example: "user@example.com" },
            password: { type: "string", minLength: 8,    example: "SecurePass123"    },
          },
        },

        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email:    { type: "string", format: "email", example: "user@example.com" },
            password: { type: "string",                  example: "SecurePass123"    },
          },
        },

        LoginResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            token:   { type: "string",  example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJpYXQiOjE3MDAwMDAwMDB9.signature" },
            user: {
              type: "object",
              properties: {
                id:    { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                email: { type: "string", example: "user@example.com"                      },
              },
            },
          },
        },

        // ── Upload ────────────────────────────────────────────────────────
        ResumeUploadResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                resumeId:   { type: "string", example: "550e8400-e29b-41d4-a716-446655440001" },
                fileUrl:    { type: "string", example: "https://storage.example.com/resumes/550e8400-e29b-41d4-a716-446655440001.pdf" },
                parsedData: {
                  type: "object",
                  description: "Structured data extracted from the resume by the LLM pipeline",
                },
              },
            },
          },
        },

        JDUploadResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                jdId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440002" },
                parsedData: {
                  type: "object",
                  description: "Structured data extracted from the job description by the LLM pipeline",
                },
              },
            },
          },
        },

        // ── Apply ─────────────────────────────────────────────────────────
        ApplyRequest: {
          type: "object",
          required: ["jdId", "resumeId", "credentialId"],
          properties: {
            jdId:         { type: "string", example: "550e8400-e29b-41d4-a716-446655440002" },
            resumeId:     { type: "string", example: "550e8400-e29b-41d4-a716-446655440001" },
            credentialId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440003" },
          },
        },

        ApplyResponse: {
          type: "object",
          properties: {
            success:       { type: "boolean", example: true                                        },
            applicationId: { type: "string",  example: "550e8400-e29b-41d4-a716-446655440004"      },
            status:        { type: "string",  example: "queued"                                    },
          },
        },

        SendResponse: {
          type: "object",
          properties: {
            success:       { type: "boolean", example: true                                        },
            applicationId: { type: "string",  example: "550e8400-e29b-41d4-a716-446655440004"      },
            status:        { type: "string",  example: "sent"                                      },
          },
        },

        // ── Credentials ───────────────────────────────────────────────────
        CredentialRequest: {
          type: "object",
          required: ["email", "password", "provider"],
          properties: {
            email:    { type: "string", format: "email",                    example: "sender@gmail.com"      },
            password: { type: "string",                                      example: "app-specific-password" },
            provider: { type: "string", enum: ["gmail", "outlook"],          example: "gmail"                 },
          },
        },

        // ── Shared ────────────────────────────────────────────────────────
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                code:    { type: "string", example: "INVALID_TOKEN"     },
                message: { type: "string", example: "Token has expired" },
              },
            },
          },
        },
      },

      // ── Reusable responses ────────────────────────────────────────────────
      responses: {
        Unauthorized: {
          description: "Missing or invalid JWT token",
          content: {
            "application/json": {
              schema:  { $ref: "#/components/schemas/ErrorResponse" },
              example: { success: false, error: { code: "MISSING_TOKEN", message: "Authorization header required" } },
            },
          },
        },

        Forbidden: {
          description: "Access denied — resource belongs to another user",
          content: {
            "application/json": {
              schema:  { $ref: "#/components/schemas/ErrorResponse" },
              example: { success: false, error: { code: "FORBIDDEN", message: "You do not own this resource" } },
            },
          },
        },

        ValidationError: {
          description: "Request body failed schema validation",
          content: {
            "application/json": {
              schema:  { $ref: "#/components/schemas/ErrorResponse" },
              example: { success: false, error: { code: "VALIDATION_ERROR", message: "email is required" } },
            },
          },
        },

        InternalServerError: {
          description: "Unexpected server error",
          content: {
            "application/json": {
              schema:  { $ref: "#/components/schemas/ErrorResponse" },
              example: { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
            },
          },
        },
      },
    },
  },

  // Scan all route files for @openapi JSDoc blocks
  apis: ["./src/routes/*.js", "./index.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = { swaggerSpec, swaggerUi };
