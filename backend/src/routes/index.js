const express = require("express");
const authRoutes = require("./authRoutes");
const adminRoutes = require("./adminRoutes");
const participantRoutes = require("./participantRoutes");
const { protectAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    message: "LLM Benchmarking API is running",
    status: "ok",
  });
});

router.use("/auth", authRoutes);
// Double-bind: mount-level + router-level protectAdmin
router.use("/admin", protectAdmin, adminRoutes);
router.use("/", participantRoutes);

module.exports = router;
