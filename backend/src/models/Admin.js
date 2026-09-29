const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  passwordHash: { type: String, required: true },
  role: {
    type: String,
    enum: ["admin"],
    default: "admin",
  },
  experimentIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Experiment",
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Admin", adminSchema);
