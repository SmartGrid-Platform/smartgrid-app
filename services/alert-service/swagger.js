const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "Alert Service API",
    version: "1.0.0",
    description: "Notifications and physical meter inspections microservice API documentation"
  },
  servers: [
    {
      url: "http://localhost:3005",
      description: "Local Development Server"
    }
  ],
  paths: {
    "/api/alerts": {
      get: {
        summary: "Get all notifications (Staff/Supervisor/Admin only)",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "List of notifications" }
        }
      },
      post: {
        summary: "Create and send a notification",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  user_id: { type: "integer" },
                  title: { type: "string" },
                  message: { type: "string" },
                  type: { type: "string", enum: ["LOW_BALANCE", "TAMPER", "RECHARGE", "BILL", "SYSTEM", "INSPECTION"] }
                },
                required: ["user_id", "title", "message", "type"]
              }
            }
          }
        },
        responses: {
          201: { description: "Notification sent successfully" }
        }
      }
    },
    "/api/alerts/user/{userId}": {
      get: {
        summary: "Get notifications list for a specific user",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "userId", in: "path", required: true, schema: { type: "integer" } }
        ],
        responses: {
          200: { description: "User notifications" }
        }
      }
    },
    "/api/inspections": {
      get: {
        summary: "Get all physical inspections",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "List of inspections" }
        }
      },
      post: {
        summary: "Create a manual inspection request (Staff/Supervisor/Admin only)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  consumer_id: { type: "integer" },
                  reason: { type: "string" },
                  assigned_to: { type: "integer" }
                },
                required: ["consumer_id", "reason"]
              }
            }
          }
        },
        responses: {
          201: { description: "Inspection created successfully" }
        }
      }
    },
    "/api/inspections/{id}": {
      put: {
        summary: "Update inspection status or assignment",
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
                  status: { type: "string", enum: ["PENDING", "COMPLETED", "CANCELLED"] },
                  assigned_to: { type: "integer" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Inspection updated successfully" }
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
