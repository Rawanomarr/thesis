require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
require("./models");
const apiRoutes = require("./routes");
const errorHandler = require("./middleware/errorHandler");
const { LlmAdapterError } = require("./services/llm");
const { setupSwagger } = require("./config/swaggerSetup");

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((origin) => origin.trim())
  : true;

// Swagger UI needs relaxed CSP; keep other Helmet defaults
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

setupSwagger(app);

app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, try again later" },
  })
);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

app.use("/api", apiRoutes);

app.use((err, req, res, next) => {
  if (err instanceof LlmAdapterError) {
    return res.status(err.status || 502).json({
      message: err.message,
      code: err.code,
    });
  }
  return next(err);
});

app.use(errorHandler);

const startServer = async () => {
  await connectDB();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
  });
};

startServer();
