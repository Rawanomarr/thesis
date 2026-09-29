const crypto = require("crypto");

const createToken = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");

const createPseudoId = () => `p_${crypto.randomBytes(6).toString("hex")}`;

module.exports = {
  createToken,
  createPseudoId,
};
