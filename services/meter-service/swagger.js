const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "Meter Service API",
    version: "1.0.0",
    description: "Meter tracking and reading upload microservice API documentation"
  },
  servers: [
    {
      url: "http://localhost:3003",
      description: "Local Development Server"
    }
  ],
  paths: {
    "/api/meters": {
      get: {
        summary: "Get list of all meters",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "List of meters" },
          403: { description: "Forbidden" }
        }
      },
      post: {
        summary: "Create a new meter (Staff/Admin only)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  meter_number: { type: "string" }
                },
                required: ["meter_number"]
              }
            }
          }
        },
        responses: {
          201: { description: "Meter created successfully" },
          400: { description: "Bad request" }
        }
      }
    },
    "/api/meters/{id}": {
      get: {
        summary: "Get specific meter details",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } }
        ],
        responses: {
          200: { description: "Meter details" },
          404: { description: "Meter not found" }
        }
      },
      put: {
        summary: "Update meter status/tamper (Staff/Supervisor/Admin only)",
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
                  status: { type: "string", enum: ["ACTIVE", "INACTIVE", "TAMPERED"] }
                },
                required: ["status"]
              }
            }
          }
        },
        responses: {
          200: { description: "Meter updated successfully" },
          404: { description: "Meter not found" }
        }
      }
    },
    "/api/meters/{id}/readings": {
      get: {
        summary: "Get readings for a specific meter",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } }
        ],
        responses: {
          200: { description: "List of meter readings" }
        }
      },
      post: {
        summary: "Add a new reading to a meter and deduct cost",
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
                  units_consumed: { type: "number" }
                },
                required: ["units_consumed"]
              }
            }
          }
        },
        responses: {
          201: { description: "Reading saved and balance updated" },
          404: { description: "Meter or consumer not found" }
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
