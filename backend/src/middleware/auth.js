const { Admin } = require("../models");
const { verifyToken, ADMIN_TOKEN_TYPE } = require("../utils/jwt");

/**
 * Admin-only gate. Rejects:
 * - missing / non-Bearer Authorization
 * - participant tokens (X-Participant-Token alone)
 * - JWTs that are not typ=admin_access + role=admin
 * - deleted / non-admin accounts
 */
const protectAdmin = async (req, res, next) => {
  try {
    // Participant study tokens must never unlock admin APIs
    if (req.headers["x-participant-token"] && !req.headers.authorization) {
      return res.status(403).json({
        message: "Forbidden — admin authentication required",
        code: "ADMIN_ONLY",
      });
    }

    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Admin authentication required",
        code: "ADMIN_AUTH_REQUIRED",
      });
    }

    const token = header.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        message: "Admin authentication required",
        code: "ADMIN_AUTH_REQUIRED",
      });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({
        message: "Invalid or expired admin token",
        code: "ADMIN_TOKEN_INVALID",
      });
    }

    if (payload.typ !== ADMIN_TOKEN_TYPE || payload.role !== "admin") {
      return res.status(403).json({
        message: "Forbidden — admin role required",
        code: "ADMIN_ONLY",
      });
    }

    const admin = await Admin.findById(payload.sub).select("-passwordHash");

    if (!admin || admin.role !== "admin") {
      return res.status(403).json({
        message: "Forbidden — admin account not found",
        code: "ADMIN_ONLY",
      });
    }

    req.admin = admin;
    return next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired admin token",
      code: "ADMIN_TOKEN_INVALID",
    });
  }
};

const requireExperimentAccess = (req, res, next) => {
  const experimentId = req.params.experimentId || req.body.experimentId;

  if (!experimentId) {
    return res.status(400).json({ message: "experimentId is required" });
  }

  const allowed = req.admin.experimentIds.some(
    (id) => id.toString() === experimentId.toString()
  );

  if (!allowed) {
    return res.status(403).json({
      message: "Access denied for this experiment",
      code: "EXPERIMENT_FORBIDDEN",
    });
  }

  return next();
};

module.exports = {
  protectAdmin,
  requireExperimentAccess,
};
