const express = require("express");
const rateLimit = require("express-rate-limit");
const { login, me, bootstrapAdmin } = require("../controllers/authController");
const { protectAdmin } = require("../middleware/auth");
const {
  validate,
  loginSchema,
  createAdminSchema,
} = require("../utils/validate");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many auth attempts, try again later" },
});

router.post("/login", authLimiter, validate(loginSchema), login);
router.post(
  "/bootstrap",
  authLimiter,
  validate(createAdminSchema),
  bootstrapAdmin
);
router.get("/me", protectAdmin, me);

module.exports = router;
