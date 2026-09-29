const { z } = require("zod");

const validate =
  (schema, source = "body") =>
  (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    req[source] = result.data;
    return next();
  };

const loginSchema = z.object({
  username: z.string().trim().min(3).max(64),
  password: z.string().min(8).max(128),
});

const createAdminSchema = z.object({
  username: z.string().trim().min(3).max(64),
  password: z.string().min(8).max(128),
});

module.exports = {
  validate,
  loginSchema,
  createAdminSchema,
};
