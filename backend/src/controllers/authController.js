const bcrypt = require("bcryptjs");
const { Admin } = require("../models");
const { signAdminToken } = require("../utils/jwt");

const SALT_ROUNDS = 12;

const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username: username.toLowerCase() });

    // Same message whether user missing or wrong password (no account enumeration)
    if (!admin || admin.role !== "admin") {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const matches = await bcrypt.compare(password, admin.passwordHash);

    if (!matches) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signAdminToken(admin);

    return res.json({
      token,
      tokenType: "Bearer",
      admin: {
        id: admin._id,
        username: admin.username,
        role: admin.role,
        experimentIds: admin.experimentIds,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const me = async (req, res) => {
  return res.json({
    admin: {
      id: req.admin._id,
      username: req.admin.username,
      role: req.admin.role,
      experimentIds: req.admin.experimentIds,
    },
  });
};

/**
 * Bootstrap: create the first admin only when the collection is empty.
 * Disabled in production unless ALLOW_ADMIN_BOOTSTRAP=true.
 */
const bootstrapAdmin = async (req, res, next) => {
  try {
    const bootstrapAllowed =
      process.env.NODE_ENV !== "production" ||
      process.env.ALLOW_ADMIN_BOOTSTRAP === "true";

    if (!bootstrapAllowed) {
      return res.status(403).json({
        message: "Admin bootstrap is disabled",
        code: "BOOTSTRAP_DISABLED",
      });
    }

    const existingCount = await Admin.countDocuments();

    if (existingCount > 0) {
      return res.status(403).json({
        message: "Bootstrap disabled — an admin already exists",
        code: "BOOTSTRAP_DISABLED",
      });
    }

    const { username, password } = req.body;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const admin = await Admin.create({
      username: username.toLowerCase(),
      passwordHash,
      role: "admin",
      experimentIds: [],
    });

    const token = signAdminToken(admin);

    return res.status(201).json({
      token,
      tokenType: "Bearer",
      admin: {
        id: admin._id,
        username: admin.username,
        role: admin.role,
        experimentIds: admin.experimentIds,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  login,
  me,
  bootstrapAdmin,
  SALT_ROUNDS,
};
