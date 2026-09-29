const swaggerUi = require("swagger-ui-express");
const swaggerDefinition = require("./swagger");

const swaggerUiOptions = {
  explorer: true,
  customSiteTitle: "LLM Benchmarking API Docs",
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    tryItOutEnabled: true,
    filter: true,
  },
};

/**
 * Mount Swagger UI at /api-docs (and raw JSON at /api-docs.json).
 */
const setupSwagger = (app) => {
  app.get("/api-docs.json", (req, res) => {
    res.json(swaggerDefinition);
  });

  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerDefinition, swaggerUiOptions)
  );
};

module.exports = { setupSwagger, swaggerDefinition };
