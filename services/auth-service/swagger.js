const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "Auth Service API",
    version: "1.0.0",
    description: "Authentication and User Management microservice API documentation"
  },
  servers: [
    {
      url: "http://localhost:3001",
      description: "Local Development Server"
    }
  ],
  paths: {
    "/api/auth/register": {
      post: {
        summary: "Register a new user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                  password: { type: "string" },
                  role: { type: "string", enum: ["CONSUMER", "STAFF", "ADMIN"] },
                  address: { type: "string" },
                  phone: { type: "string" }
                },
                required: ["name", "email", "password"]
              }
            }
          }
        },
        responses: {
          201: { description: "User registered successfully" },
          400: { description: "Bad request" },
          500: { description: "Internal server error" }
        }
      }
    },
    "/api/auth/login": {
      post: {
        summary: "Login user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string" },
                  password: { type: "string" }
                },
                required: ["email", "password"]
              }
            }
          }
        },
        responses: {
          200: { description: "Login successful with token" },
          401: { description: "Invalid credentials" },
          500: { description: "Internal server error" }
        }
      }
    },
    "/api/auth/profile": {
      get: {
        summary: "Get current user profile",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "User profile details" },
          401: { description: "Unauthorized" }
        }
      }
    },
    "/api/auth/users": {
      get: {
        summary: "Get list of all users (Admin only)",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "List of users" },
          403: { description: "Forbidden" }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    }
  }
};

module.exports = swaggerDocument;
