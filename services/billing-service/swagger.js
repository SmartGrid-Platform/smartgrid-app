const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "Billing Service API",
    version: "1.0.0",
    description: "Tariffs, recharges, and bill generation microservice API documentation"
  },
  servers: [
    {
      url: "http://localhost:3004",
      description: "Local Development Server"
    }
  ],
  paths: {
    "/api/tariffs": {
      get: {
        summary: "Get all tariffs",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "List of tariffs" }
        }
      },
      post: {
        summary: "Create a new tariff (Admin only)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  tariff_name: { type: "string" },
                  rate_per_unit: { type: "number" },
                  effective_date: { type: "string", format: "date" }
                },
                required: ["tariff_name", "rate_per_unit", "effective_date"]
              }
            }
          }
        },
        responses: {
          201: { description: "Tariff created successfully" },
          403: { description: "Forbidden" }
        }
      }
    },
    "/api/recharges": {
      get: {
        summary: "Get recharge history (Staff/Admin only)",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "Recharge history list" }
        }
      },
      post: {
        summary: "Process a new prepaid balance recharge (Consumer/Staff/Admin)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  consumer_id: { type: "integer" },
                  amount: { type: "number" }
                },
                required: ["consumer_id", "amount"]
              }
            }
          }
        },
        responses: {
          201: { description: "Recharge processed successfully" },
          404: { description: "Consumer not found" }
        }
      }
    },
    "/api/bills": {
      get: {
        summary: "Get all bills",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "List of all bills" }
        }
      }
    },
    "/api/bills/consumer/{consumerId}": {
      get: {
        summary: "Get billing history for a consumer",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "consumerId", in: "path", required: true, schema: { type: "integer" } }
        ],
        responses: {
          200: { description: "Billing history list" }
        }
      }
    },
    "/api/bills/generate": {
      post: {
        summary: "Generate a monthly bill (Staff/Admin only)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  consumerId: { type: "integer" },
                  billingMonth: { type: "string" }
                },
                required: ["consumerId", "billingMonth"]
              }
            }
          }
        },
        responses: {
          201: { description: "Bill generated successfully" },
          400: { description: "Bad request" }
        }
      }
    },
    "/api/bills/{id}/download": {
      get: {
        summary: "Download bill PDF receipt",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } }
        ],
        responses: {
          200: { description: "File download response" }
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
