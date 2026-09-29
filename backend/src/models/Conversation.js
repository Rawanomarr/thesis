const mongoose = require("mongoose");

const turnSchema = new mongoose.Schema(
  {
    turnNumber: { type: Number, required: true, min: 1 },
    role: {
      type: String,
      enum: ["participant", "assistant"],
      required: true,
    },
    content: { type: String, required: true },
    inputTokens: { type: Number, default: 0, min: 0 },
    outputTokens: { type: Number, default: 0, min: 0 },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Session",
    required: true,
    unique: true,
    index: true,
  },
  participantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Participant",
    required: true,
    index: true,
  },
  experimentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Experiment",
    required: true,
    index: true,
  },
  turns: { type: [turnSchema], default: [] },
  totalInputTokens: { type: Number, default: 0, min: 0 },
  totalOutputTokens: { type: Number, default: 0, min: 0 },
});

module.exports = mongoose.model("Conversation", conversationSchema);
