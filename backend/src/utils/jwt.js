const jwt = require("jsonwebtoken");

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const ADMIN_TOKEN_TYPE = "admin_access";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
};

const signAdminToken = (admin) => {
  return jwt.sign(
    {
      sub: admin._id.toString(),
      role: "admin",
      typ: ADMIN_TOKEN_TYPE,
      username: admin.username,
    },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN }
  );
};

const verifyToken = (token) => {
  return jwt.verify(token, getJwtSecret());
};

module.exports = {
  signAdminToken,
  verifyToken,
  JWT_EXPIRES_IN,
  ADMIN_TOKEN_TYPE,
};
