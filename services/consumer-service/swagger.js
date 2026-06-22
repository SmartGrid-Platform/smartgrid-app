const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "Consumer Service API",
    version: "1.0.0",
    description: "Consumer profile and meter assignment microservice API documentation"
  },
  servers: [
    {
      url: "http://localhost:3002",
      description: "Local Development Server"
    }
  ],
  paths: {
    "/api/consumers": {
      get: {
        summary: "Get list of all consumers (Staff/Supervisor/Admin only)",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "List of consumers retrieved successfully" },
          403: { description: "Forbidden" }
        }
      }
    },
    "/api/consumers/me": {
      get: {
        summary: "Get logged-in consumer profile details",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "Consumer details retrieved successfully" },
          401: { description: "Unauthorized" }
        }
      }
    },
    "/api/consumers/{id}": {
      get: {
        summary: "Get specific consumer details",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } }
        ],
        responses: {
          200: { description: "Consumer details" },
          404: { description: "Consumer not found" }
        }
      },
      put: {
        summary: "Update consumer profile (Address, Phone)",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  address: { type: "string" },
                  phone: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Consumer updated successfully" },
          403: { description: "Forbidden" }
        }
      }
    },
    "/api/consumers/assign-meter": {
      post: {
        summary: "Assign a meter to a consumer (Staff/Admin only)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  consumerId: { type: "integer" },
                  meterId: { type: "integer" },
                  installationDate: { type: "string", format: "date" }
                },
                required: ["consumerId", "meterId"]
              }
            }
          }
        },
        responses: {
          200: { description: "Meter assigned successfully" },
          400: { description: "Bad request" },
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
